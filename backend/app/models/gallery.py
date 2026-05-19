from sqlalchemy import String, Integer, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional
from app.models.base import Base

def _kst_now():
    return datetime.now(ZoneInfo("Asia/Seoul"))


class Album(Base):
    __tablename__ = "albums"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    visibility: Mapped[str] = mapped_column(String, default="public")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    cover_photo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("photos.id"), nullable=True
    )
    photo_count: Mapped[int] = mapped_column(Integer, default=0)
    event_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    event_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    event_location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    participant_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tagged_people: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tagging_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_kst_now)
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=_kst_now
    )

    owner = relationship("User")
    photos = relationship(
        "Photo",
        back_populates="album",
        foreign_keys="[Photo.album_id]",
        cascade="all, delete-orphan",
    )
    cover_photo = relationship("Photo", foreign_keys=[cover_photo_id], viewonly=True)


class AlbumShareLink(Base):
    __tablename__ = "album_share_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    album_id: Mapped[int] = mapped_column(ForeignKey("albums.id"))
    token: Mapped[str] = mapped_column(String, unique=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_kst_now)

    album = relationship("Album")
    creator = relationship("User")


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    album_id: Mapped[int] = mapped_column(ForeignKey("albums.id"))
    url: Mapped[str] = mapped_column(String)
    thumbnail_url: Mapped[str] = mapped_column(String)

    # New fields for Phase 1
    filename: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # bytes
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    uploader_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_kst_now)

    album = relationship("Album", back_populates="photos", foreign_keys=[album_id])
    uploader = relationship("User")
