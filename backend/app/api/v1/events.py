"""
Events API - Event and RSVP management endpoints.
Supports capacity limits, waitlist, and auto-promotion.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from datetime import datetime, date
from zoneinfo import ZoneInfo

def _kst_now():
    return datetime.now(ZoneInfo("Asia/Seoul"))
from typing import List, Optional

from app.core.deps import (
    get_db,
    get_current_user,
    get_current_user_optional,
    require_roles,
)
from app.models.event import Event, Attendance
from app.models.notification import Notification
from app.core.permissions import has_role
from app.models.user import User
from app.api.v1.notifications import send_notification
from app.schemas.event import (
    EventCreate,
    EventUpdate,
    EventOut,
    AttendanceOut,
    AttendeeInfo,
    RSVPResponse,
    RSVPStatusResponse,
    RSVPCancelResponse,
    EventAttendeesResponse,
    EventWaitlistResponse,
    CheckInCodeResponse,
    CheckInResponse,
    CheckInStatsResponse,
)
from app.api.v1.activity import grant_points
from app.core.storage import generate_qr_code, delete_qr_code
from app.utils.recurrence import expand_events
import secrets

router = APIRouter()


def to_naive_datetime(value: Optional[datetime]) -> Optional[datetime]:
    if value and value.tzinfo:
        return value.replace(tzinfo=None)
    return value


async def get_event_counts(
    db: AsyncSession,
    event_id: int,
    occurrence_date: date,
    include_null: bool = False,
) -> tuple[int, int]:
    attendee_conditions = [
        Attendance.event_id == event_id,
        Attendance.status == "attending",
    ]
    waitlist_conditions = [
        Attendance.event_id == event_id,
        Attendance.status == "waitlist",
    ]
    if include_null:
        attendee_conditions.append(
            or_(
                Attendance.occurrence_date == occurrence_date,
                Attendance.occurrence_date.is_(None),
            )
        )
        waitlist_conditions.append(
            or_(
                Attendance.occurrence_date == occurrence_date,
                Attendance.occurrence_date.is_(None),
            )
        )
    else:
        attendee_conditions.append(Attendance.occurrence_date == occurrence_date)
        waitlist_conditions.append(Attendance.occurrence_date == occurrence_date)

    attendee_result = await db.execute(
        select(func.count(Attendance.id)).where(and_(*attendee_conditions))
    )
    attendee_count = attendee_result.scalar() or 0

    waitlist_result = await db.execute(
        select(func.count(Attendance.id)).where(and_(*waitlist_conditions))
    )
    waitlist_count = waitlist_result.scalar() or 0

    return attendee_count, waitlist_count


def resolve_occurrence_date(event: Event, occurrence_date: Optional[date]) -> date:
    if event.recurrence_type:
        if occurrence_date is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Occurrence date is required for recurring events",
            )
        range_start = datetime.combine(occurrence_date, datetime.min.time())
        range_end = datetime.combine(occurrence_date, datetime.max.time())
        occurrences = expand_events([event], range_start, range_end)
        if not occurrences:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Occurrence date is not valid for this event",
            )
        return occurrence_date

    event_date = event.start_time.date()
    if occurrence_date and occurrence_date != event_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Occurrence date does not match event date",
        )
    return event_date


async def event_to_out(
    db: AsyncSession,
    event: Event,
    start_time_override: datetime | None = None,
    end_time_override: datetime | None = None,
    occurrence_date: Optional[date] = None,
) -> EventOut:
    start_time = start_time_override or event.start_time
    end_time = end_time_override or event.end_time
    resolved_date = occurrence_date or start_time.date()
    include_null = event.recurrence_type is None

    attendee_count, waitlist_count = await get_event_counts(
        db, event.id, resolved_date, include_null
    )
    is_full = event.max_attendees is not None and attendee_count >= event.max_attendees

    checked_in_conditions = [
        Attendance.event_id == event.id,
        Attendance.status == "attending",
        Attendance.checked_in_at.isnot(None),
    ]
    if include_null:
        checked_in_conditions.append(
            or_(
                Attendance.occurrence_date == resolved_date,
                Attendance.occurrence_date.is_(None),
            )
        )
    else:
        checked_in_conditions.append(Attendance.occurrence_date == resolved_date)

    checked_in_result = await db.execute(
        select(func.count(Attendance.id)).where(and_(*checked_in_conditions))
    )
    checked_in_count = checked_in_result.scalar() or 0

    return EventOut(
        id=event.id,
        title=event.title,
        description=event.description,
        start_time=start_time,
        end_time=end_time,
        owner_id=event.owner_id,
        created_at=event.created_at,
        event_type=event.event_type,
        team=event.team,
        target_rank=event.target_rank,
        approval_status=event.approval_status,
        recurrence_type=event.recurrence_type,
        recurrence_interval=event.recurrence_interval,
        recurrence_end_date=event.recurrence_end_date,
        recurrence_count=event.recurrence_count,
        max_attendees=event.max_attendees,
        location=event.location,
        is_online=event.is_online,
        online_link=event.online_link,
        registration_deadline=event.registration_deadline,
        allow_waitlist=event.allow_waitlist,
        check_in_enabled=event.check_in_enabled,
        check_in_start=event.check_in_start,
        check_in_end=event.check_in_end,
        checked_in_count=checked_in_count,
        attendee_count=attendee_count,
        waitlist_count=waitlist_count,
        is_full=is_full,
    )


async def promote_from_waitlist(
    db: AsyncSession, event_id: int, occurrence_date: date, include_null: bool
) -> Optional[int]:
    conditions = [
        Attendance.event_id == event_id,
        Attendance.status == "waitlist",
    ]
    if include_null:
        conditions.append(
            or_(
                Attendance.occurrence_date == occurrence_date,
                Attendance.occurrence_date.is_(None),
            )
        )
    else:
        conditions.append(Attendance.occurrence_date == occurrence_date)

    result = await db.execute(
        select(Attendance)
        .where(and_(*conditions))
        .order_by(Attendance.waitlist_position)
        .limit(1)
    )
    first_waitlist = result.scalar_one_or_none()

    if first_waitlist:
        # Promote to attending
        first_waitlist.status = "attending"
        first_waitlist.waitlist_position = None

        # Reorder remaining waitlist
        remaining_result = await db.execute(
            select(Attendance)
            .where(
                and_(Attendance.event_id == event_id, Attendance.status == "waitlist")
            )
            .order_by(Attendance.waitlist_position)
        )
        remaining = remaining_result.scalars().all()
        for i, attendance in enumerate(remaining, start=1):
            attendance.waitlist_position = i

        return first_waitlist.user_id

    return None


# ============ Event CRUD Endpoints ============


@router.post("", include_in_schema=False, response_model=EventOut)
async def create_event(
    data: EventCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles("staff", "admin", "superadmin")),
):
    """Create a new event."""
    # Generate check-in code if enabled
    check_in_code = None
    if data.check_in_enabled:
        check_in_code = secrets.token_urlsafe(16)

    approval_status = "approved" if has_role(user.role, "staff") else "pending"
    approved_by = user.id if approval_status == "approved" else None
    approved_at = _kst_now() if approval_status == "approved" else None

    event = Event(
        title=data.title,
        description=data.description,
        start_time=to_naive_datetime(data.start_time),
        end_time=to_naive_datetime(data.end_time),
        owner_id=user.id,
        event_type=data.event_type,
        team=data.team,
        target_rank=data.target_rank,
        approval_status=approval_status,
        approved_by=approved_by,
        approved_at=approved_at,
        recurrence_type=data.recurrence_type,
        recurrence_interval=data.recurrence_interval,
        recurrence_end_date=to_naive_datetime(data.recurrence_end_date),
        recurrence_count=data.recurrence_count,
        max_attendees=data.max_attendees,
        location=data.location,
        is_online=data.is_online,
        online_link=data.online_link,
        registration_deadline=to_naive_datetime(data.registration_deadline),
        allow_waitlist=data.allow_waitlist,
        check_in_enabled=data.check_in_enabled,
        check_in_code=check_in_code,
        check_in_start=to_naive_datetime(data.check_in_start),
        check_in_end=to_naive_datetime(data.check_in_end),
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    if event.approval_status == "approved":
        users_result = await db.execute(
            select(User).where(
                and_(
                    User.id != user.id,
                    User.notify_event_update == True,
                )
            )
        )
        users = users_result.scalars().all()
        for target in users:
            if event.target_rank and target.rank != event.target_rank:
                continue
            await send_notification(
                db=db,
                user_id=target.id,
                notification_type="event_change",
                title="일정 업데이트",
                message=f"{user.name}님이 '{event.title}' 일정을 수정했습니다.",
                link=f"/events/{event.id}",
                related_type="event",
                related_id=event.id,
            )

    return await event_to_out(db, event)


@router.get("", include_in_schema=False, response_model=List[EventOut])
async def list_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    upcoming_only: bool = False,
    event_type: Optional[str] = None,
    team: Optional[str] = None,
    target_rank: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all events with optional filtering."""
    query = select(Event)

    if upcoming_only:
        query = query.where(Event.end_time > _kst_now())

    query = query.where(Event.approval_status == "approved")

    if event_type:
        query = query.where(Event.event_type == event_type)
    if team:
        query = query.where(Event.team == team)
    if target_rank:
        query = query.where(Event.target_rank == target_rank)

    query = query.order_by(Event.start_time).offset(skip).limit(limit)
    result = await db.execute(query)
    events = result.scalars().all()

    return [await event_to_out(db, e) for e in events]


