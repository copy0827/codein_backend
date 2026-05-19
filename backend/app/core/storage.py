"""
File storage and image processing utilities.
Supports local storage and can be extended for S3.
"""

import os
import uuid
import shutil
from pathlib import Path
from typing import Optional, Tuple, List
from io import BytesIO
from fastapi import UploadFile, HTTPException, status
from PIL import Image
import qrcode
import qrcode.image.svg
from qrcode.constants import ERROR_CORRECT_L

from app.core.config import settings
from app.core.s3_storage import s3_client

# Constants
MEDIA_ROOT = Path("media")
PROFILE_IMAGES_DIR = MEDIA_ROOT / "profiles"
GALLERY_IMAGES_DIR = MEDIA_ROOT / "gallery"
THUMBNAILS_DIR = MEDIA_ROOT / "thumbnails"
QR_CODES_DIR = MEDIA_ROOT / "qr_codes"
ATTACHMENTS_DIR = MEDIA_ROOT / "attachments"

# Image constraints
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024

# Thumbnail settings
THUMBNAIL_SIZE = (300, 300)
PROFILE_IMAGE_SIZE = (400, 400)


def ensure_directories():
    """Create necessary media directories if they don't exist."""
    for directory in [
        MEDIA_ROOT,
        PROFILE_IMAGES_DIR,
        GALLERY_IMAGES_DIR,
        THUMBNAILS_DIR,
        QR_CODES_DIR,
        ATTACHMENTS_DIR,
    ]:
        directory.mkdir(parents=True, exist_ok=True)


ensure_directories()


def validate_image_file(
    file: UploadFile,
    max_size: int = MAX_IMAGE_SIZE,
    allowed_types: set = ALLOWED_IMAGE_TYPES,
) -> None:
    """
    Validate uploaded image file.

    Args:
        file: The uploaded file
        max_size: Maximum file size in bytes
        allowed_types: Set of allowed MIME types

    Raises:
        HTTPException: If validation fails
    """
    # Check content type
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}",
        )

    # Check file extension
    if file.filename:
        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file extension. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
            )


async def read_file_content(file: UploadFile, max_size: int = MAX_IMAGE_SIZE) -> bytes:
    """
    Read file content with size validation.

    Args:
        file: The uploaded file
        max_size: Maximum file size in bytes

    Returns:
        File content as bytes

    Raises:
        HTTPException: If file is too large
    """
    content = await file.read()

    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {max_size // (1024 * 1024)}MB",
        )

    return content


def get_image_dimensions(content: bytes) -> Tuple[int, int]:
    """
    Get image dimensions from content.

    Args:
        content: Image file content as bytes

    Returns:
        Tuple of (width, height)
    """
    try:
        with Image.open(BytesIO(content)) as img:
            return img.size
    except Exception:
        return (0, 0)


def resize_image(
    content: bytes,
    max_size: Tuple[int, int],
    quality: int = 85,
    format: str = "JPEG",
) -> bytes:
    """
    Resize image while maintaining aspect ratio.

    Args:
        content: Original image content
        max_size: Maximum (width, height)
        quality: JPEG quality (1-100)
        format: Output format (JPEG, PNG, WEBP)

    Returns:
        Resized image content
    """
    try:
        with Image.open(BytesIO(content)) as img:
            # Convert RGBA to RGB for JPEG
            if format == "JPEG" and img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            # Resize maintaining aspect ratio
            img.thumbnail(max_size, Image.Resampling.LANCZOS)

            output = BytesIO()
            img.save(output, format=format, quality=quality, optimize=True)
            return output.getvalue()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process image: {str(e)}",
        )


def create_thumbnail(content: bytes, size: Tuple[int, int] = THUMBNAIL_SIZE) -> bytes:
    """
    Create a square thumbnail from image content.

    Args:
        content: Original image content
        size: Thumbnail size (width, height)

    Returns:
        Thumbnail image content
    """
    try:
        with Image.open(BytesIO(content)) as img:
            # Convert RGBA to RGB
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            # Calculate crop box for square thumbnail (center crop)
            width, height = img.size
            min_dim = min(width, height)
            left = (width - min_dim) // 2
            top = (height - min_dim) // 2
            right = left + min_dim
            bottom = top + min_dim

            # Crop to square and resize
            img = img.crop((left, top, right, bottom))
            img = img.resize(size, Image.Resampling.LANCZOS)

            output = BytesIO()
            img.save(output, format="JPEG", quality=80, optimize=True)
            return output.getvalue()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create thumbnail: {str(e)}",
        )


