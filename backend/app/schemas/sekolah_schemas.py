"""
Pydantic schemas untuk Sekolah, Siswa, Dokumen, AuditLog, Notifikasi, Admin
"""
from datetime import date, datetime
from typing import Any, Optional
import uuid

from pydantic import BaseModel, EmailStr, Field, field_validator


# ══════════════════════════════════════════════════════════════════════════════
# SEKOLAH
# ══════════════════════════════════════════════════════════════════════════════

class SekolahBase(BaseModel):
    nama: str = Field(..., min_length=3, max_length=255, description="Nama lengkap sekolah")
    kode: str = Field(..., min_length=2, max_length=20, description="Kode NPSN atau internal")
    alamat: Optional[str] = None
    kota: Optional[str] = Field(None, max_length=100)
    provinsi: Optional[str] = Field(None, max_length=100)
    kabupaten_id: Optional[uuid.UUID] = None
    kode_pos: Optional[str] = Field(None, max_length=10)
    telepon: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    website: Optional[str] = Field(None, max_length=255)
    sindas_api_url: Optional[str] = Field(None, max_length=255)
    sindas_api_key: Optional[str] = Field(None, max_length=255)


class SekolahCreate(SekolahBase):
    master_key: str = Field(..., min_length=32, description="Master key sekolah (plain, akan di-hash)")


class SekolahUpdate(BaseModel):
    nama: Optional[str] = Field(None, min_length=3, max_length=255)
    alamat: Optional[str] = None
    kota: Optional[str] = None
    provinsi: Optional[str] = None
    kabupaten_id: Optional[uuid.UUID] = None
    telepon: Optional[str] = None
    email: Optional[EmailStr] = None
    website: Optional[str] = Field(None, max_length=255)
    sindas_api_url: Optional[str] = Field(None, max_length=255)
    sindas_api_key: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None


class SekolahResponse(SekolahBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    # master_key_hash TIDAK dikembalikan ke client

    model_config = {"from_attributes": True}

class RegistrasiSekolahCreate(BaseModel):
    nama_sekolah: str = Field(..., min_length=3, max_length=255)
    kode_npsn: str = Field(..., min_length=2, max_length=20)
    alamat: str = Field(..., min_length=5)
    kabupaten_id: str = Field(..., description="UUID Kabupaten/Kota")
    nama_pic: str = Field(..., min_length=2, max_length=255)
    email_pic: EmailStr
    telepon_pic: str = Field(..., min_length=6, max_length=20)

class RegistrasiSekolahResponse(BaseModel):
    id: int
    nama_sekolah: str
    kode_npsn: str
    alamat: str
    kabupaten_id: uuid.UUID
    nama_pic: str
    email_pic: str
    telepon_pic: str
    status: str
    tanggal_daftar: datetime
    tanggal_diproses: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════════
# SISWA
# ══════════════════════════════════════════════════════════════════════════════

class SiswaBase(BaseModel):
    nis: str = Field(..., min_length=4, max_length=20, description="Nomor Induk Siswa")
    nisn: Optional[str] = Field(None, min_length=10, max_length=10, description="NISN 10 digit")
    nama_lengkap: str = Field(..., min_length=2, max_length=255)
    tgl_lahir: Optional[date] = None
    tempat_lahir: Optional[str] = Field(None, max_length=100)
    jenis_kelamin: Optional[str] = Field(None, pattern=r"^[LP]$", description="L atau P")
    agama: Optional[str] = Field(None, max_length=20)
    alamat: Optional[str] = None
    kelas: Optional[str] = Field(None, max_length=20)
    jurusan: Optional[str] = Field(None, max_length=100)
    angkatan: Optional[int] = Field(None, ge=1900, le=2100)
    tahun_lulus: Optional[int] = Field(None, ge=1900, le=2100)
    email: Optional[EmailStr] = None
    telepon: Optional[str] = Field(None, max_length=20)
    telepon_ortu: Optional[str] = Field(None, max_length=20)
    nama_ortu: Optional[str] = Field(None, max_length=255)
    sekolah_id: int


class SiswaCreate(SiswaBase):
    pass


class SiswaUpdate(BaseModel):
    nama_lengkap: Optional[str] = Field(None, min_length=2, max_length=255)
    tgl_lahir: Optional[date] = None
    kelas: Optional[str] = None
    jurusan: Optional[str] = None
    angkatan: Optional[int] = Field(None, ge=1900, le=2100)
    tahun_lulus: Optional[int] = Field(None, ge=1900, le=2100)
    email: Optional[EmailStr] = None
    telepon: Optional[str] = None
    telepon_ortu: Optional[str] = None
    nama_ortu: Optional[str] = None
    foto_path: Optional[str] = None
    is_active: Optional[bool] = None


class SiswaResponse(SiswaBase):
    id: int
    foto_path: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    # entropy_seed TIDAK dikembalikan ke client

    model_config = {"from_attributes": True}


class SiswaList(BaseModel):
    items: list[SiswaResponse]
    total: int
    page: int
    size: int


# ══════════════════════════════════════════════════════════════════════════════
# DOKUMEN
# ══════════════════════════════════════════════════════════════════════════════

class DokumenBase(BaseModel):
    jenis_dok: str = Field(..., description="Jenis dokumen akademik")
    tahun_ajaran: str = Field(
        ...,
        pattern=r"^\d{4}/\d{4}$",
        description="Format YYYY/YYYY, contoh: 2023/2024",
    )
    semester: str = Field("full", description="ganjil | genap | full")
    metadata_json: Optional[dict[str, Any]] = None


class DokumenCreate(DokumenBase):
    siswa_id: int


class DokumenUpdate(BaseModel):
    jenis_dok: Optional[str] = None
    tahun_ajaran: Optional[str] = Field(None, pattern=r"^\d{4}/\d{4}$")
    semester: Optional[str] = None
    status: Optional[str] = None
    metadata_json: Optional[dict[str, Any]] = None
    expires_at: Optional[datetime] = None


class DokumenResponse(DokumenBase):
    id: int
    siswa_id: int
    original_filename: Optional[str] = None
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    status: str
    versi: int
    uploaded_by: Optional[int] = None
    approved_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    download_url: Optional[str] = None  # Presigned URL, diisi oleh service
    siswa: Optional[SiswaResponse] = None
    # file_path_encrypted, key_wrapped, file_hash_sha256 TIDAK dikembalikan

    model_config = {"from_attributes": True}


class DokumenList(BaseModel):
    items: list[DokumenResponse]
    total: int
    page: int
    size: int


class DokumenApprovalRequest(BaseModel):
    status: str = Field(..., pattern=r"^(approved|rejected)$")
    catatan: Optional[str] = None


class DokumenSearchRequest(BaseModel):
    siswa_id: Optional[int] = None
    jenis_dok: Optional[str] = None
    tahun_ajaran: Optional[str] = None
    semester: Optional[str] = None
    status: Optional[str] = None
    sekolah_id: Optional[int] = None
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN
# ══════════════════════════════════════════════════════════════════════════════

class AdminCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100, pattern=r"^[a-zA-Z0-9_.-]+$")
    email: EmailStr
    nama_lengkap: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field("operator", description="super_admin | admin | operator | viewer")
    sekolah_id: Optional[int] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password harus ada huruf kapital")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password harus ada angka")
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in v):
            raise ValueError("Password harus ada karakter spesial")
        return v


