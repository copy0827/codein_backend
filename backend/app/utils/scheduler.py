import asyncio
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_sessionmaker
from app.models.event import Event, Attendance
from app.models.user import User
from app.utils.email import send_event_reminder


async def send_event_reminders():
    async with async_sessionmaker() as db:
        now = datetime.utcnow()
        reminder_time = now + timedelta(hours=24)

        result = await db.execute(
            select(Event).where(
                and_(
                    Event.start_time >= now,
                    Event.start_time <= reminder_time,
                )
            )
        )
        upcoming_events = result.scalars().all()

        for event in upcoming_events:
            attendances_result = await db.execute(
                select(Attendance, User)
                .join(User, Attendance.user_id == User.id)
                .where(
                    and_(
                        Attendance.event_id == event.id,
                        Attendance.status == "attending",
                    )
                )
            )
            attendances = attendances_result.all()

            for attendance, user in attendances:
                if user.email:
                    send_event_reminder(
                        user_email=user.email,
                        user_name=user.name,
                        event_title=event.title,
                        event_start=event.start_time,
                        event_location=event.location,
                        event_online_link=event.online_link,
                    )
                    await asyncio.sleep(0.1)


async def scheduler_loop():
    while True:
        await send_event_reminders()
        await asyncio.sleep(3600)
