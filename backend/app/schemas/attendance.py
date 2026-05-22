"""
출석 체크 및 스탬프 보상 — Pydantic v2 스키마.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import List, Literal, Optional
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator

KST = ZoneInfo("Asia/Seoul")


class AttendancePolicySnapshot(BaseModel):
    """출석 API 응답에 포함되는 정책 스냅샷."""

    max_stamp_pieces: int = Field(10, ge=1, description="스탬프판 전체 칸 수")
    daily_attendance_points: int = Field(10, ge=0, description="일일 출석 포인트")
    board_complete_reward_points: int = Field(
        100, ge=0, description="스탬프판 완성 보상 포인트"
    )


class AttendanceStatusResponse(BaseModel):
    """오늘 내 출석 상태 (대시보드·출석 버튼용)."""

    user_id: int
    today_kst: date = Field(..., description="KST 기준 오늘 날짜")
    has_checked_in_today: bool = Field(
        False, description="오늘 이미 출석 완료 여부"
    )
    total_attendance_days: int = 0
    current_streak_days: int = 0
    current_stamp_cycle: int = 1
    current_stamp_count: int = Field(
        0, description="현재 스탬프판에 찍힌 칸 수"
    )
    completed_stamp_boards: int = 0
    max_stamp_pieces: int = 10
    stamps_until_board_complete: int = Field(
        0, description="스탬프판 완성까지 남은 칸 수 (이미 완료 시 0)"
    )
    policy: AttendancePolicySnapshot = Field(default_factory=AttendancePolicySnapshot)
    last_attendance_date: Optional[date] = None
    last_attended_at: Optional[datetime] = None

    @field_validator("last_attended_at", mode="before")
    @classmethod
    def normalize_last_attended_at(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc).astimezone(KST)
            return value.astimezone(KST)
        return value


class AttendanceCheckResponse(BaseModel):
    """출석 체크 완료 결과."""

    success: bool = True
    message: str = Field(..., description="사용자 안내 메시지")
    attendance_date: date
    attended_at: datetime
    earned_points: int = Field(0, description="당일 출석으로 획득한 포인트")
    bonus_points: int = Field(
        0, description="스탬프판 완성 등 추가 보상 포인트"
    )
    total_points_earned: int = Field(
        0, description="이번 출석으로 총 획득 포인트(일일+보너스)"
    )
    stamp_filled: bool = Field(
        True, description="이번 출석으로 스탬프 1칸이 채워졌는지"
    )
    board_completed: bool = Field(
        False, description="이번 출석으로 스탬프판을 완성했는지"
    )
    current_stamp_cycle: int = 1
    current_stamp_count: int = 0
    completed_stamp_boards: int = 0
    total_attendance_days: int = 0
    current_streak_days: int = 0
    policy: AttendancePolicySnapshot = Field(default_factory=AttendancePolicySnapshot)

    @field_validator("attended_at", mode="before")
    @classmethod
    def normalize_attended_at(cls, value: object) -> object:
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc).astimezone(KST)
            return value.astimezone(KST)
        return value


class AttendanceHistoryItem(BaseModel):
    """월별 출석 이력 한 건."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    attendance_date: date
    attended_at: datetime
    earned_points: int

    @field_validator("attended_at", mode="before")
    @classmethod
    def normalize_attended_at(cls, value: object) -> object:
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc).astimezone(KST)
            return value.astimezone(KST)
        return value


class AttendanceHistoryResponse(BaseModel):
    """월별 내 출석 이력 목록."""

    user_id: int
    year: int
    month: int = Field(..., ge=1, le=12)
    total_days_in_month: int = Field(0, description="해당 월 출석 일수")
    items: List[AttendanceHistoryItem] = Field(default_factory=list)


AttendanceMemberStatus = Literal["ATTENDED", "ABSENT"]


class AdminAttendanceMemberItem(BaseModel):
    """관리자 일별 출석 현황 — 부원 1명."""

    user_id: int
    name: str
    student_id: str
    generation: str
    major: str
    role: str
    status: AttendanceMemberStatus
    attended_at: Optional[datetime] = Field(
        None, description="출석 시각 (미출석 시 null)"
    )

    @field_validator("attended_at", mode="before")
    @classmethod
    def normalize_attended_at(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc).astimezone(KST)
            return value.astimezone(KST)
        return value


class AttendanceAdminDailyStatusResponse(BaseModel):
    """관리자 — 특정 날짜 전체 부원 출석 현황."""

    target_date: date
    total_active_members: int = Field(..., description="활성 부원 수")
    attended_count: int = Field(..., description="해당 날짜 출석 인원")
    absent_count: int = Field(..., description="해당 날짜 미출석 인원")
    attendance_rate: float = Field(
        ..., ge=0, le=100, description="출석률(%) — 활성 부원 0명이면 0"
    )
    members: List[AdminAttendanceMemberItem] = Field(default_factory=list)
