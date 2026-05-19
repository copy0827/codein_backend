"""
Report API endpoints for content moderation.

Provides:
- Submit reports (authenticated users)
- List/filter reports (staff+)
- Resolve reports with actions (staff+)
- Report statistics (admin+)
"""

from datetime import datetime, timezone
from pathlib import Path
import json
from zoneinfo import ZoneInfo
from typing import Optional


def _kst_now():
    return datetime.now(ZoneInfo("Asia/Seoul"))



from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_

from app.core.deps import get_db, get_current_user, require_min_role
from app.models.report import Report, ReportTargetType, ReportStatus, ReportReason
from app.models.board import Post
from app.models.comment import Comment
from app.models.user import User
from app.schemas.report import (
    ReportCreate,
    ReportOut,
    ReportResolve,
    ReportListOut,
    ReportStats,
)
from app.api.v1.notifications import send_notification


router = APIRouter()

AUDIT_LOG_PATH = Path('/app/runtime/admin-actions.jsonl')

def _write_admin_audit(action: str, payload: dict):
    try:
        AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with AUDIT_LOG_PATH.open('a', encoding='utf-8') as fp:
            fp.write(json.dumps({"ts": datetime.now(timezone.utc).isoformat(), "action": action, "payload": payload}, ensure_ascii=False) + "\n")
    except Exception:
        pass



