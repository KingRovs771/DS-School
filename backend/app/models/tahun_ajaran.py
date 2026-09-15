"""
Model: TahunAjaran
==================
Data tahun ajaran akademik yang aktif dan dapat dipilih di sistem.
Mendukung pengaturan tahun ajaran default.
"""
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, CheckConstraint, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TahunAjaran(Base):
    """
    Tabel: tahun_ajaran — per sekolah
    Setiap sekolah memiliki daftar tahun ajaran sendiri (isolasi).
    Unique (sekolah_id, tahun), hanya satu is_default per sekolah.
    """
    __tablename__ = "tahun_ajaran"

    __table_args__ = (
        CheckConstraint(
            "length(tahun) = 9 AND substr(tahun, 5, 1) = '/'",
            name="ck_tahun_ajaran_format",
        ),
        UniqueConstraint("sekolah_id", "tahun", name="uq_tahun_ajaran_sekolah_tahun"),
        Index("ix_tahun_ajaran_tahun", "tahun"),
        Index("ix_tahun_ajaran_sekolah_id", "sekolah_id"),
        {"comment": "Daftar tahun ajaran akademik per sekolah"},
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Primary key",
    )
    sekolah_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("sekolah.id", ondelete="CASCADE"),
        nullable=False,
        comment="FK ke sekolah pemilik tahun ajaran",
    )
    tahun: Mapped[str] = mapped_column(
        String(9),
        nullable=False,
        comment="Format YYYY/YYYY (contoh: 2025/2026)",
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        server_default="false",
        comment="Apakah tahun ajaran ini menjadi default di sekolah tersebut",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        comment="Waktu dibuat (UTC)",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
        comment="Waktu diperbarui (UTC)",
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    sekolah: Mapped["Sekolah"] = relationship(  # noqa: F821
        "Sekolah",
        back_populates="tahun_ajaran_list",
    )

    def __repr__(self) -> str:
        return f"<TahunAjaran id={self.id} sekolah_id={self.sekolah_id} tahun={self.tahun!r} is_default={self.is_default}>"
