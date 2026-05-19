from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func, desc
from sqlalchemy.dialects.postgresql import TSVECTOR
from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel
from app.core.deps import get_db, get_current_user_optional
from app.core.permissions import can_access_target_audience
from app.models.board import Post, Board
from app.models.gallery import Album
from app.models.event import Event
from app.models.user import User

router = APIRouter()


class PostSearchResult(BaseModel):
    id: int
    title: str
    content: str
    board_id: int
    board_name: Optional[str] = None
    author_id: int
    author_name: Optional[str] = None
    view_count: int
    created_at: datetime
    rank: Optional[float] = None  # Full-text search relevance score

    class Config:
        from_attributes = True


class AlbumSearchResult(BaseModel):
    id: int
    name: str
    visibility: str
    owner_id: int
    owner_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EventSearchResult(BaseModel):
    id: int
    title: str
    description: str
    start_time: datetime
    end_time: datetime
    owner_id: int
    owner_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SearchResponse(BaseModel):
    posts: list[PostSearchResult]
    albums: list[AlbumSearchResult]
    events: list[EventSearchResult]
    total_count: int
    query: str
    filters: dict
    used_fulltext: bool = False  # Indicates if full-text search was used


def is_post_accessible(post: Post, user: Optional[User]) -> bool:
    if user:
        return can_access_target_audience(
            user.role, user.rank, post.target_audience, post.target_ranks
        )
    return can_access_target_audience(
        "guest", "unranked", post.target_audience, post.target_ranks
    )


