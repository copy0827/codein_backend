from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

from app.schemas.user import UserSummary


class PostCreate(BaseModel):
    title: str
    content: Optional[str] = None
    template_id: Optional[int] = None
    # Phase 1: Notice fields
    notice_type: Optional[str] = None  # "normal", "important", "urgent"
    target_audience: Optional[str] = (
        None  # "all", "members", "admins", "specific_ranks"
    )
    target_ranks: Optional[List[str]] = None  # List of ranks for specific_ranks
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    template_id: Optional[int] = None
    is_pinned: Optional[bool] = None
    is_hidden: Optional[bool] = None
    notice_type: Optional[str] = None
    target_audience: Optional[str] = None
    target_ranks: Optional[List[str]] = None
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class NoticeTemplateCreate(BaseModel):
    name: str
    content: str
    description: Optional[str] = None
    is_active: bool = True


class NoticeTemplateUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class NoticeTemplateOut(BaseModel):
    id: int
    name: str
    content: str
    description: Optional[str] = None
    is_active: bool
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PostAttachmentOut(BaseModel):
    id: int
    post_id: int
    uploader_id: int
    original_filename: str
    file_url: str
    file_size: int
    content_type: Optional[str] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


class PostOut(BaseModel):
    id: int
    title: str
    content: str
    board_id: int
    author_id: int
    template_id: Optional[int] = None
    view_count: int
    is_pinned: bool
    is_hidden: bool = False
    is_blinded: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Phase 1: Notice fields
    notice_type: Optional[str] = None
    target_audience: Optional[str] = None
    target_ranks: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    attachments: List[PostAttachmentOut] = []
    author: Optional[UserSummary] = None
    # Computed fields (populated by API)
    is_read: bool = False
    read_count: int = 0

    class Config:
        from_attributes = True


class PostReadLogOut(BaseModel):
    user_id: int
    user_name: str
    read_at: datetime


class PostReadStatusResponse(BaseModel):
    post_id: int
    total_readers: int
    read_logs: List[PostReadLogOut]


class NoticeListResponse(BaseModel):
    total: int
    notices: List[PostOut]


class BoardCreate(BaseModel):
    name: str
    board_type: Optional[str] = "general"
    is_public: bool = True
    order: int = 0


class BoardUpdate(BaseModel):
    name: Optional[str] = None
    board_type: Optional[str] = None
    is_public: Optional[bool] = None
    order: Optional[int] = None


class BoardOut(BaseModel):
    id: int
    name: str
    board_type: Optional[str] = None
    is_public: bool
    order: int

    class Config:
        from_attributes = True
