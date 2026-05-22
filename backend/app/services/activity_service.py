"""
활동 모집 신청·승인/거절 비즈니스 로직.

기획서 예외 정책(동시 참여 제한, 중복 신청, 마감 검증, 정원 마감)을 서비스 레이어에서 방어합니다.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from zoneinfo import ZoneInfo

from app.models.activity_recruitment import (
    ActivityApplication,
    ActivityRecruitment,
    ApplicationStatus,
    RecruitmentStatus,
)

logger = logging.getLogger(__name__)

KST = ZoneInfo("Asia/Seoul")

ApplicationDecisionStatus = Literal["APPROVED", "REJECTED"]


def _now_kst() -> datetime:
    return datetime.now(KST)


def _normalize_dt(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).astimezone(KST)
    return value.astimezone(KST)


def _is_recruitment_closed(activity: ActivityRecruitment, *, now: datetime | None = None) -> bool:
    """모집 마감(CLOSED) 또는 모집 기한 경과 여부."""
    now = now or _now_kst()
    if activity.recruitment_status == RecruitmentStatus.CLOSED.value:
        return True
    return _normalize_dt(activity.deadline) < now


async def _get_activity(
    db: AsyncSession,
    activity_id: int,
    *,
    for_update: bool = False,
) -> ActivityRecruitment:
    stmt = select(ActivityRecruitment).where(ActivityRecruitment.id == activity_id)
    if for_update:
        stmt = stmt.with_for_update()
    result = await db.execute(stmt)
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="모집글을 찾을 수 없습니다.",
        )
    return activity


async def _user_has_active_participation(db: AsyncSession, user_id: int) -> bool:
    """
    [정책 1] APPROVED 신청이 있고, 해당 모집글이 COMPLETED 가 아닌 경우 '참여 중'.
    """
    stmt = (
        select(ActivityApplication.id)
        .join(
            ActivityRecruitment,
            ActivityApplication.activity_id == ActivityRecruitment.id,
        )
        .where(
            ActivityApplication.applicant_id == user_id,
            ActivityApplication.status == ApplicationStatus.APPROVED.value,
            ActivityRecruitment.recruitment_status != RecruitmentStatus.COMPLETED.value,
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None


async def apply_activity(
    db: AsyncSession,
    user_id: int,
    activity_id: int,
    message: str,
) -> ActivityApplication:
    """
    활동 모집글에 신청합니다.

    호출 측에서 `await db.commit()` 으로 트랜잭션을 확정해야 합니다.
    """
    message = (message or "").strip()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="신청 메시지를 입력해 주세요.",
        )

    async with db.begin_nested():
        activity = await _get_activity(db, activity_id, for_update=True)
        now = _now_kst()

        if activity.recruitment_status == RecruitmentStatus.COMPLETED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="활동이 완료된 모집글에는 신청할 수 없습니다.",
            )

        if _is_recruitment_closed(activity, now=now):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="모집이 마감되었거나 모집 기한이 지났습니다.",
            )

        if await _user_has_active_participation(db, user_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 참여 중인 다른 활동이 있어 신청할 수 없습니다.",
            )

        existing_result = await db.execute(
            select(ActivityApplication).where(
                ActivityApplication.activity_id == activity_id,
                ActivityApplication.applicant_id == user_id,
            )
        )
        existing = existing_result.scalar_one_or_none()

        if existing is not None:
            if existing.status in (
                ApplicationStatus.PENDING.value,
                ApplicationStatus.APPROVED.value,
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="이미 신청했거나 승인된 활동입니다.",
                )
            if existing.status == ApplicationStatus.REJECTED.value:
                existing.message = message
                existing.status = ApplicationStatus.PENDING.value
                existing.applied_at = now
                await db.flush()
                await db.refresh(existing)
                return existing

        application = ActivityApplication(
            activity_id=activity_id,
            applicant_id=user_id,
            message=message,
            status=ApplicationStatus.PENDING.value,
            applied_at=now,
        )
        db.add(application)
        try:
            await db.flush()
            await db.refresh(application)
        except IntegrityError:
            logger.warning(
                "activity apply integrity conflict activity_id=%s user_id=%s",
                activity_id,
                user_id,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 신청했거나 승인된 활동입니다.",
            ) from None

        return application


async def approve_or_reject_application(
    db: AsyncSession,
    owner_id: int,
    activity_id: int,
    applicant_id: int,
    to_status: ApplicationDecisionStatus,
) -> ActivityApplication:
    """
    모집글 작성자가 신청을 승인 또는 거절합니다.

    APPROVED 시 정원·마감 상태를 원자적으로 갱신합니다 (행 잠금).
    """
    if to_status not in (
        ApplicationStatus.APPROVED.value,
        ApplicationStatus.REJECTED.value,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="to_status는 APPROVED 또는 REJECTED 여야 합니다.",
        )

    async with db.begin_nested():
        activity = await _get_activity(db, activity_id, for_update=True)

        if activity.owner_id != owner_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="모집글 작성자만 신청을 처리할 수 있습니다.",
            )

        app_result = await db.execute(
            select(ActivityApplication).where(
                ActivityApplication.activity_id == activity_id,
                ActivityApplication.applicant_id == applicant_id,
            )
        )
        application = app_result.scalar_one_or_none()
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="신청 내역을 찾을 수 없습니다.",
            )

        if to_status == ApplicationStatus.REJECTED.value:
            if application.status != ApplicationStatus.PENDING.value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="대기 중인 신청만 거절할 수 있습니다.",
                )
            application.status = ApplicationStatus.REJECTED.value
            await db.flush()
            await db.refresh(application)
            return application

        if application.status == ApplicationStatus.APPROVED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 승인된 신청입니다.",
            )
        if application.status != ApplicationStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="대기 중인 신청만 승인할 수 있습니다.",
            )

        if activity.recruitment_status == RecruitmentStatus.COMPLETED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="활동이 완료된 모집글에는 승인할 수 없습니다.",
            )

        if _is_recruitment_closed(activity):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="모집이 마감된 상태에서는 승인할 수 없습니다.",
            )

        if activity.current_participants >= activity.max_participants:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="모집 정원이 가득 찼습니다. 더 이상 승인할 수 없습니다.",
            )

        if await _user_has_active_participation(db, applicant_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="신청자가 이미 다른 활동에 참여 중입니다.",
            )

        application.status = ApplicationStatus.APPROVED.value
        activity.current_participants += 1

        if activity.current_participants >= activity.max_participants:
            activity.recruitment_status = RecruitmentStatus.CLOSED.value

        await db.flush()
        await db.refresh(application)
        await db.refresh(activity)
        return application
