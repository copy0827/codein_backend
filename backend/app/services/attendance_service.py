"""
출석 체크 및 스탬프 보상 비즈니스 로직.

- KST 날짜는 서버 시각만 사용 (클라이언트 입력 불신)
- 유저 단위 행 잠금 + (user_id, attendance_date) 유니크로 연타·동시 요청 방어
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from zoneinfo import ZoneInfo

from app.models.daily_attendance import (
    AttendancePolicy,
    DailyAttendance,
    DEFAULT_ATTENDANCE_POLICY_ID,
    UserAttendanceStat,
)
from app.models.user import User
from app.schemas.attendance import (
    AttendanceCheckResponse,
    AttendancePolicySnapshot,
    AttendanceStatusResponse,
)
from app.services.rank_service import get_rank_for_points

logger = logging.getLogger(__name__)

KST = ZoneInfo("Asia/Seoul")


def _now_kst() -> datetime:
    return datetime.now(KST)


def _kst_today() -> date:
    """서버 시각 기준 KST 오늘 날짜 (연·월·일만)."""
    return _now_kst().date()


def _policy_snapshot(policy: AttendancePolicy) -> AttendancePolicySnapshot:
    return AttendancePolicySnapshot(
        max_stamp_pieces=policy.max_stamp_pieces,
        daily_attendance_points=policy.daily_attendance_points,
        board_complete_reward_points=policy.board_complete_reward_points,
    )


async def _load_attendance_policy(db: AsyncSession) -> AttendancePolicy:
    """정책 id=1 우선, 없으면 첫 행·기본값."""
    policy = await db.get(AttendancePolicy, DEFAULT_ATTENDANCE_POLICY_ID)
    if policy is not None:
        return policy

    result = await db.execute(
        select(AttendancePolicy).order_by(AttendancePolicy.id).limit(1)
    )
    policy = result.scalar_one_or_none()
    if policy is not None:
        return policy

    return AttendancePolicy(
        id=DEFAULT_ATTENDANCE_POLICY_ID,
        max_stamp_pieces=10,
        daily_attendance_points=10,
        board_complete_reward_points=100,
    )


async def _get_user_for_update(db: AsyncSession, user_id: int) -> User:
    result = await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="비활성화된 계정입니다.",
        )
    return user


async def _get_or_create_stat_for_update(
    db: AsyncSession, user_id: int
) -> UserAttendanceStat:
    result = await db.execute(
        select(UserAttendanceStat)
        .where(UserAttendanceStat.user_id == user_id)
        .with_for_update()
    )
    stat = result.scalar_one_or_none()
    if stat is not None:
        return stat

    try:
        async with db.begin_nested():
            stat = UserAttendanceStat(user_id=user_id)
            db.add(stat)
            await db.flush()
    except IntegrityError:
        pass

    result = await db.execute(
        select(UserAttendanceStat)
        .where(UserAttendanceStat.user_id == user_id)
        .with_for_update()
    )
    stat = result.scalar_one_or_none()
    if stat is None:
        raise RuntimeError(
            f"UserAttendanceStat 생성 후 조회 실패: user_id={user_id}"
        )
    return stat


async def _has_attendance_on_date(
    db: AsyncSession, user_id: int, attendance_date: date
) -> bool:
    result = await db.execute(
        select(DailyAttendance.id).where(
            DailyAttendance.user_id == user_id,
            DailyAttendance.attendance_date == attendance_date,
        )
    )
    return result.scalar_one_or_none() is not None


async def _get_today_attendance_row(
    db: AsyncSession, user_id: int, today_kst: date
) -> Optional[DailyAttendance]:
    result = await db.execute(
        select(DailyAttendance).where(
            DailyAttendance.user_id == user_id,
            DailyAttendance.attendance_date == today_kst,
        )
    )
    return result.scalar_one_or_none()


async def _update_streak_days(
    db: AsyncSession,
    stat: UserAttendanceStat,
    user_id: int,
    today_kst: date,
) -> None:
    """직전 출석일이 KST 어제면 연속 +1, 아니면 1로 리셋."""
    result = await db.execute(
        select(func.max(DailyAttendance.attendance_date)).where(
            DailyAttendance.user_id == user_id,
            DailyAttendance.attendance_date < today_kst,
        )
    )
    last_date: Optional[date] = result.scalar_one_or_none()
    yesterday = today_kst - timedelta(days=1)

    if last_date == yesterday:
        stat.current_streak_days += 1
    else:
        stat.current_streak_days = 1


def _stamps_until_complete(stamp_count: int, max_pieces: int) -> int:
    if max_pieces <= 0:
        return 0
    remaining = max_pieces - stamp_count
    return max(0, remaining)


async def get_my_attendance_status(
    db: AsyncSession,
    user_id: int,
) -> AttendanceStatusResponse:
    """오늘(KST) 출석 여부 및 스탬프·누적 상태 요약."""
    today_kst = _kst_today()
    policy = await _load_attendance_policy(db)

    stat_result = await db.execute(
        select(UserAttendanceStat).where(UserAttendanceStat.user_id == user_id)
    )
    stat = stat_result.scalar_one_or_none()

    today_row = await _get_today_attendance_row(db, user_id, today_kst)

    last_result = await db.execute(
        select(DailyAttendance)
        .where(DailyAttendance.user_id == user_id)
        .order_by(DailyAttendance.attendance_date.desc())
        .limit(1)
    )
    last_row = last_result.scalar_one_or_none()

    stamp_count = stat.current_stamp_count if stat else 0
    max_pieces = policy.max_stamp_pieces

    return AttendanceStatusResponse(
        user_id=user_id,
        today_kst=today_kst,
        has_checked_in_today=today_row is not None,
        total_attendance_days=stat.total_attendance_days if stat else 0,
        current_streak_days=stat.current_streak_days if stat else 0,
        current_stamp_cycle=stat.current_stamp_cycle if stat else 1,
        current_stamp_count=stamp_count,
        completed_stamp_boards=stat.completed_stamp_boards if stat else 0,
        max_stamp_pieces=max_pieces,
        stamps_until_board_complete=_stamps_until_complete(stamp_count, max_pieces),
        policy=_policy_snapshot(policy),
        last_attendance_date=last_row.attendance_date if last_row else None,
        last_attended_at=last_row.attended_at if last_row else None,
    )


async def check_today_attendance(
    db: AsyncSession,
    user_id: int,
) -> AttendanceCheckResponse:
    """
    오늘(KST) 출석 체크, 스탬프·포인트 정산.

    전체 과정을 단일 트랜잭션으로 커밋합니다.
    """
    today_kst = _kst_today()
    attended_at = _now_kst()

    if await _has_attendance_on_date(db, user_id, today_kst):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="오늘은 이미 출석 체크를 완료했습니다.",
        )

    policy = await _load_attendance_policy(db)
    daily_points = policy.daily_attendance_points
    bonus_points = 0
    board_completed = False

    try:
        user = await _get_user_for_update(db, user_id)

        if await _has_attendance_on_date(db, user_id, today_kst):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="오늘은 이미 출석 체크를 완료했습니다.",
            )

        stat = await _get_or_create_stat_for_update(db, user_id)
        await _update_streak_days(db, stat, user_id, today_kst)

        stat.total_attendance_days += 1
        stat.current_stamp_count += 1

        if stat.current_stamp_count >= policy.max_stamp_pieces:
            board_completed = True
            bonus_points = policy.board_complete_reward_points
            stat.completed_stamp_boards += 1
            stat.current_stamp_count = 0
            stat.current_stamp_cycle += 1

        attendance = DailyAttendance(
            user_id=user_id,
            attendance_date=today_kst,
            attended_at=attended_at,
            earned_points=daily_points,
        )
        db.add(attendance)

        total_credit = daily_points + bonus_points
        user.points = (user.points or 0) + total_credit
        user.activity_points = (user.activity_points or 0) + total_credit

        new_rank = get_rank_for_points(user.activity_points)
        if new_rank != user.rank:
            user.rank = new_rank

        await db.flush()

        await db.commit()

        await db.refresh(attendance)
        await db.refresh(stat)
        await db.refresh(user)

    except HTTPException:
        await db.rollback()
        raise
    except IntegrityError:
        await db.rollback()
        logger.warning(
            "attendance duplicate integrity user_id=%s date=%s",
            user_id,
            today_kst,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="오늘은 이미 출석 체크를 완료했습니다.",
        ) from None
    except Exception:
        await db.rollback()
        raise

    total_earned = daily_points + bonus_points
    if board_completed:
        message = (
            f"출석 완료! {daily_points}P를 받았습니다. "
            f"스탬프판을 완성해 추가 {bonus_points}P 보너스를 획득했습니다!"
        )
    else:
        message = (
            f"출석 완료! {daily_points}P를 받았습니다. "
            f"스탬프 {stat.current_stamp_count}/{policy.max_stamp_pieces}칸"
        )

    return AttendanceCheckResponse(
        success=True,
        message=message,
        attendance_date=today_kst,
        attended_at=attendance.attended_at,
        earned_points=daily_points,
        bonus_points=bonus_points,
        total_points_earned=total_earned,
        stamp_filled=True,
        board_completed=board_completed,
        current_stamp_cycle=stat.current_stamp_cycle,
        current_stamp_count=stat.current_stamp_count,
        completed_stamp_boards=stat.completed_stamp_boards,
        total_attendance_days=stat.total_attendance_days,
        current_streak_days=stat.current_streak_days,
        policy=_policy_snapshot(policy),
    )
