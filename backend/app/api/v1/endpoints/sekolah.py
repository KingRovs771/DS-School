import structlog
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import hash_password
from app.core.dependencies import get_current_admin, get_tu_sekolah
from app.models.admin import Admin, AdminRole
from app.models.sekolah import Sekolah
from app.models.registrasi import RegistrasiSekolah, RegistrasiStatus
from app.models.wilayah import KabupatenKota
from app.schemas.sekolah_schemas import (
    SekolahResponse, SekolahUpdate, SekolahCreate, 
    RegistrasiSekolahCreate, RegistrasiSekolahResponse
)
from pydantic import BaseModel
import uuid

logger = structlog.get_logger(__name__)
router = APIRouter()

class KabupatenResponse(BaseModel):
    id: uuid.UUID
    nama: str
    provinsi: str

class KabupatenSyncRequest(BaseModel):
    provinsi: str
    nama: str
    kode_kemendagri: str

@router.post("/kabupaten/sync", response_model=KabupatenResponse)
async def sync_kabupaten(
    payload: KabupatenSyncRequest,
    db: AsyncSession = Depends(get_db)
):
    """Sinkronisasi kabupaten dari API eksternal wilayah.id ke database lokal."""
    # Coba cari berdasarkan kode kemendagri terlebih dahulu
    stmt = select(KabupatenKota).where(KabupatenKota.kode_kemendagri == payload.kode_kemendagri)
    kab = (await db.execute(stmt)).scalar_one_or_none()
    
    if not kab:
        # Coba cari berdasarkan nama dan provinsi
        stmt_name = select(KabupatenKota).where(
            KabupatenKota.nama == payload.nama,
            KabupatenKota.provinsi == payload.provinsi
        )
        kab = (await db.execute(stmt_name)).scalar_one_or_none()
        
        if kab:
            # Update kode jika kosong
            if not kab.kode_kemendagri:
                kab.kode_kemendagri = payload.kode_kemendagri
                await db.commit()
                await db.refresh(kab)
        else:
            # Buat baru
            kab = KabupatenKota(
                nama=payload.nama,
                provinsi=payload.provinsi,
                kode_kemendagri=payload.kode_kemendagri
            )
            db.add(kab)
            await db.commit()
            await db.refresh(kab)
            
    return kab

@router.get("/kabupaten", response_model=List[KabupatenResponse])
async def list_kabupaten(db: AsyncSession = Depends(get_db)):
    """Mendapatkan daftar kabupaten/kota untuk form pendaftaran"""
    stmt = select(KabupatenKota).order_by(KabupatenKota.provinsi, KabupatenKota.nama)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/register", response_model=RegistrasiSekolahResponse, status_code=status.HTTP_201_CREATED)
