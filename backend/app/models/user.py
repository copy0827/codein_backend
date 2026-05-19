from sqlalchemy import String, Integer, Boolean, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional
from app.models.base import Base

def _kst_now():
    return datetime.now(ZoneInfo("Asia/Seoul"))


class User(Base):
    """
    User model with role-based access control.

    Roles (role field):
    - guest: Non-member (비회원) - can view public content only
    - member: Regular member (회원) - can access member-only content
    - staff: Staff/Operator (운영진) - can manage content and events
    - admin: Administrator (관리자) - full access except system settings
    - superadmin: Super Administrator (슈퍼관리자) - full system access

    Ranks (rank field) - based on coding test / activity:
    - unranked: Not yet tested (신입)
    - bronze: Bronze tier (브론즈)
    - silver: Silver tier (실버)
    - gold: Gold tier (골드)
    - platinum: Platinum tier (플래티넘)
    - diamond: Diamond tier (다이아몬드)
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))

    # Basic profile
    name: Mapped[str] = mapped_column(String(100))
    student_id: Mapped[str] = mapped_column(String(20))
    major: Mapped[str] = mapped_column(String(100))
    generation: Mapped[str] = mapped_column(String(20))

    # Extended profile (Phase 1)
    interests: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array
    tech_stack: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array
    github_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    portfolio_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    profile_image: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    privacy_settings: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON

    # Role & Rank system
    role: Mapped[str] = mapped_column(String(20), default="member", index=True)
    rank: Mapped[str] = mapped_column(String(20), default="unranked", index=True)

    # Activity & Points
    activity_points: Mapped[int] = mapped_column(Integer, default=0)
    points: Mapped[int] = mapped_column(Integer, default=0)

    # Status & Moderation
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_suspended: Mapped[bool] = mapped_column(Boolean, default=False)
    suspended_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    suspension_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    warning_count: Mapped[int] = mapped_column(Integer, default=0)

    # Notification preferences
    notification_email: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_web_push: Mapped[bool] = mapped_column(Boolean, default=True)
    reminder_24h: Mapped[bool] = mapped_column(Boolean, default=True)
    reminder_1h: Mapped[bool] = mapped_column(Boolean, default=True)

    # Phase 2: Extended notification preferences
    notify_new_post: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_comment_reply: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_event_reminder: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_event_update: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_mention: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_system: Mapped[bool] = mapped_column(Boolean, default=True)

    # Onboarding
    onboarding_step: Mapped[int] = mapped_column(Integer, default=0)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_kst_now, nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=_kst_now, nullable=True
    )