@router.get("", include_in_schema=False, response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    type: Optional[Literal["posts", "albums", "events", "all"]] = Query(
        "all", description="Filter by content type"
    ),
    date_from: Optional[date] = Query(None, description="Filter from date (inclusive)"),
    date_to: Optional[date] = Query(None, description="Filter to date (inclusive)"),
    author_id: Optional[int] = Query(
        None, description="Filter by author ID (posts only)"
    ),
    author_name: Optional[str] = Query(
        None, description="Filter by author name (posts only)"
    ),
    board_id: Optional[int] = Query(
        None, description="Filter by board ID (posts only)"
    ),
    use_fulltext: bool = Query(
        True, description="Use PostgreSQL full-text search for posts"
    ),
    limit: int = Query(20, ge=1, le=100, description="Max results per type"),
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Search across posts, albums, and events with optional filters.

    - **q**: Search query (required, searches title/name and content/description)
    - **type**: Filter to specific content type or "all"
    - **date_from**: Filter results created on or after this date
    - **date_to**: Filter results created on or before this date
    - **author_id**: Filter posts by author (posts only)
    - **author_name**: Filter posts by author name (posts only)
    - **board_id**: Filter posts by board (posts only)
    - **use_fulltext**: Use PostgreSQL full-text search for posts (default true)
    - **limit**: Maximum results per type (default 20, max 100)
    """
    posts_result = []
    albums_result = []
    events_result = []
    used_fulltext = False

    # Convert dates to datetime for comparison
    date_from_dt = (
        datetime.combine(date_from, datetime.min.time()) if date_from else None
    )
    date_to_dt = datetime.combine(date_to, datetime.max.time()) if date_to else None

    # Search Posts
    if type in ("all", "posts"):
        # Try full-text search if enabled and search_vector column exists
        if use_fulltext:
            try:
                # Convert query to tsquery format (handles spaces as AND)
                # Using 'simple' config for Korean text
                ts_query = func.plainto_tsquery("simple", q)

                # Select with relevance ranking
                rank_expr = func.ts_rank(Post.search_vector, ts_query).label("rank")

                post_query = (
                    select(
                        Post,
                        Board.name.label("board_name"),
                        User.name.label("author_name"),
                        rank_expr,
                    )
                    .join(Board, Post.board_id == Board.id, isouter=True)
                    .join(User, Post.author_id == User.id, isouter=True)
                    .where(
                        and_(
                            Post.is_hidden == False,
                            Post.is_blinded == False,
                            Post.search_vector.op("@@")(ts_query),
                        )
                    )
                )

                # Apply post-specific filters
                if author_id is not None:
                    post_query = post_query.where(Post.author_id == author_id)
                if author_name:
                    post_query = post_query.where(User.name.ilike(f"%{author_name}%"))
                if board_id is not None:
                    post_query = post_query.where(Post.board_id == board_id)
                if date_from_dt:
                    post_query = post_query.where(Post.created_at >= date_from_dt)
                if date_to_dt:
                    post_query = post_query.where(Post.created_at <= date_to_dt)

                # Order by relevance, then by date
                post_query = post_query.order_by(
                    desc(rank_expr), Post.created_at.desc()
                ).limit(limit)
                post_rows = (await db.execute(post_query)).all()

                for row in post_rows:
                    post, board_name, author_name, rank = row
                    if not is_post_accessible(post, user):
                        continue
                    posts_result.append(
                        PostSearchResult(
                            id=post.id,
                            title=post.title,
                            content=post.content[:200] + "..."
                            if len(post.content) > 200
                            else post.content,
                            board_id=post.board_id,
                            board_name=board_name,
                            author_id=post.author_id,
                            author_name=author_name,
                            view_count=post.view_count,
                            created_at=post.created_at,
                            rank=float(rank) if rank else None,
                        )
                    )
                used_fulltext = True
            except Exception:
                # Fall back to ILIKE if full-text search fails
                # (e.g., search_vector column doesn't exist yet)
                pass

        # Fallback to ILIKE search
        if not posts_result and not used_fulltext:
            post_query = (
                select(
                    Post, Board.name.label("board_name"), User.name.label("author_name")
                )
                .join(Board, Post.board_id == Board.id, isouter=True)
                .join(User, Post.author_id == User.id, isouter=True)
                .where(
                    and_(
                        Post.is_hidden == False,
                        Post.is_blinded == False,
                        or_(
                            Post.title.ilike(f"%{q}%"),
                            Post.content.ilike(f"%{q}%"),
                        ),
                    )
                )
            )

            # Apply post-specific filters
            if author_id is not None:
                post_query = post_query.where(Post.author_id == author_id)
            if author_name:
                post_query = post_query.where(User.name.ilike(f"%{author_name}%"))
            if board_id is not None:
                post_query = post_query.where(Post.board_id == board_id)
            if date_from_dt:
                post_query = post_query.where(Post.created_at >= date_from_dt)
            if date_to_dt:
                post_query = post_query.where(Post.created_at <= date_to_dt)

            post_query = post_query.order_by(Post.created_at.desc()).limit(limit)
            post_rows = (await db.execute(post_query)).all()

            for row in post_rows:
                post, board_name, author_name = row
                if not is_post_accessible(post, user):
                    continue
                posts_result.append(
                    PostSearchResult(
                        id=post.id,
                        title=post.title,
                        content=post.content[:200] + "..."
                        if len(post.content) > 200
                        else post.content,
                        board_id=post.board_id,
                        board_name=board_name,
                        author_id=post.author_id,
                        author_name=author_name,
                        view_count=post.view_count,
                        created_at=post.created_at,
                        rank=None,
                    )
                )

    # Search Albums
    if type in ("all", "albums"):
        album_query = (
            select(Album, User.name.label("owner_name"))
            .join(User, Album.owner_id == User.id, isouter=True)
            .where(
                and_(
                    Album.visibility == "public",
                    Album.name.ilike(f"%{q}%"),
                )
            )
        )

        if date_from_dt:
            album_query = album_query.where(Album.created_at >= date_from_dt)
        if date_to_dt:
            album_query = album_query.where(Album.created_at <= date_to_dt)

        album_query = album_query.order_by(Album.created_at.desc()).limit(limit)
        album_rows = (await db.execute(album_query)).all()

        for row in album_rows:
            album, owner_name = row
            albums_result.append(
                AlbumSearchResult(
                    id=album.id,
                    name=album.name,
                    visibility=album.visibility,
                    owner_id=album.owner_id,
                    owner_name=owner_name,
                    created_at=album.created_at,
                )
            )

    # Search Events
    if type in ("all", "events"):
        event_query = (
            select(Event, User.name.label("owner_name"))
            .join(User, Event.owner_id == User.id, isouter=True)
            .where(
                or_(
                    Event.title.ilike(f"%{q}%"),
                    Event.description.ilike(f"%{q}%"),
                )
            )
        )

        if date_from_dt:
            event_query = event_query.where(Event.created_at >= date_from_dt)
        if date_to_dt:
            event_query = event_query.where(Event.created_at <= date_to_dt)

        event_query = event_query.order_by(Event.start_time.desc()).limit(limit)
        event_rows = (await db.execute(event_query)).all()

        for row in event_rows:
            event, owner_name = row
            events_result.append(
                EventSearchResult(
                    id=event.id,
                    title=event.title,
                    description=event.description[:200] + "..."
                    if len(event.description) > 200
                    else event.description,
                    start_time=event.start_time,
                    end_time=event.end_time,
                    owner_id=event.owner_id,
                    owner_name=owner_name,
                    created_at=event.created_at,
                )
            )

    total_count = len(posts_result) + len(albums_result) + len(events_result)

    return SearchResponse(
        posts=posts_result,
        albums=albums_result,
        events=events_result,
        total_count=total_count,
        query=q,
        filters={
            "type": type,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "author_id": author_id,
            "author_name": author_name,
            "board_id": board_id,
        },
        used_fulltext=used_fulltext,
    )
