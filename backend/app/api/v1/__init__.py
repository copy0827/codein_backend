from fastapi import APIRouter
from app.api.v1 import (
    auth,
    boards,
    gallery,
    events,
    codetest,
    admin,
    search,
    notifications,
    reports,
    profile,
    activity,
    comments,
    calendar,
    dashboard,
)

router = APIRouter()
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(boards.router, prefix="/boards", tags=["boards"])
router.include_router(gallery.router, prefix="/gallery", tags=["gallery"])
router.include_router(events.router, prefix="/events", tags=["events"])
router.include_router(codetest.router, prefix="/codetest", tags=["codetest"])
router.include_router(admin.router, prefix="/admin", tags=["admin"])
router.include_router(search.router, prefix="/search", tags=["search"])
router.include_router(
    notifications.router, prefix="/notifications", tags=["notifications"]
)
router.include_router(reports.router, prefix="/reports", tags=["reports"])
router.include_router(profile.router, prefix="/profile", tags=["profile"])
router.include_router(activity.router, prefix="/activity", tags=["activity"])
router.include_router(comments.router, tags=["comments"])
router.include_router(calendar.router, prefix="/calendar", tags=["calendar"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
