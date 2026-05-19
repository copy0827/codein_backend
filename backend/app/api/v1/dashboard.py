"""
Dashboard API - Dashboard widgets and aggregated data endpoints.
Provides activity feed, popular posts, upcoming events, and stats.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import List, Optional
from pydantic import BaseModel


def _kst_now():
    return datetime.now(ZoneInfo("Asia/Seoul"))



from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.board import Post, Board
from app.models.event import Event, Attendance
from app.models.activity import ActivityLog
from app.models.notification import Notification

router = APIRouter()


# ============ Schemas ============


class ActivityItem(BaseModel):
    id: int
    activity_type: str
    description: Optional[str] = None
    points: int
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    created_at: datetime
    user_id: int
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class PopularPost(BaseModel):
    id: int
    title: str
    view_count: int
    board_id: int
    board_name: Optional[str] = None
    author_id: int
    author_name: Optional[str] = None
    created_at: datetime
    comment_count: int = 0

    class Config:
        from_attributes = True


class UpcomingEvent(BaseModel):
    id: int
    title: str
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    is_online: bool = False
    attendee_count: int = 0
    max_attendees: Optional[int] = None
    is_attending: bool = False

    class Config:
        from_attributes = True


class QuickStats(BaseModel):
    total_users: int = 0
    total_posts: int = 0
    total_events: int = 0
    active_users_today: int = 0
    posts_this_week: int = 0
    events_this_week: int = 0


class UserDashboardStats(BaseModel):
    unread_notifications: int = 0
    upcoming_events: int = 0
    my_posts_views: int = 0
    activity_points: int = 0
    rank: str = "unranked"
    points_to_next_rank: Optional[int] = None


class DashboardResponse(BaseModel):
    quick_stats: QuickStats
    activity_feed: List[ActivityItem]
    popular_posts: List[PopularPost]
    upcoming_events: List[UpcomingEvent]
    user_stats: Optional[UserDashboardStats] = None


class ActivityFeedResponse(BaseModel):
    activities: List[ActivityItem]
    total: int
    has_more: bool


class PopularPostsResponse(BaseModel):
    posts: List[PopularPost]
    period: str  # "day", "week", "month"


# ============ Helper Functions ============

RANK_THRESHOLDS = {
    "unranked": 0,
    "bronze": 100,
    "silver": 500,
    "gold": 1500,
    "platinum": 5000,
    "diamond": 15000,
}

RANK_ORDER = ["unranked", "bronze", "silver", "gold", "platinum", "diamond"]


def get_points_to_next_rank(current_rank: str, current_points: int) -> Optional[int]:
    """Calculate points needed for next rank."""
    try:
        idx = RANK_ORDER.index(current_rank)
        if idx < len(RANK_ORDER) - 1:
            next_rank = RANK_ORDER[idx + 1]
            return max(0, RANK_THRESHOLDS[next_rank] - current_points)
    except ValueError:
        pass
    return None


# ============ Endpoints ============


@router.get("", include_in_schema=False, response_model=DashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Get dashboard with all widgets.

    Includes quick stats, activity feed, popular posts, and upcoming events.
    """
    now = _kst_now()
    week_ago = now - timedelta(days=7)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Quick stats
    total_users_result = await db.execute(select(func.count(User.id)))
    total_users = total_users_result.scalar() or 0

    total_posts_result = await db.execute(
        select(func.count(Post.id)).where(Post.is_hidden == False)
    )
    total_posts = total_posts_result.scalar() or 0

    total_events_result = await db.execute(select(func.count(Event.id)))
    total_events = total_events_result.scalar() or 0

    # Active users today (users with activity logs today)
    active_today_result = await db.execute(
        select(func.count(func.distinct(ActivityLog.user_id))).where(
            ActivityLog.created_at >= today_start
        )
    )
    active_today = active_today_result.scalar() or 0

    posts_week_result = await db.execute(
        select(func.count(Post.id)).where(Post.created_at >= week_ago)
    )
    posts_week = posts_week_result.scalar() or 0

    events_week_result = await db.execute(
        select(func.count(Event.id)).where(Event.start_time >= now, Event.start_time <= now + timedelta(days=7))
    )
    events_week = events_week_result.scalar() or 0

    quick_stats = QuickStats(
        total_users=total_users,
        total_posts=total_posts,
        total_events=total_events,
        active_users_today=active_today,
        posts_this_week=posts_week,
        events_this_week=events_week,
    )

    # Activity feed (recent activities)
    activity_result = await db.execute(
        select(ActivityLog, User)
        .join(User, ActivityLog.user_id == User.id)
        .order_by(desc(ActivityLog.created_at))
        .limit(10)
    )
    activity_rows = activity_result.all()

    activity_feed = [
        ActivityItem(
            id=log.id,
            activity_type=log.activity_type,
            description=log.description,
            points=log.points,
            reference_type=log.reference_type,
            reference_id=log.reference_id,
            created_at=log.created_at,
            user_id=user.id,
            user_name=user.name,
        )
        for log, user in activity_rows
    ]

    # Popular posts (last 7 days, by view count)
    popular_result = await db.execute(
        select(Post, User, Board)
        .join(User, Post.author_id == User.id)
        .join(Board, Post.board_id == Board.id)
        .where(
            and_(
                Post.created_at >= week_ago,
                Post.is_hidden == False,
                Post.is_blinded == False,
            )
        )
        .order_by(desc(Post.view_count))
        .limit(5)
    )
    popular_rows = popular_result.all()

    popular_posts = [
        PopularPost(
            id=post.id,
            title=post.title,
            view_count=post.view_count,
            board_id=post.board_id,
            board_name=board.name,
            author_id=post.author_id,
            author_name=user.name,
            created_at=post.created_at,
        )
        for post, user, board in popular_rows
    ]

    # Upcoming events
    user_id = current_user.id if current_user else None

    events_result = await db.execute(
        select(Event)
        .where(Event.start_time >= now)
        .order_by(Event.start_time)
        .limit(5)
    )
    events = events_result.scalars().all()

    # Get attendance counts and user's attendance
    event_ids = [e.id for e in events]
    attendance_counts = {}
    user_attending = set()

    if event_ids:
        counts_result = await db.execute(
            select(Attendance.event_id, func.count(Attendance.id))
            .where(
                and_(
                    Attendance.event_id.in_(event_ids),
                    Attendance.status == "attending",
                )
            )
            .group_by(Attendance.event_id)
        )
        attendance_counts = dict(counts_result.all())

        if user_id:
            user_result = await db.execute(
                select(Attendance.event_id).where(
                    and_(
                        Attendance.event_id.in_(event_ids),
                        Attendance.user_id == user_id,
                        Attendance.status == "attending",
                    )
                )
            )
            user_attending = {row[0] for row in user_result.all()}

    upcoming_events = [
        UpcomingEvent(
            id=event.id,
            title=event.title,
            start_time=event.start_time,
            end_time=event.end_time,
            location=event.location,
            is_online=event.is_online,
            attendee_count=attendance_counts.get(event.id, 0),
            max_attendees=event.max_attendees,
            is_attending=event.id in user_attending,
        )
        for event in events
    ]

    # User-specific stats
    user_stats = None
    if current_user:
        # Unread notifications
        unread_result = await db.execute(
            select(func.count(Notification.id)).where(
                and_(
                    Notification.user_id == current_user.id,
                    Notification.is_read == False,
                )
            )
        )
        unread = unread_result.scalar() or 0

        # Upcoming events user is attending
        upcoming_attending_result = await db.execute(
            select(func.count(Attendance.id))
            .join(Event, Attendance.event_id == Event.id)
            .where(
                and_(
                    Attendance.user_id == current_user.id,
                    Attendance.status == "attending",
                    Event.start_time >= now,
                )
            )
        )
        upcoming_attending = upcoming_attending_result.scalar() or 0

        # Total views on user's posts
        views_result = await db.execute(
            select(func.sum(Post.view_count)).where(Post.author_id == current_user.id)
        )
        total_views = views_result.scalar() or 0

        user_stats = UserDashboardStats(
            unread_notifications=unread,
            upcoming_events=upcoming_attending,
            my_posts_views=total_views,
            activity_points=current_user.activity_points,
            rank=current_user.rank,
            points_to_next_rank=get_points_to_next_rank(
                current_user.rank, current_user.activity_points
            ),
        )

    return DashboardResponse(
        quick_stats=quick_stats,
        activity_feed=activity_feed,
        popular_posts=popular_posts,
        upcoming_events=upcoming_events,
        user_stats=user_stats,
    )


