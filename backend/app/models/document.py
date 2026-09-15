"""
Document model — tabel documents & categories
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger, Boolean, DateTime, Enum, ForeignKey,
    Integer, String, Text, JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DocumentStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class DocumentAccessLevel(str, enum.Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    SECRET = "secret"


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(7), default="#6366f1")  # hex color
    sekolah_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("sekolah.id", ondelete="CASCADE"), nullable=True
    )
    parent_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("categories.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    parent: Mapped["Category | None"] = relationship("Category", remote_side="Category.id")
    documents: Mapped[list["Document"]] = relationship("Document", back_populates="category")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # File info
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    minio_object_name: Mapped[str] = mapped_column(String(512), nullable=False)
    minio_bucket: Mapped[str] = mapped_column(String(100), nullable=False)

    # NeuralKeyGen generated document key
    document_key: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    # Metadata
    tags: Mapped[list] = mapped_column(JSON, default=list)
    extra_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus), default=DocumentStatus.DRAFT
    )
    access_level: Mapped[DocumentAccessLevel] = mapped_column(
        Enum(DocumentAccessLevel), default=DocumentAccessLevel.INTERNAL
    )

    # OCR content for full-text search
    ocr_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_ocr_processed: Mapped[bool] = mapped_column(Boolean, default=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Foreign keys
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    category_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("categories.id"), nullable=True
    )
    approved_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", foreign_keys=[owner_id], back_populates="documents")  # noqa: F821
    category: Mapped["Category | None"] = relationship("Category", back_populates="documents")
    approved_by: Mapped["User | None"] = relationship("User", foreign_keys=[approved_by_id])  # noqa: F821
    versions: Mapped[list["DocumentVersion"]] = relationship("DocumentVersion", back_populates="document")

    def __repr__(self) -> str:
        return f"<Document id={self.id} title={self.title[:30]} status={self.status}>"


class DocumentVersion(Base):
    """Riwayat versi dokumen."""
    __tablename__ = "document_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(Integer, ForeignKey("documents.id"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    minio_object_name: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    change_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    document: Mapped["Document"] = relationship("Document", back_populates="versions")
    created_by: Mapped["User"] = relationship("User")  # noqa: F821
