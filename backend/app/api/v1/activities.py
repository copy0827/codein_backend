"""
활동 모집 게시판 API — 목록·작성·신청자 조회·상태 변경.
"""

from __future__ import annotations

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.deps import get_current_user, get_current_user_optional, get_db
from app.core.permissions import has_role
from app.models.activity_recruitment import (
    ActivityApplication,
    ActivityRecruitment,
    ApplicationStatus,
    RecruitmentStatus,
    RecruitmentType,
)
from app.models.user import User
from app.schemas.activity import (
    ActivityCreate,
    ActivityListResponse,
    ActivityResponse,
    ActivityStatusPatch,
    ApplicationCreate,
    ApplicationListResponse,
    ApplicationResponse,
    ApplicationUpdate,
)
from app.schemas.user import UserSummary
from app.services.activity_service import (
    apply_activity,
    approve_or_reject_application,
)

router = APIRouter()

ALLOWED_STATUS_PATCH = {
    RecruitmentStatus.CLOSED.value,
    RecruitmentStatus.COMPLETED.value,
}


def _is_admin(user: User) -> bool:
    return has_role(user.role, "admin")


def _mentoring_visibility_filter(*, include_unapproved: bool):
    """멘토링 글은 승인된 것만 노출 (관리자는 미승인 포함 가능)."""
    if include_unapproved:
        return None
    return or_(
        ActivityRecruitment.recruitment_type != RecruitmentType.MENTORING.value,
        ActivityRecruitment.is_approved.is_(True),
    )


def _application_to_response(
    application: ActivityApplication,
    *,
    activity_title: Optional[str] = None,
    process_message: Optional[str] = None,
) -> ApplicationResponse:
    applicant_summary = None
    if application.applicant is not None:
        applicant_summary = UserSummary.model_validate(application.applicant)
    return ApplicationResponse(
        id=application.id,
        activity_id=application.activity_id,
        applicant_id=application.applicant_id,
        message=application.message,
        status=application.status,
        applied_at=application.applied_at,
        applicant=applicant_summary,
        activity_title=activity_title,
        process_message=process_message,
    )


def _activity_to_response(
    activity: ActivityRecruitment,
    *,
    pending_count: int = 0,
) -> ActivityResponse:
    owner_summary = (
        UserSummary.model_validate(activity.owner) if activity.owner is not None else None
    )
    spots_remaining = max(0, activity.max_participants - activity.current_participants)
    return ActivityResponse(
        id=activity.id,
        title=activity.title,
        content=activity.content,
        recruitment_type=activity.recruitment_type,
        recruitment_status=activity.recruitment_status,
        max_participants=activity.max_participants,
        current_participants=activity.current_participants,
        deadline=activity.deadline,
        activity_period=activity.activity_period,
        tech_stacks=activity.tech_stacks,
        is_approved=activity.is_approved,
        owner_id=activity.owner_id,
        additional_info=activity.additional_info,
        created_at=activity.created_at,
        updated_at=activity.updated_at,
        owner=owner_summary,
        spots_remaining=spots_remaining,
        is_full=activity.current_participants >= activity.max_participants,
        pending_application_count=pending_count,
    )


async def _get_activity_or_404(
    db: AsyncSession, activity_id: int, *, load_owner: bool = False
) -> ActivityRecruitment:
    stmt = select(ActivityRecruitment).where(ActivityRecruitment.id == activity_id)
    if load_owner:
        stmt = stmt.options(joinedload(ActivityRecruitment.owner))
    result = await db.execute(stmt)
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="모집글을 찾을 수 없습니다.",
        )
    return activity


async def _pending_counts_by_activity(
    db: AsyncSession, activity_ids: list[int]
) -> dict[int, int]:
    if not activity_ids:
        return {}
    rows = await db.execute(
        select(
            ActivityApplication.activity_id,
            func.count(ActivityApplication.id),
        )
        .where(
            ActivityApplication.activity_id.in_(activity_ids),
            ActivityApplication.status == ApplicationStatus.PENDING.value,
        )
        .group_by(ActivityApplication.activity_id)
    )
    return {activity_id: count for activity_id, count in rows.all()}


async def _load_application_with_applicant(
    db: AsyncSession,
    application_id: int,
) -> ActivityApplication:
    result = await db.execute(
        select(ActivityApplication)
        .where(ActivityApplication.id == application_id)
        .options(joinedload(ActivityApplication.applicant))
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="신청 내역을 찾을 수 없습니다.",
        )
    return application


