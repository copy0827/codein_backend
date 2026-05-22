"""
출석 체크 및 스탬프 보상 — 일일 출석 이력·유저 메타·관리자 정책.

이벤트 RSVP용 `app.models.event.Attendance`(테이블 `attendance`)와 별개입니다.
기획서의 `Attendance`(출석 이력)는 본 모듈의 `DailyAttendance`(`daily_attendances`)에 해당합니다.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from zoneinfo import ZoneInfo

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User

KST = ZoneInfo("Asia/Seoul")

# 관리자 정책 단일 행(id=1) 시드 가정
DEFAULT_ATTENDANCE_POLICY_ID = 1


def _kst_now() -> datetime:
    return datetime.now(KST)


class DailyAttendance(Base):
    """
    일일 출석 이력 (출석 체크 1회 = 1행).

    KST 기준 `attendance_date`로 하루 1회만 출석 가능합니다.
    """

    __tablename__ = "daily_attendances"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "attendance_date",
            name="uq_daily_attendances_user_date",
        ),
        Index("ix_daily_attendances_user_id", "user_id"),
        Index("ix_daily_attendances_attendance_date", "attendance_date"),
        Index(
            "ix_daily_attendances_user_date",
            "user_id",
            "attendance_date",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    attended_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_kst_now,
        nullable=False,
    )
    earned_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


# 기획서 명칭 `Attendance` — 이벤트 RSVP 모델과 구분해 alias 제공
Attendance = DailyAttendance


class UserAttendanceStat(Base):
    """유저별 출석·스탬프판 누적 메타 상태."""

    __tablename__ = "user_attendance_stats"

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    total_attendance_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_streak_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_stamp_cycle: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    current_stamp_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed_stamp_boards: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class AttendancePolicy(Base):
    """관리자 출석·스탬프 정책 (단일 행 또는 id=1 기본 정책)."""

    __tablename__ = "attendance_policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    max_stamp_pieces: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    daily_attendance_points: Mapped[int] = mapped_column(
        Integer, default=10, nullable=False
    )
    board_complete_reward_points: Mapped[int] = mapped_column(
        Integer, default=100, nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        default=_kst_now,
        onupdate=_kst_now,
        nullable=True,
    )
