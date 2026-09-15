"""
Pydantic schemas untuk Document
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.models.document import DocumentAccessLevel, DocumentStatus


# ── Category ────────────────────────────────────────────────────────────────
class CategoryBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    color: str = Field("#6366f1", pattern=r"^#[0-9a-fA-F]{6}$")
    parent_id: Optional[int] = None
    sekolah_id: Optional[int] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Document ────────────────────────────────────────────────────────────────
class DocumentBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=512)
    description: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    access_level: DocumentAccessLevel = DocumentAccessLevel.INTERNAL
    category_id: Optional[int] = None
    expires_at: Optional[datetime] = None


class DocumentCreate(DocumentBase):
    """Schema for document creation (multipart form fields)."""
    pass


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=512)
    description: Optional[str] = None
    tags: Optional[list[str]] = None
    access_level: Optional[DocumentAccessLevel] = None
    category_id: Optional[int] = None
    status: Optional[DocumentStatus] = None
    expires_at: Optional[datetime] = None


class DocumentResponse(DocumentBase):
    id: int
    filename: str
    original_filename: str
    file_size: int
    mime_type: str
    document_key: str
    version: int
    status: DocumentStatus
    is_ocr_processed: bool
    owner_id: int
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime] = None
    download_url: Optional[str] = None  # presigned URL, populated by service

    model_config = {"from_attributes": True}


class DocumentList(BaseModel):
    items: list[DocumentResponse]
    total: int
    page: int
    size: int


class DocumentVersionResponse(BaseModel):
    id: int
    version_number: int
    file_size: int
    change_note: Optional[str]
    created_by_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentApprovalRequest(BaseModel):
    status: DocumentStatus
    note: Optional[str] = None


class DocumentSearchRequest(BaseModel):
    query: Optional[str] = None
    category_id: Optional[int] = None
    status: Optional[DocumentStatus] = None
    access_level: Optional[DocumentAccessLevel] = None
    tags: Optional[list[str]] = None
    owner_id: Optional[int] = None
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)
