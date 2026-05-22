"""
Case 2: 코딩테스트 랭킹 및 통계 대시보드 — Pydantic v2 응답 스키마.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Literal, Optional
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.codetest_ranking import CodeTestStatPeriodType

StatPeriodTypeLiteral = Literal["ALL", "SEMESTER", "MONTH"]


class DifficultyTierStats(BaseModel):
    """난이도(티어)별 제출·정답 집계."""

    total: int = 0
    correct: int = 0


DifficultyDistribution = dict[str, DifficultyTierStats]


class PeriodTrendPoint(BaseModel):
    """기간별 제출·정답 추이 (차트/그래프용)."""

    period_label: str = Field(..., description="표시용 기간 라벨 (예: 2026-05, 3월 1주)")
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    total_submissions: int = 0
    correct_submissions: int = 0
    correct_rate: float = 0.0


class RankingItemResponse(BaseModel):
    """랭킹 목록 한 행."""

    rank: int
    user_id: int
    nickname: str = Field(..., description="표시용 닉네임(이름)")
    total_submissions: int
    correct_submissions: int
    correct_rate: float = Field(..., ge=0.0, le=100.0)
    total_score: int
    last_activity_date: Optional[datetime] = None
    is_top_three: bool = False
    is_self: bool = False
    rank_tier: Optional[str] = Field(None, description="회원 랭크 (bronze, gold 등)")

    @field_validator("last_activity_date", mode="before")
    @classmethod
    def normalize_activity_date(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)
            return value
        return value


class RankingListResponse(BaseModel):
    """랭킹 목록 (페이지네이션)."""

    total: int
    page: int
    size: int
    total_pages: int
    period_type: StatPeriodTypeLiteral = "ALL"
    items: List[RankingItemResponse] = Field(default_factory=list)
    my_rank: Optional[int] = Field(None, description="현재 로그인 사용자 순위 (없으면 null)")
    my_item: Optional[RankingItemResponse] = Field(
        None, description="현재 로그인 사용자 랭킹 행"
    )


class UserStatDetailResponse(BaseModel):
    """개인 통계 상세 (대시보드)."""

    model_config = ConfigDict(from_attributes=True)

    user_id: int
    nickname: str
    period_type: StatPeriodTypeLiteral
    total_submissions: int = 0
    correct_submissions: int = 0
    correct_rate: float = Field(0.0, ge=0.0, le=100.0)
    total_score: int = 0
    difficulty_distribution: DifficultyDistribution = Field(default_factory=dict)
    submission_trend: List[PeriodTrendPoint] = Field(
        default_factory=list,
        description="기간별 제출·정답 추이",
    )
    last_activity_date: Optional[datetime] = None
    rank: Optional[int] = Field(None, description="해당 period_type 기준 순위")
    rank_tier: Optional[str] = None

    @field_validator("period_type", mode="before")
    @classmethod
    def coerce_period_type(cls, value: Any) -> str:
        if isinstance(value, CodeTestStatPeriodType):
            return value.value
        return str(value).upper()

    @field_validator("difficulty_distribution", mode="before")
    @classmethod
    def parse_difficulty_distribution(cls, value: Any) -> dict[str, DifficultyTierStats]:
        if value is None:
            return {}
        if not isinstance(value, dict):
            return {}
        result: dict[str, DifficultyTierStats] = {}
        for key, raw in value.items():
            if isinstance(raw, DifficultyTierStats):
                result[str(key)] = raw
            elif isinstance(raw, dict):
                result[str(key)] = DifficultyTierStats.model_validate(raw)
            else:
                result[str(key)] = DifficultyTierStats()
        return result

    @field_validator("last_activity_date", mode="before")
    @classmethod
    def normalize_last_activity(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)
            return value.astimezone(ZoneInfo("Asia/Seoul"))
        return value


class MyPageWidgetResponse(BaseModel):
    """마이페이지 요약 위젯."""

    my_rank: Optional[int] = Field(None, description="이번 달(MONTH) 기준 순위")
    correct_rate: float = Field(0.0, ge=0.0, le=100.0, description="이번 달 정답률")
    month_total_submissions: int = Field(0, description="이번 달 총 제출 수")
    month_correct_submissions: int = Field(0, description="이번 달 맞은 문제 수")
    last_activity_date: Optional[datetime] = Field(
        None, description="최근 문제 제출일"
    )
    total_score_month: int = Field(0, description="이번 달 획득 점수")
    period_type: StatPeriodTypeLiteral = "MONTH"

    @field_validator("last_activity_date", mode="before")
    @classmethod
    def normalize_last_activity(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)
            return value.astimezone(ZoneInfo("Asia/Seoul"))
        return value


class UserCodeTestStatOut(BaseModel):
    """ORM → API 직렬화용 (집계 테이블 원본)."""

    model_config = ConfigDict(from_attributes=True)

    user_id: int
    period_type: StatPeriodTypeLiteral
    total_submissions: int = 0
    correct_submissions: int = 0
    correct_rate: float = 0.0
    total_score: int = 0
    difficulty_distribution: Optional[DifficultyDistribution] = None
    last_activity_date: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_validator("period_type", mode="before")
    @classmethod
    def coerce_period_type(cls, value: Any) -> str:
        if isinstance(value, CodeTestStatPeriodType):
            return value.value
        return str(value).upper()

    @field_validator("difficulty_distribution", mode="before")
    @classmethod
    def parse_difficulty_distribution(cls, value: Any) -> Optional[dict[str, DifficultyTierStats]]:
        if value is None:
            return None
        if not isinstance(value, dict):
            return None
        return {
            str(key): (
                item
                if isinstance(item, DifficultyTierStats)
                else DifficultyTierStats.model_validate(item)
            )
            for key, item in value.items()
            if isinstance(item, (dict, DifficultyTierStats))
        }
