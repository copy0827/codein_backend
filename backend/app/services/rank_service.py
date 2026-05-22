"""
랭크(활동 포인트) 계산 및 코딩테스트 통계(UserCodeTestStat) 집계 서비스.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from zoneinfo import ZoneInfo

from app.models.codetest_ranking import (
    CodeTestStatPeriodType,
    UserCodeTestStat,
)

logger = logging.getLogger(__name__)

KST = ZoneInfo("Asia/Seoul")

# Rank thresholds (points required for each rank)
RANK_THRESHOLDS = {
    "unranked": 0,
    "bronze": 100,
    "silver": 500,
    "gold": 1500,
    "platinum": 5000,
    "diamond": 15000,
}

RANK_ORDER = ["unranked", "bronze", "silver", "gold", "platinum", "diamond"]

PERIOD_TYPES = (
    CodeTestStatPeriodType.ALL.value,
    CodeTestStatPeriodType.SEMESTER.value,
    CodeTestStatPeriodType.MONTH.value,
)


def get_rank_for_points(points: int) -> str:
    """Determine rank based on points."""
    for rank in reversed(RANK_ORDER):
        if points >= RANK_THRESHOLDS[rank]:
            return rank
    return "unranked"


def get_next_rank(current_rank: str) -> Optional[str]:
    """Get the next rank after current rank."""
    try:
        idx = RANK_ORDER.index(current_rank)
        if idx < len(RANK_ORDER) - 1:
            return RANK_ORDER[idx + 1]
    except ValueError:
        pass
    return None


def _now_kst() -> datetime:
    return datetime.now(KST)


def _semester_bounds(now: datetime) -> Tuple[datetime, datetime]:
    """
    학기 구간 (KST, 동아리 일반 일정 기준).

    - 1학기(봄): 3월 1일 ~ 8월 31일
    - 2학기(가을): 9월 1일 ~ 다음해 2월 말
    """
    if now.tzinfo is None:
        now = now.replace(tzinfo=KST)
    else:
        now = now.astimezone(KST)

    year = now.year
    if 3 <= now.month <= 8:
        start = datetime(year, 3, 1, 0, 0, 0, tzinfo=KST)
        end = datetime(year, 8, 31, 23, 59, 59, tzinfo=KST)
    elif now.month >= 9:
        start = datetime(year, 9, 1, 0, 0, 0, tzinfo=KST)
        end = datetime(year + 1, 2, 28, 23, 59, 59, tzinfo=KST)
    else:
        start = datetime(year - 1, 9, 1, 0, 0, 0, tzinfo=KST)
        end = datetime(year, 2, 28, 23, 59, 59, tzinfo=KST)
    return start, end


def _month_bounds(now: datetime) -> Tuple[datetime, datetime]:
    if now.tzinfo is None:
        now = now.replace(tzinfo=KST)
    else:
        now = now.astimezone(KST)
    start = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=KST)
    if now.month == 12:
        end = datetime(now.year + 1, 1, 1, 0, 0, 0, tzinfo=KST)
    else:
        end = datetime(now.year, now.month + 1, 1, 0, 0, 0, tzinfo=KST)
    return start, end


def _normalize_difficulty_key(difficulty: str) -> str:
    """JSON difficulty_distribution 키 (tier_1, tier_2, …)."""
    raw = (difficulty or "").strip().lower()
    if not raw:
        return "tier_unknown"

    tier_map = {"easy": "tier_1", "medium": "tier_2", "hard": "tier_3"}
    if raw in tier_map:
        return tier_map[raw]
    if raw.startswith("tier_"):
        return raw
    if raw.startswith("level"):
        digits = "".join(ch for ch in raw if ch.isdigit())
        return f"tier_{digits}" if digits else "tier_unknown"
    if raw.isdigit():
        return f"tier_{raw}"
    return f"tier_{raw.replace(' ', '_')}"


def _compute_correct_rate(correct: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round((correct / total) * 100.0, 2)


def _should_reset_period(
    stat: UserCodeTestStat,
    period_type: str,
    now: datetime,
) -> bool:
    """월/학기가 바뀌었으면 누적치를 초기화합니다."""
    if period_type == CodeTestStatPeriodType.ALL.value:
        return False
    if stat.last_activity_date is None:
        return False

    last = stat.last_activity_date
    if last.tzinfo is None:
        last = last.replace(tzinfo=KST)
    else:
        last = last.astimezone(KST)

    if period_type == CodeTestStatPeriodType.MONTH.value:
        return last.year != now.year or last.month != now.month

    if period_type == CodeTestStatPeriodType.SEMESTER.value:
        start, end = _semester_bounds(now)
        return last < start or last > end

    return False


def _reset_period_counters(stat: UserCodeTestStat) -> None:
    stat.total_submissions = 0
    stat.correct_submissions = 0
    stat.correct_rate = 0.0
    stat.total_score = 0
    stat.difficulty_distribution = {}


def _bump_difficulty_distribution(
    distribution: Optional[dict[str, Any]],
    difficulty_key: str,
    *,
    is_correct: bool,
) -> dict[str, Any]:
    dist: dict[str, Any] = dict(distribution or {})
    entry = dist.get(difficulty_key)
    if not isinstance(entry, dict):
        entry = {"total": 0, "correct": 0}
    entry = {
        "total": int(entry.get("total", 0)) + 1,
        "correct": int(entry.get("correct", 0)) + (1 if is_correct else 0),
    }
    dist[difficulty_key] = entry
    return dist


async def _get_or_create_stat(
    db: AsyncSession,
    user_id: int,
    period_type: str,
) -> UserCodeTestStat:
    result = await db.execute(
        select(UserCodeTestStat).where(
            UserCodeTestStat.user_id == user_id,
            UserCodeTestStat.period_type == period_type,
        )
    )
    stat = result.scalar_one_or_none()
    if stat is None:
        stat = UserCodeTestStat(
            user_id=user_id,
            period_type=period_type,
            total_submissions=0,
            correct_submissions=0,
            correct_rate=0.0,
            total_score=0,
            difficulty_distribution={},
        )
        db.add(stat)
        await db.flush()
    return stat


def _apply_submission_to_stat(
    stat: UserCodeTestStat,
    *,
    is_correct: bool,
    score: int,
    difficulty_key: str,
    now: datetime,
) -> None:
    stat.total_submissions += 1
    if is_correct:
        stat.correct_submissions += 1
        stat.total_score += max(0, int(score))

    stat.correct_rate = _compute_correct_rate(
        stat.correct_submissions,
        stat.total_submissions,
    )
    stat.difficulty_distribution = _bump_difficulty_distribution(
        stat.difficulty_distribution,
        difficulty_key,
        is_correct=is_correct,
    )
    stat.last_activity_date = now


async def update_user_stats(
    db: AsyncSession,
    user_id: int,
    problem_id: int,
    is_correct: bool,
    score: int,
    difficulty: str,
) -> None:
    """
    채점 완료 후 UserCodeTestStat(ALL / SEMESTER / MONTH)를 즉시 누적 갱신합니다.

    Submission 저장 트랜잭션과 분리해 호출하는 것을 권장합니다.
    """
    now = _now_kst()
    difficulty_key = _normalize_difficulty_key(difficulty)

    for period_type in PERIOD_TYPES:
        stat = await _get_or_create_stat(db, user_id, period_type)
        if _should_reset_period(stat, period_type, now):
            _reset_period_counters(stat)

        _apply_submission_to_stat(
            stat,
            is_correct=is_correct,
            score=score,
            difficulty_key=difficulty_key,
            now=now,
        )

    logger.debug(
        "UserCodeTestStat updated user_id=%s problem_id=%s correct=%s difficulty=%s",
        user_id,
        problem_id,
        is_correct,
        difficulty_key,
    )


async def update_user_stats_safe(
    db: AsyncSession,
    user_id: int,
    problem_id: int,
    is_correct: bool,
    score: int,
    difficulty: str,
) -> None:
    """
    통계 갱신 실패 시 로그만 남기고 예외를 삼킵니다 (Submission 저장과 격리).
    """
    try:
        await update_user_stats(
            db=db,
            user_id=user_id,
            problem_id=problem_id,
            is_correct=is_correct,
            score=score,
            difficulty=difficulty,
        )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception(
            "Failed to update UserCodeTestStat (submission unaffected): "
            "user_id=%s problem_id=%s is_correct=%s",
            user_id,
            problem_id,
            is_correct,
        )
