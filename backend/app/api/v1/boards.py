import asyncio
import time
from collections import defaultdict, deque
"""
Boards API - Post and notice management endpoints.
Supports notice targeting and read tracking.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, case, update
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
import json
from pathlib import Path
from zoneinfo import ZoneInfo
from typing import List, Optional


def _kst_now():
    return datetime.now(ZoneInfo("Asia/Seoul"))


from app.core.deps import (
    get_db,
    get_current_user,
    get_current_user_optional,
    require_roles,
    require_min_role,
    require_owner_or_role,
)
from app.core.permissions import can_access_target_audience, has_role
from app.core.storage import save_notice_attachment, delete_file
from app.models.board import Board, NoticeTemplate, Post, PostAttachment, PostReadLog
from app.models.user import User
from app.schemas.board import (
    BoardCreate,
    BoardOut,
    BoardUpdate,
    NoticeListResponse,
    NoticeTemplateCreate,
    NoticeTemplateOut,
    NoticeTemplateUpdate,
    PostAttachmentOut,
    PostCreate,
    PostOut,
    PostReadLogOut,
    PostReadStatusResponse,
    PostUpdate,
)
from app.schemas.user import UserSummary
from app.api.v1.activity import grant_points
from app.api.v1.notifications import notify_mentions, send_notification

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
        pass

POST_CREATE_LIMIT = 10
POST_CREATE_WINDOW = 60
_post_hits: dict[str, deque[float]] = defaultdict(deque)
_post_lock = asyncio.Lock()

async def _enforce_post_create_rate_limit(key: str):
    now = time.monotonic()
    async with _post_lock:
        q = _post_hits[key]
        while q and now - q[0] > POST_CREATE_WINDOW:
            q.popleft()
        if len(q) >= POST_CREATE_LIMIT:
            raise HTTPException(status_code=429, detail="게시글 작성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.")
        q.append(now)


async def get_post_read_info(
    db: AsyncSession, post_id: int, user_id: Optional[int] = None
) -> tuple[bool, int]:
    """Get read status and count for a post."""
    # Get read count
    count_result = await db.execute(
        select(func.count(PostReadLog.id)).where(PostReadLog.post_id == post_id)
    )
    read_count = count_result.scalar() or 0

    # Check if current user has read
    is_read = False
    if user_id:
        read_result = await db.execute(
            select(PostReadLog).where(
                and_(PostReadLog.post_id == post_id, PostReadLog.user_id == user_id)
            )
        )
        is_read = read_result.scalar_one_or_none() is not None

    return is_read, read_count


async def post_to_out(
    db: AsyncSession, post: Post, user_id: Optional[int] = None
) -> PostOut:
    """Convert Post model to PostOut with computed fields."""
    is_read, read_count = await get_post_read_info(db, post.id, user_id)

    attachments_result = await db.execute(
        select(PostAttachment)
        .where(PostAttachment.post_id == post.id)
        .order_by(PostAttachment.uploaded_at.desc())
    )
    attachments = attachments_result.scalars().all()
    attachment_out = [PostAttachmentOut.model_validate(a) for a in attachments]

    author_data = UserSummary.model_validate(post.author) if post.author else None

    return PostOut(
        id=post.id,
        title=post.title,
        content=post.content,
        board_id=post.board_id,
        author_id=post.author_id,
        template_id=post.template_id,
        view_count=post.view_count,
        is_pinned=post.is_pinned,
        is_hidden=post.is_hidden,
        is_blinded=post.is_blinded,
        created_at=post.created_at,
        updated_at=post.updated_at,
        notice_type=post.notice_type,
        target_audience=post.target_audience,
        target_ranks=post.target_ranks,
        scheduled_at=post.scheduled_at,
        expires_at=post.expires_at,
        attachments=attachment_out,
        author=author_data,
        is_read=is_read,
        read_count=read_count,
    )


def is_target_audience_allowed(post: Post, user: Optional[User]) -> bool:
    if not user:
        return can_access_target_audience(
            "guest", "unranked", post.target_audience, post.target_ranks
        )
    return can_access_target_audience(
        user.role, user.rank, post.target_audience, post.target_ranks
    )


def should_show_notice(post: Post, user: Optional[User]) -> bool:
    """Check if a notice should be shown to the user based on targeting."""
    if not post.notice_type:
        return True

    if post.scheduled_at and _kst_now() < post.scheduled_at:
        return False

    if post.expires_at and _kst_now() > post.expires_at:
        return False

    return is_target_audience_allowed(post, user)


def should_show_post(post: Post, user: Optional[User]) -> bool:
    if post.notice_type:
        return should_show_notice(post, user)
    return is_target_audience_allowed(post, user)


# ============ Board Endpoints ============


@router.get("", response_model=List[BoardOut])
async def list_boards(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    query = select(Board).order_by(Board.order.asc(), Board.id.asc())
    is_staff = current_user and has_role(current_user.role, "staff")
    if not is_staff:
        query = query.where(
            Board.board_type.in_(["notice", "general", "qna"]),
            Board.is_public == True,
        )
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=BoardOut, status_code=status.HTTP_201_CREATED)
async def create_board(
    data: BoardCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role("admin")),
):
    """Create a new board. Admin only."""
    existing = await db.execute(select(Board).where(Board.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Board name already exists",
        )

    # Auto-assign order
    max_order_result = await db.execute(select(func.max(Board.order)))
    max_order = max_order_result.scalar() or 0

    board = Board(
        name=data.name,
        board_type=data.board_type,
        is_public=data.is_public,
        order=max_order + 1,
    )
    db.add(board)
    await db.commit()
    await db.refresh(board)
    return board


@router.patch("/{board_id}", response_model=BoardOut)
async def update_board(
    board_id: int,
    data: BoardUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role("admin")),
):
    """Update a board. Admin only."""
    result = await db.execute(select(Board).where(Board.id == board_id))
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    before_is_blinded = post.is_blinded
    if "name" in update_data:
        existing = await db.execute(
            select(Board).where(
                and_(Board.name == update_data["name"], Board.id != board_id)
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Board name already exists",
            )

    for field, value in update_data.items():
        setattr(board, field, value)

    await db.commit()
    await db.refresh(board)
    return board


@router.delete("/{board_id}")
async def delete_board(
    board_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role("admin")),
):
    """Delete a board. Admin only."""
    result = await db.execute(select(Board).where(Board.id == board_id))
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )

    # Check if there are posts in this board
    posts_count = await db.execute(
        select(func.count(Post.id)).where(Post.board_id == board_id)
    )
    if posts_count.scalar() > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete board with posts. Delete or move posts first.",
        )

    await db.delete(board)
    await db.commit()
    return {"message": "Board deleted"}


@router.put("/reorder")
async def reorder_boards(
    board_ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role("admin")),
):
    """Reorder boards. Admin only."""
    for index, board_id in enumerate(board_ids):
        await db.execute(
            update(Board).where(Board.id == board_id).values(order=index + 1)
        )
    await db.commit()
    return {"message": "Boards reordered"}


@router.get("/notice", response_model=List[PostOut])
async def list_notice_posts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    include_hidden: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    is_staff = current_user and has_role(current_user.role, "staff")

    notice_board_result = await db.execute(
        select(Board).where(Board.board_type == "notice")
    )
    notice_board = notice_board_result.scalar_one_or_none()
    if not notice_board:
        return []

    query = (
        select(Post)
        .where(Post.board_id == notice_board.id)
        .options(selectinload(Post.author))
        .where(Post.notice_type.isnot(None))
    )

    if not include_hidden:
        query = query.where(Post.is_hidden == False)

    if not is_staff:
        query = query.where(Post.is_blinded == False)

    query = (
        query.order_by(Post.is_pinned.desc(), Post.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(query)
    posts = result.scalars().all()

    filtered_posts = [post for post in posts if should_show_post(post, current_user)]

    user_id = current_user.id if current_user else None
    return [await post_to_out(db, post, user_id) for post in filtered_posts]


@router.get("/{board_id}", response_model=List[PostOut])
@router.get("/{board_id}/posts", response_model=List[PostOut])
async def list_posts(
    board_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    include_hidden: bool = False,
    notice_only: bool = Query(False, description="Only include notice posts"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """List posts in a board."""
    is_staff = current_user and has_role(current_user.role, "staff")

    board_result = await db.execute(select(Board).where(Board.id == board_id))
    board = board_result.scalar_one_or_none()

    query = (
        select(Post).where(Post.board_id == board_id).options(selectinload(Post.author))
    )

    if not include_hidden:
        query = query.where(Post.is_hidden == False)

    if notice_only:
        query = query.where(Post.notice_type.isnot(None))

    if not is_staff:
        query = query.where(Post.is_blinded == False)

    query = (
        query.order_by(Post.is_pinned.desc(), Post.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(query)
    posts = result.scalars().all()

    allow_public_board = (
        board and board.is_public and not current_user and "자유" in board.name
    )

    if allow_public_board:
        filtered_posts = posts
    else:
        filtered_posts = [
            post for post in posts if should_show_post(post, current_user)
        ]

    user_id = current_user.id if current_user else None
    return [await post_to_out(db, post, user_id) for post in filtered_posts]


@router.post("/{board_id}", response_model=PostOut, status_code=status.HTTP_201_CREATED)
async def create_post(
    board_id: int,
    data: PostCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    board_result = await db.execute(select(Board).where(Board.id == board_id))
    board = board_result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    # Board 2 (응시자랑)은 '자랑하기' 기능을 통해서만 포스팅 가능
    if board_id == 2:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 게시판은 '자랑하기' 기능을 통해서만 게시글 작성이 가능합니다.",
        )

    if board.board_type == "notice":
        if not has_role(current_user.role, "staff"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only staff can create posts in the notice board",
            )
        if not data.notice_type:
            data.notice_type = "normal"
        if not data.target_audience:
            data.target_audience = "all"

    if data.notice_type and not has_role(current_user.role, "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff can create notices",
        )

    content = data.content or ""
    if data.template_id:
        template_result = await db.execute(
            select(NoticeTemplate).where(
                and_(
                    NoticeTemplate.id == data.template_id,
                    NoticeTemplate.is_active == True,
                )
            )
        )
        template = template_result.scalar_one_or_none()
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notice template not found",
            )
        if not content:
            content = template.content

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Content is required",
        )

    target_ranks = ",".join(data.target_ranks) if data.target_ranks else None

    post = Post(
        title=data.title,
        content=content,
        board_id=board_id,
        author_id=current_user.id,
        template_id=data.template_id,
        notice_type=data.notice_type,
        target_audience=data.target_audience,
        target_ranks=target_ranks,
        scheduled_at=data.scheduled_at,
        expires_at=data.expires_at,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    await db.refresh(post, ["author"])

    try:
        await grant_points(
            db=db,
            user_id=current_user.id,
            activity_type="post_create",
            reference_type="post",
            reference_id=post.id,
        )
    except Exception:
        pass

    link = f"/board/{post.board_id}/post/{post.id}"
    if post.notice_type:
        users_result = await db.execute(
            select(User).where(
                and_(
                    User.id != current_user.id,
                    User.notify_system == True,
                )
            )
        )
        users = users_result.scalars().all()
        for user in users:
            if not can_access_target_audience(
                user.role, user.rank, post.target_audience, post.target_ranks
            ):
                continue
            await send_notification(
                db=db,
                user_id=user.id,
                notification_type="notice",
                title="새 공지",
                message=f"{board.name}에 '{post.title}' 공지가 등록되었습니다.",
                link=link,
                related_type="post",
                related_id=post.id,
            )
    else:
        # 구독한 게시판 새 글 알림 기능은 일시 중지합니다.
        # users_result = await db.execute(
        #     select(User).where(
        #         and_(
        #             User.id != current_user.id,
        #             User.notify_new_post == True,
        #         )
        #     )
        # )
        # users = users_result.scalars().all()
        # for user in users:
        #     if not can_access_target_audience(
        #         user.role, user.rank, post.target_audience, post.target_ranks
        #     ):
        #         continue
        #     await send_notification(
        #         db=db,
        #         user_id=user.id,
        #         notification_type="post",
        #         title="새 글",
        #         message=f"{board.name}에 새 글이 등록되었습니다.",
        #         link=link,
        #         related_type="post",
        #         related_id=post.id,
        #     )
        pass

    await notify_mentions(
        db=db,
        content=post.content,
        actor_id=current_user.id,
        actor_name=current_user.name,
        link=link,
        related_type="post",
        related_id=post.id,
    )

    user_id = current_user.id if current_user else None
    return await post_to_out(db, post, user_id)


@router.get("/{board_id}/posts/{post_id}", response_model=PostOut)
async def get_post(
    board_id: int,
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Get a single post by ID."""
    result = await db.execute(
        select(Post)
        .where(and_(Post.id == post_id, Post.board_id == board_id))
        .options(selectinload(Post.author))
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    is_staff = current_user and has_role(current_user.role, "staff")

    if post.is_hidden and not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Post is hidden",
        )

    if post.is_blinded and not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Post is blinded",
        )

    if not should_show_post(post, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: content not accessible",
        )

    post.view_count += 1
    await db.commit()
    await db.refresh(post)
    await db.refresh(post, ["author"])

    user_id = current_user.id if current_user else None
    return await post_to_out(db, post, user_id)


