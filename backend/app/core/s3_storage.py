import boto3
import uuid
import logging
from botocore.exceptions import ClientError
from botocore.config import Config
from pathlib import Path
from typing import Optional, Dict, Any, BinaryIO
from fastapi import UploadFile, HTTPException, status
from io import BytesIO

from app.core.config import settings

logger = logging.getLogger(__name__)

class S3Storage:
    def __init__(self):
        # boto3 client 설정
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            config=Config(signature_version="s3v4")
        )
        self.bucket = settings.S3_BUCKET
        self._ensure_bucket()

    def _ensure_bucket(self):
        """버킷이 존재하지 않으면 생성"""
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code == "404":
                logger.info(f"Bucket {self.bucket} does not exist. Creating it.")
                try:
                    self.client.create_bucket(Bucket=self.bucket)
                    # 공개 읽기 권한을 위한 폴리시 구성을 원한다면 여기에 추가할 수 있습니다.
                except ClientError as create_err:
                    logger.error(f"Failed to create bucket: {create_err}")
            else:
                logger.error(f"Unexpected error when checking bucket: {e}")

    def generate_filename(self, original_filename: Optional[str], prefix: str = "") -> str:
        """MinIO(S3)에 저장될 고유한 Key(파일경로) 생성"""
        ext = Path(original_filename).suffix.lower() if original_filename else ".jpg"
        unique_id = uuid.uuid4().hex[:12]
        
        # prefix를 디렉토리 계층처럼 사용 
        if prefix:
            return f"{prefix}/{unique_id}{ext}"
        return f"{unique_id}{ext}"

    def upload_file(
        self, 
        file_obj: BinaryIO, 
        s3_key: str, 
        content_type: str = "application/octet-stream"
    ) -> bool:
        """파일 객체를 S3에 업로드"""
        try:
            # 포인터 초기화
            file_obj.seek(0)
            self.client.upload_fileobj(
                file_obj,
                self.bucket,
                s3_key,
                ExtraArgs={"ContentType": content_type}
            )
            return True
        except ClientError as e:
            logger.error(f"S3 Upload failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload file to object storage."
            )

    def delete_file(self, s3_key: str) -> bool:
        """S3에서 파일 삭제"""
        try:
            self.client.delete_object(Bucket=self.bucket, Key=s3_key)
            return True
        except ClientError as e:
            logger.error(f"S3 Delete failed: {e}")
            return False

    def get_presigned_url(self, s3_key: str, expires_in: int = 3600) -> str:
        """클라이언트가 직접 다운로드하거나 브라우저에 표시할 수 있는 임시 URL 발급"""
        try:
            url = self.client.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": self.bucket, "Key": s3_key},
                ExpiresIn=expires_in,
            )
            return url
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            return ""

# 싱글톤 인스턴스
s3_client = S3Storage() if settings.STORAGE_MODE == "s3" else None
