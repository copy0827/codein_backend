"""
Activity API - User activity points and history endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from typing import Optional

from app.core.deps import get_db, get_current_user, require_roles
from app.models.user import User
from app.models.activity import ActivityLog, ACTIVITY_POINTS, ACTIVITY_DESCRIPTIONS
from app.schemas.activity import (
    ActivityLogOut,
    ActivityLogCreate,
    ActivityHistoryOut,
    PointsSummary,
)

router = APIRouter()

from app.services.rank_service import get_rank_for_points, get_next_rank, RANK_THRESHOLDS, RANK_ORDER


async def grant_points(
    db: AsyncSession,
    user_id: int,
    activity_type: str,
    points: Optional[int] = None,
    description: Optional[str] = None,
    reference_type: Optional[str] = None,
    reference_id: Optional[int] = None,
) -> ActivityLog:
    """
    Grant activity points to a user and log the activity.
    Returns the created ActivityLog entry.
    """
    # Get user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise ValueError(f"User {user_id} not found")

    # Determine points
    if points is None:
        points = ACTIVITY_POINTS.get(activity_type, 0)

    # Determine description
    if description is None:
        description = ACTIVITY_DESCRIPTIONS.get(activity_type, activity_type)

    # Update user points and active_points
    user.points = (user.points or 0) + points
    if points > 0:
        user.activity_points = (user.activity_points or 0) + points

    # Check for rank up based on activity_points
    old_rank = user.rank or "unranked"
    new_rank = get_rank_for_points(user.activity_points)

    rank_changed = old_rank != new_rank
    if rank_changed:
        user.rank = new_rank

    # Create activity log
    log = ActivityLog(
        user_id=user_id,
        activity_type=activity_type,
        points=points,
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
        balance_after=user.points,
    )
    db.add(log)

    # If rank changed, also log that
    if rank_changed:
        rank_log = ActivityLog(
            user_id=user_id,
            activity_type="rank_up",
            points=0,
            description=f"{old_rank} → {new_rank} 등급 변경",
            balance_after=user.points,
        )
        db.add(rank_log)

    await db.commit()
    await db.refresh(log)

    return log


async def check_and_promote_rank(db: AsyncSession, user: User) -> bool:
    """
    Check if user should be promoted based on current points.
    Returns True if rank was changed.
    """
    current_points = user.activity_points or 0
    current_rank = user.rank or "unranked"
    expected_rank = get_rank_for_points(current_points)

    if current_rank != expected_rank:
        old_rank = current_rank
        user.rank = expected_rank

        # Log the rank change
        log = ActivityLog(
            user_id=user.id,
            activity_type="rank_up",
            points=0,
            description=f"{old_rank} → {expected_rank} 등급 승격",
            balance_after=current_points,
        )
        db.add(log)
        await db.commit()
        return True

    return False


@router.get("/me/history", response_model=ActivityHistoryOut)
async def get_my_activity_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    activity_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's activity history with pagination."""
    user_id = current_user.id

    # Base query
    query = select(ActivityLog).where(ActivityLog.user_id == user_id)
    count_query = select(func.count(ActivityLog.id)).where(
        ActivityLog.user_id == user_id
    )

    # Filter by type if provided
    if activity_type:
        query = query.where(ActivityLog.activity_type == activity_type)
        count_query = count_query.where(ActivityLog.activity_type == activity_type)

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Calculate pagination
    total_pages = (total + page_size - 1) // page_size
    offset = (page - 1) * page_size

    # Get items
    query = (
        query.order_by(ActivityLog.created_at.desc()).offset(offset).limit(page_size)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    return ActivityHistoryOut(
        items=[ActivityLogOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/me/summary", response_model=PointsSummary)
async def get_my_points_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's points summary."""
    user_id = current_user.id
    # Total earned (sum of positive points)
    earned_result = await db.execute(
        select(func.coalesce(func.sum(ActivityLog.points), 0)).where(
            and_(ActivityLog.user_id == user_id, ActivityLog.points > 0)
        )
    )
    total_earned = earned_result.scalar() or 0

    # Total spent/deducted (sum of negative points, as positive number)
    spent_result = await db.execute(
        select(func.coalesce(func.sum(ActivityLog.points), 0)).where(
            and_(ActivityLog.user_id == user_id, ActivityLog.points < 0)
        )
    )
    total_spent_raw = spent_result.scalar() or 0
    total_spent = abs(total_spent_raw)
    
    # Update current_rank to simply use the synced DB rank
    current_rank = current_user.rank or "unranked"
    current_points = current_user.points or 0
    activity_points = current_user.activity_points or 0

    # This month earned (net: including deductions)
    month_start = datetime.now().replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    month_result = await db.execute(
        select(func.coalesce(func.sum(ActivityLog.points), 0)).where(
            and_(
                ActivityLog.user_id == user_id,
                ActivityLog.created_at >= month_start,
            )
        )
    )
    this_month_earned = month_result.scalar() or 0

    # Next rank info
    next_rank = get_next_rank(current_rank)
    points_to_next = None
    if next_rank:
        points_to_next = max(0, RANK_THRESHOLDS[next_rank] - activity_points)

    return PointsSummary(
        current_points=current_points,
        total_earned=total_earned,
        total_spent=total_spent,
        this_month_earned=this_month_earned,
        rank=current_rank,
        next_rank=next_rank,
        points_to_next_rank=points_to_next,
    )


@router.get("/{user_id}/history", response_model=ActivityHistoryOut)
async def get_user_activity_history(
    user_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Get a user's activity history (respects privacy settings)."""
    # Check if user exists
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check privacy settings
    import json

    show_activity = True
    if user.privacy_settings:
        try:
            settings = json.loads(user.privacy_settings)
            show_activity = settings.get("show_activity", True)
        except (json.JSONDecodeError, TypeError):
            pass

    if not show_activity:
        return ActivityHistoryOut(
            items=[],
            total=0,
            page=page,
            page_size=page_size,
            total_pages=0,
        )

    # Get activity history
    count_query = select(func.count(ActivityLog.id)).where(
        ActivityLog.user_id == user_id
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    total_pages = (total + page_size - 1) // page_size
    offset = (page - 1) * page_size

    query = (
        select(ActivityLog)
        .where(ActivityLog.user_id == user_id)
        .order_by(ActivityLog.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    return ActivityHistoryOut(
        items=[ActivityLogOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/admin/grant/{user_id}", response_model=ActivityLogOut)
async def admin_grant_points(
    user_id: int,
    data: ActivityLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    """Admin: Manually grant or deduct points from a user."""
    activity_type = "admin_grant" if data.points >= 0 else "admin_deduct"

    try:
        log = await grant_points(
            db=db,
            user_id=user_id,
            activity_type=activity_type,
            points=data.points,
            description=data.description,
        )
        return log
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
