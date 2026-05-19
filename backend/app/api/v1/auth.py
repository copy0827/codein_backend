import asyncio
import time
from collections import defaultdict, deque
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Response, Cookie, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.db.session import async_session
from app.models.user import User

router = APIRouter()

LOGIN_MIN_DELAY_SECONDS = 0.6
LOGIN_RATE_LIMIT_ATTEMPTS = 6
LOGIN_RATE_LIMIT_WINDOW_SECONDS = 60
_login_attempts: dict[str, deque[float]] = defaultdict(deque)
_login_attempts_lock = asyncio.Lock()


class Register(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    name: str
    student_id: str
    major: str
    generation: str


class Login(BaseModel):
    email: str
    password: str


async def _enforce_login_rate_limit(key: str) -> None:
    now = time.monotonic()
    async with _login_attempts_lock:
        q = _login_attempts[key]
        while q and now - q[0] > LOGIN_RATE_LIMIT_WINDOW_SECONDS:
            q.popleft()
        if len(q) >= LOGIN_RATE_LIMIT_ATTEMPTS:
            raise HTTPException(429, "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.")


async def _record_login_failure(key: str) -> None:
    now = time.monotonic()
    async with _login_attempts_lock:
        q = _login_attempts[key]
        q.append(now)
        while q and now - q[0] > LOGIN_RATE_LIMIT_WINDOW_SECONDS:
            q.popleft()


async def _clear_login_failures(key: str) -> None:
    async with _login_attempts_lock:
        _login_attempts.pop(key, None)


@router.post("/register")
async def register(data: Register):
    async with async_session() as db:
        res = await db.execute(select(User).where(User.email == data.email))
        if res.scalar_one_or_none():
            raise HTTPException(400, "Email exists")
        user = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            name=data.name,
            student_id=data.student_id,
            major=data.major,
            generation=data.generation,
            is_active=False,
        )
        db.add(user)
        await db.commit()
        return {"status": "pending_approval"}


@router.post("/login")
async def login(data: Login, response: Response, request: Request):
    started = time.perf_counter()
    client_ip = request.client.host if request.client else "unknown"
    key = f"{client_ip}:{(data.email or '').strip().lower()}"
    try:
        await _enforce_login_rate_limit(key)

        async with async_session() as db:
            res = await db.execute(select(User).where(User.email == data.email))
            user = res.scalar_one_or_none()
            if not user or not verify_password(data.password, user.hashed_password):
                await _record_login_failure(key)
                raise HTTPException(401, "Invalid credentials")
            if not user.is_active:
                raise HTTPException(403, "Account pending approval")
            if user.is_suspended:
                now = datetime.now(ZoneInfo("Asia/Seoul"))
                if user.suspended_until is None or user.suspended_until > now:
                    until_msg = (
                        user.suspended_until.strftime("%Y-%m-%d %H:%M")
                        if user.suspended_until
                        else "무기한"
                    )
                    raise HTTPException(
                        403,
                        f"활동 정지된 계정입니다. 정지 기간: {until_msg}",
                    )
                else:
                    user.is_suspended = False
                    user.suspended_until = None
                    await db.commit()

            await _clear_login_failures(key)
            access_token = create_access_token({"sub": str(user.id)})
            refresh_token = create_refresh_token({"sub": str(user.id)})
            response.set_cookie(
                key="refresh_token",
                value=refresh_token,
                httponly=True,
                secure=True,
                samesite="lax",
                max_age=60 * 60 * 24 * 7,
                path='/',
            )
            return {"access_token": access_token}
    finally:
        elapsed = time.perf_counter() - started
        if elapsed < LOGIN_MIN_DELAY_SECONDS:
            await asyncio.sleep(LOGIN_MIN_DELAY_SECONDS - elapsed)


@router.post("/refresh")
async def refresh_token(refresh_token: str | None = Cookie(default=None)):
    if not refresh_token:
        raise HTTPException(401, "Missing refresh token")
    from jose import jwt, JWTError
    from app.core.config import settings
    try:
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Invalid refresh token")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(401, "Invalid refresh token")
    except JWTError:
        raise HTTPException(401, "Invalid refresh token")
    return {"access_token": create_access_token({"sub": str(user_id)})}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="refresh_token", path='/')
    return {"ok": True}