@router.put("/{board_id}/posts/{post_id}", response_model=PostOut)
async def update_post(
    board_id: int,
    post_id: int,
    data: PostUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a post. Only author can update."""
    result = await db.execute(
        select(Post).where(and_(Post.id == post_id, Post.board_id == board_id))
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    if post.author_id != current_user.id and not has_role(current_user.role, "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only author or staff can update this post",
        )

    # Check if this is a notice board
    board_result = await db.execute(select(Board).where(Board.id == board_id))
    board = board_result.scalar_one_or_none()
    if board and board.board_type == "notice" and not has_role(current_user.role, "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff can update posts in the notice board",
        )

    update_data = data.model_dump(exclude_unset=True)
    before_is_blinded = post.is_blinded

    # Handle target_ranks conversion
    if "target_ranks" in update_data:
        if update_data["target_ranks"]:
            update_data["target_ranks"] = ",".join(update_data["target_ranks"])
        else:
            update_data["target_ranks"] = None

    if "template_id" in update_data:
        template_id = update_data["template_id"]
        if template_id:
            template_result = await db.execute(
                select(NoticeTemplate).where(
                    and_(
                        NoticeTemplate.id == template_id,
                        NoticeTemplate.is_active == True,
                    )
                )
            )
            template = template_result.scalar_one_or_none()
            if not template:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Notice template not found",
                )
            if not update_data.get("content"):
                update_data["content"] = template.content
        elif not update_data.get("content"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Content is required when no template is selected",
            )

    for field, value in update_data.items():
        setattr(post, field, value)

    await db.commit()
    await db.refresh(post)
    await db.refresh(post, ["author"])

    if before_is_blinded != post.is_blinded:
        _write_admin_audit(
            "boards.update_post.blind_change",
            {
                "actor_user_id": current_user.id,
                "post_id": post.id,
                "board_id": post.board_id,
                "from": bool(before_is_blinded),
                "to": bool(post.is_blinded),
            },
        )

    return await post_to_out(db, post, current_user.id)


@router.delete("/{board_id}/posts/{post_id}")
async def delete_post(
    board_id: int,
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a post. Only author or admin can delete."""
    result = await db.execute(
        select(Post).where(and_(Post.id == post_id, Post.board_id == board_id))
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    if post.author_id != current_user.id and not has_role(current_user.role, "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only author or staff can delete this post",
        )

    # Check if this is a notice board
    board_result = await db.execute(select(Board).where(Board.id == board_id))
    board = board_result.scalar_one_or_none()
    if board and board.board_type == "notice" and not has_role(current_user.role, "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff can delete posts in the notice board",
        )

    attachments_result = await db.execute(
        select(PostAttachment).where(PostAttachment.post_id == post_id)
    )
    attachments = attachments_result.scalars().all()
    for attachment in attachments:
        delete_file(attachment.file_url)

    await db.delete(post)
    await db.commit()

    return {"message": "Post deleted"}


@router.get(
    "/{board_id}/posts/{post_id}/attachments", response_model=List[PostAttachmentOut]
)
async def list_post_attachments(
    board_id: int,
    post_id: int,
    db: AsyncSession = Depends(get_db),
):
    post_result = await db.execute(
        select(Post).where(and_(Post.id == post_id, Post.board_id == board_id))
    )
    if not post_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    attachments_result = await db.execute(
        select(PostAttachment)
        .where(PostAttachment.post_id == post_id)
        .order_by(PostAttachment.uploaded_at.desc())
    )
    attachments = attachments_result.scalars().all()
    return [PostAttachmentOut.model_validate(a) for a in attachments]


@router.post(
    "/{board_id}/posts/{post_id}/attachments", response_model=PostAttachmentOut
)
async def upload_post_attachment(
    board_id: int,
    post_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post_result = await db.execute(
        select(Post).where(and_(Post.id == post_id, Post.board_id == board_id))
    )
    post = post_result.scalar_one_or_none()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    await require_owner_or_role(post.author_id, "staff", current_user)
    file_info = await save_notice_attachment(file, post_id, current_user.id)

    attachment = PostAttachment(
        post_id=post.id,
        uploader_id=current_user.id,
        original_filename=file_info["original_filename"],
        file_path=file_info["file_path"],
        file_url=file_info["file_url"],
        file_size=file_info["file_size"],
        content_type=file_info["content_type"],
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    return PostAttachmentOut.model_validate(attachment)


@router.delete("/{board_id}/posts/{post_id}/attachments/{attachment_id}")
async def delete_post_attachment(
    board_id: int,
    post_id: int,
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post_result = await db.execute(
        select(Post).where(and_(Post.id == post_id, Post.board_id == board_id))
    )
    post = post_result.scalar_one_or_none()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    await require_owner_or_role(post.author_id, "staff", current_user)

    attachment_result = await db.execute(
        select(PostAttachment).where(
            and_(PostAttachment.id == attachment_id, PostAttachment.post_id == post_id)
        )
    )
    attachment = attachment_result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found",
        )

    delete_file(attachment.file_url)
    await db.delete(attachment)
    await db.commit()

    return {"status": "ok"}


@router.get("/notices/templates", response_model=List[NoticeTemplateOut])
async def list_notice_templates(
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role("staff")),
):
    query = select(NoticeTemplate)
    if not include_inactive:
        query = query.where(NoticeTemplate.is_active == True)
    query = query.order_by(NoticeTemplate.created_at.desc())
    result = await db.execute(query)
    templates = result.scalars().all()
    return [NoticeTemplateOut.model_validate(template) for template in templates]


@router.post(
    "/notices/templates",
    response_model=NoticeTemplateOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_notice_template(
    data: NoticeTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role("staff")),
):
    existing = await db.execute(
        select(NoticeTemplate).where(NoticeTemplate.name == data.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Notice template name already exists",
        )

    template = NoticeTemplate(
        name=data.name,
        content=data.content,
        description=data.description,
        is_active=data.is_active,
        created_by=current_user.id,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    return NoticeTemplateOut.model_validate(template)


@router.put("/notices/templates/{template_id}", response_model=NoticeTemplateOut)
async def update_notice_template(
    template_id: int,
    data: NoticeTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role("staff")),
):
    result = await db.execute(
        select(NoticeTemplate).where(NoticeTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notice template not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    before_is_blinded = post.is_blinded
    if "name" in update_data:
        existing = await db.execute(
            select(NoticeTemplate).where(
                and_(
                    NoticeTemplate.name == update_data["name"],
                    NoticeTemplate.id != template_id,
                )
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Notice template name already exists",
            )

    for field, value in update_data.items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)

    return NoticeTemplateOut.model_validate(template)


@router.delete("/notices/templates/{template_id}")
async def delete_notice_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role("staff")),
):
    result = await db.execute(
        select(NoticeTemplate).where(NoticeTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notice template not found",
        )

    template.is_active = False
    await db.commit()

    return {"status": "ok"}


# ============ Read Tracking Endpoints ============


@router.post("/{board_id}/posts/{post_id}/read")
async def mark_as_read(
    board_id: int,
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a post as read by the current user."""
    from sqlalchemy.exc import IntegrityError

    # Verify post exists
    result = await db.execute(
        select(Post).where(and_(Post.id == post_id, Post.board_id == board_id))
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Check if already read
    existing = await db.execute(
        select(PostReadLog).where(
            and_(PostReadLog.post_id == post_id, PostReadLog.user_id == current_user.id)
        )
    )
    if existing.scalar_one_or_none():
        return {"message": "Already marked as read", "is_read": True}

    # Create read log - handle race condition with IntegrityError
    try:
        read_log = PostReadLog(user_id=current_user.id, post_id=post_id)
        db.add(read_log)
        await db.commit()
    except IntegrityError:
        # Duplicate key - already read (race condition)
        await db.rollback()
        return {"message": "Already marked as read", "is_read": True}

    return {"message": "Marked as read", "is_read": True}


@router.get(
    "/{board_id}/posts/{post_id}/read-status", response_model=PostReadStatusResponse
)
async def get_read_status(
    board_id: int,
    post_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_min_role("admin")),
):
    """
    Get read status for a post (admin only).

    Shows which users have read the post.
    """
    # Verify post exists
    result = await db.execute(
        select(Post).where(and_(Post.id == post_id, Post.board_id == board_id))
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Get total readers
    count_result = await db.execute(
        select(func.count(PostReadLog.id)).where(PostReadLog.post_id == post_id)
    )
    total_readers = count_result.scalar() or 0

    # Get read logs with user info
    logs_result = await db.execute(
        select(PostReadLog, User)
        .join(User, PostReadLog.user_id == User.id)
        .where(PostReadLog.post_id == post_id)
        .order_by(PostReadLog.read_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = logs_result.all()

    read_logs = [
        PostReadLogOut(user_id=user.id, user_name=user.name, read_at=log.read_at)
        for log, user in rows
    ]

    return PostReadStatusResponse(
        post_id=post_id,
        total_readers=total_readers,
        read_logs=read_logs,
    )
