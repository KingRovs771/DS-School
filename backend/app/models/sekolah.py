"""
Model: Sekolah
==============
Master data sekolah. Setiap sekolah memiliki master_key_hash yang digunakan
sebagai salt/seed utama untuk enkripsi dokumen siswa.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Index, Integer,
    String, Text, UniqueConstraint, ForeignKey
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.core.database import Base


class Sekolah(Base):
    """
    Tabel: sekolah
    Menyimpan data master sekolah.
    """
    __tablename__ = "sekolah"

    __table_args__ = (
        UniqueConstraint("kode", name="uq_sekolah_kode"),
        Index("ix_sekolah_kode", "kode"),
        {"comment": "Master data sekolah"},
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Primary key",
    )
    nama: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Nama lengkap sekolah",
    )
    kode: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        unique=True,
        comment="Kode sekolah (NPSN atau kode internal)",
    )
    alamat: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Alamat lengkap sekolah",
    )
    kota: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Kota/kabupaten",
    )
    kabupaten_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("kabupaten_kota.id"),
        nullable=True,
        comment="ID Kabupaten/Kota wilayah sekolah",
    )
    provinsi: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Provinsi",
    )
    kode_pos: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        comment="Kode pos",
    )
    telepon: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Nomor telepon sekolah",
    )
    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Email resmi sekolah",
    )
    website: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="URL website sekolah",
    )
    sindas_api_url: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Link API SINDAS untuk sekolah ini",
    )
    sindas_api_key: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="API Key SINDAS untuk sekolah ini",
    )
    # ── Keamanan ─────────────────────────────────────────────────────────────
    master_key_hash: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        comment=(
            "Hash dari master key sekolah (Argon2id/bcrypt). "
            "Digunakan sebagai komponen enkripsi dokumen siswa."
        ),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        server_default="true",
        comment="Status aktif sekolah",
    )
    public_key_pem: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Public Key RSA Master Key sekolah (PEM)",
    )
    mk_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
        comment="Versi Master Key yang aktif. 0 = belum di-setup",
    )
    # ── Timestamps ────────────────────────────────────────────────────────────
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
        comment="Waktu terakhir diperbarui (UTC)",
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    # Relationship ke KabupatenKota
    kabupaten = relationship("KabupatenKota", back_populates="sekolah_list")

    siswa: Mapped[list["Siswa"]] = relationship(  # noqa: F821
        "Siswa",
        back_populates="sekolah",
        cascade="all, delete-orphan",
    )

    # Relationship untuk audit log 
    audit_logs = relationship(  # noqa: F821
        "Siswa",
        back_populates="sekolah",
        cascade="all, delete-orphan",
    )
    admin: Mapped[list["Admin"]] = relationship(  # noqa: F821
        "Admin",
        back_populates="sekolah",
        cascade="all, delete-orphan",
    )

    tahun_ajaran_list: Mapped[list["TahunAjaran"]] = relationship(  # noqa: F821
        "TahunAjaran",
        back_populates="sekolah",
        cascade="all, delete-orphan",
    )

    @validates("nama")
    def validate_nama(self, key, value):
        if value is not None:
            return " ".join([word.capitalize() for word in value.split()])
        return value

    def __repr__(self) -> str:
        return f"<Sekolah id={self.id} kode={self.kode!r} nama={self.nama[:30]!r}>"
