"""Case 2: 코딩테스트 랭킹·통계 조회 서비스 (Window Function 기반)."""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import Select, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from zoneinfo import ZoneInfo

from app.models.codetest import Submission
from app.models.codetest_ranking import CodeTestStatPeriodType, UserCodeTestStat
from app.models.user import User
from app.schemas.codetest_ranking import (
    DifficultyTierStats,
    MyPageWidgetResponse,
    PeriodTrendPoint,
    RankingItemResponse,
    RankingListResponse,
    UserStatDetailResponse,
)
from app.services.rank_service import (
    KST,
    PERIOD_TYPES,
    _month_bounds,
    _semester_bounds,
)

VALID_PERIODS = set(PERIOD_TYPES)


def normalize_period(period: str) -> str:
    normalized = (period or CodeTestStatPeriodType.ALL.value).strip().upper()
    if normalized not in VALID_PERIODS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"period는 {', '.join(sorted(VALID_PERIODS))} 중 하나여야 합니다.",
        )
    return normalized


def _rank_window_order():
    return (
        UserCodeTestStat.total_score.desc(),
        UserCodeTestStat.correct_rate.desc(),
        UserCodeTestStat.correct_submissions.desc(),
        UserCodeTestStat.total_submissions.desc(),
    )


def _ranked_stats_select(period_type: str) -> Select[Any]:
    rank_expr = func.rank().over(order_by=_rank_window_order()).label("rank_position")
    return (
        select(
            rank_expr,
            UserCodeTestStat.user_id,
            UserCodeTestStat.total_submissions,
            UserCodeTestStat.correct_submissions,
            UserCodeTestStat.correct_rate,
            UserCodeTestStat.total_score,
            UserCodeTestStat.last_activity_date,
            User.name.label("nickname"),
            User.rank.label("rank_tier"),
        )
        .select_from(UserCodeTestStat)
        .join(User, User.id == UserCodeTestStat.user_id)
        .where(
            UserCodeTestStat.period_type == period_type,
            User.is_active.is_(True),
        )
    )


def _parse_difficulty_distribution(
    raw: Optional[dict[str, Any]],
) -> dict[str, DifficultyTierStats]:
    if not raw:
        return {}
    result: dict[str, DifficultyTierStats] = {}
    for key, value in raw.items():
        if isinstance(value, dict):
            result[str(key)] = DifficultyTierStats.model_validate(value)
        else:
            result[str(key)] = DifficultyTierStats()
    return result


def _row_to_ranking_item(
    row: Any,
    *,
    current_user_id: Optional[int],
) -> RankingItemResponse:
    rank_val = int(row.rank_position)
    user_id = int(row.user_id)
    return RankingItemResponse(
        rank=rank_val,
        user_id=user_id,
        nickname=row.nickname or "알 수 없음",
        total_submissions=int(row.total_submissions or 0),
        correct_submissions=int(row.correct_submissions or 0),
        correct_rate=float(row.correct_rate or 0.0),
        total_score=int(row.total_score or 0),
        last_activity_date=row.last_activity_date,
        is_top_three=rank_val <= 3,
        is_self=current_user_id is not None and user_id == current_user_id,
        rank_tier=row.rank_tier,
    )


async def _count_ranked_users(db: AsyncSession, period_type: str) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(UserCodeTestStat)
        .join(User, User.id == UserCodeTestStat.user_id)
        .where(
            UserCodeTestStat.period_type == period_type,
            User.is_active.is_(True),
        )
    )
    return int(result.scalar() or 0)


async def _fetch_user_rank(
    db: AsyncSession,
    period_type: str,
    user_id: int,
) -> Optional[int]:
    ranked = _ranked_stats_select(period_type).subquery()
    result = await db.execute(
        select(ranked.c.rank_position).where(ranked.c.user_id == user_id)
    )
    row = result.first()
    if row is None:
        return None
    return int(row[0])


async def get_ranking_list(
    db: AsyncSession,
    *,
    period: str,
    page: int,
    size: int,
    current_user: Optional[User],
) -> RankingListResponse:
    period_type = normalize_period(period)
    total = await _count_ranked_users(db, period_type)
    total_pages = max(1, math.ceil(total / size)) if total else 0
    offset = (page - 1) * size

    ranked = _ranked_stats_select(period_type).subquery()
    page_query = (
        select(ranked)
        .order_by(ranked.c.rank_position.asc())
        .offset(offset)
        .limit(size)
    )
    result = await db.execute(page_query)
    rows = result.all()

    current_user_id = current_user.id if current_user else None
    items = [
        _row_to_ranking_item(row, current_user_id=current_user_id) for row in rows
    ]

    my_rank: Optional[int] = None
    my_item: Optional[RankingItemResponse] = None
    if current_user_id is not None:
        my_rank = await _fetch_user_rank(db, period_type, current_user_id)
        if my_rank is not None:
            stat_result = await db.execute(
                select(UserCodeTestStat, User)
                .join(User, User.id == UserCodeTestStat.user_id)
                .where(
                    UserCodeTestStat.user_id == current_user_id,
                    UserCodeTestStat.period_type == period_type,
                )
            )
            stat_row = stat_result.first()
            if stat_row:
                stat, user = stat_row
                my_item = RankingItemResponse(
                    rank=my_rank,
                    user_id=current_user_id,
                    nickname=user.name,
                    total_submissions=stat.total_submissions,
                    correct_submissions=stat.correct_submissions,
                    correct_rate=float(stat.correct_rate or 0.0),
                    total_score=stat.total_score,
                    last_activity_date=stat.last_activity_date,
                    is_top_three=my_rank <= 3,
                    is_self=True,
                    rank_tier=user.rank,
                )

    return RankingListResponse(
        total=total,
        page=page,
        size=size,
        total_pages=total_pages,
        period_type=period_type,  # type: ignore[arg-type]
        items=items,
        my_rank=my_rank,
        my_item=my_item,
    )


