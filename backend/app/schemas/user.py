from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from typing import Optional, List
import json


class UserBase(BaseModel):
    """Base user fields."""

    email: EmailStr
    name: str
    student_id: str
    major: str
    generation: str


class UserCreate(UserBase):
    """Fields for creating a new user."""

    password: str


class UserProfileUpdate(BaseModel):
    """Fields that users can update in their profile."""

    # name: Optional[str] = None
    student_id: Optional[str] = None
    major: Optional[str] = None
    generation: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=500)
    interests: Optional[List[str]] = None
    tech_stack: Optional[List[str]] = None
    github_url: Optional[str] = Field(None, max_length=255)
    portfolio_url: Optional[str] = Field(None, max_length=255)
    profile_image: Optional[str] = Field(None, max_length=255)

    # Notification preferences
    notification_email: Optional[bool] = None
    notification_web_push: Optional[bool] = None
    reminder_24h: Optional[bool] = None
    reminder_1h: Optional[bool] = None

    @field_validator("github_url", "portfolio_url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


class PrivacySettings(BaseModel):
    """Privacy settings for user profile."""

    show_email: bool = False
    show_student_id: bool = False
    show_activity: bool = True
    show_rank: bool = True


class PrivacySettingsUpdate(BaseModel):
    """Update privacy settings."""

    show_email: Optional[bool] = None
    show_student_id: Optional[bool] = None
    show_activity: Optional[bool] = None
    show_rank: Optional[bool] = None


class UserPublicProfile(BaseModel):
    """Public profile visible to other users."""

    id: int
    name: str
    major: str
    generation: str
    bio: Optional[str] = None
    interests: Optional[List[str]] = None
    tech_stack: Optional[List[str]] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    profile_image: Optional[str] = None
    role: str
    rank: str
    activity_points: int
    created_at: datetime

    # Optional fields based on privacy settings
    email: Optional[str] = None
    student_id: Optional[str] = None

    class Config:
        from_attributes = True

    @field_validator("interests", "tech_stack", mode="before")
    @classmethod
    def parse_json_list(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return []
        return v


class UserOwnProfile(UserPublicProfile):
    """Full profile for the user themselves (includes all fields)."""

    email: Optional[str] = (
        None  # Override to make required in practice but keep type consistent
    )
    student_id: Optional[str] = None
    notification_email: bool
    notification_web_push: bool
    reminder_24h: bool
    reminder_1h: bool
    privacy_settings: Optional[PrivacySettings] = None
    warning_count: int
    is_suspended: bool
    suspended_until: Optional[datetime] = None
    onboarding_step: int
    onboarding_completed: bool
    updated_at: Optional[datetime] = None
    hashed_password: Optional[str] = None

    @field_validator("privacy_settings", mode="before")
    @classmethod
    def parse_privacy_settings(cls, v):
        if v is None:
            return PrivacySettings()
        if isinstance(v, str):
            try:
                data = json.loads(v)
                return PrivacySettings(**data)
            except (json.JSONDecodeError, TypeError):
                return PrivacySettings()
        return v


class UserSummary(BaseModel):
    """Minimal user info for lists and references."""

    id: int
    name: str
    profile_image: Optional[str] = None
    rank: str
    role: str

    class Config:
        from_attributes = True


class RankInfo(BaseModel):
    """Information about user's rank and progress."""

    current_rank: str
    current_points: int
    next_rank: Optional[str] = None
    points_to_next: Optional[int] = None
    rank_progress_percent: float = 0.0


class UserStatsOut(BaseModel):
    """User activity statistics."""

    total_posts: int = 0
    total_comments: int = 0
    total_events_attended: int = 0
    total_albums_created: int = 0
    coding_tests_completed: int = 0
    current_streak_days: int = 0
    longest_streak_days: int = 0


# Phase 2: Notification Settings
class NotificationSettings(BaseModel):
    """User notification preferences."""

    # Channel settings
    email_enabled: bool = True
    web_push_enabled: bool = True

    # Reminder settings
    reminder_24h: bool = True
    reminder_1h: bool = True

    # Notification type settings
    notify_new_post: bool = True
    notify_comment_reply: bool = True
    notify_event_reminder: bool = True
    notify_event_update: bool = True
    notify_mention: bool = True
    notify_system: bool = True


class NotificationSettingsUpdate(BaseModel):
    """Update notification settings."""

    email_enabled: Optional[bool] = None
    web_push_enabled: Optional[bool] = None
    reminder_24h: Optional[bool] = None
    reminder_1h: Optional[bool] = None
    notify_new_post: Optional[bool] = None
    notify_comment_reply: Optional[bool] = None
    notify_event_reminder: Optional[bool] = None
    notify_event_update: Optional[bool] = None
    notify_mention: Optional[bool] = None
    notify_system: Optional[bool] = None


class UserAdminOut(BaseModel):
    id: int
    email: str
    name: str
    student_id: str
    major: str
    generation: str
    role: str
    rank: str
    activity_points: int
    is_active: bool
    is_suspended: bool
    suspended_until: Optional[datetime] = None
    suspension_reason: Optional[str] = None
    warning_count: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    hashed_password: Optional[str] = None

    class Config:
        from_attributes = True


class UserAdminUpdate(BaseModel):
    role: Optional[str] = None
    rank: Optional[str] = None
    is_active: Optional[bool] = None
    is_suspended: Optional[bool] = None
    suspended_until: Optional[datetime] = None
    suspension_reason: Optional[str] = None
    warning_count: Optional[int] = None
    activity_points: Optional[int] = None


class UserAdminListOut(BaseModel):
    items: List[UserAdminOut]
    total: int


class UserAdminSubmissionOut(BaseModel):
    id: int
    problem_id: int
    problem_title: str
    test_id: Optional[int] = None
    test_title: Optional[str] = None
    code: str
    language: str
    result: str
    execution_time: Optional[float]
    memory_used: Optional[int]
    test_cases_passed: int
    test_cases_total: int
    error_message: Optional[str]
    submitted_at: datetime

    class Config:
        from_attributes = True


class UserAdminSubmissionListOut(BaseModel):
    items: List[UserAdminSubmissionOut]
    total: int


class AdminPasswordReset(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)
