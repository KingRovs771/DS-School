"""
Model: Admin
============
Akun administrator yang mengelola DMS sekolah.
Mendukung multi-level role: super_admin > admin > operator > viewer.
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Index,
    Integer, String, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.core.database import Base


class AdminRole(str, enum.Enum):
    """Hierarki peran administrator."""
    SUPER_ADMIN = "super_admin"  # Akses penuh lintas sekolah
    ADMIN       = "admin"        # Admin per sekolah
    OPERATOR    = "operator"     # Upload dan review dokumen
    VIEWER      = "viewer"       # Hanya baca
    TU_SEKOLAH  = "tu_sekolah"   # Peran TU Sekolah
    DINAS_PENDIDIKAN = "dinas_pendidikan" # Peran Dinas Pendidikan


class Admin(Base):
    """
    Tabel: admin
    Akun pengelola DMS. Terikat ke satu sekolah (kecuali super_admin).

    Indexes:
        - ix_admin_username    (username)    — login lookup
        - ix_admin_email       (email)       — login lookup
        - ix_admin_sekolah_id  (sekolah_id)  — admin per sekolah
        - ix_admin_role        (role)        — filter by role
    """
    __tablename__ = "admin"

    __table_args__ = (
        UniqueConstraint("username", name="uq_admin_username"),
        UniqueConstraint("email", name="uq_admin_email"),
        Index("ix_admin_username", "username"),
        Index("ix_admin_email", "email"),
        Index("ix_admin_sekolah_id", "sekolah_id"),
        Index("ix_admin_role", "role"),
        {"comment": "Akun administrator DMS"},
    )

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Primary key",
    )

    # ── Identitas ─────────────────────────────────────────────────────────────
    username: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        comment="Username untuk login (alphanumeric + underscore)",
    )
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        comment="Email admin (digunakan untuk login dan notifikasi)",
    )
    nama_lengkap: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Nama lengkap admin",
    )

    # ── Keamanan ─────────────────────────────────────────────────────────────
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Hash password (Argon2id/bcrypt, TIDAK boleh plaintext)",
    )
    role: Mapped[AdminRole] = mapped_column(
        Enum(AdminRole, name="admin_role_enum", values_callable=lambda obj: [e.value for e in obj]),
        default=AdminRole.OPERATOR,
        nullable=False,
        comment="Level akses admin",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        server_default="true",
        comment="Status aktif akun admin",
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        server_default="false",
        comment="Apakah email sudah diverifikasi",
    )
    failed_login_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        server_default="0",
        comment="Jumlah percobaan login gagal berturut-turut (lockout jika >= 5)",
    )
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Akun terkunci sampai waktu ini (NULL = tidak terkunci)",
    )
    password_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Waktu terakhir password diubah",
    )
    two_factor_secret: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Secret key TOTP untuk 2FA (terenkripsi)",
    )
    two_factor_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        server_default="false",
        comment="Apakah 2FA aktif untuk akun ini",
    )

    # ── Foreign Keys ──────────────────────────────────────────────────────────
    sekolah_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("sekolah.id", ondelete="SET NULL"),
        nullable=True,
        comment=(
            "FK ke sekolah yang dikelola. "
            "NULL untuk super_admin (akses semua sekolah)"
        ),
    )

    # ── Timestamps ────────────────────────────────────────────────────────────
    last_login: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Waktu login terakhir berhasil (UTC)",
    )
    last_login_ip: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
        comment="IP address saat login terakhir",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        comment="Waktu akun dibuat (UTC)",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
        comment="Waktu terakhir data diperbarui (UTC)",
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    sekolah: Mapped["Sekolah | None"] = relationship(  # noqa: F821
        "Sekolah",
        foreign_keys=[sekolah_id],
        back_populates="admin",
    )
    uploaded_dokumen: Mapped[list["Dokumen"]] = relationship(  # noqa: F821
        "Dokumen",
        foreign_keys="Dokumen.uploaded_by",
        back_populates="uploader",
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(  # noqa: F821
        "AuditLog",
        back_populates="admin",
        foreign_keys="AuditLog.user_id",
    )

    @validates("nama_lengkap")
    def validate_nama_lengkap(self, key, value):
        if value is not None:
            return " ".join([word.capitalize() for word in value.split()])
        return value

    def __repr__(self) -> str:
        return f"<Admin id={self.id} username={self.username!r} role={self.role}>"
