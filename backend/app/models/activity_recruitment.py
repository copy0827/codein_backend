"""
활동 모집 게시판 및 멘토-멘티 연동 — 단일 테이블 통합 모델.

- ActivityRecruitment: 스터디/프로젝트/대회/멘토링 모집글
- ActivityApplication: 모집글 신청 내역
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from zoneinfo import ZoneInfo

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


def _kst_now() -> datetime:
    return datetime.now(ZoneInfo("Asia/Seoul"))


class RecruitmentType(str, enum.Enum):
    """모집 유형."""

    STUDY = "STUDY"
    PROJECT = "PROJECT"
    CONTEST = "CONTEST"
    MENTORING = "MENTORING"


class RecruitmentStatus(str, enum.Enum):
    """모집글 상태."""

    RECRUITING = "RECRUITING"
    CLOSED = "CLOSED"
    COMPLETED = "COMPLETED"


class ApplicationStatus(str, enum.Enum):
    """신청 상태."""

    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ActivityRecruitment(Base):
    """
    활동 모집글 (스터디·프로젝트·대회·멘토링 통합).

    MENTORING 유형은 is_approved=False 로 등록 후 관리자 승인 시 공개됩니다.
    additional_info 에 멘토링 전용·프로젝트 팀원 정보 등 유형별 메타를 JSON 으로 저장합니다.
    """

    __tablename__ = "activity_recruitments"

    __table_args__ = (
        Index("ix_activity_recruitments_type", "recruitment_type"),
        Index("ix_activity_recruitments_status", "recruitment_status"),
        Index("ix_activity_recruitments_owner", "owner_id"),
        Index("ix_activity_recruitments_approved", "is_approved"),
        Index("ix_activity_recruitments_deadline", "deadline"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    recruitment_type: Mapped[str] = mapped_column(String(20), nullable=False)
    recruitment_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=RecruitmentStatus.RECRUITING.value
    )

    max_participants: Mapped[int] = mapped_column(Integer, nullable=False)
    current_participants: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    activity_period: Mapped[str] = mapped_column(String(255), nullable=False)

    tech_stacks: Mapped[Optional[list[Any]]] = mapped_column(JSON, nullable=True)

    is_approved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    additional_info: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_kst_now, nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=_kst_now
    )

    owner: Mapped["User"] = relationship("User", foreign_keys=[owner_id])
    applications: Mapped[List["ActivityApplication"]] = relationship(
        "ActivityApplication",
        back_populates="activity",
        cascade="all, delete-orphan",
    )


class ActivityApplication(Base):
    """활동 모집글 신청 내역."""

    __tablename__ = "activity_applications"

    __table_args__ = (
        UniqueConstraint(
            "activity_id",
            "applicant_id",
            name="uq_activity_applications_activity_applicant",
        ),
        Index("ix_activity_applications_activity", "activity_id"),
        Index("ix_activity_applications_applicant", "applicant_id"),
        Index("ix_activity_applications_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    activity_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("activity_recruitments.id", ondelete="CASCADE"),
        nullable=False,
    )
    applicant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=ApplicationStatus.PENDING.value
    )
    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_kst_now, nullable=False
    )

    activity: Mapped["ActivityRecruitment"] = relationship(
        "ActivityRecruitment", back_populates="applications"
    )
    applicant: Mapped["User"] = relationship("User", foreign_keys=[applicant_id])