@router.get("/occurrences", response_model=List[EventOut])
async def list_occurrences(
    start: datetime = Query(...),
    end: datetime = Query(...),
    event_type: Optional[str] = None,
    team: Optional[str] = None,
    target_rank: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if start >= end:
        raise HTTPException(status_code=400, detail="Invalid occurrence range")

    start_naive = start.replace(tzinfo=None) if start.tzinfo else start
    end_naive = end.replace(tzinfo=None) if end.tzinfo else end

    query = (
        select(Event)
        .where(Event.start_time <= end_naive)
        .where(
            or_(
                Event.recurrence_type.is_(None),
                Event.recurrence_end_date.is_(None),
                Event.recurrence_end_date >= start_naive,
            )
        )
        .where(Event.approval_status == "approved")
    )

    if event_type:
        query = query.where(Event.event_type == event_type)
    if team:
        query = query.where(Event.team == team)
    if target_rank:
        query = query.where(Event.target_rank == target_rank)

    result = await db.execute(query.order_by(Event.start_time))
    events = result.scalars().all()

    occurrences = [
        (event, window.start_time, window.end_time)
        for event, window in expand_events(events, start_naive, end_naive)
    ]
    occurrences.sort(key=lambda item: item[1])

    return [
        await event_to_out(db, event, occ_start, occ_end)
        for event, occ_start, occ_end in occurrences
    ]


@router.get("/{event_id}", response_model=EventOut)
async def get_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get event details by ID."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    if event.approval_status != "approved":
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Event awaiting approval",
            )
        if event.owner_id != current_user.id and not has_role(
            current_user.role, "staff"
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Event awaiting approval",
            )

    if current_user:
        now = _kst_now()
        time_until = event.start_time - now
        reminders = []
        if time_until.total_seconds() > 0 and current_user.notify_event_reminder:
            if current_user.reminder_24h and time_until.total_seconds() <= 86400:
                reminders.append("event_reminder_24h")
            if current_user.reminder_1h and time_until.total_seconds() <= 3600:
                reminders.append("event_reminder_1h")

        for reminder_type in reminders:
            existing = await db.execute(
                select(Notification).where(
                    Notification.user_id == current_user.id,
                    Notification.related_type == "event",
                    Notification.related_id == event.id,
                    Notification.notification_type == reminder_type,
                )
            )
            if existing.scalar_one_or_none():
                continue
            await send_notification(
                db=db,
                user_id=current_user.id,
                notification_type=reminder_type,
                title="일정 리마인더",
                message=f"{event.title} 일정이 곧 시작됩니다.",
                link=f"/events/{event.id}",
                related_type="event",
                related_id=event.id,
            )

    return await event_to_out(db, event)


