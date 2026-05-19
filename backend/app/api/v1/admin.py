import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.deps import get_db, require_min_role, get_current_user
from app.core.security import hash_password
from app.models.board import Board, Post
from app.models.codetest import Submission
from app.models.comment import Comment
from app.models.report import Report, ReportStatus
from app.models.user import User
from app.schemas.user import UserAdminListOut, UserAdminOut, UserAdminUpdate, UserAdminSubmissionListOut, UserAdminSubmissionOut, AdminPasswordReset
from app.models.codetest import Problem, ProblemBank, Test

router = APIRouter()

AUDIT_LOG_PATH = Path('/app/runtime/admin-actions.jsonl')

def _write_admin_audit(action: str, payload: dict):
    try:
        AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "payload": payload,
        }
        with AUDIT_LOG_PATH.open('a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        # audit logging must never break admin actions
        pass


@router.get("/stats", dependencies=[Depends(require_min_role("staff"))])
async def stats(db: AsyncSession = Depends(get_db)):
    users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    posts = (await db.execute(select(func.count(Post.id)))).scalar() or 0
    submissions = (await db.execute(select(func.count(Submission.id)))).scalar() or 0

    pending_reports = (
        await db.execute(
            select(func.count(Report.id)).where(Report.status == ReportStatus.PENDING)
        )
    ).scalar() or 0

    qna_board_id = (
        await db.execute(select(Board.id).where(Board.board_type == "qna"))
    ).scalar_one_or_none()

    if qna_board_id is None:
        unanswered_qna = 0
    else:
        unanswered_qna = (
            await db.execute(
                select(func.count(Post.id))
                .outerjoin(Comment, Post.id == Comment.post_id)
                .where(and_(Post.board_id == qna_board_id, Comment.id.is_(None)))
            )
        ).scalar() or 0

    pending_reviews = (
        await db.execute(
            select(func.count(Submission.id)).where(Submission.result == "pending")
        )
    ).scalar() or 0

    return {
        "users": users,
        "posts": posts,
        "submissions": submissions,
        "pending_reports": pending_reports,
        "unanswered_questions": unanswered_qna,
        "pending_event_approvals": 0,
        "pending_reviews": pending_reviews,
    }




@router.get("/qna/unanswered", dependencies=[Depends(require_min_role("staff"))])
async def list_unanswered_qna(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    qna_board_id = (
        await db.execute(select(Board.id).where(Board.board_type == "qna"))
    ).scalar_one_or_none()

    if qna_board_id is None:
        return []

    rows = await db.execute(
        select(Post.id, Post.title, User.name, Post.created_at)
        .select_from(Post)
        .join(User, User.id == Post.author_id)
        .outerjoin(Comment, Post.id == Comment.post_id)
        .where(and_(Post.board_id == qna_board_id, Comment.id.is_(None)))
        .group_by(Post.id, User.name)
        .order_by(Post.created_at.desc())
        .limit(limit)
    )

    return [
        {
            "id": r[0],
            "title": r[1],
            "author_name": r[2],
            "created_at": r[3],
        }
        for r in rows.all()
    ]


@router.post(
    "/users/{user_id}/password",
    dependencies=[Depends(require_min_role("admin"))],
)
async def admin_reset_user_password(
    user_id: int,
    data: AdminPasswordReset,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(data.new_password)
    await db.commit()

    _write_admin_audit(
        "admin.reset_user_password",
        {
            "target_user_id": user.id,
            "target_email": user.email,
            "admin_user_id": admin_user.id,
        },
    )

    return {"ok": True}

@router.get(
    "/users",
    response_model=UserAdminListOut,
    dependencies=[Depends(require_min_role("admin"))],
)
async def list_users(
    search: Optional[str] = None,
    role: Optional[str] = None,
    rank: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_suspended: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(User).where(User.email.notlike('deleted_%@deleted.local'))

    if search:
        like = f"%{search}%"
        query = query.where(
            or_(
                User.name.ilike(like),
                User.email.ilike(like),
                User.student_id.ilike(like),
            )
        )
    if role:
        query = query.where(User.role == role)
    if rank:
        query = query.where(User.rank == rank)
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    if is_suspended is not None:
        query = query.where(User.is_suspended == is_suspended)

    count_query = select(func.count(User.id)).where(User.email.notlike('deleted_%@deleted.local'))
    if search:
        like = f"%{search}%"
        count_query = count_query.where(
            or_(
                User.name.ilike(like),
                User.email.ilike(like),
                User.student_id.ilike(like),
            )
        )
    if role:
        count_query = count_query.where(User.role == role)
    if rank:
        count_query = count_query.where(User.rank == rank)
    if is_active is not None:
        count_query = count_query.where(User.is_active == is_active)
    if is_suspended is not None:
        count_query = count_query.where(User.is_suspended == is_suspended)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(User.created_at.desc()).offset(skip).limit(limit)
    )
    users = result.scalars().all()

    return UserAdminListOut(
        items=[UserAdminOut.model_validate(user) for user in users],
        total=total,
    )


@router.get(
    "/users/{user_id}",
    response_model=UserAdminOut,
    dependencies=[Depends(require_min_role("admin"))],
)
async def get_user_detail(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserAdminOut.model_validate(user)


@router.patch(
    "/users/{user_id}",
    response_model=UserAdminOut,
    dependencies=[Depends(require_min_role("admin"))],
)
async def update_user(
    user_id: int,
    data: UserAdminUpdate,
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = data.model_dump(exclude_unset=True)

    # If rank is being updated manually by an admin
    if "rank" in update_data and update_data["rank"] != user.rank:
        old_rank = user.rank or "unranked"
        new_rank = update_data["rank"]
        
        from app.services.rank_service import RANK_THRESHOLDS
        
        # We only deduct points if the new rank is valid
        if new_rank in RANK_THRESHOLDS:
            new_rank_points = RANK_THRESHOLDS[new_rank]
            
            # If the admin is downgrading the user (or assigning a rank with fewer points than they currently have)
            current_activity = user.activity_points or 0
            if current_activity > new_rank_points:
                point_difference = current_activity - new_rank_points
                
                # Deduct from both points and activity_points
                user.activity_points = new_rank_points
                
                # Make sure points don't go below 0
                new_points = max(0, (user.points or 0) - point_difference)
                user.points = new_points
                
                # Log the deduction and rank change
                from app.models.activity import ActivityLog
                deduct_log = ActivityLog(
                    user_id=user.id,
                    activity_type="admin_deduct",
                    points=-point_difference,
                    description=f"관리자 직권 등급 변경 ({old_rank} → {new_rank})에 따른 포인트 차감",
                    balance_after=new_points,
                )
                db.add(deduct_log)

        
    for field, value in update_data.items():
        setattr(user, field, value)

    if update_data.get("is_suspended") is False:
        user.suspended_until = None
        user.suspension_reason = None

    await db.commit()
    await db.refresh(user)
    _write_admin_audit(
        "admin.update_user",
        {
            "target_user_id": user.id,
            "changes": update_data,
        },
    )
    return UserAdminOut.model_validate(user)

@router.get(
    "/users/{user_id}/submissions",
    response_model=UserAdminSubmissionListOut,
    dependencies=[Depends(require_min_role("admin"))],
)
async def get_user_submissions(
    user_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    # Check if user exists
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Fetch submissions with problem and test association
    query = (
        select(Submission, Problem.title, Test.id, Test.title)
        .outerjoin(Problem, Submission.problem_id == Problem.id)
        .outerjoin(Test, Problem.test_id == Test.id)
        .where(Submission.user_id == user_id)
        .order_by(Submission.submitted_at.desc())
        .offset(skip).limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()

    items = []
    for sub, prob_title, test_id, test_title in rows:
        title = prob_title if prob_title else f"Problem #{sub.problem_id}"
        
        items.append(
            UserAdminSubmissionOut(
                id=sub.id,
                problem_id=sub.problem_id,
                problem_title=title,
                test_id=test_id,
                test_title=test_title,
                code=sub.code,
                language=sub.language,
                result=sub.result,
                execution_time=sub.execution_time,
                memory_used=sub.memory_used,
                test_cases_passed=sub.test_cases_passed,
                test_cases_total=sub.test_cases_total,
                error_message=sub.error_message,
                submitted_at=sub.submitted_at
            )
        )

    count_query = select(func.count(Submission.id)).where(Submission.user_id == user_id)
    total = (await db.execute(count_query)).scalar() or 0

    return UserAdminSubmissionListOut(
        items=items,
        total=total
    )


@router.delete(
    "/users/{user_id}",
    dependencies=[Depends(require_min_role("admin"))],
)
async def delete_user(
    user_id: int,
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="본인 계정은 삭제할 수 없습니다")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    target_snapshot = {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
    }
    target_user_id = user.id

    if force:
        try:
            await db.delete(user)
            await db.commit()
            _write_admin_audit(
                "admin.delete_user.force_hard",
                {
                    "actor_user_id": current_user.id,
                    "target": target_snapshot,
                },
            )
            return {"ok": True, "mode": "force-hard"}
        except IntegrityError:
            await db.rollback()
            result2 = await db.execute(select(User).where(User.id == target_user_id))
            soft_user = result2.scalar_one_or_none()
            if not soft_user:
                raise HTTPException(status_code=404, detail="User not found after rollback")
            soft_user.is_active = False
            soft_user.is_suspended = True
            soft_user.suspension_reason = "관리자 완전삭제 실패로 소프트삭제"
            soft_user.email = f"deleted_{target_user_id}_{int(datetime.now(timezone.utc).timestamp())}@deleted.local"
            soft_user.name = f"삭제된 사용자#{target_user_id}"
            await db.commit()
            _write_admin_audit(
                "admin.delete_user.force_soft",
                {
                    "actor_user_id": current_user.id,
                    "target": target_snapshot,
                },
            )
            return {"ok": True, "mode": "force-soft"}

    try:
        await db.delete(user)
        await db.commit()
        _write_admin_audit(
            "admin.delete_user.hard",
            {
                "actor_user_id": current_user.id,
                "target": target_snapshot,
            },
        )
        return {"ok": True, "mode": "hard"}
    except IntegrityError:
        await db.rollback()
        # Fallback: soft-delete without schema changes
        result2 = await db.execute(select(User).where(User.id == target_user_id))
        soft_user = result2.scalar_one_or_none()
        if not soft_user:
            raise HTTPException(status_code=404, detail="User not found after rollback")

        soft_user.is_active = False
        soft_user.is_suspended = True
        soft_user.suspension_reason = "관리자 삭제 처리(소프트삭제)"
        soft_user.email = f"deleted_{target_user_id}_{int(datetime.now(timezone.utc).timestamp())}@deleted.local"
        soft_user.name = f"삭제된 사용자#{target_user_id}"

        await db.commit()
        _write_admin_audit(
            "admin.delete_user.soft",
            {
                "actor_user_id": current_user.id,
                "target": target_snapshot,
            },
        )
        return {"ok": True, "mode": "soft"}


@router.get(
    "/audit-logs",
    dependencies=[Depends(require_min_role("admin"))],
)
async def get_audit_logs(limit: int = Query(100, ge=1, le=500)):
    if not AUDIT_LOG_PATH.exists():
        return {"items": []}
    lines = AUDIT_LOG_PATH.read_text(encoding='utf-8').splitlines()
    selected = lines[-limit:]
    items = []
    for line in reversed(selected):
        try:
            items.append(json.loads(line))
        except Exception:
            continue
    return {"items": items}
