import asyncio
import time
from collections import defaultdict, deque
"""
Profile API - User profile management endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import json

from app.core.storage import save_profile_image, delete_file

from app.core.deps import get_db, get_current_user, require_roles
from app.models.user import User
from app.models.board import Post
from app.models.event import Event, Attendance
from app.models.gallery import Album
from app.schemas.user import (
    UserOwnProfile,
    UserPublicProfile,
    UserProfileUpdate,
    PrivacySettings,
    PrivacySettingsUpdate,
    RankInfo,
    UserStatsOut,
    NotificationSettings,
    NotificationSettingsUpdate,
)

router = APIRouter()

PROFILE_UPDATE_LIMIT = 12
PROFILE_UPDATE_WINDOW = 60
_profile_hits: dict[str, deque[float]] = defaultdict(deque)
_profile_lock = asyncio.Lock()

async def _enforce_profile_rate_limit(key: str):
    now = time.monotonic()
    async with _profile_lock:
        q = _profile_hits[key]
        while q and now - q[0] > PROFILE_UPDATE_WINDOW:
            q.popleft()
        if len(q) >= PROFILE_UPDATE_LIMIT:
            raise HTTPException(status_code=429, detail="프로필 수정 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.")
        q.append(now)

from app.services.rank_service import get_rank_for_points, get_next_rank, RANK_THRESHOLDS, RANK_ORDER


def calculate_rank_info(user: User) -> RankInfo:
    """Calculate rank progress information for a user."""
    current_rank = user.rank or "unranked"
    current_points = user.activity_points or 0
    next_rank = get_next_rank(current_rank)

    if next_rank is None:
        # Max rank reached
        return RankInfo(
            current_rank=current_rank,
            current_points=current_points,
            next_rank=None,
            points_to_next=None,
            rank_progress_percent=100.0,
        )

    current_threshold = RANK_THRESHOLDS.get(current_rank, 0)
    next_threshold = RANK_THRESHOLDS.get(next_rank, 0)

    points_in_range = current_points - current_threshold
    range_size = next_threshold - current_threshold

    progress = (points_in_range / range_size * 100) if range_size > 0 else 0
    progress = max(0, min(100, progress))

    return RankInfo(
        current_rank=current_rank,
        current_points=current_points,
        next_rank=next_rank,
        points_to_next=max(0, next_threshold - current_points),
        rank_progress_percent=round(progress, 1),
    )


@router.get("/me", response_model=UserOwnProfile)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    """Get current user's full profile."""
    return current_user


@router.put("/me", response_model=UserOwnProfile)
async def update_my_profile(
    update_data: UserProfileUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current user's profile."""
    client_ip = request.client.host if request.client else "unknown"
    await _enforce_profile_rate_limit(f"{client_ip}:{current_user.id}")
    update_dict = update_data.model_dump(exclude_unset=True)

    # Prevent identity tampering via profile endpoint
    restricted_fields = {"name", "student_id", "major", "generation", "role", "email"}
    requested_restricted = sorted(restricted_fields.intersection(update_dict.keys()))
    if requested_restricted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"다음 필드는 /profile/me 에서 변경할 수 없습니다: {', '.join(requested_restricted)}",
        )

    allowed_fields = {
        "bio",
        "interests",
        "tech_stack",
        "github_url",
        "portfolio_url",
        "profile_image",
        "notification_email",
        "notification_web_push",
        "reminder_24h",
        "reminder_1h",
    }
    update_dict = {k: v for k, v in update_dict.items() if k in allowed_fields}

    # Convert lists to JSON strings for storage
    if "interests" in update_dict and update_dict["interests"] is not None:
        update_dict["interests"] = json.dumps(update_dict["interests"])
    if "tech_stack" in update_dict and update_dict["tech_stack"] is not None:
        update_dict["tech_stack"] = json.dumps(update_dict["tech_stack"])

    for field, value in update_dict.items():
        if hasattr(current_user, field):
            setattr(current_user, field, value)

    await db.commit()
    await db.refresh(current_user)

    return current_user


@router.get("/me/privacy", response_model=PrivacySettings)
async def get_my_privacy_settings(
    current_user: User = Depends(get_current_user),
):
    """Get current user's privacy settings."""
    if current_user.privacy_settings:
        try:
            data = json.loads(current_user.privacy_settings)
            return PrivacySettings(**data)
        except (json.JSONDecodeError, TypeError):
            pass
    return PrivacySettings()


