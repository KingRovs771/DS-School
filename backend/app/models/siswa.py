"""
Model: Siswa
============
Data lengkap siswa beserta entropy_seed yang digunakan
NeuralKeyGen untuk menghasilkan kunci dokumen per-siswa.
"""
import enum
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, ForeignKey,
    Index, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.core.database import Base


class KelasEnum(str, enum.Enum):
    """Tingkat kelas untuk sekolah menengah."""
    X    = "X"
    XI   = "XI"
    XII  = "XII"
    # SMP
    VII  = "VII"
    VIII = "VIII"
    IX   = "IX"
    # SD
    I    = "I"
    II   = "II"
    III  = "III"
    IV   = "IV"
    V    = "V"
    VI   = "VI"


class Siswa(Base):
    """
    Tabel: siswa
    Data pribadi siswa + seed entropy untuk pembangkitan kunci dokumen.

    Indexes:
        - ix_siswa_nis        (nis)           — pencarian cepat by NIS
        - ix_siswa_nisn       (nisn)          — pencarian by NISN nasional
        - ix_siswa_email      (email)         — lookup by email
        - ix_siswa_sekolah    (sekolah_id)    — filter by sekolah
        - ix_siswa_angkatan   (angkatan)      — filter by tahun angkatan
        - ix_siswa_kelas_sek  (kelas, sekolah_id) — compound: kelas per sekolah
    """
    __tablename__ = "siswa"

    __table_args__ = (
        # Unique constraints
        UniqueConstraint("nis", "sekolah_id", name="uq_siswa_nis_sekolah"),
        UniqueConstraint("nisn", name="uq_siswa_nisn"),
        UniqueConstraint("email", name="uq_siswa_email"),
        # Indexes
        Index("ix_siswa_nis", "nis"),
        Index("ix_siswa_nisn", "nisn"),
        Index("ix_siswa_email", "email"),
        Index("ix_siswa_sekolah_id", "sekolah_id"),
        Index("ix_siswa_angkatan", "angkatan"),
        Index("ix_siswa_kelas_sekolah", "kelas", "sekolah_id"),
        {"comment": "Data siswa dan seed untuk NeuralKeyGen"},
    )

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Primary key",
    )

    # ── Identitas Akademik ────────────────────────────────────────────────────
    nis: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Nomor Induk Siswa (unik per sekolah)",
    )
    nisn: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        unique=True,
        comment="Nomor Induk Siswa Nasional (10 digit, unik nasional)",
    )

    # ── Data Pribadi ──────────────────────────────────────────────────────────
    nama_lengkap: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Nama lengkap siswa",
    )
    tgl_lahir: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="Tanggal lahir siswa",
    )
    tempat_lahir: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Tempat lahir siswa",
    )
    jenis_kelamin: Mapped[str | None] = mapped_column(
        String(1),
        nullable=True,
        comment="Jenis kelamin: L = Laki-laki, P = Perempuan",
    )
    agama: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Agama siswa",
    )
    alamat: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Alamat lengkap siswa",
    )

    # ── Akademik ──────────────────────────────────────────────────────────────
    kelas: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Kelas/tingkat (X, XI, XII, VII, dst)",
    )
    jurusan: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Jurusan / program studi",
    )
    angkatan: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Tahun angkatan masuk (e.g. 2022)",
    )
    tahun_lulus: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Tahun kelulusan (opsional)",
    )

    # ── Kontak ────────────────────────────────────────────────────────────────
    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
        comment="Email siswa (opsional, harus unik jika diisi)",
    )
    telepon: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Nomor telepon / WhatsApp siswa",
    )
    telepon_ortu: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Nomor telepon orang tua/wali",
    )
    nama_ortu: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Nama orang tua/wali",
    )

    # ── Media ─────────────────────────────────────────────────────────────────
    foto_path: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
        comment="Path/URL foto siswa di MinIO (bucket: dms-avatars)",
    )

    # ── Keamanan / Enkripsi ───────────────────────────────────────────────────
    entropy_seed: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
        comment=(
            "Seed entropy untuk NeuralKeyGen. "
            "Digabung dengan master_key_hash sekolah untuk membuat "
            "kunci enkripsi per-siswa yang unik."
        ),
    )

    # ── Status ────────────────────────────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        server_default="true",
        comment="Status aktif siswa (False jika sudah lulus/pindah)",
    )

    # ── Foreign Keys ──────────────────────────────────────────────────────────
    sekolah_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("sekolah.id", ondelete="RESTRICT"),
        nullable=False,
        comment="FK ke tabel sekolah",
    )

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        comment="Waktu record dibuat (UTC)",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
        comment="Waktu terakhir diperbarui (UTC)",
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    sekolah: Mapped["Sekolah"] = relationship(  # noqa: F821
        "Sekolah",
        back_populates="siswa",
    )
    dokumen: Mapped[list["Dokumen"]] = relationship(  # noqa: F821
        "Dokumen",
        back_populates="siswa",
        cascade="all, delete-orphan",
    )
    notifikasi: Mapped[list["Notifikasi"]] = relationship(  # noqa: F821
        "Notifikasi",
        back_populates="siswa",
        cascade="all, delete-orphan",
    )

    @validates("nama_lengkap", "nama_ortu")
    def validate_names(self, key, value):
        if value is not None:
            return " ".join([word.capitalize() for word in value.split()])
        return value

    def __repr__(self) -> str:
        return f"<Siswa id={self.id} nis={self.nis!r} nama={self.nama_lengkap[:25]!r}>"
