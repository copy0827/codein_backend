from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class NotificationCreate(BaseModel):
    user_id: int
    notification_type: str
    title: str
    message: str
    link: Optional[str] = None
    related_type: Optional[str] = None
    related_id: Optional[int] = None


class NotificationOut(BaseModel):
    id: int
    user_id: int
    notification_type: str
    title: str
    message: str
    link: Optional[str]
    related_type: Optional[str]
    related_id: Optional[int]
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationCountOut(BaseModel):
    count: int


class NotificationListOut(BaseModel):
    notifications: List[NotificationOut]
    total: int
    unread_count: int