@router.put("/{event_id}", response_model=EventOut)
async def update_event(
    event_id: int,
    data: EventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "superadmin")),
):
    """Update event. Only owner can update."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    if event.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only event owner can update",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if isinstance(value, datetime):
            value = to_naive_datetime(value)
        setattr(event, field, value)

    await db.commit()
    await db.refresh(event)
    return await event_to_out(db, event)


@router.post("/{event_id}/approve", response_model=EventOut)
async def approve_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "superadmin")),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event.approval_status = "approved"
    event.approved_by = current_user.id
    event.approved_at = _kst_now()
    await db.commit()
    await db.refresh(event)
    return await event_to_out(db, event)


@router.delete("/{event_id}")
async def delete_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "superadmin")),
):
    """Delete event. Only owner can delete."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    if event.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only event owner can delete",
        )

    await db.delete(event)
    await db.commit()

    return {"message": "Event deleted successfully"}


# ============ RSVP Endpoints ============


@router.post("/{event_id}/attend", response_model=RSVPResponse)
async def attend_event(
    event_id: int,
    notes: Optional[str] = None,
    occurrence_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    resolved_date = resolve_occurrence_date(event, occurrence_date)
    include_null = event.recurrence_type is None

    if event.registration_deadline and _kst_now() > event.registration_deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration deadline has passed",
        )

    attendance_conditions = [
        Attendance.event_id == event_id,
        Attendance.user_id == user.id,
        Attendance.status.in_(["attending", "waitlist"]),
    ]
    if include_null:
        attendance_conditions.append(
            or_(
                Attendance.occurrence_date == resolved_date,
                Attendance.occurrence_date.is_(None),
            )
        )
    else:
        attendance_conditions.append(Attendance.occurrence_date == resolved_date)

    existing_result = await db.execute(
        select(Attendance)
        .where(and_(*attendance_conditions))
        .order_by(Attendance.registered_at.desc())
        .limit(1)
    )
    existing = existing_result.scalars().first()

    if existing:
        if existing.status == "attending":
            return RSVPResponse(
                status="already_attending",
                message="You are already registered for this event",
            )
        elif existing.status == "waitlist":
            return RSVPResponse(
                status="already_waitlist",
                message="You are already on the waitlist",
                waitlist_position=existing.waitlist_position,
            )

    attendee_count, waitlist_count = await get_event_counts(
        db, event_id, resolved_date, include_null
    )
    is_full = event.max_attendees is not None and attendee_count >= event.max_attendees

    if is_full:
        if not event.allow_waitlist:
            return RSVPResponse(
                status="event_full",
                message="Event is full and waitlist is not enabled",
                attendee_count=attendee_count,
                max_attendees=event.max_attendees,
            )

        attendance = Attendance(
            event_id=event_id,
            user_id=user.id,
            occurrence_date=resolved_date,
            status="waitlist",
            waitlist_position=waitlist_count + 1,
            notes=notes,
        )
        db.add(attendance)
        await db.commit()

        return RSVPResponse(
            status="waitlist",
            message="Event is full. You have been added to the waitlist.",
            waitlist_position=waitlist_count + 1,
            attendee_count=attendee_count,
            max_attendees=event.max_attendees,
        )

    attendance = Attendance(
        event_id=event_id,
        user_id=user.id,
        occurrence_date=resolved_date,
        status="attending",
        notes=notes,
    )
    db.add(attendance)
    await db.commit()

    # Grant activity points
    try:
        await grant_points(
            db=db,
            user_id=user.id,
            activity_type="event_attend",
            reference_type="event",
            reference_id=event_id,
        )
    except Exception:
        pass

    return RSVPResponse(
        status="attending",
        message="Successfully registered for the event",
        attendee_count=attendee_count + 1,
        max_attendees=event.max_attendees,
    )


