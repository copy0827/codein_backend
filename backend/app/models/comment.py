"""
Comment model - Supports nested comments (replies) for posts.
"""

from sqlalchemy import String, Integer, Text, ForeignKey, Boolean, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional, List
from app.models.base import Base

def _kst_now():
    return datetime.now(ZoneInfo("Asia/Seoul"))


class Comment(Base):
    """
    Comment on a post. Supports one level of nesting (replies).

    Fields:
    - post_id: The post this comment belongs to
    - author_id: The user who wrote the comment
    - parent_id: If this is a reply, the parent comment ID (NULL for top-level)
    - content: The comment text
    - is_blinded: Hidden due to report/moderation
    - is_deleted: Soft delete (shows as "deleted comment" in UI)
    """

    __tablename__ = "comments"

    __table_args__ = (
        Index("ix_comments_post_id", "post_id"),
        Index("ix_comments_author_id", "author_id"),
        Index("ix_comments_parent_id", "parent_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    post_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True
    )

    content: Mapped[str] = mapped_column(Text, nullable=False)

    is_blinded: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_kst_now, nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=_kst_now
    )

    # Relationships
    post = relationship("Post", backref="comments")
    author = relationship("User")
    parent = relationship("Comment", remote_side=[id], backref="replies")