def generate_filename(original_filename: Optional[str], prefix: str = "") -> str:
    """
    Generate a unique filename.

    Args:
        original_filename: Original file name
        prefix: Optional prefix for the filename

    Returns:
        Unique filename with original extension
    """
    ext = Path(original_filename).suffix.lower() if original_filename else ".jpg"
    unique_id = uuid.uuid4().hex[:12]

    if prefix:
        return f"{prefix}_{unique_id}{ext}"
    return f"{unique_id}{ext}"


async def save_profile_image(
    file: UploadFile,
    user_id: int,
) -> Tuple[str, str]:
    """
    Save a profile image with resizing.

    Args:
        file: Uploaded image file
        user_id: User ID for filename prefix

    Returns:
        Tuple of (relative_path, full_url)
    """
    validate_image_file(file)
    content = await read_file_content(file)

    # Resize for profile
    resized = resize_image(content, PROFILE_IMAGE_SIZE)

    # Generate filename and save
    filename = generate_filename(file.filename, f"user_{user_id}")
    
    if settings.STORAGE_MODE == "s3" and s3_client:
        s3_key = f"profiles/{filename}"
        s3_client.upload_file(
            file_obj=BytesIO(resized),
            s3_key=s3_key,
            content_type=file.content_type
        )
        return s3_key, f"/media/{s3_key}"

    filepath = PROFILE_IMAGES_DIR / filename
    with open(filepath, "wb") as f:
        f.write(resized)

    relative_path = str(filepath.relative_to(MEDIA_ROOT))
    return relative_path, f"/media/{relative_path}"


async def save_gallery_photo(
    file: UploadFile,
    album_id: int,
    uploader_id: int,
) -> dict:
    """
    Save a gallery photo with thumbnail generation.

    Args:
        file: Uploaded image file
        album_id: Album ID
        uploader_id: User ID who uploaded

    Returns:
        Dict with file info including paths and dimensions
    """
    validate_image_file(file)
    content = await read_file_content(file)

    # Get original dimensions
    width, height = get_image_dimensions(content)

    # Generate filenames
    base_name = generate_filename(file.filename, f"album_{album_id}")
    thumb_name = f"thumb_{base_name.rsplit('.', 1)[0]}.jpg"

    # Save original (with some optimization)
    optimized = resize_image(content, (2048, 2048), quality=90)
    
    # Create and save thumbnail
    thumbnail = create_thumbnail(content)

    if settings.STORAGE_MODE == "s3" and s3_client:
        s3_key_photo = f"gallery/{base_name}"
        s3_key_thumb = f"thumbnails/{thumb_name}"
        
        s3_client.upload_file(BytesIO(optimized), s3_key_photo, file.content_type)
        s3_client.upload_file(BytesIO(thumbnail), s3_key_thumb, file.content_type)
        
        return {
            "filename": base_name,
            "url": f"/media/{s3_key_photo}",
            "thumbnail_url": f"/media/{s3_key_thumb}",
            "file_size": len(optimized),
            "width": width,
            "height": height,
        }

    photo_path = GALLERY_IMAGES_DIR / base_name
    with open(photo_path, "wb") as f:
        f.write(optimized)

    thumb_path = THUMBNAILS_DIR / thumb_name
    with open(thumb_path, "wb") as f:
        f.write(thumbnail)

    return {
        "filename": base_name,
        "url": f"/media/gallery/{base_name}",
        "thumbnail_url": f"/media/thumbnails/{thumb_name}",
        "file_size": len(optimized),
        "width": width,
        "height": height,
    }