@router.post("/{event_id}/rsvp", response_model=RSVPStatusResponse)
async def set_rsvp_status(
    event_id: int,
    status: str = Query(...),
    notes: Optional[str] = None,
    occurrence_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if status not in {"tentative", "declined"}:
        raise HTTPException(status_code=400, detail="Invalid RSVP status")

    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    resolved_date = resolve_occurrence_date(event, occurrence_date)
    include_null = event.recurrence_type is None

    attendance_conditions = [
        Attendance.event_id == event_id,
        Attendance.user_id == current_user.id,
    ]
    if include_null:
        attendance_conditions.append(
            or_(
                Attendance.occurrence_date == resolved_date,
                Attendance.occurrence_date.is_(None),
            )
        )
    else:
        attendance_conditions.append(Attendance.occurrence_date == resolved_date)

    attendance_result = await db.execute(
        select(Attendance)
        .where(and_(*attendance_conditions))
        .order_by(Attendance.registered_at.desc())
        .limit(1)
    )
    attendance = attendance_result.scalars().first()

    was_attending = attendance is not None and attendance.status == "attending"
    was_waitlist = attendance is not None and attendance.status == "waitlist"

    if attendance:
        attendance.status = status
        attendance.notes = notes
        attendance.waitlist_position = None
        attendance.cancelled_at = _kst_now() if status == "declined" else None
    else:
        attendance = Attendance(
            event_id=event_id,
            user_id=current_user.id,
            status=status,
            occurrence_date=resolved_date if event.recurrence_type else None,
            notes=notes,
        )
        db.add(attendance)

    if was_attending:
        await promote_from_waitlist(db, event_id, resolved_date, include_null)
        # Deduct points for cancellation
        try:
            await grant_points(
                db=db,
                user_id=current_user.id,
                activity_type="event_cancel",
                reference_type="event",
                reference_id=event_id,
            )
        except Exception:
            pass

    if was_waitlist:
        reorder_conditions = [
            Attendance.event_id == event_id,
            Attendance.status == "waitlist",
        ]
        if include_null:
            reorder_conditions.append(
                or_(
                    Attendance.occurrence_date == resolved_date,
                    Attendance.occurrence_date.is_(None),
                )
            )
        else:
            reorder_conditions.append(Attendance.occurrence_date == resolved_date)

        remaining_result = await db.execute(
            select(Attendance)
            .where(and_(*reorder_conditions))
            .order_by(Attendance.waitlist_position)
        )
        remaining = remaining_result.scalars().all()
        for index, waitlist_attendance in enumerate(remaining, start=1):
            waitlist_attendance.waitlist_position = index

    await db.commit()

    attendee_count, _ = await get_event_counts(
        db, event.id, resolved_date, include_null
    )

    return RSVPStatusResponse(
        status=status,
        message="RSVP status updated",
        attendee_count=attendee_count,
        max_attendees=event.max_attendees,
    )


@router.delete("/{event_id}/attend", response_model=RSVPCancelResponse)
async def cancel_attendance(
    event_id: int,
    occurrence_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    resolved_date = resolve_occurrence_date(event, occurrence_date)
    include_null = event.recurrence_type is None

    attendance_conditions = [
        Attendance.event_id == event_id,
        Attendance.user_id == user.id,
        Attendance.status.in_(["attending", "waitlist"]),
    ]
    if include_null:
        attendance_conditions.append(
            or_(
                Attendance.occurrence_date == resolved_date,
                Attendance.occurrence_date.is_(None),
            )
        )
    else:
        attendance_conditions.append(Attendance.occurrence_date == resolved_date)

    result = await db.execute(
        select(Attendance)
        .where(and_(*attendance_conditions))
        .order_by(Attendance.registered_at.desc())
        .limit(1)
    )
    attendance = result.scalars().first()

    if not attendance:
        return RSVPCancelResponse(
            status="not_found",
            message="You are not registered for this event",
        )

    was_attending = attendance.status == "attending"

    attendance.status = "cancelled"
    attendance.cancelled_at = _kst_now()
    attendance.waitlist_position = None

    promoted_user_id = None

    if was_attending:
        promoted_user_id = await promote_from_waitlist(
            db, event_id, resolved_date, include_null
        )
        # Deduct points for cancellation
        try:
            await grant_points(
                db=db,
                user_id=user.id,
                activity_type="event_cancel",
                reference_type="event",
                reference_id=event_id,
            )
        except Exception:
            pass

    await db.commit()

    message = "Successfully cancelled registration"
    if promoted_user_id:
        message += ". A user from the waitlist has been promoted."

    return RSVPCancelResponse(
        status="cancelled",
        message=message,
        promoted_user_id=promoted_user_id,
    )


@router.get("/{event_id}/my-attendance", response_model=Optional[AttendanceOut])
async def get_my_attendance(
    event_id: int,
    occurrence_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    resolved_date = resolve_occurrence_date(event, occurrence_date)
    include_null = event.recurrence_type is None

    attendance_conditions = [
        Attendance.event_id == event_id,
        Attendance.user_id == user.id,
    ]
    if include_null:
        attendance_conditions.append(
            or_(
                Attendance.occurrence_date == resolved_date,
                Attendance.occurrence_date.is_(None),
            )
        )
    else:
        attendance_conditions.append(Attendance.occurrence_date == resolved_date)

    result = await db.execute(
        select(Attendance)
        .where(and_(*attendance_conditions))
        .order_by(Attendance.registered_at.desc())
        .limit(1)
    )
    attendance = result.scalars().first()

    return attendance


@router.get("/{event_id}/attendees", response_model=EventAttendeesResponse)
async def get_attendees(
    event_id: int,
    occurrence_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    resolved_date = resolve_occurrence_date(event, occurrence_date)
    include_null = event.recurrence_type is None

    attendee_conditions = [
        Attendance.event_id == event_id,
        Attendance.status == "attending",
    ]
    if include_null:
        attendee_conditions.append(
            or_(
                Attendance.occurrence_date == resolved_date,
                Attendance.occurrence_date.is_(None),
            )
        )
    else:
        attendee_conditions.append(Attendance.occurrence_date == resolved_date)

    result = await db.execute(
        select(Attendance, User)
        .join(User, Attendance.user_id == User.id)
        .where(and_(*attendee_conditions))
        .order_by(Attendance.registered_at)
    )
    rows = result.all()

    attendees = [
        AttendeeInfo(
            user_id=user.id,
            user_name=user.name,
            status=attendance.status,
            registered_at=attendance.registered_at,
            occurrence_date=attendance.occurrence_date,
            waitlist_position=attendance.waitlist_position,
            checked_in_at=attendance.checked_in_at,
        )
        for attendance, user in rows
    ]

    return EventAttendeesResponse(
        event_id=event_id,
        attendee_count=len(attendees),
        max_attendees=event.max_attendees,
        attendees=attendees,
    )


@router.get("/{event_id}/waitlist", response_model=EventWaitlistResponse)
async def get_waitlist(
    event_id: int,
    occurrence_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    resolved_date = resolve_occurrence_date(event, occurrence_date)
    include_null = event.recurrence_type is None

    waitlist_conditions = [
        Attendance.event_id == event_id,
        Attendance.status == "waitlist",
    ]
    if include_null:
        waitlist_conditions.append(
            or_(
                Attendance.occurrence_date == resolved_date,
                Attendance.occurrence_date.is_(None),
            )
        )
    else:
        waitlist_conditions.append(Attendance.occurrence_date == resolved_date)

    result = await db.execute(
        select(Attendance, User)
        .join(User, Attendance.user_id == User.id)
        .where(and_(*waitlist_conditions))
        .order_by(Attendance.waitlist_position)
    )
    rows = result.all()

    waitlist = [
        AttendeeInfo(
            user_id=user.id,
            user_name=user.name,
            status=attendance.status,
            registered_at=attendance.registered_at,
            occurrence_date=attendance.occurrence_date,
            waitlist_position=attendance.waitlist_position,
        )
        for attendance, user in rows
    ]

    return EventWaitlistResponse(
        event_id=event_id,
        waitlist_count=len(waitlist),
        waitlist=waitlist,
    )


# ============ Check-in Endpoints ============


@router.post("/{event_id}/check-in/enable", response_model=CheckInCodeResponse)
async def enable_check_in(
    event_id: int,
    check_in_start: Optional[datetime] = None,
    check_in_end: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Enable check-in for an event and generate QR code data.

    Only event owner can enable check-in.
    """
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    if event.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only event owner can manage check-in",
        )

    # Generate new code if not exists
    if not event.check_in_code:
        event.check_in_code = secrets.token_urlsafe(16)

    event.check_in_enabled = True
    event.check_in_start = check_in_start
    event.check_in_end = check_in_end

    await db.commit()
    await db.refresh(event)

    # QR data format: event_id:check_in_code
    qr_data = f"{event.id}:{event.check_in_code}"

    return CheckInCodeResponse(
        event_id=event.id,
        check_in_code=event.check_in_code,
        check_in_enabled=event.check_in_enabled,
        check_in_start=event.check_in_start,
        check_in_end=event.check_in_end,
        qr_data=qr_data,
        qr_image_url=generate_qr_code(qr_data, event.id),
    )


@router.post("/{event_id}/check-in/disable")
async def disable_check_in(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disable check-in for an event."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    if event.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only event owner can manage check-in",
        )

    event.check_in_enabled = False
    await db.commit()

    return {"message": "Check-in disabled"}


@router.get("/{event_id}/check-in/code", response_model=CheckInCodeResponse)
async def get_check_in_code(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get check-in code for an event.

    Only event owner can view the code.
    """
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    if event.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only event owner can view check-in code",
        )

    if not event.check_in_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Check-in not enabled for this event",
        )

    qr_data = f"{event.id}:{event.check_in_code}"

    return CheckInCodeResponse(
        event_id=event.id,
        check_in_code=event.check_in_code,
        check_in_enabled=event.check_in_enabled,
        check_in_start=event.check_in_start,
        check_in_end=event.check_in_end,
        qr_data=qr_data,
        qr_image_url=generate_qr_code(qr_data, event.id),
    )


@router.post("/{event_id}/check-in", response_model=CheckInResponse)
async def check_in(
    event_id: int,
    code: str,
    occurrence_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    resolved_date = resolve_occurrence_date(event, occurrence_date)
    include_null = event.recurrence_type is None

    if not event.check_in_enabled:
        return CheckInResponse(
            status="check_in_closed",
            message="Check-in is not enabled for this event",
        )

    now = _kst_now()
    if event.check_in_start and now < event.check_in_start:
        return CheckInResponse(
            status="check_in_closed",
            message="Check-in has not started yet",
        )
    if event.check_in_end and now > event.check_in_end:
        return CheckInResponse(
            status="check_in_closed",
            message="Check-in has ended",
        )

    if code != event.check_in_code:
        return CheckInResponse(
            status="invalid_code",
            message="Invalid check-in code",
        )

    attendance_conditions = [
        Attendance.event_id == event_id,
        Attendance.user_id == current_user.id,
        Attendance.status == "attending",
    ]
    if include_null:
        attendance_conditions.append(
            or_(
                Attendance.occurrence_date == resolved_date,
                Attendance.occurrence_date.is_(None),
            )
        )
    else:
        attendance_conditions.append(Attendance.occurrence_date == resolved_date)

    attendance_result = await db.execute(
        select(Attendance)
        .where(and_(*attendance_conditions))
        .order_by(Attendance.registered_at.desc())
        .limit(1)
    )
    attendance = attendance_result.scalars().first()

    if not attendance:
        return CheckInResponse(
            status="not_attending",
            message="You are not registered for this event",
        )

    # Check if already checked in
    if attendance.checked_in_at:
        return CheckInResponse(
            status="already_checked_in",
            message="You have already checked in",
            checked_in_at=attendance.checked_in_at,
        )

    # Perform check-in
    attendance.checked_in_at = now
    await db.commit()

    points_earned = 0
    try:
        activity_log = await grant_points(
            db=db,
            user_id=current_user.id,
            activity_type="event_checkin",
            reference_type="event",
            reference_id=event_id,
        )
        if activity_log:
            points_earned = activity_log.points
    except Exception:
        pass

    return CheckInResponse(
        status="success",
        message="Successfully checked in!",
        checked_in_at=attendance.checked_in_at,
        points_earned=points_earned,
    )


@router.get("/{event_id}/check-in/stats", response_model=CheckInStatsResponse)
async def get_check_in_stats(
    event_id: int,
    occurrence_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    resolved_date = resolve_occurrence_date(event, occurrence_date)
    include_null = event.recurrence_type is None

    attendee_conditions = [
        Attendance.event_id == event_id,
        Attendance.status == "attending",
    ]
    if include_null:
        attendee_conditions.append(
            or_(
                Attendance.occurrence_date == resolved_date,
                Attendance.occurrence_date.is_(None),
            )
        )
    else:
        attendee_conditions.append(Attendance.occurrence_date == resolved_date)

    attendees_result = await db.execute(
        select(Attendance, User)
        .join(User, Attendance.user_id == User.id)
        .where(and_(*attendee_conditions))
        .order_by(Attendance.checked_in_at.desc().nullslast(), Attendance.registered_at)
    )
    rows = attendees_result.all()

    attendees = [
        AttendeeInfo(
            user_id=user.id,
            user_name=user.name,
            status=attendance.status,
            registered_at=attendance.registered_at,
            occurrence_date=attendance.occurrence_date,
            waitlist_position=attendance.waitlist_position,
            checked_in_at=attendance.checked_in_at,
        )
        for attendance, user in rows
    ]

    total = len(attendees)
    checked_in = sum(1 for a in attendees if a.checked_in_at is not None)
    rate = (checked_in / total * 100) if total > 0 else 0

    return CheckInStatsResponse(
        event_id=event_id,
        total_attendees=total,
        checked_in_count=checked_in,
        check_in_rate=round(rate, 1),
        attendees=attendees,
    )