class AdminUpdate(BaseModel):
    nama_lengkap: Optional[str] = Field(None, min_length=2, max_length=255)
    role: Optional[str] = None
    is_active: Optional[bool] = None
    sekolah_id: Optional[int] = None
    password: Optional[str] = Field(None, min_length=8, max_length=128)


class AdminResponse(BaseModel):
    id: int
    username: str
    email: str
    nama_lengkap: str
    role: str
    is_active: bool
    is_verified: bool
    sekolah_id: Optional[int] = None
    last_login: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminLoginRequest(BaseModel):
    username: str  # bisa username atau email
    password: str
    code: Optional[str] = None


class AdminTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    admin: AdminResponse


# ══════════════════════════════════════════════════════════════════════════════
# AUDIT LOG
# ══════════════════════════════════════════════════════════════════════════════

class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    siswa_id: Optional[int] = None
    user_type: str
    action: str
    dokumen_id: Optional[int] = None
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    endpoint: Optional[str] = None
    http_method: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    detail: Optional[dict[str, Any]] = None
    duration_ms: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogList(BaseModel):
    items: list[AuditLogResponse]
    total: int
    page: int
    size: int


# ══════════════════════════════════════════════════════════════════════════════
# NOTIFIKASI
# ══════════════════════════════════════════════════════════════════════════════

class NotifikasiResponse(BaseModel):
    id: int
    siswa_id: int
    dokumen_id: Optional[int] = None
    tipe: str
    judul: str
    pesan: str
    payload: Optional[dict[str, Any]] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    expires_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class NotifikasiList(BaseModel):
    items: list[NotifikasiResponse]
    total: int
    unread_count: int


class NotifikasiMarkReadRequest(BaseModel):
    ids: list[int] = Field(..., min_length=1, description="List ID notifikasi yang akan ditandai dibaca")


# ══════════════════════════════════════════════════════════════════════════════
# TAHUN AJARAN — per sekolah
# ══════════════════════════════════════════════════════════════════════════════

class TahunAjaranBase(BaseModel):
    tahun: str = Field(..., pattern=r"^\d{4}/\d{4}$", description="Format YYYY/YYYY")
    is_default: bool = False


class TahunAjaranCreate(TahunAjaranBase):
    # sekolah_id opsional: jika super_admin mengelola sekolah lain, isi ini.
    # Jika admin biasa (punya sekolah_id), akan diabaikan dan pakai sekolah admin.
    sekolah_id: Optional[int] = Field(None, description="ID sekolah pemilik (hanya super_admin)")


class TahunAjaranResponse(TahunAjaranBase):
    id: int
    sekolah_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
