from __future__ import annotations
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator


# ─── Retention Policy ──────────────────────────────────────────────────────────

class RetentionPolicyBase(BaseModel):
    jenis_dok: str = Field(..., max_length=100, examples=["rapor", "ijazah"])
    durasi_hari: int = Field(1825, ge=1, description="Durasi retensi dalam hari")
    aksi_setelah: Literal["archive", "delete", "notify_only"] = "archive"
    notif_hari_sebelum: int = Field(30, ge=0, description="Notifikasi N hari sebelum kadaluarsa")
    is_active: bool = True


class RetentionPolicyCreate(RetentionPolicyBase):
    sekolah_id: int


class RetentionPolicyUpdate(BaseModel):
    durasi_hari: Optional[int] = Field(None, ge=1)
    aksi_setelah: Optional[Literal["archive", "delete", "notify_only"]] = None
    notif_hari_sebelum: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class RetentionPolicyRead(RetentionPolicyBase):
    id: int
    sekolah_id: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Legal Hold ───────────────────────────────────────────────────────────────

class LegalHoldSetRequest(BaseModel):
    alasan: str = Field(..., min_length=5, max_length=1000,
                        description="Alasan penetapan legal hold wajib diisi")


class LegalHoldRead(BaseModel):
    dokumen_id: int
    legal_hold: bool
    legal_hold_at: Optional[datetime] = None
    legal_hold_alasan: Optional[str] = None
    legal_hold_by: Optional[int] = None

    model_config = {"from_attributes": True}


# ─── Dokumen Akan Expired ─────────────────────────────────────────────────────

class DokumenAkanExpiredItem(BaseModel):
    id: int
    jenis_dok: str
    tahun_ajaran: str
    siswa_id: int
    siswa_nama: str
    siswa_nisn: str
    sekolah_id: int
    retention_expires_at: datetime
    sisa_hari: int
    legal_hold: bool
    status: str

    model_config = {"from_attributes": True}


# ─── Retention Log ────────────────────────────────────────────────────────────

class RetentionLogRead(BaseModel):
    id: int
    dokumen_id: Optional[int] = None
    aksi: str
    alasan: Optional[str] = None
    dilakukan_oleh: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}
