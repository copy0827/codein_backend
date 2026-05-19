from sqlalchemy import String, Integer, Text, ForeignKey, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional
import enum
from app.models.base import Base

def _kst_now():
    return datetime.now(ZoneInfo("Asia/Seoul"))


class ReportTargetType(str, enum.Enum):
    POST = "post"
    COMMENT = "comment"
    ALBUM = "album"
    PHOTO = "photo"
    USER = "user"


class ReportStatus(str, enum.Enum):
    PENDING = "pending"
    REVIEWING = "reviewing"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class ReportReason(str, enum.Enum):
    SPAM = "spam"
    HARASSMENT = "harassment"
    INAPPROPRIATE = "inappropriate"
    COPYRIGHT = "copyright"
    MISINFORMATION = "misinformation"
    OTHER = "other"


class Report(Base):
    """User-submitted reports for content moderation"""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Who reported
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    # What was reported (polymorphic reference)
    target_type: Mapped[ReportTargetType] = mapped_column(
        Enum(ReportTargetType), nullable=False
    )
    target_id: Mapped[int] = mapped_column(Integer, nullable=False)

    # Report details
    reason: Mapped[ReportReason] = mapped_column(Enum(ReportReason), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Status tracking
    status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus), default=ReportStatus.PENDING
    )

    review_started_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    review_started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Resolution details
    resolved_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    resolution_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Action taken
    action_taken: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # e.g., "content_blinded", "user_warned", "user_suspended", "no_action"

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_kst_now)

    # Relationships
    reporter = relationship("User", foreign_keys=[reporter_id])
    review_started_by = relationship("User", foreign_keys=[review_started_by_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])