async def _assert_activity_visible(
    activity: ActivityRecruitment,
    user: Optional[User],
) -> None:
    """미승인 멘토링 글은 작성자·관리자만 조회 가능."""
    if activity.recruitment_type != RecruitmentType.MENTORING.value:
        return
    if activity.is_approved:
        return
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="모집글을 찾을 수 없습니다.",
        )
    if user.id == activity.owner_id or (user and _is_admin(user)):
        return
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="모집글을 찾을 수 없습니다.",
    )


@router.get("", response_model=ActivityListResponse)
async def list_activities(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
    recruitment_type: Optional[str] = Query(
        None, description="STUDY, PROJECT, CONTEST, MENTORING"
    ),
    recruitment_status: Optional[str] = Query(
        None, description="RECRUITING, CLOSED, COMPLETED"
    ),
    tech_stack: Optional[str] = Query(None, description="기술 스택 태그 필터"),
    search_keyword: Optional[str] = Query(None, description="제목·내용 검색"),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=50),
):
    include_unapproved = current_user is not None and _is_admin(current_user)
    conditions = []

    mentoring_filter = _mentoring_visibility_filter(
        include_unapproved=include_unapproved
    )
    if mentoring_filter is not None:
        conditions.append(mentoring_filter)

    if recruitment_type:
        normalized_type = recruitment_type.strip().upper()
        conditions.append(ActivityRecruitment.recruitment_type == normalized_type)

    if recruitment_status:
        normalized_status = recruitment_status.strip().upper()
        conditions.append(
            ActivityRecruitment.recruitment_status == normalized_status
        )

    if tech_stack:
        tag = tech_stack.strip()
        if tag:
            conditions.append(ActivityRecruitment.tech_stacks.contains([tag]))

    if search_keyword:
        keyword = f"%{search_keyword.strip()}%"
        conditions.append(
            or_(
                ActivityRecruitment.title.ilike(keyword),
                ActivityRecruitment.content.ilike(keyword),
            )
        )

    base_query = select(ActivityRecruitment).options(
        joinedload(ActivityRecruitment.owner)
    )
    if conditions:
        base_query = base_query.where(and_(*conditions))

    count_query = select(func.count()).select_from(ActivityRecruitment)
    if conditions:
        count_query = count_query.where(and_(*conditions))

    total = (await db.execute(count_query)).scalar() or 0
    total_pages = math.ceil(total / size) if total else 0
    offset = (page - 1) * size

    result = await db.execute(
        base_query.order_by(ActivityRecruitment.created_at.desc())
        .offset(offset)
        .limit(size)
    )
    activities = result.scalars().unique().all()
    pending_map = await _pending_counts_by_activity(
        db, [activity.id for activity in activities]
    )

    items = [
        _activity_to_response(
            activity, pending_count=pending_map.get(activity.id, 0)
        )
        for activity in activities
    ]

    return ActivityListResponse(
        items=items,
        total=total,
        page=page,
        page_size=size,
        total_pages=total_pages,
    )


