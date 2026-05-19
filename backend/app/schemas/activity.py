from datetime import datetime, timezone
from typing import Optional, List
from zoneinfo import ZoneInfo
from pydantic import BaseModel, field_validator


class ActivityLogOut(BaseModel):
    """Activity log entry output."""

    id: int
    activity_type: str
    points: int
    description: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    balance_after: int
    created_at: datetime

    @field_validator("created_at", mode="before")
    def convert_to_kst(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            # Assume naive datetime from DB is UTC
            v = v.replace(tzinfo=timezone.utc)
        return v.astimezone(ZoneInfo("Asia/Seoul"))

    class Config:
        from_attributes = True


class ActivityLogCreate(BaseModel):
    """For admin manual point adjustment."""

    points: int
    description: str


class ActivityHistoryOut(BaseModel):
    """Paginated activity history response."""

    items: List[ActivityLogOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class PointsSummary(BaseModel):
    """Summary of user's points."""

    current_points: int
    total_earned: int
    total_spent: int
    this_month_earned: int
    rank: str
    next_rank: Optional[str] = None
    points_to_next_rank: Optional[int] = None
