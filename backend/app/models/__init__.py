"""
Models package — registrasi semua model SQLAlchemy.

Import order PENTING untuk menghindari circular imports:
    1. Base (dari database)
    2. Model tanpa FK: Sekolah
    3. Model dengan FK ke Sekolah: Admin, Siswa
    4. Model dengan FK ke Admin+Siswa: Dokumen
    5. Model dengan FK ke semua: AuditLog, Notifikasi

Semua model harus diimport di sini agar Alembic `autogenerate`
dapat mendeteksi perubahan schema secara otomatis.
"""

# ── 1. Sekolah (independen) ────────────────────────────────────────────────────
from app.models.sekolah import Sekolah
from app.models.tahun_ajaran import TahunAjaran

# ── 2. Admin & Siswa (FK ke Sekolah) ──────────────────────────────────────────
from app.models.admin import Admin, AdminRole
from app.models.siswa import Siswa, KelasEnum
from app.models.wilayah import KabupatenKota, DinasAdmin
from app.models.registrasi import RegistrasiSekolah, RegistrasiStatus
# ── 3. Dokumen (FK ke Admin + Siswa) ──────────────────────────────────────────
from app.models.dokumen import (
    Dokumen,
    JenisDokumen,
    SemesterEnum,
    StatusDokumen,
)

# ── 4. AuditLog & Notifikasi (FK ke semua) ────────────────────────────────────
from app.models.audit_log import AuditLog, AuditAction, AuditStatus, UserType
from app.models.notifikasi import Notifikasi, TipeNotifikasi

# ── 5. SindasSyncLog (FK ke Siswa + Sekolah) ──────────────────────────────────
from app.models.sindas_sync_log import SindasSyncLog, SindasEventType, SindasSyncStatus

# ── 6. RetentionPolicy & RetentionLog ──────────────────────────────────────────────
from app.models.retention import RetentionPolicy, RetentionLog, AksiRetensi

# ── 7. Backup & Restore ─────────────────────────────────────────────────────────────
from app.models.backup import BackupRecord

# ── Legacy models (dari versi sebelumnya — untuk backward compatibility) ──────
from app.models.user import User, UserRole
from app.models.document import Document, Category, DocumentVersion, DocumentStatus, DocumentAccessLevel
from app.models.activity_log import ActivityLog

__all__ = [
    # ── New DMS Schema ─────────────────────────────────────────────────────────
    "Sekolah",
    "TahunAjaran",
    "Admin", "AdminRole",
    "Siswa", "KelasEnum",
    "Dokumen", "JenisDokumen", "SemesterEnum", "StatusDokumen",
    "AuditLog", "AuditAction", "AuditStatus", "UserType",
    "Notifikasi", "TipeNotifikasi",
    "SindasSyncLog", "SindasEventType", "SindasSyncStatus",
    "KabupatenKota", "DinasAdmin", "RegistrasiSekolah", "RegistrasiStatus",
    "RetentionPolicy", "RetentionLog", "AksiRetensi",
    "BackupRecord",
    # ── Legacy ─────────────────────────────────────────────────────────────────
    "User", "UserRole",
    "Document", "Category", "DocumentVersion", "DocumentStatus", "DocumentAccessLevel",
    "ActivityLog",
]
