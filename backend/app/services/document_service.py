"""
Document Service — upload, download, search, versioning
"""
import mimetypes
import uuid
from datetime import datetime

import structlog
from fastapi import HTTPException, UploadFile
from sqlalchemy import or_, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.minio_client import upload_file, get_presigned_url, delete_file
from app.core.neural_keygen import get_neural_keygen
from app.models.document import Document
from app.models.user import User
from app.schemas.document import (
    DocumentCreate, DocumentUpdate, DocumentSearchRequest,
    DocumentApprovalRequest,
)

logger = structlog.get_logger(__name__)


class DocumentService:

    @staticmethod
    async def upload_document(
        db: AsyncSession,
        file: UploadFile,
        payload: DocumentCreate,
        owner: User,
    ) -> Document:
        """Upload dokumen baru ke MinIO dan simpan metadata ke DB."""
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="File tidak boleh kosong")

        # Generate NeuralKeyGen document key
        keygen = get_neural_keygen()
        document_key = await keygen.generate_key_async(content)

        # Build MinIO object path
        ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
        object_name = f"{owner.id}/{datetime.utcnow().strftime('%Y/%m')}/{uuid.uuid4()}.{ext}"

        # Detect MIME type
        mime_type = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"

        # Upload to MinIO
        await upload_file(
            bucket=settings.MINIO_BUCKET_DOCUMENTS,
            object_name=object_name,
            data=content,
            content_type=mime_type,
        )

        doc = Document(
            title=payload.title,
            description=payload.description,
            filename=f"{uuid.uuid4()}.{ext}",
            original_filename=file.filename,
            file_size=len(content),
            mime_type=mime_type,
            minio_object_name=object_name,
            minio_bucket=settings.MINIO_BUCKET_DOCUMENTS,
            document_key=document_key,
            tags=payload.tags,
            access_level=payload.access_level,
            category_id=payload.category_id,
            expires_at=payload.expires_at,
            owner_id=owner.id,
        )
        db.add(doc)
        await db.flush()
        logger.info("Document uploaded", doc_id=doc.id, owner_id=owner.id)
        return doc

    @staticmethod
    async def get_document(db: AsyncSession, doc_id: int, user: User) -> Document:
        """Ambil dokumen by ID dengan cek akses."""
        result = await db.execute(select(Document).where(Document.id == doc_id))
        doc = result.scalar_one_or_none()
        if not doc:
            raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
        # TODO: implement fine-grained access control
        return doc

    @staticmethod
    async def get_download_url(db: AsyncSession, doc_id: int, user: User) -> str:
        """Return presigned URL untuk download dokumen."""
        doc = await DocumentService.get_document(db, doc_id, user)
        return await get_presigned_url(
            bucket=doc.minio_bucket,
            object_name=doc.minio_object_name,
            expires_hours=1,
        )

    @staticmethod
    async def search_documents(
        db: AsyncSession,
        params: DocumentSearchRequest,
        user: User,
    ) -> tuple[list[Document], int]:
        """Full-text search + filter dokumen."""
        query = select(Document)

        if params.query:
            q = f"%{params.query}%"
            query = query.where(
                or_(
                    Document.title.ilike(q),
                    Document.description.ilike(q),
                    Document.ocr_content.ilike(q),
                )
            )
        if params.category_id:
            query = query.where(Document.category_id == params.category_id)
        if params.status:
            query = query.where(Document.status == params.status)
        if params.access_level:
            query = query.where(Document.access_level == params.access_level)
        if params.owner_id:
            query = query.where(Document.owner_id == params.owner_id)

        # Count
        count_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = count_result.scalar()

        # Paginate
        offset = (params.page - 1) * params.size
        result = await db.execute(query.offset(offset).limit(params.size))
        docs = result.scalars().all()

        return list(docs), total

    @staticmethod
    async def update_document(
        db: AsyncSession,
        doc_id: int,
        payload: DocumentUpdate,
        user: User,
    ) -> Document:
        """Update metadata dokumen."""
        doc = await DocumentService.get_document(db, doc_id, user)
        if doc.owner_id != user.id and user.role not in ("admin", "super_admin"):
            raise HTTPException(status_code=403, detail="Akses ditolak")

        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(doc, field, value)
        return doc

    @staticmethod
    async def approve_document(
        db: AsyncSession,
        doc_id: int,
        payload: DocumentApprovalRequest,
        approver: User,
    ) -> Document:
        """Approve atau reject dokumen (admin only)."""
        result = await db.execute(select(Document).where(Document.id == doc_id))
        doc = result.scalar_one_or_none()
        if not doc:
            raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")

        doc.status = payload.status
        doc.approved_by_id = approver.id
        logger.info("Document approval", doc_id=doc.id, status=payload.status, approver=approver.id)
        return doc

    @staticmethod
    async def delete_document(db: AsyncSession, doc_id: int, user: User) -> None:
        """Hapus dokumen dari DB dan MinIO."""
        doc = await DocumentService.get_document(db, doc_id, user)
        if doc.owner_id != user.id and user.role not in ("admin", "super_admin"):
            raise HTTPException(status_code=403, detail="Akses ditolak")

        await delete_file(bucket=doc.minio_bucket, object_name=doc.minio_object_name)
        await db.delete(doc)
        logger.info("Document deleted", doc_id=doc_id, user_id=user.id)
