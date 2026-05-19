from sqlalchemy import String, Integer, DateTime, ForeignKey, Boolean, Text, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, date
from zoneinfo import ZoneInfo
from typing import Optional
from app.models.base import Base

def _kst_now():
    return datetime.now(ZoneInfo("Asia/Seoul"))


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_kst_now)
    event_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    team: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    target_rank: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    approval_status: Mapped[str] = mapped_column(String, default="approved")
    approved_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    recurrence_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    recurrence_interval: Mapped[int] = mapped_column(Integer, default=1)
    recurrence_end_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    recurrence_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Phase 1: RSVP improvements
    max_attendees: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    online_link: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    registration_deadline: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    allow_waitlist: Mapped[bool] = mapped_column(Boolean, default=True)

    # Phase 2: QR Check-in
    check_in_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    check_in_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    check_in_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    check_in_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    attendances = relationship(
        "Attendance", back_populates="event", cascade="all, delete-orphan"
    )


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    occurrence_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")

    # Phase 1: RSVP improvements
    waitlist_position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_kst_now)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Phase 2: QR Check-in
    checked_in_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    event = relationship("Event", back_populates="attendances")
    user = relationship("User")
