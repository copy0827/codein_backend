"""
Gallery API - Album and photo management endpoints.
Supports multi-photo upload with automatic thumbnail generation.
"""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Query
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import secrets


def _kst_now():
    return datetime.now(ZoneInfo("Asia/Seoul"))


from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.core.deps import get_db, get_current_user
from app.core.permissions import has_role
from app.core.storage import save_gallery_photos_batch, delete_gallery_photo
from app.models.gallery import Album, Photo, AlbumShareLink
from app.models.user import User
from app.schemas.gallery import (
    AlbumCreate,
    AlbumUpdate,
    AlbumOut,
    AlbumWithPhotos,
    AlbumListResponse,
    PhotoOut,
    PhotoUploadResponse,
    PhotosUploadResponse,
    ShareLinkCreate,
    ShareLinkOut,
)

router = APIRouter()


# ============ Album Endpoints ============


@router.get("/albums", response_model=AlbumListResponse)
async def list_albums(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    visibility: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all albums.

    - Public albums are visible to everyone
    - Private albums only visible to owner
    """
    query = select(Album)

    if visibility:
        if visibility == "public":
            query = query.where(Album.visibility == "public")
        elif visibility == "members":
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Members-only albums require login",
                )
            query = query.where(Album.visibility == "members")
        elif visibility == "staff":
            if not current_user or not has_role(current_user.role, "staff"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Staff-only albums require staff access",
                )
            query = query.where(Album.visibility == "staff")
        elif visibility == "private":
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Private albums require login",
                )
            query = query.where(
                and_(Album.visibility == "private", Album.owner_id == current_user.id)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid visibility",
            )
    elif current_user:
        allowed = ["public", "members"]
        if has_role(current_user.role, "staff"):
            allowed.append("staff")
        query = query.where(
            or_(
                Album.visibility.in_(allowed),
                and_(Album.visibility == "private", Album.owner_id == current_user.id),
            )
        )
    else:
        query = query.where(Album.visibility == "public")

    # Get total count
    count_query = select(func.count(Album.id)).where(
        query.whereclause if query.whereclause is not None else True
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get albums with pagination
    query = (
        query.order_by(Album.created_at.desc())
        .offset(skip)
        .limit(limit)
        .options(selectinload(Album.cover_photo))
    )
    result = await db.execute(query)
    albums = result.scalars().all()

    return AlbumListResponse(total=total, albums=albums)


@router.post("/albums", response_model=AlbumOut)
async def create_album(
    data: AlbumCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new album."""
    if not has_role(user.role, "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff, admin, or superadmin can create albums",
        )
    if data.visibility == "staff" and not has_role(user.role, "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff-only albums require staff access",
        )
    event_date = data.event_date
    if event_date and event_date.tzinfo:
        event_date = event_date.replace(tzinfo=None)

    album = Album(
        name=data.name,
        description=data.description,
        visibility=data.visibility,
        owner_id=user.id,
        event_name=data.event_name,
        event_date=event_date,
        event_location=data.event_location,
        participant_count=data.participant_count,
        tagged_people=data.tagged_people,
        tagging_consent=data.tagging_consent,
    )
    db.add(album)
    await db.commit()
    await db.refresh(album)
    return album


@router.get("/albums/{album_id}", response_model=AlbumWithPhotos)
async def get_album(
    album_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get album details with photos."""
    result = await db.execute(select(Album).where(Album.id == album_id))
    album = result.scalar_one_or_none()

    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found",
        )

    if album.visibility == "public":
        pass
    elif album.visibility == "members":
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Members-only album",
            )
    elif album.visibility == "staff":
        if not current_user or not has_role(current_user.role, "staff"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Staff-only album",
            )
    elif album.visibility == "private":
        if not current_user or current_user.id != album.owner_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this album",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this album",
        )

    # Get photos
    photos_result = await db.execute(
        select(Photo)
        .where(Photo.album_id == album_id)
        .order_by(Photo.display_order, Photo.uploaded_at)
    )
    photos = photos_result.scalars().all()

    return AlbumWithPhotos(
        id=album.id,
        name=album.name,
        description=album.description,
        visibility=album.visibility,
        owner_id=album.owner_id,
        cover_photo_id=album.cover_photo_id,
        photo_count=album.photo_count,
        event_name=album.event_name,
        event_date=album.event_date,
        event_location=album.event_location,
        participant_count=album.participant_count,
        tagged_people=album.tagged_people,
        tagging_consent=album.tagging_consent,
        created_at=album.created_at,
        updated_at=album.updated_at,
        photos=photos,
    )


@router.put("/albums/{album_id}", response_model=AlbumOut)
async def update_album(
    album_id: int,
    data: AlbumUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update album details. Only owner can update."""
    result = await db.execute(select(Album).where(Album.id == album_id))
    album = result.scalar_one_or_none()

    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found",
        )

    if not has_role(current_user.role, "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff, admin, or superadmin can update albums",
        )

    update_data = data.model_dump(exclude_unset=True)
    if update_data.get("visibility") == "staff" and not has_role(
        current_user.role, "staff"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff-only albums require staff access",
        )
    for field, value in update_data.items():
        setattr(album, field, value)

    await db.commit()
    await db.refresh(album)
    return album


@router.delete("/albums/{album_id}")
async def delete_album(
    album_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete album and all its photos. Only owner can delete."""
    result = await db.execute(select(Album).where(Album.id == album_id))
    album = result.scalar_one_or_none()

    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found",
        )

    if not has_role(current_user.role, "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff, admin, or superadmin can delete albums",
        )

    # Delete all photo files
    photos_result = await db.execute(select(Photo).where(Photo.album_id == album_id))
    photos = photos_result.scalars().all()

    for photo in photos:
        if photo.filename:
            delete_gallery_photo(photo.filename)

    # Delete album (cascade will delete Photo records)
    await db.delete(album)
    await db.commit()

    return {"message": "Album deleted successfully"}


@router.post("/albums/{album_id}/share", response_model=ShareLinkOut)
async def create_share_link(
    album_id: int,
    payload: ShareLinkCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Album).where(Album.id == album_id))
    album = result.scalar_one_or_none()

    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found",
        )

    if album.owner_id != current_user.id and not has_role(current_user.role, "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner or staff can share",
        )

    days = payload.expires_in_days if payload.expires_in_days is not None else 7
    expires_at = _kst_now() + timedelta(days=days)

    share_link = AlbumShareLink(
        album_id=album.id,
        token=secrets.token_urlsafe(16),
        expires_at=expires_at,
        created_by=current_user.id,
    )
    db.add(share_link)
    await db.commit()
    await db.refresh(share_link)

    return ShareLinkOut(
        token=share_link.token,
        share_url=f"/gallery/share/{share_link.token}",
        expires_at=share_link.expires_at,
    )


@router.get("/share/{token}", response_model=AlbumWithPhotos)
async def get_shared_album(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    link_result = await db.execute(
        select(AlbumShareLink).where(AlbumShareLink.token == token)
    )
    share_link = link_result.scalar_one_or_none()

    if not share_link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share link not found",
        )

    if share_link.expires_at and share_link.expires_at < _kst_now():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Share link expired",
        )

    album_result = await db.execute(
        select(Album).where(Album.id == share_link.album_id)
    )
    album = album_result.scalar_one_or_none()

    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found",
        )

    photos_result = await db.execute(
        select(Photo)
        .where(Photo.album_id == album.id)
        .order_by(Photo.display_order, Photo.uploaded_at)
    )
    photos = photos_result.scalars().all()

    return AlbumWithPhotos(
        id=album.id,
        name=album.name,
        description=album.description,
        visibility=album.visibility,
        owner_id=album.owner_id,
        cover_photo_id=album.cover_photo_id,
        photo_count=album.photo_count,
        event_name=album.event_name,
        event_date=album.event_date,
        event_location=album.event_location,
        participant_count=album.participant_count,
        tagged_people=album.tagged_people,
        tagging_consent=album.tagging_consent,
        created_at=album.created_at,
        updated_at=album.updated_at,
        photos=photos,
    )


# ============ Photo Endpoints ============


@router.post("/albums/{album_id}/photos", response_model=PhotosUploadResponse)
async def upload_photos(
    album_id: int,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Upload multiple photos to an album.

    - Maximum 10 files per request
    - Maximum 5MB per file
    - Allowed formats: JPEG, PNG, GIF, WEBP
    - Thumbnails are automatically generated
    """
    # Validate album exists
    result = await db.execute(select(Album).where(Album.id == album_id))
    album = result.scalar_one_or_none()

    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found",
        )

    # Check permission (owner or public album)
    if album.visibility != "public" and album.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to upload to this album",
        )

    # Limit number of files
    if len(files) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 10 files per upload",
        )

    # Get current max display_order
    max_order_result = await db.execute(
        select(func.max(Photo.display_order)).where(Photo.album_id == album_id)
    )
    max_order = max_order_result.scalar() or 0

    # Save files and create photo records
    saved_photos = await save_gallery_photos_batch(files, album_id, user.id)

    photo_responses = []
    for i, file_info in enumerate(saved_photos):
        photo = Photo(
            album_id=album_id,
            url=file_info["url"],
            thumbnail_url=file_info["thumbnail_url"],
            filename=file_info["filename"],
            file_size=file_info["file_size"],
            width=file_info["width"],
            height=file_info["height"],
            uploader_id=user.id,
            display_order=max_order + i + 1,
        )
        db.add(photo)
        await db.flush()

        photo_responses.append(
            PhotoUploadResponse(
                id=photo.id,
                url=photo.url,
                thumbnail_url=photo.thumbnail_url,
                filename=photo.filename,
                file_size=photo.file_size,
                width=photo.width,
                height=photo.height,
            )
        )

    # Update album photo count
    album.photo_count = album.photo_count + len(saved_photos)

    # Set cover photo if this is the first upload
    if album.cover_photo_id is None and photo_responses:
        album.cover_photo_id = photo_responses[0].id

    await db.commit()

    return PhotosUploadResponse(
        uploaded_count=len(photo_responses),
        photos=photo_responses,
    )


