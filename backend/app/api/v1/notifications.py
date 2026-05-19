import asyncio
import json
import re
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import List, Optional


def _kst_now():
    return datetime.now(ZoneInfo("Asia/Seoul"))



from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, and_

from app.core.deps import get_db, get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import (
    NotificationCreate,
    NotificationOut,
    NotificationCountOut,
    NotificationListOut,
)

router = APIRouter()

notification_subscribers: dict[int, list[asyncio.Queue]] = {}

MENTION_PATTERN = re.compile(r"@([\w가-힣._-]{2,})")


def extract_mentions(content: Optional[str]) -> set[str]:
    if not content:
        return set()
    return {match.group(1) for match in MENTION_PATTERN.finditer(content)}


async def get_mentioned_users(db: AsyncSession, content: Optional[str]) -> List[User]:
    names = extract_mentions(content)
    if not names:
        return []
    result = await db.execute(select(User).where(User.name.in_(list(names))))
    return result.scalars().all()


async def notify_mentions(
    db: AsyncSession,
    content: Optional[str],
    actor_id: int,
    actor_name: str,
    link: Optional[str],
    related_type: Optional[str],
    related_id: Optional[int],
) -> List[int]:
    mentioned_users = await get_mentioned_users(db, content)
    notified: List[int] = []
    for user in mentioned_users:
        if user.id == actor_id or not user.notify_mention:
            continue
        await send_notification(
            db=db,
            user_id=user.id,
            notification_type="mention",
            title="멘션 알림",
            message=f"{actor_name}님이 멘션했습니다.",
            link=link,
            related_type=related_type,
            related_id=related_id,
        )
        notified.append(user.id)
    return notified


@router.get("", include_in_schema=False, response_model=List[NotificationOut])
async def get_notifications(
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0),
    unread_only: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Notification).where(Notification.user_id == user.id)

    if unread_only:
        query = query.where(Notification.is_read == False)

    query = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/unread/count", response_model=NotificationCountOut)
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(func.count(Notification.id)).where(
            and_(Notification.user_id == user.id, Notification.is_read == False)
        )
    )
    count = result.scalar() or 0
    return {"count": count}


@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            and_(Notification.id == notification_id, Notification.user_id == user.id)
        )
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    notification.read_at = _kst_now()
    await db.commit()

    return {"status": "ok"}


@router.post("/read-all")
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(and_(Notification.user_id == user.id, Notification.is_read == False))
        .values(is_read=True, read_at=_kst_now())
    )
    await db.commit()

    return {"status": "ok"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            and_(Notification.id == notification_id, Notification.user_id == user.id)
        )
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    await db.delete(notification)
    await db.commit()

    return {"status": "ok"}


@router.get("/stream")
async def notification_stream(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    from jose import jwt, JWTError
    from app.core.config import settings

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token")

    queue: asyncio.Queue = asyncio.Queue()

    if user_id not in notification_subscribers:
        notification_subscribers[user_id] = []
    notification_subscribers[user_id].append(queue)

    async def event_generator():
        try:
            while True:
                try:
                    notification = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"event: notification\ndata: {json.dumps(notification)}\n\n"
                except asyncio.TimeoutError:
                    yield f": heartbeat\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            if user_id in notification_subscribers:
                notification_subscribers[user_id].remove(queue)
                if not notification_subscribers[user_id]:
                    del notification_subscribers[user_id]

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def send_notification(
    db: AsyncSession,
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    related_type: Optional[str] = None,
    related_id: Optional[int] = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        link=link,
        related_type=related_type,
        related_id=related_id,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)

    if user_id in notification_subscribers:
        notification_data = {
            "id": notification.id,
            "notification_type": notification_type,
            "title": title,
            "message": message,
            "link": link,
            "created_at": notification.created_at.isoformat(),
        }
        for queue in notification_subscribers[user_id]:
            await queue.put(notification_data)

    return notification


async def send_bulk_notification(
    db: AsyncSession,
    user_ids: List[int],
    notification_type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    related_type: Optional[str] = None,
    related_id: Optional[int] = None,
) -> List[Notification]:
    notifications = []
    for user_id in user_ids:
        notification = await send_notification(
            db=db,
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
            related_type=related_type,
            related_id=related_id,
        )
        notifications.append(notification)
    return notifications
