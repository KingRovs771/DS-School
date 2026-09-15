from datetime import datetime, timezone
import uuid
from sqlalchemy import String, BigInteger, ForeignKey, TIMESTAMP, Index, text, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class BackupRecord(Base):
    __tablename__ = "backup_records"

    __table_args__ = (
        Index("idx_backup_status", "status"),
        Index("idx_backup_created", "created_at"),
        {"comment": "Rekaman riwayat backup dan restore"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    nama_file: Mapped[str] = mapped_column(String(200), nullable=False)
    ukuran_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    manifest_json: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        server_default="pending",
    )
    tipe: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="manual",
        server_default="manual",
    )
    storage_path: Mapped[str | None] = mapped_column(nullable=True)
    dibuat_oleh: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("admin.id", ondelete="SET NULL"),
        nullable=True,
    )
    restored_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
    restored_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("admin.id", ondelete="SET NULL"),
        nullable=True,
    )
    error_message: Mapped[str | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=text("NOW()"),
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
