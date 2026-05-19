from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.models.report import ReportTargetType, ReportReason, ReportStatus


class ReportCreate(BaseModel):
    """Schema for creating a new report"""

    target_type: ReportTargetType
    target_id: int
    reason: ReportReason
    description: Optional[str] = Field(None, max_length=1000)


class ReportOut(BaseModel):
    """Schema for report response"""

    id: int
    reporter_id: int
    reporter_name: Optional[str] = None
    target_type: ReportTargetType
    target_id: int
    reason: ReportReason
    description: Optional[str]
    status: ReportStatus
    review_started_by_id: Optional[int]
    review_started_by_name: Optional[str] = None
    review_started_at: Optional[datetime]
    resolved_by_id: Optional[int]
    resolved_by_name: Optional[str] = None
    resolution_note: Optional[str]
    resolved_at: Optional[datetime]
    action_taken: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ReportResolve(BaseModel):
    """Schema for resolving a report"""

    status: ReportStatus
    resolution_note: Optional[str] = Field(None, max_length=1000)
    action_taken: Optional[str] = Field(None, max_length=100)
    # Actions: "content_blinded", "user_warned", "user_suspended", "no_action"


class ReportListOut(BaseModel):
    """Schema for paginated report list"""

    items: list[ReportOut]
    total: int
    pending_count: int


class ReportStats(BaseModel):
    """Schema for report statistics"""

    total: int
    pending: int
    reviewing: int
    resolved: int
    rejected: int
