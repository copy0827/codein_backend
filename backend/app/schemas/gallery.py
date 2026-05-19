from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class AlbumCreate(BaseModel):
    name: str
    description: Optional[str] = None
    visibility: str = "public"
    event_name: Optional[str] = None
    event_date: Optional[datetime] = None
    event_location: Optional[str] = None
    participant_count: Optional[int] = None
    tagged_people: Optional[str] = None
    tagging_consent: bool = False


class AlbumUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[str] = None
    cover_photo_id: Optional[int] = None
    event_name: Optional[str] = None
    event_date: Optional[datetime] = None
    event_location: Optional[str] = None
    participant_count: Optional[int] = None
    tagged_people: Optional[str] = None
    tagging_consent: Optional[bool] = None


class PhotoOut(BaseModel):
    id: int
    album_id: int
    url: str
    thumbnail_url: str
    filename: Optional[str] = None
    file_size: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    uploader_id: Optional[int] = None
    display_order: int = 0
    caption: Optional[str] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


class PhotoUploadResponse(BaseModel):
    id: int
    url: str
    thumbnail_url: str
    filename: str
    file_size: int
    width: Optional[int] = None
    height: Optional[int] = None


class ShareLinkCreate(BaseModel):
    expires_in_days: Optional[int] = None


class ShareLinkOut(BaseModel):
    token: str
    share_url: str
    expires_at: Optional[datetime] = None


class PhotosUploadResponse(BaseModel):
    uploaded_count: int
    photos: List[PhotoUploadResponse]


class AlbumOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    visibility: str
    owner_id: int
    cover_photo_id: Optional[int] = None
    cover_photo: Optional[PhotoOut] = None
    photo_count: int = 0
    event_name: Optional[str] = None
    event_date: Optional[datetime] = None
    event_location: Optional[str] = None
    participant_count: Optional[int] = None
    tagged_people: Optional[str] = None
    tagging_consent: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlbumWithPhotos(AlbumOut):
    photos: List[PhotoOut] = []


class AlbumListResponse(BaseModel):
    total: int
    albums: List[AlbumOut]
