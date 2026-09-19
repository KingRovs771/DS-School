"""
MinIO client initialization & bucket management
"""
import asyncio
from io import BytesIO
from typing import Optional

import structlog
from minio import Minio

from app.core.config import settings

logger = structlog.get_logger(__name__)

_minio_client: Optional[Minio] = None


def get_minio_client() -> Minio:
    """Return a singleton MinIO client."""
    global _minio_client
    if _minio_client is None:
        _minio_client = Minio(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ROOT_USER,
            secret_key=settings.MINIO_ROOT_PASSWORD,
            secure=settings.MINIO_USE_SSL,
        )
    return _minio_client


async def init_minio_buckets() -> None:
    """Create required buckets if they don't exist."""
    client = get_minio_client()
    buckets = [
        settings.MINIO_BUCKET_DOCUMENTS,
        settings.MINIO_BUCKET_AVATARS,
        settings.MINIO_BUCKET_BACKUP,
    ]

    try:
        for bucket in buckets:
            loop = asyncio.get_event_loop()
            exists = await loop.run_in_executor(None, client.bucket_exists, bucket)
            if not exists:
                await loop.run_in_executor(None, client.make_bucket, bucket)
                logger.info("Created MinIO bucket", bucket=bucket)
            else:
                logger.debug("MinIO bucket already exists", bucket=bucket)
    except Exception as exc:
        logger.warning("⚠️  MinIO initialization warning (will retry on demand)", error=str(exc))


async def upload_file(
    bucket: str,
    object_name: str,
    data: bytes,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload file ke MinIO dan return URL-nya."""
    client = get_minio_client()
    stream = BytesIO(data)
    loop = asyncio.get_event_loop()

    await loop.run_in_executor(
        None,
        lambda: client.put_object(
            bucket,
            object_name,
            stream,
            length=len(data),
            content_type=content_type,
        ),
    )
    return f"/{bucket}/{object_name}"


async def get_presigned_url(bucket: str, object_name: str, expires_hours: int = 1) -> str:
    """Generate a presigned URL for temporary access."""
    from datetime import timedelta
    client = get_minio_client()
    loop = asyncio.get_event_loop()
    url = await loop.run_in_executor(
        None,
        lambda: client.presigned_get_object(
            bucket, object_name, expires=timedelta(hours=expires_hours)
        ),
    )
    return url


async def delete_file(bucket: str, object_name: str) -> None:
    """Hapus file dari MinIO."""
    client = get_minio_client()
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, client.remove_object, bucket, object_name)
