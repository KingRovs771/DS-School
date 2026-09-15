"""
Model: Dokumen
==============
Menyimpan metadata dokumen siswa. File aktual tersimpan terenkripsi
di MinIO. Key enkripsi dibungkus (wrapped) dengan kunci per-siswa
dari NeuralKeyGen sehingga tidak ada satu pihak pun yang memegang
plaintext key dokumen.

Enkripsi Flow:
    doc_key  = NeuralKeyGen(siswa.entropy_seed + sekolah.master_key_hash)
    file_enc = AES-256-GCM(file_bytes, doc_key)
    key_wrapped = AES-KW(doc_key, admin_key)  ← disimpan di kolom key_wrapped
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Index, Integer,
    String, Text, UniqueConstraint, CheckConstraint, JSON,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class JenisDokumen(str, enum.Enum):
    """Jenis dokumen akademik siswa."""
    IJAZAH              = "ijazah"
    TRANSKRIP_NILAI     = "transkrip_nilai"
    RAPORT              = "raport"
    SKHUN               = "skhun"
    SURAT_KETERANGAN    = "surat_keterangan"
    SERTIFIKAT          = "sertifikat"
    PIAGAM              = "piagam"
    SK_LULUS            = "sk_lulus"
    KARTU_PELAJAR       = "kartu_pelajar"
    SURAT_AKTIF         = "surat_aktif"
    REKOMENDASI         = "rekomendasi"
    LAINNYA             = "lainnya"


class SemesterEnum(str, enum.Enum):
    GANJIL  = "ganjil"
    GENAP   = "genap"
    FULL    = "full"   # Untuk dokumen yang mencakup satu tahun penuh


class StatusDokumen(str, enum.Enum):
    DRAFT           = "draft"
    PENDING_REVIEW  = "pending_review"
    APPROVED        = "approved"
    REJECTED        = "rejected"
    ARCHIVED        = "archived"
    EXPIRED         = "expired"


class Dokumen(Base):
    """
    Tabel: dokumen
    Metadata dokumen akademik siswa dengan enkripsi end-to-end.

    Indexes:
        - ix_dokumen_siswa_id      (siswa_id)        — dokumen per siswa
        - ix_dokumen_created_at    (created_at)       — timeline/audit
        - ix_dokumen_jenis         (jenis_dok)        — filter by jenis
        - ix_dokumen_tahun         (tahun_ajaran)     — filter by tahun
        - ix_dokumen_status        (status)           — filter by status
        - ix_dokumen_file_hash     (file_hash_sha256) — integritas/dedup
        - ix_dokumen_siswa_jenis   (siswa_id, jenis_dok)  — compound
    """
    __tablename__ = "dokumen"

    __table_args__ = (
        UniqueConstraint(
            "siswa_id", "jenis_dok", "tahun_ajaran", "semester",
            name="uq_dokumen_siswa_jenis_tahun_semester",
        ),
        # Indexes
        Index("ix_dokumen_siswa_id", "siswa_id"),
        Index("ix_dokumen_created_at", "created_at"),
        Index("ix_dokumen_jenis_dok", "jenis_dok"),
        Index("ix_dokumen_tahun_ajaran", "tahun_ajaran"),
        Index("ix_dokumen_status", "status"),
        Index("ix_dokumen_file_hash_sha256", "file_hash_sha256"),
        Index("ix_dokumen_siswa_jenis", "siswa_id", "jenis_dok"),
        Index("ix_dokumen_uploaded_by", "uploaded_by"),
        # Check constraints
        CheckConstraint(
            "length(tahun_ajaran) = 9 AND substr(tahun_ajaran, 5, 1) = '/'",
            name="ck_dokumen_format_tahun_ajaran",
        ),
        {"comment": "Dokumen akademik siswa (terenkripsi di MinIO)"},
    )

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Primary key",
    )

    # ── Foreign Key ───────────────────────────────────────────────────────────
    siswa_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("siswa.id", ondelete="RESTRICT"),
        nullable=False,
        comment="FK ke tabel siswa",
    )

    # ── Klasifikasi Dokumen ───────────────────────────────────────────────────
    jenis_dok: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Jenis/kategori dokumen akademik",
    )
    tahun_ajaran: Mapped[str] = mapped_column(
        String(9),
        nullable=False,
        comment="Tahun ajaran format YYYY/YYYY (e.g. 2023/2024)",
    )
    semester: Mapped[SemesterEnum] = mapped_column(
        Enum(SemesterEnum, name="semester_enum", values_callable=lambda obj: [e.value for e in obj]),
        default=SemesterEnum.FULL,
        nullable=False,
        comment="Semester: ganjil | genap | full",
    )
    status: Mapped[StatusDokumen] = mapped_column(
        Enum(StatusDokumen, name="status_dokumen_enum", values_callable=lambda obj: [e.value for e in obj]),
        default=StatusDokumen.DRAFT,
        nullable=False,
        server_default="draft",
        comment="Status alur persetujuan dokumen",
    )

    # ── File Storage ──────────────────────────────────────────────────────────
    file_path_encrypted: Mapped[str] = mapped_column(
        String(1024),
        nullable=False,
        comment=(
            "Path object di MinIO (bucket/object-name). "
            "File disimpan dalam format terenkripsi AES-256-GCM."
        ),
    )
    file_hash_sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment=(
            "SHA-256 hash dari file SEBELUM enkripsi. "
            "Digunakan untuk verifikasi integritas dan deteksi duplikat."
        ),
    )
    file_size_bytes: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Ukuran file asli dalam bytes (sebelum enkripsi)",
    )
    mime_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="MIME type file asli (application/pdf, image/jpeg, dst)",
    )
    original_filename: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
        comment="Nama file asli saat diupload",
    )

    # ── Kunci Enkripsi ────────────────────────────────────────────────────────
    key_wrapped: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment=(
            "Document encryption key yang sudah di-wrap (AES Key Wrap / RSA-OAEP). "
            "Hanya bisa di-unwrap dengan kunci admin atau master key sekolah. "
            "Format: base64(wrapped_key)"
        ),
    )

    # ── Metadata Fleksibel ────────────────────────────────────────────────────
    metadata_json: Mapped[dict | None] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
        comment=(
            "Metadata tambahan dalam format JSONB. Contoh: "
            '{"nilai_rata": 85.5, "predikat": "A", "catatan": "..."}'
        ),
    )

    # ── Audit Upload ──────────────────────────────────────────────────────────
    uploaded_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("admin.id", ondelete="SET NULL"),
        nullable=True,
        comment="FK ke tabel admin — siapa yang mengupload dokumen ini",
    )
    approved_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("admin.id", ondelete="SET NULL"),
        nullable=True,
        comment="FK ke admin yang menyetujui dokumen",
    )
    rejected_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Alasan penolakan (jika status = rejected)",
    )
    versi: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
        server_default="1",
        comment="Nomor versi dokumen (increment saat ada update)",
    )
    dokumen_induk_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("dokumen.id", ondelete="SET NULL"),
        nullable=True,
        comment="FK ke dokumen versi sebelumnya (untuk riwayat versi)",
    )

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        comment="Waktu dokumen diupload (UTC)",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
        comment="Waktu terakhir metadata diperbarui (UTC)",
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Batas waktu berlaku dokumen (opsional)",
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Waktu dokumen disetujui (UTC)",
    )

    # ── Legal Hold & Retention ────────────────────────────────────────────────
    legal_hold: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="Apakah dokumen ini dalam status Legal Hold (dilindungi dari hapus/archive)",
    )
    legal_hold_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("admin.id", ondelete="SET NULL"),
        nullable=True,
        comment="FK ke admin yang menetapkan legal hold",
    )
    legal_hold_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Waktu legal hold ditetapkan (UTC)",
    )
    legal_hold_alasan: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Alasan penetapan legal hold",
    )
    retention_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Waktu dokumen kadaluarsa berdasarkan retention policy (UTC)",
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    siswa: Mapped["Siswa"] = relationship(  # noqa: F821
        "Siswa",
        back_populates="dokumen",
    )
    uploader: Mapped["Admin | None"] = relationship(  # noqa: F821
        "Admin",
        foreign_keys=[uploaded_by],
        back_populates="uploaded_dokumen",
    )
    approver: Mapped["Admin | None"] = relationship(  # noqa: F821
        "Admin",
        foreign_keys=[approved_by],
    )
    dokumen_induk: Mapped["Dokumen | None"] = relationship(
        "Dokumen",
        remote_side="Dokumen.id",
        foreign_keys=[dokumen_induk_id],
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(  # noqa: F821
        "AuditLog",
        back_populates="dokumen",
    )

    def __repr__(self) -> str:
        return (
            f"<Dokumen id={self.id} siswa_id={self.siswa_id} "
            f"jenis={self.jenis_dok} tahun={self.tahun_ajaran}>"
        )
