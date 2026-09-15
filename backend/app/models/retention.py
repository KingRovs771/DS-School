import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Index, Integer, String, Text,
    CheckConstraint, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AksiRetensi(str, enum.Enum):
    ARCHIVE     = "archive"
    DELETE      = "delete"
    NOTIFY_ONLY = "notify_only"


class RetentionPolicy(Base):
    """
    Tabel: retention_policy
    Kebijakan retensi dokumen per jenis per sekolah.
    """
    __tablename__ = "retention_policy"

    __table_args__ = (
        UniqueConstraint("sekolah_id", "jenis_dok", name="uq_retention_sekolah_jenis"),
        CheckConstraint(
            "aksi_setelah IN ('archive', 'delete', 'notify_only')",
            name="ck_retention_aksi_setelah",
        ),
        Index("ix_retention_policy_sekolah_id", "sekolah_id"),
        Index("ix_retention_policy_jenis_dok", "jenis_dok"),
        {"comment": "Kebijakan retensi dokumen per jenis per sekolah"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sekolah_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sekolah.id", ondelete="CASCADE"), nullable=False,
        comment="FK ke sekolah pemilik kebijakan",
    )
    jenis_dok: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="Jenis dokumen yang diatur (rapor, ijazah, dll)",
    )
    durasi_hari: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="1825",
        comment="Durasi retensi dalam hari sejak upload",
    )
    aksi_setelah: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="archive",
        comment="Aksi setelah expired: archive | delete | notify_only",
    )
    notif_hari_sebelum: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="30",
        comment="Kirim notifikasi N hari sebelum expired",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true",
        comment="Apakah kebijakan ini aktif",
    )
    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("admin.id", ondelete="SET NULL"), nullable=True,
        comment="FK ke admin yang membuat kebijakan",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False,
    )

    sekolah: Mapped["Sekolah"] = relationship("Sekolah")  # noqa: F821
    creator: Mapped["Admin | None"] = relationship("Admin", foreign_keys=[created_by])  # noqa: F821

    def __repr__(self) -> str:
        return f"<RetentionPolicy sekolah={self.sekolah_id} jenis={self.jenis_dok} durasi={self.durasi_hari}d>"


class RetentionLog(Base):
    """
    Tabel: retention_log
    Immutable log setiap aksi retensi yang dieksekusi.
    """
    __tablename__ = "retention_log"

    __table_args__ = (
        Index("ix_retention_log_dokumen_id", "dokumen_id"),
        Index("ix_retention_log_created_at", "created_at"),
        {"comment": "Log histori aksi retensi (immutable)"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dokumen_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("dokumen.id", ondelete="SET NULL"), nullable=True,
    )
    aksi: Mapped[str] = mapped_column(String(30), nullable=False)
    alasan: Mapped[str | None] = mapped_column(Text, nullable=True)
    dilakukan_oleh: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("admin.id", ondelete="SET NULL"), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc), nullable=False,
    )

    dokumen: Mapped["Dokumen | None"] = relationship("Dokumen")  # noqa: F821
    admin: Mapped["Admin | None"] = relationship("Admin", foreign_keys=[dilakukan_oleh])  # noqa: F821

    def __repr__(self) -> str:
        return f"<RetentionLog doc={self.dokumen_id} aksi={self.aksi}>"
