from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from app.core.config import settings
import botocore.exceptions

router = APIRouter()

@router.get("/{file_path:path}")
async def get_media_file(file_path: str):
    """
    미디어 파일 서빙 라우터
    S3 모드일 경우 내부에서 MinIO(S3) 객체를 직접 읽어와 스트리밍 응답합니다.
    (Presigned URL은 도커 내부 hostname 이슈로 로컬 브라우저에서 해석하지 못할 수 있으므로, 프록시 역할을 수행합니다.)
    """
    if settings.STORAGE_MODE == "s3":
        from app.core.s3_storage import s3_client
        if not s3_client:
            raise HTTPException(status_code=500, detail="S3 client not initialized")
        
        s3_key = file_path.lstrip("/")
        
        try:
            response = s3_client.client.get_object(Bucket=s3_client.bucket, Key=s3_key)
            return StreamingResponse(
                response['Body'],
                media_type=response.get('ContentType', 'application/octet-stream')
            )
        except botocore.exceptions.ClientError as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found in S3")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local fallback not handled here")