@router.put("/me/privacy", response_model=PrivacySettings)
async def update_my_privacy_settings(
    update_data: PrivacySettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current user's privacy settings."""
    # Load existing settings
    current_settings = PrivacySettings()
    if current_user.privacy_settings:
        try:
            data = json.loads(current_user.privacy_settings)
            current_settings = PrivacySettings(**data)
        except (json.JSONDecodeError, TypeError):
            pass

    # Apply updates
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(current_settings, field, value)

    # Save
    current_user.privacy_settings = json.dumps(current_settings.model_dump())
    await db.commit()

    return current_settings


@router.get("/me/notifications", response_model=NotificationSettings)
async def get_my_notification_settings(
    current_user: User = Depends(get_current_user),
):
    """Get current user's notification settings."""
    return NotificationSettings(
        email_enabled=current_user.notification_email,
        web_push_enabled=current_user.notification_web_push,
        reminder_24h=current_user.reminder_24h,
        reminder_1h=current_user.reminder_1h,
        notify_new_post=current_user.notify_new_post,
        notify_comment_reply=current_user.notify_comment_reply,
        notify_event_reminder=current_user.notify_event_reminder,
        notify_event_update=current_user.notify_event_update,
        notify_mention=current_user.notify_mention,
        notify_system=current_user.notify_system,
    )


@router.put("/me/notifications", response_model=NotificationSettings)
async def update_my_notification_settings(
    update_data: NotificationSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current user's notification settings."""
    update_dict = update_data.model_dump(exclude_unset=True)

    # Map schema fields to model fields
    field_mapping = {
        "email_enabled": "notification_email",
        "web_push_enabled": "notification_web_push",
        "reminder_24h": "reminder_24h",
        "reminder_1h": "reminder_1h",
        "notify_new_post": "notify_new_post",
        "notify_comment_reply": "notify_comment_reply",
        "notify_event_reminder": "notify_event_reminder",
        "notify_event_update": "notify_event_update",
        "notify_mention": "notify_mention",
        "notify_system": "notify_system",
    }

    for schema_field, model_field in field_mapping.items():
        if schema_field in update_dict:
            setattr(current_user, model_field, update_dict[schema_field])

    await db.commit()
    await db.refresh(current_user)

    return NotificationSettings(
        email_enabled=current_user.notification_email,
        web_push_enabled=current_user.notification_web_push,
        reminder_24h=current_user.reminder_24h,
        reminder_1h=current_user.reminder_1h,
        notify_new_post=current_user.notify_new_post,
        notify_comment_reply=current_user.notify_comment_reply,
        notify_event_reminder=current_user.notify_event_reminder,
        notify_event_update=current_user.notify_event_update,
        notify_mention=current_user.notify_mention,
        notify_system=current_user.notify_system,
    )


@router.get("/me/rank", response_model=RankInfo)
async def get_my_rank_info(
    current_user: User = Depends(get_current_user),
):
    """Get current user's rank and progress information."""
    return calculate_rank_info(current_user)


@router.get("/me/stats", response_model=UserStatsOut)
async def get_my_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's activity statistics."""
    user_id = current_user.id

    # Count posts
    posts_result = await db.execute(
        select(func.count(Post.id)).where(Post.author_id == user_id)
    )
    total_posts = posts_result.scalar() or 0

    # Count comments (TODO: Add when Comment model exists)
    total_comments = 0

    # Count events attended
    events_result = await db.execute(
        select(func.count(Attendance.id)).where(Attendance.user_id == user_id)
    )
    total_events = events_result.scalar() or 0

    # Count albums created
    albums_result = await db.execute(
        select(func.count(Album.id)).where(Album.created_by == user_id)
    )
    total_albums = albums_result.scalar() or 0

    return UserStatsOut(
        total_posts=total_posts,
        total_comments=total_comments,
        total_events_attended=total_events,
        total_albums_created=total_albums,
        coding_tests_completed=0,  # TODO: Implement when codetest has user tracking
        current_streak_days=0,  # TODO: Implement with ActivityLog
        longest_streak_days=0,
    )


@router.post("/me/image")
async def upload_profile_image(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload or replace profile image.

    - Maximum file size: 5MB
    - Allowed formats: JPEG, PNG, GIF, WEBP
    - Image will be resized to 400x400 max
    """
    # Delete old image if exists
    if current_user.profile_image:
        old_filename = current_user.profile_image.split("/")[-1]
        delete_file(f"profiles/{old_filename}")

    # Save new image
    relative_path, url = await save_profile_image(file, current_user.id)

    # Update user record
    current_user.profile_image = url
    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Profile image uploaded successfully",
        "profile_image": url,
    }


@router.delete("/me/image")
async def delete_profile_image(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete current user's profile image."""
    if not current_user.profile_image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile image to delete",
        )

    # Delete file from storage
    old_filename = current_user.profile_image.split("/")[-1]
    delete_file(f"profiles/{old_filename}")

    # Update user record
    current_user.profile_image = None
    await db.commit()

    return {"message": "Profile image deleted successfully"}


@router.get("/{user_id}", response_model=UserPublicProfile)
async def get_user_profile(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Get another user's public profile."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
        
    from app.models.activity import ActivityLog
    from sqlalchemy import and_
    
    # Calculate real activity_points
    earned_res = await db.execute(
        select(func.coalesce(func.sum(ActivityLog.points), 0)).where(
            and_(ActivityLog.user_id == user_id, ActivityLog.points > 0)
        )
    )
    spent_res = await db.execute(
        select(func.coalesce(func.sum(ActivityLog.points), 0)).where(
            and_(ActivityLog.user_id == user_id, ActivityLog.points < 0)
        )
    )
    real_activity_points = max(0, (earned_res.scalar() or 0) + (spent_res.scalar() or 0))

    # Parse privacy settings
    privacy = PrivacySettings()
    if user.privacy_settings:
        try:
            data = json.loads(user.privacy_settings)
            privacy = PrivacySettings(**data)
        except (json.JSONDecodeError, TypeError):
            pass

    # Build response with privacy in mind
    profile_data = {
        "id": user.id,
        "name": user.name,
        "major": user.major,
        "generation": user.generation,
        "bio": user.bio,
        "interests": json.loads(user.interests) if user.interests else None,
        "tech_stack": json.loads(user.tech_stack) if user.tech_stack else None,
        "github_url": user.github_url,
        "portfolio_url": user.portfolio_url,
        "profile_image": user.profile_image,
        "role": user.role,
        "rank": user.rank if privacy.show_rank else "unranked",
        "activity_points": real_activity_points if privacy.show_activity else 0,
        "created_at": user.created_at,
    }

    # Add optional fields based on privacy
    if privacy.show_email:
        profile_data["email"] = user.email
    if privacy.show_student_id:
        profile_data["student_id"] = user.student_id

    return UserPublicProfile(**profile_data)


@router.get("/{user_id}/rank", response_model=RankInfo)
async def get_user_rank_info(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a user's rank information."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    return calculate_rank_info(user)


@router.get("/{user_id}/stats", response_model=UserStatsOut)
async def get_user_stats(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a user's activity statistics."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check privacy settings
    privacy = PrivacySettings()
    if user.privacy_settings:
        try:
            data = json.loads(user.privacy_settings)
            privacy = PrivacySettings(**data)
        except (json.JSONDecodeError, TypeError):
            pass

    if not privacy.show_activity:
        # Return empty stats if activity is hidden
        return UserStatsOut()

    # Count posts
    posts_result = await db.execute(
        select(func.count(Post.id)).where(Post.author_id == user_id)
    )
    total_posts = posts_result.scalar() or 0

    # Count comments (TODO: Add when Comment model exists)
    total_comments = 0

    # Count events attended
    events_result = await db.execute(
        select(func.count(Attendance.id)).where(Attendance.user_id == user_id)
    )
    total_events = events_result.scalar() or 0

    # Count albums created
    albums_result = await db.execute(
        select(func.count(Album.id)).where(Album.created_by == user_id)
    )
    total_albums = albums_result.scalar() or 0

    return UserStatsOut(
        total_posts=total_posts,
        total_comments=total_comments,
        total_events_attended=total_events,
        total_albums_created=total_albums,
    )
