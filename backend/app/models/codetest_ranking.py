"""
Case 2: 코딩테스트 랭킹 및 통계 대시보드 — 집계 통계 모델.

Submission 원본 데이터를 기간별로 집계해 저장합니다.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from zoneinfo import ZoneInfo

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


def _kst_now() -> datetime:
    return datetime.now(ZoneInfo("Asia/Seoul"))


class CodeTestStatPeriodType(str, enum.Enum):
    """통계 집계 기간 구분."""

    ALL = "ALL"
    SEMESTER = "SEMESTER"
    MONTH = "MONTH"


class UserCodeTestStat(Base):
    """
    사용자별 코딩테스트 통계 스냅샷.

    (user_id, period_type) 복합 기본키로 기간별 유일성을 보장합니다.
    """

    __tablename__ = "user_codetest_stats"

    __table_args__ = (
        Index("ix_user_codetest_stats_period_type", "period_type"),
        Index("ix_user_codetest_stats_total_score", "total_score"),
        Index("ix_user_codetest_stats_correct_rate", "correct_rate"),
        Index("ix_user_codetest_stats_last_activity", "last_activity_date"),
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    period_type: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
        comment="ALL | SEMESTER | MONTH",
    )

    total_submissions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    correct_submissions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    correct_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    difficulty_distribution: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True,
        comment='난이도별 {"tier_1": {"total": 5, "correct": 3}} 형식',
    )
    last_activity_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_kst_now,
        onupdate=_kst_now,
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="codetest_stats")