@router.get("/albums/{album_id}/photos", response_model=List[PhotoOut])
async def list_album_photos(
    album_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get photos from an album with pagination."""
    # Check album access
    result = await db.execute(select(Album).where(Album.id == album_id))
    album = result.scalar_one_or_none()

    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found",
        )

    if album.visibility != "public":
        if not current_user or current_user.id != album.owner_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this album",
            )

    # Get photos
    query = (
        select(Photo)
        .where(Photo.album_id == album_id)
        .order_by(Photo.display_order, Photo.uploaded_at)
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    photos = result.scalars().all()

    return photos


@router.get("/photos/{photo_id}", response_model=PhotoOut)
async def get_photo(
    photo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single photo by ID."""
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found",
        )

    # Check album access
    album_result = await db.execute(select(Album).where(Album.id == photo.album_id))
    album = album_result.scalar_one_or_none()

    if album and album.visibility != "public":
        if not current_user or current_user.id != album.owner_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this photo",
            )

    return photo


@router.delete("/photos/{photo_id}")
async def delete_photo(
    photo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a photo. Only uploader or album owner can delete."""
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found",
        )

    # Check permission
    album_result = await db.execute(select(Album).where(Album.id == photo.album_id))
    album = album_result.scalar_one_or_none()

    is_uploader = photo.uploader_id == current_user.id
    is_album_owner = album and album.owner_id == current_user.id
    is_staff = has_role(current_user.role, "staff")

    if not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff, admin, or superadmin can delete this photo",
        )
    if not (is_uploader or is_album_owner or is_staff):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only uploader, album owner, or staff can delete this photo",
        )

    # Delete file from storage
    if photo.filename:
        delete_gallery_photo(photo.filename)

    # Update album photo count
    if album:
        album.photo_count = max(0, album.photo_count - 1)

        # Update cover photo if deleted
        if album.cover_photo_id == photo_id:
            # Find another photo to be the cover
            next_photo = await db.execute(
                select(Photo)
                .where(Photo.album_id == album.id, Photo.id != photo_id)
                .order_by(Photo.display_order)
                .limit(1)
            )
            next_cover = next_photo.scalar_one_or_none()
            album.cover_photo_id = next_cover.id if next_cover else None

    # Delete photo record
    await db.delete(photo)
    await db.commit()

    return {"message": "Photo deleted successfully"}