async def save_gallery_photos_batch(
    files: List[UploadFile],
    album_id: int,
    uploader_id: int,
) -> List[dict]:
    """
    Save multiple gallery photos.

    Args:
        files: List of uploaded image files
        album_id: Album ID
        uploader_id: User ID who uploaded

    Returns:
        List of file info dicts
    """
    results = []
    for file in files:
        result = await save_gallery_photo(file, album_id, uploader_id)
        results.append(result)
    return results


async def save_notice_attachment(
    file: UploadFile,
    post_id: int,
    uploader_id: int,
) -> dict:
    content = await read_file_content(file, max_size=MAX_ATTACHMENT_SIZE)
    prefix = f"post_{post_id}_user_{uploader_id}"
    filename = generate_filename(file.filename, prefix)
    
    if settings.STORAGE_MODE == "s3" and s3_client:
        s3_key = f"attachments/{filename}"
        s3_client.upload_file(BytesIO(content), s3_key, file.content_type)
        return {
            "original_filename": file.filename or filename,
            "file_path": s3_key,
            "file_url": f"/media/{s3_key}",
            "file_size": len(content),
            "content_type": file.content_type,
        }

    filepath = ATTACHMENTS_DIR / filename
    with open(filepath, "wb") as handler:
        handler.write(content)

    relative_path = str(filepath.relative_to(MEDIA_ROOT))
    return {
        "original_filename": file.filename or filename,
        "file_path": relative_path,
        "file_url": f"/media/{relative_path}",
        "file_size": len(content),
        "content_type": file.content_type,
    }


def delete_file(filepath: str) -> bool:
    """
    Delete a file from storage.

    Args:
        filepath: Path relative to media root or full path

    Returns:
        True if deleted, False if not found
    """
    # Handle both relative and absolute paths
    if filepath.startswith("/media/"):
        filepath = filepath[7:]  # Remove /media/ prefix

    full_path = MEDIA_ROOT / filepath

    if full_path.exists():
        full_path.unlink()
        return True
    return False


def delete_profile_image(filename: str) -> bool:
    """Delete a profile image."""
    return delete_file(f"profiles/{filename}")


def delete_gallery_photo(filename: str, thumb_filename: Optional[str] = None) -> bool:
    """
    Delete a gallery photo and its thumbnail.

    Args:
        filename: Photo filename
        thumb_filename: Thumbnail filename (auto-generated if not provided)
    """
    # Delete thumbnail
    if thumb_filename is None:
        name, ext = os.path.splitext(filename)
        thumb_filename = f"{name}_thumb{ext}"
        
    if settings.STORAGE_MODE == "s3" and s3_client:
        # DB에 저장된 URL을 위해 폴더 경로가 포함될 수도 있고 아닐 수도 있으므로 방어 로직 적용
        base_file = f"gallery/{filename}" if not filename.startswith("gallery/") else filename
        thumb_file = f"thumbnails/{thumb_filename}" if not thumb_filename.startswith("thumbnails/") else thumb_filename
        s3_client.delete_file(base_file)
        s3_client.delete_file(thumb_file)
        return True

    # 로컬 fallback 로직
    # Delete main photo
    delete_file(f"gallery/{filename}")
    delete_file(f"thumbnails/{thumb_filename}")
    return True


def generate_qr_code(data: str, event_id: int) -> str:
    """
    Generate QR code image for event check-in.

    Args:
        data: QR code data (format: "event_id:check_in_code")
        event_id: Event ID for filename

    Returns:
        Relative path to QR code image (/media/qr_codes/event_{id}.png)
    """
    # Create QR code instance
    qr = qrcode.QRCode(
        version=1,
        error_correction=ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )

    # Add data
    qr.add_data(data)
    qr.make(fit=True)

    # Create image
    img = qr.make_image(fill_color="black", back_color="white")

    # Save to file
    filename = f"event_{event_id}.png"
    filepath = QR_CODES_DIR / filename

    # Save image
    with open(filepath, "wb") as file:
        img.save(file)

    # Return URL path
    return f"/media/qr_codes/{filename}"


def delete_qr_code(event_id: int) -> bool:
    """
    Delete QR code image for event.

    Args:
        event_id: Event ID

    Returns:
        True if deleted, False if not found
    """
    filename = f"event_{event_id}.png"
    return delete_file(f"qr_codes/{filename}")
