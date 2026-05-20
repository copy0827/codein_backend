"""Case 1: 프로젝트 전시 / 블로그 게시글 서비스."""

from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import HTTPException, Request, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.permissions import has_role
from app.models.board import Post, PostBoardType
from app.models.comment import Comment
from app.models.user import User
from app.schemas.boards import (
    BoardCreate,
    BoardDetailResponse,
    BoardListResponse,
    BoardUpdate,
    post_to_detail_response,
    post_to_list_item,
    serialize_post_create_fields,
    _comment_to_item,
)

SHOWCASE_TYPES = {PostBoardType.PROJECT.value, PostBoardType.BLOG.value}


def _normalize_board_type(value: str) -> str:
    normalized = (value or "").strip().upper()
    if normalized not in SHOWCASE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="board_type은 PROJECT 또는 BLOG 여야 합니다.",
        )
    return normalized


def _validate_project_fields(data: BoardCreate | BoardUpdate, *, is_create: bool) -> None:
    board_type = getattr(data, "board_type", None)
    if board_type is None and not is_create:
        return
    type_value = (
        board_type.value
        if hasattr(board_type, "value")
        else str(board_type).upper()
        if board_type
        else None
    )
    if type_value != PostBoardType.PROJECT.value:
        return

    github_url = getattr(data, "github_url", None)
    period = getattr(data, "period", None)
    team_info = getattr(data, "team_info", None)
    tech_stack = getattr(data, "tech_stack", None)

    if is_create:
        if not github_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PROJECT 게시글은 github_url이 필수입니다.",
            )
        if not period:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PROJECT 게시글은 period(진행 기간)가 필수입니다.",
            )
    if github_url is not None and not str(github_url).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="github_url은 비어 있을 수 없습니다.",
        )


async def _get_showcase_post(
    db: AsyncSession, post_id: int, *, for_update: bool = False
) -> Post:
    query = (
        select(Post)
        .where(
            and_(
                Post.id == post_id,
                Post.board_type.in_(list(SHOWCASE_TYPES)),
            )
        )
        .options(joinedload(Post.author))
    )
    result = await db.execute(query)
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다.",
        )
    if not for_update and post.is_hidden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다.",
        )
    return post


def _apply_search_filters(
    query,
    *,
    search_keyword: Optional[str],
    search_type: Optional[str],
):
    if not search_keyword:
        return query
    keyword = f"%{search_keyword.strip()}%"
    if search_type == "author":
        return query.join(Post.author).where(User.name.ilike(keyword))
    return query.where(Post.title.ilike(keyword))


async def list_showcase_posts(
    db: AsyncSession,
    *,
    board_type: str,
    page: int,
    size: int,
    search_keyword: Optional[str] = None,
    search_type: Optional[str] = "title",
    include_unpublished: bool = False,
) -> BoardListResponse:
    type_value = _normalize_board_type(board_type)
    if search_type not in (None, "title", "author"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="search_type은 title 또는 author 이어야 합니다.",
        )

    filters = [
        Post.board_type == type_value,
        Post.is_blinded == False,
    ]
    if not include_unpublished:
        filters.extend([Post.is_published == True, Post.is_hidden == False])

    count_query = select(func.count(func.distinct(Post.id))).where(and_(*filters))
    if search_keyword and search_type == "author":
        count_query = count_query.join(Post.author)
    elif search_keyword:
        count_query = count_query.where(Post.title.ilike(f"%{search_keyword.strip()}%"))
    total = (await db.execute(count_query)).scalar() or 0

    comment_count_sq = (
        select(func.count(Comment.id))
        .where(
            and_(
                Comment.post_id == Post.id,
                Comment.is_deleted == False,
                Comment.is_blinded == False,
            )
        )
        .correlate(Post)
        .scalar_subquery()
    )

    list_query = (
        select(Post, comment_count_sq.label("comment_count"))
        .where(and_(*filters))
        .options(joinedload(Post.author))
        .order_by(Post.is_pinned.desc(), Post.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    list_query = _apply_search_filters(
        list_query,
        search_keyword=search_keyword,
        search_type=search_type,
    )

    rows = (await db.execute(list_query)).unique().all()
    items = [
        post_to_list_item(post, comment_count=int(comment_count or 0))
        for post, comment_count in rows
    ]
    total_pages = max(1, math.ceil(total / size)) if total else 0

    return BoardListResponse(
        total=total,
        page=page,
        size=size,
        total_pages=total_pages,
        items=items,
    )


async def create_showcase_post(
    db: AsyncSession,
    *,
    data: BoardCreate,
    author: User,
) -> Post:
    if not has_role(author.role, "member"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="게시글 작성 권한이 없습니다. 로그인 후 이용해주세요.",
        )

    from app.models.board import Board

    board_exists = await db.execute(select(Board.id).where(Board.id == data.board_id))
    if not board_exists.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="소속 게시판을 찾을 수 없습니다.",
        )

    _validate_project_fields(data, is_create=True)
    payload = serialize_post_create_fields(data)
    payload["author_id"] = author.id

    post = Post(**payload)
    db.add(post)
    await db.commit()
    await db.refresh(post, ["author"])
    return post


async def get_showcase_post_detail(
    db: AsyncSession,
    post_id: int,
    *,
    current_user: Optional[User],
    request: Request,
) -> BoardDetailResponse:
    post = await _get_showcase_post(db, post_id)
    is_staff = current_user and has_role(current_user.role, "staff")
    if not post.is_published and not is_staff:
        if not current_user or current_user.id != post.author_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="발행되지 않은 게시글입니다.",
            )

    await increment_view_count(db, post, current_user=current_user, request=request)

    comments_result = await db.execute(
        select(Comment)
        .where(
            and_(
                Comment.post_id == post.id,
                Comment.is_deleted == False,
            )
        )
        .options(
            joinedload(Comment.author),
            selectinload(Comment.replies).joinedload(Comment.author),
        )
        .order_by(Comment.created_at.asc())
    )
    comments = comments_result.scalars().unique().all()

    count_result = await db.execute(
        select(func.count(Comment.id)).where(
            and_(
                Comment.post_id == post.id,
                Comment.is_deleted == False,
                Comment.is_blinded == False,
            )
        )
    )
    comment_count = count_result.scalar() or 0

    return post_to_detail_response(
        post,
        comments=comments,
        comment_count=comment_count,
    )