async def register_sekolah(
    payload: RegistrasiSekolahCreate,
    db: AsyncSession = Depends(get_db)
):
    """Mendaftarkan sekolah baru (Public)"""
    # Cek NPSN sudah ada di registrasi?
    stmt1 = select(RegistrasiSekolah).where(RegistrasiSekolah.kode_npsn == payload.kode_npsn)
    if (await db.execute(stmt1)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Kode NPSN sedang dalam proses pendaftaran")
        
    # Cek NPSN sudah ada di master sekolah?
    stmt2 = select(Sekolah).where(Sekolah.kode == payload.kode_npsn)
    if (await db.execute(stmt2)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Kode NPSN sudah terdaftar di sistem")
        
    new_reg = RegistrasiSekolah(
        nama_sekolah=payload.nama_sekolah,
        kode_npsn=payload.kode_npsn,
        alamat=payload.alamat,
        kabupaten_id=uuid.UUID(payload.kabupaten_id),
        nama_pic=payload.nama_pic,
        email_pic=payload.email_pic,
        telepon_pic=payload.telepon_pic,
        status=RegistrasiStatus.PENDING
    )
    
    db.add(new_reg)
    await db.commit()
    await db.refresh(new_reg)
    
    logger.info("New school registration received", npsn=payload.kode_npsn)
    return new_reg


@router.get("/biodata", response_model=SekolahResponse)
async def get_sekolah_biodata(
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Mengambil data profil lengkap sekolah untuk admin/staf sekolah & dinas.
    """
    logger.info("🏫 Admin/Dinas fetching school biodata", admin_id=current_admin.id)
    
    # Dinas Pendidikan bisa melihat semua sekolah (yang dibina, tetapi untuk biodata single, dinas mengambil sekolah miliknya/yang dicari)
    # Jika admin biasa/TU/operator/viewer, hanya bisa melihat sekolahnya sendiri
    sekolah_id = current_admin.sekolah_id
    if not sekolah_id:
        if current_admin.role == AdminRole.SUPER_ADMIN:
            # Super admin default ke sekolah ID 1 jika tidak dispesifikasikan, atau ambil sekolah pertama
            stmt = select(Sekolah).limit(1)
            res = await db.execute(stmt)
            sekolah = res.scalar_one_or_none()
            if not sekolah:
                raise HTTPException(status_code=404, detail="Sekolah belum dikonfigurasi")
            return sekolah
        else:
            raise HTTPException(status_code=403, detail="Akses ditolak. Akun Anda tidak terkait dengan sekolah manapun.")
            
    stmt = select(Sekolah).where(Sekolah.id == sekolah_id)
    res = await db.execute(stmt)
    sekolah = res.scalar_one_or_none()
    if not sekolah:
        raise HTTPException(status_code=404, detail="Sekolah tidak ditemukan")
        
    return sekolah


@router.put("/biodata", response_model=SekolahResponse)
async def update_sekolah_biodata(
    payload: SekolahUpdate,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Memperbarui profil biodata sekolah (Akses: Admin Sekolah / Super Admin).
    """
    logger.info("🏫 Admin updating school biodata", admin_id=current_admin.id)
    
    if current_admin.role not in (AdminRole.ADMIN, AdminRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya Admin Sekolah atau Super Admin yang diijinkan memperbarui profil sekolah"
        )
        
    sekolah_id = current_admin.sekolah_id
    if not sekolah_id and current_admin.role == AdminRole.SUPER_ADMIN:
        # Super admin default ke sekolah pertama
        stmt = select(Sekolah).limit(1)
        res = await db.execute(stmt)
        sekolah = res.scalar_one_or_none()
    else:
        stmt = select(Sekolah).where(Sekolah.id == sekolah_id)
        res = await db.execute(stmt)
        sekolah = res.scalar_one_or_none()
        
    if not sekolah:
        raise HTTPException(status_code=404, detail="Sekolah tidak ditemukan")
        
    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(sekolah, key, val)
        
    await db.commit()
    await db.refresh(sekolah)
    
    logger.info("✅ School biodata updated successfully", sekolah_id=sekolah.id)
    return sekolah


@router.get("/", response_model=List[SekolahResponse])
async def list_sekolah(
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Melihat daftar seluruh sekolah (Khusus Super Admin).
    """
    if current_admin.role != AdminRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Hanya Super Admin yang dapat melihat daftar sekolah")
        
    stmt = select(Sekolah).order_by(Sekolah.nama.asc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/", response_model=SekolahResponse, status_code=status.HTTP_201_CREATED)
async def create_sekolah(
    payload: SekolahCreate,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Mendaftarkan sekolah baru (Khusus Super Admin).
    """
    if current_admin.role != AdminRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Hanya Super Admin yang dapat menambahkan sekolah")
        
    # Check if NPSN already exists
    stmt = select(Sekolah).where(Sekolah.kode == payload.kode)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Kode NPSN sudah terdaftar")
        
    new_sekolah = Sekolah(
        nama=payload.nama,
        kode=payload.kode,
        alamat=payload.alamat,
        kota=payload.kota,
        provinsi=payload.provinsi,
        kode_pos=payload.kode_pos,
        telepon=payload.telepon,
        email=payload.email,
        website=payload.website,
        master_key_hash=hash_password(payload.master_key),
        is_active=True
    )
    db.add(new_sekolah)
    await db.commit()
    await db.refresh(new_sekolah)
    
    # Otomatis buat admin pertama (TU Sekolah)
    from app.models.admin import Admin as AdminModel
    admin_tu = AdminModel(
        username=f"tu_{payload.kode.lower()}",
        email=f"admin@{payload.kode.lower()}.dms.id",
        nama_lengkap=f"Admin TU {payload.nama}",
        password_hash=hash_password(payload.kode),  # Default password = NPSN
        role=AdminRole.TU_SEKOLAH,
        sekolah_id=new_sekolah.id,
        is_active=True,
        is_verified=True
    )
    db.add(admin_tu)
    await db.commit()
    
    logger.info("🏫 New school registered", sekolah_id=new_sekolah.id, admin_id=current_admin.id)
    return new_sekolah


@router.put("/{sekolah_id}/status", response_model=SekolahResponse)
async def toggle_sekolah_status(
    sekolah_id: int,
    is_active: bool,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Mengaktifkan / menonaktifkan akses sekolah (Khusus Super Admin).
    """
    if current_admin.role != AdminRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Hanya Super Admin yang dapat mengubah status sekolah")
        
    stmt = select(Sekolah).where(Sekolah.id == sekolah_id)
    res = await db.execute(stmt)
    sekolah = res.scalar_one_or_none()
    
    if not sekolah:
        raise HTTPException(status_code=404, detail="Sekolah tidak ditemukan")
        
    sekolah.is_active = is_active
    await db.commit()
    await db.refresh(sekolah)
    
    action_str = "activated" if is_active else "deactivated"
    logger.info(f"🏫 School {action_str}", sekolah_id=sekolah_id, admin_id=current_admin.id)
    return sekolah

class SindasConfigResponse(BaseModel):
    sindas_api_url: Optional[str] = None
    sindas_api_key: Optional[str] = None

class SindasConfigUpdate(BaseModel):
    sindas_api_url: Optional[str] = None
    sindas_api_key: Optional[str] = None

@router.get("/sindas-config", response_model=SindasConfigResponse)
async def get_sindas_config(
    current_admin: Admin = Depends(get_tu_sekolah),
    db: AsyncSession = Depends(get_db)
):
    """Mendapatkan konfigurasi SINDAS API untuk sekolah operator yang sedang login"""
    sekolah_id = current_admin.sekolah_id
    if not sekolah_id:
        raise HTTPException(status_code=403, detail="Akun Anda tidak terkait dengan sekolah manapun")
        
    stmt = select(Sekolah).where(Sekolah.id == sekolah_id)
    sekolah = (await db.execute(stmt)).scalar_one_or_none()
    if not sekolah:
        raise HTTPException(status_code=404, detail="Sekolah tidak ditemukan")
        
    return SindasConfigResponse(
        sindas_api_url=sekolah.sindas_api_url,
        sindas_api_key=sekolah.sindas_api_key
    )

@router.put("/sindas-config", response_model=SindasConfigResponse)
async def update_sindas_config(
    payload: SindasConfigUpdate,
    current_admin: Admin = Depends(get_tu_sekolah),
    db: AsyncSession = Depends(get_db)
):
    """Memperbarui konfigurasi SINDAS API untuk sekolah operator yang sedang login"""
    sekolah_id = current_admin.sekolah_id
    if not sekolah_id:
        raise HTTPException(status_code=403, detail="Akun Anda tidak terkait dengan sekolah manapun")
        
    stmt = select(Sekolah).where(Sekolah.id == sekolah_id)
    sekolah = (await db.execute(stmt)).scalar_one_or_none()
    if not sekolah:
        raise HTTPException(status_code=404, detail="Sekolah tidak ditemukan")
        
    if payload.sindas_api_url is not None:
        sekolah.sindas_api_url = payload.sindas_api_url
    if payload.sindas_api_key is not None:
        sekolah.sindas_api_key = payload.sindas_api_key
        
    await db.commit()
    await db.refresh(sekolah)
    
    logger.info("✅ SINDAS API configuration updated for school", sekolah_id=sekolah.id, admin_id=current_admin.id)
    return SindasConfigResponse(
        sindas_api_url=sekolah.sindas_api_url,
        sindas_api_key=sekolah.sindas_api_key
    )

