"""
Calendar API - Calendar view endpoints for events.
Provides monthly/weekly views with event grouping.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, extract
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
from typing import List, Optional
from collections import defaultdict


def _kst_now():
    return datetime.now(ZoneInfo("Asia/Seoul"))



from app.core.deps import get_db, get_current_user
from app.models.event import Event, Attendance
from app.models.user import User
from app.utils.recurrence import expand_events
from pydantic import BaseModel

router = APIRouter()


# ============ Schemas ============


class CalendarEventOut(BaseModel):
    id: int
    title: str
    description: str
    start_time: datetime
    end_time: datetime
    owner_id: int
    owner_name: Optional[str] = None
    location: Optional[str] = None
    is_online: bool = False
    max_attendees: Optional[int] = None
    attendee_count: int = 0
    is_attending: bool = False
    is_full: bool = False

    class Config:
        from_attributes = True


class DayEvents(BaseModel):
    date: str  # YYYY-MM-DD
    day_of_week: int  # 0=Monday, 6=Sunday
    events: List[CalendarEventOut]
    event_count: int


class MonthlyCalendarResponse(BaseModel):
    year: int
    month: int
    days: List[DayEvents]
    total_events: int


class WeeklyCalendarResponse(BaseModel):
    week_start: str  # YYYY-MM-DD (Monday)
    week_end: str  # YYYY-MM-DD (Sunday)
    days: List[DayEvents]
    total_events: int


class UpcomingEventsResponse(BaseModel):
    events: List[CalendarEventOut]
    total: int


# ============ Helper Functions ============


async def get_event_details(
    db: AsyncSession,
    occurrences: List[tuple[Event, datetime, datetime]],
    current_user_id: Optional[int] = None,
) -> List[CalendarEventOut]:
    """Convert Event models to CalendarEventOut with attendance info."""
    if not occurrences:
        return []

    event_ids = list({event.id for event, _, _ in occurrences})

    occurrence_dates = {start_time.date() for _, start_time, _ in occurrences}

    counts_result = await db.execute(
        select(
            Attendance.event_id, Attendance.occurrence_date, func.count(Attendance.id)
        )
        .where(
            and_(
                Attendance.event_id.in_(event_ids),
                Attendance.status == "attending",
                or_(
                    Attendance.occurrence_date.in_(occurrence_dates),
                    Attendance.occurrence_date.is_(None),
                ),
            )
        )
        .group_by(Attendance.event_id, Attendance.occurrence_date)
    )
    attendance_counts = {(row[0], row[1]): row[2] for row in counts_result.all()}

    user_attending = set()
    if current_user_id:
        user_result = await db.execute(
            select(Attendance.event_id, Attendance.occurrence_date).where(
                and_(
                    Attendance.event_id.in_(event_ids),
                    Attendance.user_id == current_user_id,
                    Attendance.status == "attending",
                    or_(
                        Attendance.occurrence_date.in_(occurrence_dates),
                        Attendance.occurrence_date.is_(None),
                    ),
                )
            )
        )
        user_attending = {(row[0], row[1]) for row in user_result.all()}

    # Get owner names
    owner_ids = list({event.owner_id for event, _, _ in occurrences})
    owners_result = await db.execute(
        select(User.id, User.name).where(User.id.in_(owner_ids))
    )
    owner_names = {row[0]: row[1] for row in owners_result.all()}

    result = []
    for event, start_time, end_time in occurrences:
        occurrence_key = (event.id, start_time.date())
        count = attendance_counts.get(occurrence_key)
        if count is None:
            count = attendance_counts.get((event.id, None), 0)
        is_full = event.max_attendees is not None and count >= event.max_attendees
        is_attending = (
            occurrence_key in user_attending or (event.id, None) in user_attending
        )

        result.append(
            CalendarEventOut(
                id=event.id,
                title=event.title,
                description=event.description,
                start_time=start_time,
                end_time=end_time,
                owner_id=event.owner_id,
                owner_name=owner_names.get(event.owner_id),
                location=event.location,
                is_online=event.is_online,
                max_attendees=event.max_attendees,
                attendee_count=count,
                is_attending=is_attending,
                is_full=is_full,
            )
        )

    return result


def group_events_by_date(events: List[CalendarEventOut]) -> dict:
    """Group events by their start date."""
    grouped = defaultdict(list)
    for event in events:
        date_str = event.start_time.date().isoformat()
        grouped[date_str].append(event)
    return grouped


# ============ Endpoints ============


@router.get("/monthly", response_model=MonthlyCalendarResponse)
async def get_monthly_calendar(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Get monthly calendar view with events.

    Returns all days of the month with their events.
    """
    # Calculate month boundaries
    first_day = date(year, month, 1)
    if month == 12:
        last_day = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        last_day = date(year, month + 1, 1) - timedelta(days=1)

    # Query events in the month
    start_dt = datetime.combine(first_day, datetime.min.time())
    end_dt = datetime.combine(last_day, datetime.max.time())

    result = await db.execute(
        select(Event)
        .where(Event.start_time <= end_dt)
        .where(
            or_(
                Event.recurrence_type.is_(None),
                Event.recurrence_end_date.is_(None),
                Event.recurrence_end_date >= start_dt,
            )
        )
        .order_by(Event.start_time)
    )
    events = result.scalars().all()

    occurrences = [
        (event, window.start_time, window.end_time)
        for event, window in expand_events(events, start_dt, end_dt)
    ]

    # Convert and group events
    user_id = current_user.id if current_user else None
    event_details = await get_event_details(db, occurrences, user_id)
    grouped = group_events_by_date(event_details)

    # Build response for all days in month
    days = []
    current = first_day
    while current <= last_day:
        date_str = current.isoformat()
        day_events = grouped.get(date_str, [])
        days.append(
            DayEvents(
                date=date_str,
                day_of_week=current.weekday(),
                events=day_events,
                event_count=len(day_events),
            )
        )
        current += timedelta(days=1)

    return MonthlyCalendarResponse(
        year=year,
        month=month,
        days=days,
        total_events=len(occurrences),
    )


