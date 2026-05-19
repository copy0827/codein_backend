from sqlalchemy import (
    String,
    Integer,
    Text,
    ForeignKey,
    Boolean,
    DateTime,
    Index,
    event,
    DDL,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import TSVECTOR, ARRAY
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional, List
from app.models.base import Base

def _kst_now():
    return datetime.now(ZoneInfo("Asia/Seoul"))


class Board(Base):
    __tablename__ = "boards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True)
    board_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    order: Mapped[int] = mapped_column(Integer, default=0)


class NoticeTemplate(Base):
    __tablename__ = "notice_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    content: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_kst_now)
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=_kst_now
    )

    creator = relationship("User")


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text)

    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id"))
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    template_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("notice_templates.id"), nullable=True
    )

    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    is_blinded: Mapped[bool] = mapped_column(
        Boolean, default=False
    )  # For report system
    view_count: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_kst_now)
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=_kst_now
    )

    # Phase 1: Notice enhancements
    # Notice type: None (regular post), "normal", "important", "urgent"
    notice_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Target audience: "all", "members", "admins", "specific_ranks"
    target_audience: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Comma-separated list of ranks if target_audience is "specific_ranks"
    target_ranks: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Scheduled publishing time (null = publish immediately)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Notice expiration time
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Full-text search vector (PostgreSQL only)
    # Combines title (weight A) and content (weight B) for ranked search
    search_vector: Mapped[Optional[str]] = mapped_column(
        TSVECTOR,
        nullable=True,
    )

    board = relationship("Board")
    author = relationship("User")
    template = relationship("NoticeTemplate")
    attachments = relationship(
        "PostAttachment", back_populates="post", cascade="all, delete-orphan"
    )
    read_logs = relationship(
        "PostReadLog", back_populates="post", cascade="all, delete-orphan"
    )

    __table_args__ = (
        # GIN index for fast full-text search
        Index("ix_posts_search_vector", "search_vector", postgresql_using="gin"),
    )


class PostAttachment(Base):
    __tablename__ = "post_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"))
    uploader_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    original_filename: Mapped[str] = mapped_column(String)
    file_path: Mapped[str] = mapped_column(String)
    file_url: Mapped[str] = mapped_column(String)
    file_size: Mapped[int] = mapped_column(Integer)
    content_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_kst_now)

    post = relationship("Post", back_populates="attachments")
    uploader = relationship("User")


class PostReadLog(Base):
    """Track which users have read which posts (for notice read tracking)."""

    __tablename__ = "post_read_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"))
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_kst_now)

    post = relationship("Post", back_populates="read_logs")
    user = relationship("User")

    __table_args__ = (
        # Unique constraint to prevent duplicate read logs
        Index("ix_post_read_logs_user_post", "user_id", "post_id", unique=True),
    )


# Trigger to auto-update search_vector on INSERT/UPDATE
# Uses 'simple' config for Korean text (no stemming, exact match)
# Weight A for title (higher relevance), B for content
# NOTE: asyncpg cannot execute multiple statements in a single prepared statement,
# so we split the DDL into separate statements

_create_search_function = DDL("""
CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
""")

_drop_search_trigger = DDL(
    "DROP TRIGGER IF EXISTS posts_search_vector_trigger ON posts"
)

_create_search_trigger = DDL("""
CREATE TRIGGER posts_search_vector_trigger
    BEFORE INSERT OR UPDATE OF title, content ON posts
    FOR EACH ROW
    EXECUTE FUNCTION posts_search_vector_update()
""")

# Register the triggers to run after table creation (in order)
event.listen(
    Post.__table__,
    "after_create",
    _create_search_function.execute_if(dialect="postgresql"),
)
event.listen(
    Post.__table__,
    "after_create",
    _drop_search_trigger.execute_if(dialect="postgresql"),
)
event.listen(
    Post.__table__,
    "after_create",
    _create_search_trigger.execute_if(dialect="postgresql"),
)