@router.post("", include_in_schema=False, response_model=ReportOut, status_code=201)
async def create_report(
    report_data: ReportCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a new report. Authenticated users only.

    Users cannot report the same target twice (duplicate prevention).
    """
    # Check for duplicate report from same user
    existing = await db.execute(
        select(Report).where(
            and_(
                Report.reporter_id == user.id,
                Report.target_type == report_data.target_type,
                Report.target_id == report_data.target_id,
                Report.status.in_([ReportStatus.PENDING, ReportStatus.REVIEWING]),
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="You have already reported this content",
        )

    # Validate target exists (for posts)
    if report_data.target_type == ReportTargetType.POST:
        post = await db.execute(select(Post).where(Post.id == report_data.target_id))
        if not post.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Target post not found")

    # Validate target exists (for comments)
    if report_data.target_type == ReportTargetType.COMMENT:
        comment = await db.execute(
            select(Comment).where(Comment.id == report_data.target_id)
        )
        if not comment.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Target comment not found")

    report = Report(
        reporter_id=user.id,
        target_type=report_data.target_type,
        target_id=report_data.target_id,
        reason=report_data.reason,
        description=report_data.description,
        status=ReportStatus.PENDING,
    )

    db.add(report)
    await db.commit()
    await db.refresh(report)

    return ReportOut(
        id=report.id,
        reporter_id=report.reporter_id,
        reporter_name=user.name,
        target_type=report.target_type,
        target_id=report.target_id,
        reason=report.reason,
        description=report.description,
        status=report.status,
        review_started_by_id=None,
        review_started_by_name=None,
        review_started_at=None,
        resolved_by_id=None,
        resolved_by_name=None,
        resolution_note=None,
        resolved_at=None,
        action_taken=None,
        created_at=report.created_at,
    )


@router.get("", include_in_schema=False, response_model=ReportListOut)
async def list_reports(
    status: Optional[ReportStatus] = Query(None, description="Filter by status"),
    target_type: Optional[ReportTargetType] = Query(
        None, description="Filter by target type"
    ),
    reason: Optional[ReportReason] = Query(None, description="Filter by reason"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(require_min_role("staff")),
    db: AsyncSession = Depends(get_db),
):
    """
    List reports with optional filters. Staff+ only.
    """
    query = select(Report, User.name.label("reporter_name")).join(
        User, Report.reporter_id == User.id, isouter=True
    )

    # Apply filters
    conditions = []
    if status:
        conditions.append(Report.status == status)
    if target_type:
        conditions.append(Report.target_type == target_type)
    if reason:
        conditions.append(Report.reason == reason)

    if conditions:
        query = query.where(and_(*conditions))

    # Get total count
    count_query = select(func.count(Report.id))
    if conditions:
        count_query = count_query.where(and_(*conditions))
    total = (await db.execute(count_query)).scalar() or 0

    # Get pending count
    pending_count = (
        await db.execute(
            select(func.count(Report.id)).where(Report.status == ReportStatus.PENDING)
        )
    ).scalar() or 0

    # Get reports with pagination
    query = query.order_by(Report.created_at.desc()).offset(skip).limit(limit)
    rows = (await db.execute(query)).all()

    items = []
    for row in rows:
        report, reporter_name = row

        # Get resolved_by name if exists
        review_started_by_name = None
        if report.review_started_by_id:
            review_started_by = await db.execute(
                select(User.name).where(User.id == report.review_started_by_id)
            )
            review_started_by_name = review_started_by.scalar()

        resolved_by_name = None
        if report.resolved_by_id:
            resolved_by = await db.execute(
                select(User.name).where(User.id == report.resolved_by_id)
            )
            resolved_by_name = resolved_by.scalar()

        items.append(
            ReportOut(
                id=report.id,
                reporter_id=report.reporter_id,
                reporter_name=reporter_name,
                target_type=report.target_type,
                target_id=report.target_id,
                reason=report.reason,
                description=report.description,
                status=report.status,
                review_started_by_id=report.review_started_by_id,
                review_started_by_name=review_started_by_name,
                review_started_at=report.review_started_at,
                resolved_by_id=report.resolved_by_id,
                resolved_by_name=resolved_by_name,
                resolution_note=report.resolution_note,
                resolved_at=report.resolved_at,
                action_taken=report.action_taken,
                created_at=report.created_at,
            )
        )

    return ReportListOut(items=items, total=total, pending_count=pending_count)


@router.get("/stats", response_model=ReportStats)
async def get_report_stats(
    user: User = Depends(require_min_role("staff")),
    db: AsyncSession = Depends(get_db),
):
    """
    Get report statistics. Staff+ only.
    """
    total = (await db.execute(select(func.count(Report.id)))).scalar() or 0
    pending = (
        await db.execute(
            select(func.count(Report.id)).where(Report.status == ReportStatus.PENDING)
        )
    ).scalar() or 0
    reviewing = (
        await db.execute(
            select(func.count(Report.id)).where(Report.status == ReportStatus.REVIEWING)
        )
    ).scalar() or 0
    resolved = (
        await db.execute(
            select(func.count(Report.id)).where(Report.status == ReportStatus.RESOLVED)
        )
    ).scalar() or 0
    rejected = (
        await db.execute(
            select(func.count(Report.id)).where(Report.status == ReportStatus.REJECTED)
        )
    ).scalar() or 0

    return ReportStats(
        total=total,
        pending=pending,
        reviewing=reviewing,
        resolved=resolved,
        rejected=rejected,
    )


@router.get("/{report_id}", response_model=ReportOut)
async def get_report(
    report_id: int,
    user: User = Depends(require_min_role("staff")),
    db: AsyncSession = Depends(get_db),
):
    """
    Get a single report by ID. Staff+ only.
    """
    result = await db.execute(
        select(Report, User.name.label("reporter_name"))
        .join(User, Report.reporter_id == User.id, isouter=True)
        .where(Report.id == report_id)
    )
    row = result.one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="Report not found")

    report, reporter_name = row

    review_started_by_name = None
    if report.review_started_by_id:
        review_started_by = await db.execute(
            select(User.name).where(User.id == report.review_started_by_id)
        )
        review_started_by_name = review_started_by.scalar()

    resolved_by_name = None
    if report.resolved_by_id:
        resolved_by = await db.execute(
            select(User.name).where(User.id == report.resolved_by_id)
        )
        resolved_by_name = resolved_by.scalar()

    return ReportOut(
        id=report.id,
        reporter_id=report.reporter_id,
        reporter_name=reporter_name,
        target_type=report.target_type,
        target_id=report.target_id,
        reason=report.reason,
        description=report.description,
        status=report.status,
        review_started_by_id=report.review_started_by_id,
        review_started_by_name=review_started_by_name,
        review_started_at=report.review_started_at,
        resolved_by_id=report.resolved_by_id,
        resolved_by_name=resolved_by_name,
        resolution_note=report.resolution_note,
        resolved_at=report.resolved_at,
        action_taken=report.action_taken,
        created_at=report.created_at,
    )


@router.post("/{report_id}/review", response_model=ReportOut)
async def move_report_to_review(
    report_id: int,
    user: User = Depends(require_min_role("staff")),
    db: AsyncSession = Depends(get_db),
):
    """
    Move a report from pending to reviewing status. Staff+ only.

    Can only move reports that are currently pending.
    """
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status != ReportStatus.PENDING:
        raise HTTPException(
            status_code=400, detail="Report must be in pending status to move to review"
        )

    report.status = ReportStatus.REVIEWING
    report.review_started_by_id = user.id
    report.review_started_at = _kst_now()

    await db.commit()
    await db.refresh(report)

    reporter_name = (
        await db.execute(select(User.name).where(User.id == report.reporter_id))
    ).scalar()

    resolved_by_name = None
    if report.resolved_by_id:
        resolved_by_name = (
            await db.execute(select(User.name).where(User.id == report.resolved_by_id))
        ).scalar()

    return ReportOut(
        id=report.id,
        reporter_id=report.reporter_id,
        reporter_name=reporter_name,
        target_type=report.target_type,
        target_id=report.target_id,
        reason=report.reason,
        description=report.description,
        status=report.status,
        review_started_by_id=report.review_started_by_id,
        review_started_by_name=user.name,
        review_started_at=report.review_started_at,
        resolved_by_id=report.resolved_by_id,
        resolved_by_name=resolved_by_name,
        resolution_note=report.resolution_note,
        resolved_at=report.resolved_at,
        action_taken=report.action_taken,
        created_at=report.created_at,
    )


@router.post("/{report_id}/resolve", response_model=ReportOut)
async def resolve_report(
    report_id: int,
    resolution: ReportResolve,
    user: User = Depends(require_min_role("staff")),
    db: AsyncSession = Depends(get_db),
):
    """
    Resolve a report with optional action. Staff+ only.

    Possible actions:
    - content_blinded: Hide the reported content
    - user_warned: Issue a warning to the content owner
    - user_suspended: Suspend the content owner
    - no_action: Close without taking action
    """
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status in [ReportStatus.RESOLVED, ReportStatus.REJECTED]:
        raise HTTPException(status_code=400, detail="Report is already closed")

    # Update report
    report.status = resolution.status
    report.resolution_note = resolution.resolution_note
    report.action_taken = resolution.action_taken
    report.resolved_by_id = user.id
    report.resolved_at = _kst_now()

    # Execute action if specified
    if resolution.action_taken == "content_blinded":
        await _blind_content(report.target_type, report.target_id, db)
    elif resolution.action_taken == "user_warned":
        await _warn_user(report.target_type, report.target_id, db)
    elif resolution.action_taken == "user_suspended":
        await _suspend_user(report.target_type, report.target_id, db, days=7)

    await db.commit()
    await db.refresh(report)

    # Notify reporter
    await send_notification(
        db=db,
        user_id=report.reporter_id,
        notification_type="report_resolved",
        title="신고 처리 완료",
        message=f"신고하신 콘텐츠가 검토되었습니다. 결과: {resolution.status.value}",
        link=None,
    )

    reporter_name = (
        await db.execute(select(User.name).where(User.id == report.reporter_id))
    ).scalar()

    review_started_by_name = None
    if report.review_started_by_id:
        review_started_by_name = (
            await db.execute(
                select(User.name).where(User.id == report.review_started_by_id)
            )
        ).scalar()

    return ReportOut(
        id=report.id,
        reporter_id=report.reporter_id,
        reporter_name=reporter_name,
        target_type=report.target_type,
        target_id=report.target_id,
        reason=report.reason,
        description=report.description,
        status=report.status,
        review_started_by_id=report.review_started_by_id,
        review_started_by_name=review_started_by_name,
        review_started_at=report.review_started_at,
        resolved_by_id=report.resolved_by_id,
        resolved_by_name=user.name,
        resolution_note=report.resolution_note,
        resolved_at=report.resolved_at,
        action_taken=report.action_taken,
        created_at=report.created_at,
    )


async def _blind_content(
    target_type: ReportTargetType, target_id: int, db: AsyncSession
):
    """Blind/hide the reported content."""
    if target_type == ReportTargetType.POST:
        result = await db.execute(select(Post).where(Post.id == target_id))
        post = result.scalar_one_or_none()
        if post:
            before = bool(post.is_blinded)
            post.is_blinded = True
            _write_admin_audit("reports.blind_change", {"target_type":"post","target_id":post.id,"from":before,"to":True})
            # Notify content owner
            await send_notification(
                db=db,
                user_id=post.author_id,
                notification_type="content_blinded",
                title="콘텐츠 블라인드 처리",
                message="회원님의 게시글이 신고 접수로 인해 블라인드 처리되었습니다.",
                link=None,
            )
    elif target_type == ReportTargetType.COMMENT:
        result = await db.execute(select(Comment).where(Comment.id == target_id))
        comment = result.scalar_one_or_none()
        if comment:
            before = bool(comment.is_blinded)
            comment.is_blinded = True
            _write_admin_audit("reports.blind_change", {"target_type":"comment","target_id":comment.id,"from":before,"to":True})
            # Notify content owner
            await send_notification(
                db=db,
                user_id=comment.author_id,
                notification_type="content_blinded",
                title="콘텐츠 블라인드 처리",
                message="회원님의 댓글이 신고 접수로 인해 블라인드 처리되었습니다.",
                link=None,
            )


async def _warn_user(target_type: ReportTargetType, target_id: int, db: AsyncSession):
    """Issue a warning to the content owner."""
    user_id = None

    if target_type == ReportTargetType.POST:
        result = await db.execute(select(Post.author_id).where(Post.id == target_id))
        user_id = result.scalar()
    elif target_type == ReportTargetType.COMMENT:
        result = await db.execute(
            select(Comment.author_id).where(Comment.id == target_id)
        )
        user_id = result.scalar()

    if user_id:
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if user:
            user.warning_count = (user.warning_count or 0) + 1

            # Notify user
            await send_notification(
                db=db,
                user_id=user_id,
                notification_type="warning_issued",
                title="경고 부여",
                message=f"커뮤니티 규칙 위반으로 경고가 부여되었습니다. (누적 {user.warning_count}회)",
                link=None,
            )

            # Auto-suspend if warnings exceed threshold
            if user.warning_count >= 3:
                await _suspend_user(target_type, target_id, db, days=7)


async def _suspend_user(
    target_type: ReportTargetType, target_id: int, db: AsyncSession, days: int = 7
):
    """Suspend the content owner."""
    from datetime import timedelta

    user_id = None

    if target_type == ReportTargetType.POST:
        result = await db.execute(select(Post.author_id).where(Post.id == target_id))
        user_id = result.scalar()
    elif target_type == ReportTargetType.COMMENT:
        result = await db.execute(
            select(Comment.author_id).where(Comment.id == target_id)
        )
        user_id = result.scalar()

    if user_id:
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if user:
            user.is_suspended = True
            user.suspended_until = _kst_now() + timedelta(days=days)
            user.suspension_reason = "커뮤니티 규칙 위반으로 인한 정지"

            # Notify user
            await send_notification(
                db=db,
                user_id=user_id,
                notification_type="account_suspended",
                title="계정 정지",
                message=f"커뮤니티 규칙 위반으로 {days}일간 활동이 정지됩니다.",
                link=None,
            )