async def increment_view_count(
    db: AsyncSession,
    post: Post,
    *,
    current_user: Optional[User],
    request: Request,
) -> None:
    """
    조회수 증가.

    중복 증가 방지 가이드:
    - 로그인 사용자: 동일 사용자가 24시간 내 재조회 시 스킵 (PostReadLog 활용 가능)
    - 비로그인: X-Viewer-Key 헤더 또는 IP+User-Agent 해시 기반 (운영 환경에서는 Redis 권장)
    - 현재 구현: 로그인 사용자는 세션당 1회, 비로그인은 IP 기반 인메모리 1시간 TTL
    """
    from app.models.board import PostReadLog

    should_increment = True

    if current_user:
        recent = await db.execute(
            select(PostReadLog).where(
                and_(
                    PostReadLog.post_id == post.id,
                    PostReadLog.user_id == current_user.id,
                    PostReadLog.read_at
                    >= datetime.now(timezone.utc) - timedelta(hours=24),
                )
            )
        )
        if recent.scalar_one_or_none():
            should_increment = False
        else:
            db.add(PostReadLog(user_id=current_user.id, post_id=post.id))
    else:
        client_ip = request.client.host if request.client else "unknown"
        viewer_key = request.headers.get("X-Viewer-Key") or client_ip
        cache_key = f"{post.id}:{viewer_key}"
        if not hasattr(increment_view_count, "_guest_cache"):
            increment_view_count._guest_cache = {}
        cache: dict[str, datetime] = increment_view_count._guest_cache
        now = datetime.now(timezone.utc)
        last_seen = cache.get(cache_key)
        if last_seen and now - last_seen < timedelta(hours=1):
            should_increment = False
        else:
            cache[cache_key] = now

    if should_increment:
        post.view_count += 1
        await db.commit()
        await db.refresh(post)


def assert_can_modify_post(post: Post, user: User) -> None:
    if post.author_id == user.id:
        return
    if has_role(user.role, "admin"):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="본인 게시글이거나 관리자(ADMIN)만 수정·삭제할 수 있습니다.",
    )


async def update_showcase_post(
    db: AsyncSession,
    post_id: int,
    data: BoardUpdate,
    *,
    user: User,
) -> Post:
    post = await _get_showcase_post(db, post_id, for_update=True)
    assert_can_modify_post(post, user)

    update_payload = data.model_dump(exclude_unset=True)
    merged_type = update_payload.get("board_type", post.board_type)
    if merged_type:
        _validate_project_fields(
            BoardUpdate(
                board_type=merged_type,
                github_url=update_payload.get("github_url", post.github_url),
                period=update_payload.get("period", post.period),
                team_info=update_payload.get("team_info", post.team_info),
                tech_stack=update_payload.get("tech_stack"),
            ),
            is_create=False,
        )

    if "board_type" in update_payload and update_payload["board_type"] is not None:
        board_type = update_payload["board_type"]
        update_payload["board_type"] = (
            board_type.value if hasattr(board_type, "value") else str(board_type).upper()
        )
    if "tech_stack" in update_payload:
        tech = update_payload.pop("tech_stack")
        update_payload["tech_stack"] = (
            json.dumps(tech, ensure_ascii=False) if tech is not None else None
        )
    if "team_info" in update_payload:
        team = update_payload.pop("team_info")
        if team is None:
            update_payload["team_info"] = None
        elif isinstance(team, str):
            update_payload["team_info"] = team
        else:
            update_payload["team_info"] = json.dumps(team, ensure_ascii=False)

    for field, value in update_payload.items():
        setattr(post, field, value)

    await db.commit()
    await db.refresh(post, ["author"])
    return post


async def delete_showcase_post(
    db: AsyncSession,
    post_id: int,
    *,
    user: User,
) -> None:
    post = await _get_showcase_post(db, post_id, for_update=True)
    assert_can_modify_post(post, user)
    await db.delete(post)
    await db.commit()


async def is_showcase_post(db: AsyncSession, post_id: int) -> bool:
    result = await db.execute(
        select(Post.id).where(
            and_(Post.id == post_id, Post.board_type.in_(list(SHOWCASE_TYPES)))
        )
    )
    return result.scalar_one_or_none() is not None


async def get_showcase_post_for_github(
    db: AsyncSession,
    post_id: int,
    *,
    current_user: Optional[User] = None,
) -> Post:
    """GitHub 연동용 게시글 조회."""
    post = await _get_showcase_post(db, post_id)
    is_staff = current_user and has_role(current_user.role, "staff")
    if not post.is_published and not is_staff:
        if not current_user or current_user.id != post.author_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="발행된 게시글만 GitHub 정보를 조회할 수 있습니다.",
            )
    return post
