"""
출석 체크 및 스탬프 보상 API.
"""

from __future__ import annotations

import calendar
from datetime import date
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_current_user, get_db
from app.models.daily_attendance import DailyAttendance
from app.models.user import User
from app.schemas.attendance import (
    AdminAttendanceMemberItem,
    AttendanceAdminDailyStatusResponse,
    AttendanceCheckResponse,
    AttendanceHistoryItem,
    AttendanceHistoryResponse,
    AttendanceStatusResponse,
)
from app.services.attendance_service import (
    check_today_attendance,
    get_my_attendance_status,
)

router = APIRouter()


def _month_date_bounds(year: int, month: int) -> tuple[date, date]:
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


@router.get("/me/status", response_model=AttendanceStatusResponse)
async def get_my_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceStatusResponse:
    """오늘(KST) 내 출석 여부 및 스탬프판 현황."""
    return await get_my_attendance_status(db, current_user.id)


@router.post("/me/check", response_model=AttendanceCheckResponse)
async def post_my_check(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceCheckResponse:
    """
    오늘(KST) 출석 체크.

    중복 출석 시 400 — 서비스에서 처리합니다.
    """
    return await check_today_attendance(db, current_user.id)


@router.get("/me/history", response_model=AttendanceHistoryResponse)
async def get_my_history(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceHistoryResponse:
    """연·월별 내 출석 이력 (캘린더 매핑용)."""
    start_date, end_date = _month_date_bounds(year, month)

    result = await db.execute(
        select(DailyAttendance)
        .where(
            DailyAttendance.user_id == current_user.id,
            DailyAttendance.attendance_date >= start_date,
            DailyAttendance.attendance_date <= end_date,
        )
        .order_by(DailyAttendance.attendance_date.asc())
    )
    rows = result.scalars().all()
    items: List[AttendanceHistoryItem] = [
        AttendanceHistoryItem.model_validate(row) for row in rows
    ]

    return AttendanceHistoryResponse(
        user_id=current_user.id,
        year=year,
        month=month,
        total_days_in_month=len(items),
        items=items,
    )


@router.get("/admin/status", response_model=AttendanceAdminDailyStatusResponse)
async def get_admin_daily_status(
    target_date: date = Query(
        ...,
        alias="date",
        description="조회할 출석 날짜 (YYYY-MM-DD)",
    ),
    db: AsyncSession = Depends(get_db),
    _current_admin: User = Depends(get_current_admin),
) -> AttendanceAdminDailyStatusResponse:
    """관리자 — 특정 날짜 전체 활성 부원 출석 현황."""

    users_result = await db.execute(
        select(User)
        .where(User.is_active.is_(True))
        .order_by(User.generation.asc(), User.name.asc())
    )
    active_users = users_result.scalars().all()

    if not active_users:
        return AttendanceAdminDailyStatusResponse(
            target_date=target_date,
            total_active_members=0,
            attended_count=0,
            absent_count=0,
            attendance_rate=0.0,
            members=[],
        )

    user_ids = [u.id for u in active_users]
    attendance_result = await db.execute(
        select(DailyAttendance).where(
            DailyAttendance.user_id.in_(user_ids),
            DailyAttendance.attendance_date == target_date,
        )
    )
    attendance_by_user = {
        row.user_id: row for row in attendance_result.scalars().all()
    }

    members: List[AdminAttendanceMemberItem] = []
    attended_count = 0

    for user in active_users:
        record = attendance_by_user.get(user.id)
        if record is not None:
            attended_count += 1
            members.append(
                AdminAttendanceMemberItem(
                    user_id=user.id,
                    name=user.name,
                    student_id=user.student_id,
                    generation=user.generation,
                    major=user.major,
                    role=user.role,
                    status="ATTENDED",
                    attended_at=record.attended_at,
                )
            )
        else:
            members.append(
                AdminAttendanceMemberItem(
                    user_id=user.id,
                    name=user.name,
                    student_id=user.student_id,
                    generation=user.generation,
                    major=user.major,
                    role=user.role,
                    status="ABSENT",
                    attended_at=None,
                )
            )

    total = len(active_users)
    absent_count = total - attended_count
    rate = round((attended_count / total) * 100.0, 2) if total > 0 else 0.0

    return AttendanceAdminDailyStatusResponse(
        target_date=target_date,
        total_active_members=total,
        attended_count=attended_count,
        absent_count=absent_count,
        attendance_rate=rate,
        members=members,
    )
