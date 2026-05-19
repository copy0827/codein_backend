"""
Comments API - CRUD operations for post comments with nested replies.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, and_, inspect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timezone
from pathlib import Path
import json

from app.core.deps import get_db, get_current_user, require_roles
from app.models.user import User
from app.models.board import Post
from app.models.comment import Comment
from app.schemas.comment import (
    CommentCreate,
    CommentUpdate,
    CommentOut,
    CommentAuthor,
    CommentListResponse,
)
from app.api.v1.activity import grant_points
from app.api.v1.notifications import notify_mentions, send_notification

router = APIRouter()

AUDIT_LOG_PATH = Path('/app/runtime/admin-actions.jsonl')

def _write_admin_audit(action: str, payload: dict):
    try:
        AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with AUDIT_LOG_PATH.open('a', encoding='utf-8') as fp:
            fp.write(json.dumps({"ts": datetime.now(timezone.utc).isoformat(), "action": action, "payload": payload}, ensure_ascii=False) + "\n")
    except Exception:
        pass



def build_comment_response(
    comment: Comment, include_replies: bool = False
) -> CommentOut:
    """Build comment response with author info."""
    # Handle deleted/blinded content
    content = comment.content
    if comment.is_deleted:
        content = "[삭제된 댓글입니다]"
    elif comment.is_blinded:
        content = "[블라인드 처리된 댓글입니다]"

    author_data = None
    if comment.author and not comment.is_deleted:
        author_data = CommentAuthor(
            id=comment.author.id,
            name=comment.author.name,
            profile_image=comment.author.profile_image,
            rank=comment.author.rank or "unranked",
        )

    replies_loaded = "replies" not in inspect(comment).unloaded
    replies = comment.replies if replies_loaded and comment.replies else []

    response = CommentOut(
        id=comment.id,
        post_id=comment.post_id,
        author_id=comment.author_id,
        parent_id=comment.parent_id,
        content=content,
        is_blinded=comment.is_blinded,
        is_deleted=comment.is_deleted,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        author=author_data,
        reply_count=len(replies),
    )

    if include_replies and replies:
        response.replies = [
            build_comment_response(reply, include_replies=False) for reply in replies
        ]

    return response


@router.get("/posts/{post_id}/comments", response_model=CommentListResponse)
async def list_comments(
    post_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all comments for a post with nested replies.
    Returns top-level comments with their replies.
    """
    # Check if post exists
    post_result = await db.execute(select(Post).where(Post.id == post_id))
    post = post_result.scalar_one_or_none()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
        )

    # Count top-level comments only
    count_query = select(func.count(Comment.id)).where(
        and_(
            Comment.post_id == post_id,
            Comment.parent_id.is_(None),
        )
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Calculate pagination
    offset = (page - 1) * page_size
    has_more = offset + page_size < total

    # Get top-level comments with author and replies
    query = (
        select(Comment)
        .where(
            and_(
                Comment.post_id == post_id,
                Comment.parent_id.is_(None),
            )
        )
        .options(
            selectinload(Comment.author),
            selectinload(Comment.replies).selectinload(Comment.author),
        )
        .order_by(Comment.created_at.asc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    comments = result.scalars().all()

    return CommentListResponse(
        comments=[build_comment_response(c, include_replies=True) for c in comments],
        total=total,
        has_more=has_more,
    )


@router.post(
    "/posts/{post_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    post_id: int,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new comment on a post.
    Set parent_id to create a reply to another comment.
    """
    # Check if post exists
    post_result = await db.execute(select(Post).where(Post.id == post_id))
    post = post_result.scalar_one_or_none()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
        )

    parent = None
    # If this is a reply, check parent comment exists
    if data.parent_id:
        parent_result = await db.execute(
            select(Comment).where(
                and_(
                    Comment.id == data.parent_id,
                    Comment.post_id == post_id,
                )
            )
        )
        parent = parent_result.scalar_one_or_none()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Parent comment not found"
            )
        # Don't allow replies to replies (only 1 level of nesting)
        if parent.parent_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot reply to a reply. Only one level of nesting is allowed.",
            )

    # Create comment
    comment = Comment(
        post_id=post_id,
        author_id=current_user.id,
        parent_id=data.parent_id,
        content=data.content,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    # Grant activity points
    try:
        await grant_points(
            db=db,
            user_id=current_user.id,
            activity_type="comment_create",
            reference_type="comment",
            reference_id=comment.id,
        )
    except Exception:
        # Don't fail comment creation if points fail
        pass

    # Load author for response
    await db.refresh(comment, ["author"])

    link = f"/board/{post.board_id}/post/{post.id}"
    if data.parent_id and parent:
        parent_result = await db.execute(
            select(User).where(User.id == parent.author_id)
        )
        parent_author = parent_result.scalar_one_or_none()
        if (
            parent_author
            and parent_author.id != current_user.id
            and parent_author.notify_comment_reply
        ):
            await send_notification(
                db=db,
                user_id=parent_author.id,
                notification_type="reply",
                title="새 답글",
                message=f"{current_user.name}님이 댓글에 답글을 남겼습니다.",
                link=link,
                related_type="comment",
                related_id=comment.id,
            )
    elif post.author_id != current_user.id:
        post_author_result = await db.execute(
            select(User).where(User.id == post.author_id)
        )
        post_author = post_author_result.scalar_one_or_none()
        if post_author and post_author.notify_comment_reply:
            await send_notification(
                db=db,
                user_id=post_author.id,
                notification_type="comment",
                title="새 댓글",
                message=f"{current_user.name}님이 '{post.title}'에 댓글을 남겼습니다.",
                link=link,
                related_type="post",
                related_id=post.id,
            )

    await notify_mentions(
        db=db,
        content=comment.content,
        actor_id=current_user.id,
        actor_name=current_user.name,
        link=link,
        related_type="comment",
        related_id=comment.id,
    )

    return build_comment_response(comment)


@router.get("/comments/{comment_id}", response_model=CommentOut)
async def get_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a single comment by ID."""
    query = (
        select(Comment)
        .where(Comment.id == comment_id)
        .options(
            selectinload(Comment.author),
            selectinload(Comment.replies).selectinload(Comment.author),
        )
    )
    result = await db.execute(query)
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found"
        )

    return build_comment_response(comment, include_replies=True)


@router.put("/comments/{comment_id}", response_model=CommentOut)
async def update_comment(
    comment_id: int,
    data: CommentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a comment. Only the author can update their own comment."""
    query = (
        select(Comment)
        .where(Comment.id == comment_id)
        .options(selectinload(Comment.author))
    )
    result = await db.execute(query)
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found"
        )

    # Check ownership
    if comment.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own comments",
        )

    # Can't edit deleted or blinded comments
    if comment.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit a deleted comment",
        )
    if comment.is_blinded:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit a blinded comment",
        )

    comment.content = data.content
    await db.commit()
    await db.refresh(comment)

    return build_comment_response(comment)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft delete a comment. Only the author or staff+ can delete.
    If the comment has replies, it becomes "[삭제된 댓글입니다]".
    """
    query = (
        select(Comment)
        .where(Comment.id == comment_id)
        .options(selectinload(Comment.replies))
    )
    result = await db.execute(query)
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found"
        )

    # Check permission: author or staff+
    is_owner = comment.author_id == current_user.id
    is_staff = current_user.role in ("staff", "admin", "superadmin")

    if not is_owner and not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own comments",
        )

    # Soft delete (keep for reply structure)
    comment.is_deleted = True
    await db.commit()

    # Deduct activity points for deletion
    try:
        await grant_points(
            db=db,
            user_id=comment.author_id,
            activity_type="comment_delete",
            reference_type="comment",
            reference_id=comment.id,
        )
    except Exception:
        pass

    return None


@router.post("/comments/{comment_id}/blind", response_model=CommentOut)
async def blind_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("staff")),
):
    """Blind a comment (staff+ only). Used by moderation system."""
    query = (
        select(Comment)
        .where(Comment.id == comment_id)
        .options(selectinload(Comment.author))
    )
    result = await db.execute(query)
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found"
        )

    before = bool(comment.is_blinded)
    comment.is_blinded = True
    _write_admin_audit("comments.blind_change", {"comment_id": comment.id, "from": before, "to": True, "actor_user_id": current_user.id})
    await db.commit()
    await db.refresh(comment)

    return build_comment_response(comment)


@router.post("/comments/{comment_id}/unblind", response_model=CommentOut)
async def unblind_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("staff")),
):
    """Remove blind from a comment (staff+ only)."""
    query = (
        select(Comment)
        .where(Comment.id == comment_id)
        .options(selectinload(Comment.author))
    )
    result = await db.execute(query)
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found"
        )

    before = bool(comment.is_blinded)
    comment.is_blinded = False
    _write_admin_audit("comments.blind_change", {"comment_id": comment.id, "from": before, "to": False, "actor_user_id": current_user.id})
    await db.commit()
    await db.refresh(comment)

    return build_comment_response(comment)
