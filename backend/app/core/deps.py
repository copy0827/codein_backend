"""
Authentication and authorization dependencies for FastAPI routes.

Provides:
- Database session injection
- JWT token validation
- Role-based access control (RBAC)
- Rank-based access control
- Suspension checking
"""

from datetime import datetime
from typing import List, Optional, Union

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from app.core.config import settings
from app.core.permissions import (
    get_role_level,
    get_rank_level,
    has_role,
    has_any_role,
    has_rank,
    can_access_content,
    ROLE_MAP,
    RANK_MAP,
)
from app.db.session import async_session
from app.models.user import User

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select


# Bearer 토큰(Authorization: Bearer <token>)을 읽는다.
# auto_error=False로 해두면 토큰이 없을 때 우리가 "Missing token"을 직접 띄울 수 있음.
bearer_scheme = HTTPBearer(auto_error=False)


async def get_db() -> AsyncSession:
    """Provide an async database session."""
    async with async_session() as session:
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validate JWT token and return the current user.

    Raises:
        HTTPException 401: Invalid or missing token
        HTTPException 403: User is suspended
    """
    token = credentials.credentials if credentials else None
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    res = await db.execute(select(User).where(User.id == int(user_id)))
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=401, detail="User account is deactivated")

    # Check suspension status
    if user.is_suspended:
        if user.suspended_until and user.suspended_until > datetime.utcnow():
            raise HTTPException(
                status_code=403,
                detail=f"Account suspended until {user.suspended_until.isoformat()}. Reason: {user.suspension_reason or 'Not specified'}",
            )
        # Suspension has expired - auto-unsuspend would happen in a background job
        # But we allow access here

    return user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """
    Get current user if authenticated, otherwise return None.
    Useful for endpoints that behave differently for authenticated users.
    """
    if not credentials:
        return None

    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


def require_roles(*roles: str):
    """
    Dependency factory for exact role matching.
    User must have one of the specified roles.

    Usage:
        @router.get("/admin", dependencies=[Depends(require_roles("admin", "superadmin"))])
    """

    async def guard(user: User = Depends(get_current_user)) -> User:
        if not has_any_role(user.role, list(roles)):
            raise HTTPException(status_code=403, detail="Forbidden: insufficient role")
        return user

    return guard


def require_min_role(min_role: str):
    """
    Dependency factory for hierarchical role checking.
    User must have at least the specified role level.

    Usage:
        @router.get("/staff-only", dependencies=[Depends(require_min_role("staff"))])
    """

    async def guard(user: User = Depends(get_current_user)) -> User:
        if not has_role(user.role, min_role):
            raise HTTPException(
                status_code=403, detail=f"Forbidden: requires {min_role} role or higher"
            )
        return user

    return guard


def require_rank(min_rank: str):
    """
    Dependency factory for rank-based access control.
    User must have at least the specified rank.

    Usage:
        @router.get("/gold-plus", dependencies=[Depends(require_rank("gold"))])
    """

    async def guard(user: User = Depends(get_current_user)) -> User:
        if not has_rank(user.rank, min_rank):
            raise HTTPException(
                status_code=403, detail=f"Forbidden: requires {min_rank} rank or higher"
            )
        return user

    return guard


def require_role_or_rank(min_role: str, min_rank: str):
    """
    Dependency factory for combined role/rank checking.
    User must have either the role OR the rank.

    Usage:
        @router.get("/special", dependencies=[Depends(require_role_or_rank("staff", "gold"))])
    """

    async def guard(user: User = Depends(get_current_user)) -> User:
        if not has_role(user.role, min_role) and not has_rank(user.rank, min_rank):
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: requires {min_role} role or {min_rank} rank",
            )
        return user

    return guard


def require_content_access(target_audience: str):
    """
    Dependency factory for content-based access control.
    Checks if user can access content with the given target_audience setting.

    Usage:
        @router.get("/content/{id}")
        async def get_content(
            id: int,
            user: User = Depends(require_content_access("members"))
        ):
    """

    async def guard(user: User = Depends(get_current_user)) -> User:
        if not can_access_content(user.role, user.rank, target_audience):
            raise HTTPException(
                status_code=403, detail="Forbidden: content not accessible"
            )
        return user

    return guard


async def require_owner_or_role(
    owner_id: int,
    required_role: str,
    user: User = Depends(get_current_user),
) -> User:
    """
    Check if user is the owner of a resource OR has the required role.

    Usage:
        async def update_post(post_id: int, user: User = Depends(get_current_user)):
            post = await get_post(post_id)
            await require_owner_or_role(post.author_id, "staff", user)
    """
    if user.id != owner_id and not has_role(user.role, required_role):
        raise HTTPException(
            status_code=403, detail="Forbidden: you can only modify your own content"
        )
    return user


def get_user_permissions(user: User) -> dict:
    """
    Get a dictionary of user's permissions for frontend use.
    Returns role level, rank level, and specific permission flags.
    """
    role_level = get_role_level(user.role)
    rank_level = get_rank_level(user.rank)

    return {
        "role": user.role,
        "role_level": role_level,
        "rank": user.rank,
        "rank_level": rank_level,
        "can_create_post": role_level >= get_role_level("member"),
        "can_create_notice": role_level >= get_role_level("staff"),
        "can_create_event": role_level >= get_role_level("staff"),
        "can_moderate": role_level >= get_role_level("staff"),
        "can_manage_users": role_level >= get_role_level("admin"),
        "can_access_admin": role_level >= get_role_level("staff"),
        "is_suspended": user.is_suspended,
    }