@router.get("/weekly", response_model=WeeklyCalendarResponse)
async def get_weekly_calendar(
    year: int = Query(..., ge=2000, le=2100),
    week: int = Query(..., ge=1, le=53),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Get weekly calendar view with events.

    Week number follows ISO week numbering (week 1 contains Jan 4).
    """
    # Calculate week boundaries (Monday to Sunday)
    jan4 = date(year, 1, 4)
    week_start = jan4 - timedelta(days=jan4.weekday()) + timedelta(weeks=week - 1)
    week_end = week_start + timedelta(days=6)

    # Query events in the week
    start_dt = datetime.combine(week_start, datetime.min.time())
    end_dt = datetime.combine(week_end, datetime.max.time())

    result = await db.execute(
        select(Event)
        .where(Event.start_time <= end_dt)
        .where(
            or_(
                Event.recurrence_type.is_(None),
                Event.recurrence_end_date.is_(None),
                Event.recurrence_end_date >= start_dt,
            )
        )
        .order_by(Event.start_time)
    )
    events = result.scalars().all()

    occurrences = [
        (event, window.start_time, window.end_time)
        for event, window in expand_events(events, start_dt, end_dt)
    ]

    # Convert and group events
    user_id = current_user.id if current_user else None
    event_details = await get_event_details(db, occurrences, user_id)
    grouped = group_events_by_date(event_details)

    # Build response for all days in week
    days = []
    current = week_start
    while current <= week_end:
        date_str = current.isoformat()
        day_events = grouped.get(date_str, [])
        days.append(
            DayEvents(
                date=date_str,
                day_of_week=current.weekday(),
                events=day_events,
                event_count=len(day_events),
            )
        )
        current += timedelta(days=1)

    return WeeklyCalendarResponse(
        week_start=week_start.isoformat(),
        week_end=week_end.isoformat(),
        days=days,
        total_events=len(occurrences),
    )


@router.get("/date/{date_str}", response_model=DayEvents)
async def get_day_events(
    date_str: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Get events for a specific date.

    Date format: YYYY-MM-DD
    """
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use YYYY-MM-DD",
        )

    start_dt = datetime.combine(target_date, datetime.min.time())
    end_dt = datetime.combine(target_date, datetime.max.time())

    result = await db.execute(
        select(Event)
        .where(Event.start_time <= end_dt)
        .where(
            or_(
                Event.recurrence_type.is_(None),
                Event.recurrence_end_date.is_(None),
                Event.recurrence_end_date >= start_dt,
            )
        )
        .order_by(Event.start_time)
    )
    events = result.scalars().all()

    occurrences = [
        (event, window.start_time, window.end_time)
        for event, window in expand_events(events, start_dt, end_dt)
    ]

    user_id = current_user.id if current_user else None
    event_details = await get_event_details(db, occurrences, user_id)

    return DayEvents(
        date=date_str,
        day_of_week=target_date.weekday(),
        events=event_details,
        event_count=len(event_details),
    )


@router.get("/upcoming", response_model=UpcomingEventsResponse)
async def get_upcoming_events(
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Get upcoming events within the specified number of days.
    """
    now = _kst_now()
    end_dt = now + timedelta(days=days)

    result = await db.execute(
        select(Event)
        .where(Event.start_time <= end_dt)
        .where(
            or_(
                Event.recurrence_type.is_(None),
                Event.recurrence_end_date.is_(None),
                Event.recurrence_end_date >= now,
            )
        )
        .order_by(Event.start_time)
    )
    events = result.scalars().all()

    occurrences = [
        (event, window.start_time, window.end_time)
        for event, window in expand_events(events, now, end_dt)
    ]
    occurrences.sort(key=lambda item: item[1])
    occurrences = occurrences[:limit]

    user_id = current_user.id if current_user else None
    event_details = await get_event_details(db, occurrences, user_id)

    return UpcomingEventsResponse(
        events=event_details,
        total=len(event_details),
    )


@router.get("/my-events", response_model=UpcomingEventsResponse)
async def get_my_events(
    include_past: bool = False,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get events the current user is attending.
    """
    # Get event IDs the user is attending
    attendance_result = await db.execute(
        select(Attendance.event_id).where(
            and_(
                Attendance.user_id == current_user.id,
                Attendance.status == "attending",
            )
        )
    )
    event_ids = [row[0] for row in attendance_result.all()]

    if not event_ids:
        return UpcomingEventsResponse(events=[], total=0)

    # Get events
    query = select(Event).where(Event.id.in_(event_ids))
    result = await db.execute(query)
    events = result.scalars().all()

    now = _kst_now()
    range_start = now - timedelta(days=365) if include_past else now
    range_end = now + timedelta(days=365)

    occurrences = [
        (event, window.start_time, window.end_time)
        for event, window in expand_events(events, range_start, range_end)
    ]
    occurrences.sort(key=lambda item: item[1])
    occurrences = occurrences[:limit]

    event_details = await get_event_details(db, occurrences, current_user.id)

    return UpcomingEventsResponse(
        events=event_details,
        total=len(event_details),
    )