def _period_submission_bounds(period_type: str, now: datetime) -> Tuple[Optional[datetime], Optional[datetime]]:
    if period_type == CodeTestStatPeriodType.MONTH.value:
        return _month_bounds(now)
    if period_type == CodeTestStatPeriodType.SEMESTER.value:
        return _semester_bounds(now)
    return None, None


async def _build_submission_trend(
    db: AsyncSession,
    user_id: int,
    period_type: str,
) -> List[PeriodTrendPoint]:
    now = datetime.now(KST)
    start, end = _period_submission_bounds(period_type, now)

    week_bucket = func.date_trunc("week", Submission.submitted_at).label("bucket")
    correct_sum = func.sum(
        case((Submission.result == "correct", 1), else_=0)
    ).label("correct_count")

    query = (
        select(
            week_bucket,
            func.count(Submission.id).label("submission_count"),
            correct_sum,
        )
        .where(Submission.user_id == user_id)
        .group_by(week_bucket)
        .order_by(week_bucket.asc())
    )
    if start is not None:
        query = query.where(
            Submission.submitted_at >= start,
            Submission.submitted_at < end,
        )

    if period_type == CodeTestStatPeriodType.ALL.value:
        query = query.where(
            Submission.submitted_at >= now - timedelta(days=180)
        )

    result = await db.execute(query)
    points: List[PeriodTrendPoint] = []
    for bucket, submission_count, correct_count in result.all():
        if bucket is None:
            continue
        total = int(submission_count or 0)
        correct = int(correct_count or 0)
        if bucket.tzinfo is None:
            bucket = bucket.replace(tzinfo=KST)
        label = bucket.astimezone(KST).strftime("%Y-%m-%d")
        points.append(
            PeriodTrendPoint(
                period_label=label,
                period_start=bucket,
                period_end=bucket + timedelta(days=7),
                total_submissions=total,
                correct_submissions=correct,
                correct_rate=round((correct / total) * 100.0, 2) if total else 0.0,
            )
        )
    return points


async def get_user_stat_detail(
    db: AsyncSession,
    user_id: int,
    *,
    period: str,
) -> UserStatDetailResponse:
    period_type = normalize_period(period)

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )

    stat_result = await db.execute(
        select(UserCodeTestStat).where(
            UserCodeTestStat.user_id == user_id,
            UserCodeTestStat.period_type == period_type,
        )
    )
    stat = stat_result.scalar_one_or_none()

    rank = await _fetch_user_rank(db, period_type, user_id)

    if stat is None:
        return UserStatDetailResponse(
            user_id=user_id,
            nickname=user.name,
            period_type=period_type,  # type: ignore[arg-type]
            total_submissions=0,
            correct_submissions=0,
            correct_rate=0.0,
            total_score=0,
            difficulty_distribution={},
            submission_trend=await _build_submission_trend(db, user_id, period_type),
            last_activity_date=None,
            rank=rank,
            rank_tier=user.rank,
        )

    return UserStatDetailResponse(
        user_id=user_id,
        nickname=user.name,
        period_type=period_type,  # type: ignore[arg-type]
        total_submissions=stat.total_submissions,
        correct_submissions=stat.correct_submissions,
        correct_rate=float(stat.correct_rate or 0.0),
        total_score=stat.total_score,
        difficulty_distribution=_parse_difficulty_distribution(
            stat.difficulty_distribution
        ),
        submission_trend=await _build_submission_trend(db, user_id, period_type),
        last_activity_date=stat.last_activity_date,
        rank=rank,
        rank_tier=user.rank,
    )


async def get_my_page_widget(
    db: AsyncSession,
    current_user: User,
) -> MyPageWidgetResponse:
    period_type = CodeTestStatPeriodType.MONTH.value

    stat_result = await db.execute(
        select(UserCodeTestStat).where(
            UserCodeTestStat.user_id == current_user.id,
            UserCodeTestStat.period_type == period_type,
        )
    )
    stat = stat_result.scalar_one_or_none()
    my_rank = await _fetch_user_rank(db, period_type, current_user.id)

    if stat is None:
        return MyPageWidgetResponse(
            my_rank=my_rank,
            correct_rate=0.0,
            month_total_submissions=0,
            month_correct_submissions=0,
            last_activity_date=None,
            total_score_month=0,
            period_type="MONTH",
        )

    return MyPageWidgetResponse(
        my_rank=my_rank,
        correct_rate=float(stat.correct_rate or 0.0),
        month_total_submissions=stat.total_submissions,
        month_correct_submissions=stat.correct_submissions,
        last_activity_date=stat.last_activity_date,
        total_score_month=stat.total_score,
        period_type="MONTH",
    )