@router.post("", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
async def create_activity(
    payload: ActivityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recruitment_type = payload.recruitment_type

    if recruitment_type == RecruitmentType.MENTORING.value:
        if _is_admin(current_user):
            is_approved = (
                payload.is_approved if payload.is_approved is not None else False
            )
        else:
            is_approved = False
    else:
        is_approved = payload.is_approved if payload.is_approved is not None else True

    activity = ActivityRecruitment(
        title=payload.title.strip(),
        content=payload.content.strip(),
        recruitment_type=recruitment_type,
        recruitment_status=payload.recruitment_status,
        max_participants=payload.max_participants,
        current_participants=0,
        deadline=payload.deadline,
        activity_period=payload.activity_period.strip(),
        tech_stacks=payload.tech_stacks,
        is_approved=is_approved,
        owner_id=current_user.id,
        additional_info=payload.additional_info,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)

    result = await db.execute(
        select(ActivityRecruitment)
        .where(ActivityRecruitment.id == activity.id)
        .options(joinedload(ActivityRecruitment.owner))
    )
    activity = result.scalar_one()
    return _activity_to_response(activity, pending_count=0)


@router.get("/{activity_id}", response_model=ActivityResponse)
async def get_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    activity = await _get_activity_or_404(db, activity_id, load_owner=True)
    await _assert_activity_visible(activity, current_user)

    pending_map = await _pending_counts_by_activity(db, [activity.id])
    return _activity_to_response(
        activity, pending_count=pending_map.get(activity.id, 0)
    )


@router.post(
    "/{activity_id}/apply",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def apply_to_activity(
    activity_id: int,
    body: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    활동 모집 신청 (스터디·프로젝트·대회·멘토링 공통).

    정책 검증은 activity_service.apply_activity 에서 수행합니다.
    """
    activity = await _get_activity_or_404(db, activity_id)
    await _assert_activity_visible(activity, current_user)

    if activity.owner_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="본인이 작성한 모집글에는 신청할 수 없습니다.",
        )

    application = await apply_activity(
        db,
        user_id=current_user.id,
        activity_id=activity_id,
        message=body.message,
    )
    await db.commit()

    application = await _load_application_with_applicant(db, application.id)
    return _application_to_response(application, activity_title=activity.title)


@router.patch(
    "/{activity_id}/applications/{applicant_id}",
    response_model=ApplicationResponse,
)
async def patch_activity_application(
    activity_id: int,
    applicant_id: int,
    body: ApplicationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    신청 승인/거절 (모집글 작성자 전용).

    403 등 예외는 activity_service.approve_or_reject_application 에서 발생합니다.
    """
    activity = await _get_activity_or_404(db, activity_id)
    await _assert_activity_visible(activity, current_user)

    application = await approve_or_reject_application(
        db,
        owner_id=current_user.id,
        activity_id=activity_id,
        applicant_id=applicant_id,
        to_status=body.status,
    )
    await db.commit()

    application = await _load_application_with_applicant(db, application.id)
    return _application_to_response(
        application,
        activity_title=activity.title,
        process_message=body.process_message,
    )


@router.get(
    "/{activity_id}/applications",
    response_model=ApplicationListResponse,
)
async def list_activity_applications(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    """
    신청자 목록 조회.

    - 모집글 작성자(owner): 전체 신청·메시지 조회
    - 그 외 로그인 회원: 본인 신청 1건만 반환
    - 신청 이력이 없는 비작성자: 403 Forbidden
    """
    activity = await _get_activity_or_404(db, activity_id)
    await _assert_activity_visible(activity, current_user)

    is_owner = activity.owner_id == current_user.id

    if is_owner or _is_admin(current_user):
        conditions = [ActivityApplication.activity_id == activity_id]
        count_stmt = (
            select(func.count())
            .select_from(ActivityApplication)
            .where(*conditions)
        )
        total = (await db.execute(count_stmt)).scalar() or 0
        total_pages = math.ceil(total / size) if total else 0
        offset = (page - 1) * size

        result = await db.execute(
            select(ActivityApplication)
            .where(*conditions)
            .options(joinedload(ActivityApplication.applicant))
            .order_by(ActivityApplication.applied_at.desc())
            .offset(offset)
            .limit(size)
        )
        applications = result.scalars().unique().all()
        items = [
            _application_to_response(app, activity_title=activity.title)
            for app in applications
        ]
        return ApplicationListResponse(
            items=items,
            total=total,
            page=page,
            page_size=size,
            total_pages=total_pages,
        )

    own_result = await db.execute(
        select(ActivityApplication)
        .where(
            ActivityApplication.activity_id == activity_id,
            ActivityApplication.applicant_id == current_user.id,
        )
        .options(joinedload(ActivityApplication.applicant))
    )
    own_application = own_result.scalar_one_or_none()

    if own_application is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="신청자 목록은 모집글 작성자만 조회할 수 있습니다.",
        )

    return ApplicationListResponse(
        items=[
            _application_to_response(
                own_application, activity_title=activity.title
            )
        ],
        total=1,
        page=1,
        page_size=size,
        total_pages=1,
    )


@router.patch("/{activity_id}/status", response_model=ActivityResponse)
async def patch_activity_status(
    activity_id: int,
    payload: ActivityStatusPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    activity = await _get_activity_or_404(db, activity_id, load_owner=True)

    if activity.owner_id != current_user.id and not _is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="모집글 작성자 또는 관리자만 상태를 변경할 수 있습니다.",
        )

    new_status = payload.recruitment_status
    if new_status not in ALLOWED_STATUS_PATCH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="recruitment_status는 CLOSED 또는 COMPLETED 만 설정할 수 있습니다.",
        )

    activity.recruitment_status = new_status
    await db.commit()
    await db.refresh(activity)

    pending_map = await _pending_counts_by_activity(db, [activity.id])
    return _activity_to_response(
        activity, pending_count=pending_map.get(activity.id, 0)
    )
