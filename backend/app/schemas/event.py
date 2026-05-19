from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional, List


class EventCreate(BaseModel):
    title: str
    description: str
    start_time: datetime
    end_time: datetime
    event_type: Optional[str] = None
    team: Optional[str] = None
    target_rank: Optional[str] = None
    recurrence_type: Optional[str] = None
    recurrence_interval: int = 1
    recurrence_end_date: Optional[datetime] = None
    recurrence_count: Optional[int] = None
    # Phase 1: New fields
    max_attendees: Optional[int] = None
    location: Optional[str] = None
    is_online: bool = False
    online_link: Optional[str] = None
    registration_deadline: Optional[datetime] = None
    allow_waitlist: bool = True
    # Phase 2: Check-in
    check_in_enabled: bool = False
    check_in_start: Optional[datetime] = None
    check_in_end: Optional[datetime] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    event_type: Optional[str] = None
    team: Optional[str] = None
    target_rank: Optional[str] = None
    recurrence_type: Optional[str] = None
    recurrence_interval: Optional[int] = None
    recurrence_end_date: Optional[datetime] = None
    recurrence_count: Optional[int] = None
    max_attendees: Optional[int] = None
    location: Optional[str] = None
    is_online: Optional[bool] = None
    online_link: Optional[str] = None
    registration_deadline: Optional[datetime] = None
    allow_waitlist: Optional[bool] = None
    # Phase 2: Check-in
    check_in_enabled: Optional[bool] = None
    check_in_start: Optional[datetime] = None
    check_in_end: Optional[datetime] = None


class EventOut(BaseModel):
    id: int
    title: str
    description: str
    start_time: datetime
    end_time: datetime
    owner_id: int
    created_at: datetime
    event_type: Optional[str] = None
    team: Optional[str] = None
    target_rank: Optional[str] = None
    approval_status: Optional[str] = None
    recurrence_type: Optional[str] = None
    recurrence_interval: int = 1
    recurrence_end_date: Optional[datetime] = None
    recurrence_count: Optional[int] = None
    # Phase 1: New fields
    max_attendees: Optional[int] = None
    location: Optional[str] = None
    is_online: bool = False
    online_link: Optional[str] = None
    registration_deadline: Optional[datetime] = None
    allow_waitlist: bool = True
    # Phase 2: Check-in
    check_in_enabled: bool = False
    check_in_start: Optional[datetime] = None
    check_in_end: Optional[datetime] = None
    checked_in_count: int = 0
    # Computed fields
    attendee_count: int = 0
    waitlist_count: int = 0
    is_full: bool = False

    class Config:
        from_attributes = True


class AttendeeInfo(BaseModel):
    user_id: int
    user_name: str
    status: str
    registered_at: datetime
    occurrence_date: Optional[date] = None
    waitlist_position: Optional[int] = None
    checked_in_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AttendanceOut(BaseModel):
    id: int
    event_id: int
    user_id: int
    status: str
    occurrence_date: Optional[date] = None
    waitlist_position: Optional[int] = None
    registered_at: datetime
    cancelled_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RSVPResponse(BaseModel):
    status: str  # "attending", "waitlist", "already_attending", "event_full"
    message: str
    waitlist_position: Optional[int] = None
    attendee_count: Optional[int] = None
    max_attendees: Optional[int] = None


class RSVPStatusResponse(BaseModel):
    status: str
    message: str
    attendee_count: Optional[int] = None
    max_attendees: Optional[int] = None


class RSVPCancelResponse(BaseModel):
    status: str  # "cancelled", "not_found"
    message: str
    promoted_user_id: Optional[int] = None  # If waitlist user was promoted


class EventAttendeesResponse(BaseModel):
    event_id: int
    attendee_count: int
    max_attendees: Optional[int] = None
    attendees: List[AttendeeInfo]


class EventWaitlistResponse(BaseModel):
    event_id: int
    waitlist_count: int
    waitlist: List[AttendeeInfo]


# Phase 2: Check-in schemas
class CheckInCodeResponse(BaseModel):
    event_id: int
    check_in_code: str
    check_in_enabled: bool
    check_in_start: Optional[datetime] = None
    check_in_end: Optional[datetime] = None
    qr_data: str  # Data to encode in QR code
    qr_image_url: str  # URL to QR code image


class CheckInResponse(BaseModel):
    status: str  # "success", "already_checked_in", "not_attending", "check_in_closed"
    message: str
    checked_in_at: Optional[datetime] = None
    points_earned: int = 0


class CheckInStatsResponse(BaseModel):
    event_id: int
    total_attendees: int
    checked_in_count: int
    check_in_rate: float
    attendees: List[AttendeeInfo]