@router.get("/activity", response_model=ActivityFeedResponse)
async def get_activity_feed(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user_id: Optional[int] = None,
    activity_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get activity feed with filtering and pagination.
    """
    query = select(ActivityLog, User).join(User, ActivityLog.user_id == User.id)

    if user_id:
        query = query.where(ActivityLog.user_id == user_id)

    if activity_type:
        query = query.where(ActivityLog.activity_type == activity_type)

    # Get total count
    count_query = select(func.count(ActivityLog.id))
    if user_id:
        count_query = count_query.where(ActivityLog.user_id == user_id)
    if activity_type:
        count_query = count_query.where(ActivityLog.activity_type == activity_type)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    query = query.order_by(desc(ActivityLog.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    activities = [
        ActivityItem(
            id=log.id,
            activity_type=log.activity_type,
            description=log.description,
            points=log.points,
            reference_type=log.reference_type,
            reference_id=log.reference_id,
            created_at=log.created_at,
            user_id=user.id,
            user_name=user.name,
        )
        for log, user in rows
    ]

    return ActivityFeedResponse(
        activities=activities,
        total=total,
        has_more=skip + limit < total,
    )


@router.get("/popular-posts", response_model=PopularPostsResponse)
async def get_popular_posts(
    period: str = Query("week", regex="^(day|week|month)$"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """
    Get popular posts for a time period.
    """
    now = _kst_now()

    if period == "day":
        since = now - timedelta(days=1)
    elif period == "week":
        since = now - timedelta(days=7)
    else:  # month
        since = now - timedelta(days=30)

    result = await db.execute(
        select(Post, User, Board)
        .join(User, Post.author_id == User.id)
        .join(Board, Post.board_id == Board.id)
        .where(
            and_(
                Post.created_at >= since,
                Post.is_hidden == False,
                Post.is_blinded == False,
            )
        )
        .order_by(desc(Post.view_count))
        .limit(limit)
    )
    rows = result.all()

    posts = [
        PopularPost(
            id=post.id,
            title=post.title,
            view_count=post.view_count,
            board_id=post.board_id,
            board_name=board.name,
            author_id=post.author_id,
            author_name=user.name,
            created_at=post.created_at,
        )
        for post, user, board in rows
    ]

    return PopularPostsResponse(posts=posts, period=period)


@router.get("/my-summary", response_model=UserDashboardStats)
async def get_my_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get dashboard summary for current user.
    """
    now = _kst_now()

    # Unread notifications
    unread_result = await db.execute(
        select(func.count(Notification.id)).where(
            and_(
                Notification.user_id == current_user.id,
                Notification.is_read == False,
            )
        )
    )
    unread = unread_result.scalar() or 0

    # Upcoming events
    upcoming_result = await db.execute(
        select(func.count(Attendance.id))
        .join(Event, Attendance.event_id == Event.id)
        .where(
            and_(
                Attendance.user_id == current_user.id,
                Attendance.status == "attending",
                Event.start_time >= now,
            )
        )
    )
    upcoming = upcoming_result.scalar() or 0

    # Total views
    views_result = await db.execute(
        select(func.sum(Post.view_count)).where(Post.author_id == current_user.id)
    )
    total_views = views_result.scalar() or 0

    return UserDashboardStats(
        unread_notifications=unread,
        upcoming_events=upcoming,
        my_posts_views=total_views,
        activity_points=current_user.activity_points,
        rank=current_user.rank,
        points_to_next_rank=get_points_to_next_rank(
            current_user.rank, current_user.activity_points
        ),
    )
