"""
Pydantic schemas for Comment API.
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class CommentCreate(BaseModel):
    """Schema for creating a new comment."""

    content: str = Field(..., min_length=1, max_length=5000)
    parent_id: Optional[int] = None  # For replies


class CommentUpdate(BaseModel):
    """Schema for updating a comment."""

    content: str = Field(..., min_length=1, max_length=5000)


class CommentAuthor(BaseModel):
    """Minimal author info for comment display."""

    id: int
    name: str
    profile_image: Optional[str] = None
    rank: str

    class Config:
        from_attributes = True


class CommentOut(BaseModel):
    """Schema for comment response."""

    id: int
    post_id: int
    author_id: int
    parent_id: Optional[int] = None
    content: str
    is_blinded: bool
    is_deleted: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Populated in API
    author: Optional[CommentAuthor] = None
    replies: Optional[List["CommentOut"]] = None
    reply_count: int = 0

    class Config:
        from_attributes = True


class CommentWithReplies(CommentOut):
    """Comment with nested replies loaded."""

    replies: List[CommentOut] = []


class CommentListResponse(BaseModel):
    """Response for listing comments with pagination info."""

    comments: List[CommentOut]
    total: int
    has_more: bool
