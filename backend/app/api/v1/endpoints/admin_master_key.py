from datetime import datetime, timezone
import os
import shutil
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, AsyncSessionLocal
from app.core.dependencies import get_super_admin
from app.core.crypto import generate_master_key, unwrap_student_key, wrap_student_key
from app.models.admin import Admin
from app.models.sekolah import Sekolah
from app.models.dokumen import Dokumen
from app.models.siswa import Siswa
from app.models.audit_log import AuditLog, UserType, AuditAction, AuditStatus

router = APIRouter()

SECRETS_DIR = "/app/.secrets"

class RotateKeyRequest(BaseModel):
    confirm: str

class MasterKeyStatusResponse(BaseModel):
    mk_version: int
    active_public_key: str | None
    status: str
    total_dokumen: int

class SchoolMasterKeyStatus(BaseModel):
    id: int
    nama: str
    npsn: str
    mk_version: int
    public_key_pem: str | None
    status: str
    total_dokumen: int
    is_active: bool


@router.get("/status", response_model=MasterKeyStatusResponse)
async def get_master_key_status(
    sekolah_id: Optional[int] = Query(None, description="Filter berdasarkan ID sekolah"),
    current_admin: Admin = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    target_sekolah_id = sekolah_id or current_admin.sekolah_id
    if not target_sekolah_id:
        # Jika super_admin tidak menyertakan sekolah_id, coba cari sekolah pertama di database
        first_sch = await db.scalar(select(Sekolah.id).limit(1))
        if first_sch:
            target_sekolah_id = first_sch
        else:
            raise HTTPException(status_code=404, detail="Sekolah tidak ditemukan")

    sekolah = await db.scalar(select(Sekolah).where(Sekolah.id == target_sekolah_id))
    if not sekolah:
        raise HTTPException(status_code=404, detail="Sekolah tidak ditemukan")

    # Hitung total dokumen
    stmt = select(func.count(Dokumen.id)).join(Siswa).where(Siswa.sekolah_id == target_sekolah_id)
    total_dokumen = await db.scalar(stmt)

    status_str = "active" if sekolah.mk_version > 0 else "not_setup"

    return MasterKeyStatusResponse(
        mk_version=sekolah.mk_version,
        active_public_key=sekolah.public_key_pem,
        status=status_str,
        total_dokumen=total_dokumen or 0,
    )


@router.get("/schools", response_model=list[SchoolMasterKeyStatus])
async def list_schools_master_keys(
    current_admin: Admin = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Melihat daftar status Kunci Master untuk seluruh sekolah terdaftar (Khusus Super Admin)."""
    stmt = select(Sekolah).order_by(Sekolah.nama.asc())
    res = await db.execute(stmt)
    sekolah_list = res.scalars().all()
    
    response = []
    for s in sekolah_list:
        doc_stmt = select(func.count(Dokumen.id)).join(Siswa).where(Siswa.sekolah_id == s.id)
        total_docs = await db.scalar(doc_stmt) or 0
        
        status_str = "active" if s.mk_version > 0 else "not_setup"
        
        response.append(
            SchoolMasterKeyStatus(
                id=s.id,
                nama=s.nama,
                npsn=s.kode,
                mk_version=s.mk_version,
                public_key_pem=s.public_key_pem,
                status=status_str,
                total_dokumen=total_docs,
                is_active=s.is_active
            )
        )
    return response


async def process_key_rotation(
    sekolah_id: int, 
    old_version: int, 
    new_version: int, 
    old_private_key_pem: str | None, 
    new_public_key_pem: str, 
    admin_id: int
):
    """
    Tugas background untuk melakukan re-wrapping kunci dokumen.
    """
    try:
        async with AsyncSessionLocal() as db:
            stmt = select(Dokumen).join(Siswa).where(Siswa.sekolah_id == sekolah_id)
            result = await db.execute(stmt)
            dokumen_list = result.scalars().all()
            
            success_count = 0
            error_count = 0

            for doc in dokumen_list:
                try:
                    student_key = None
                    if old_private_key_pem and doc.key_wrapped:
                        student_key = unwrap_student_key(doc.key_wrapped, old_private_key_pem)
                    
                    if student_key:
                        new_wrapped_key = wrap_student_key(student_key, new_public_key_pem)
                        doc.key_wrapped = new_wrapped_key
                        doc.mk_version = new_version
                        success_count += 1
                except Exception as e:
                    print(f"[Rotasi] Gagal re-wrap dokumen ID {doc.id}: {e}")
                    error_count += 1
                    
            # Catat di Audit Log
            audit = AuditLog(
                user_id=admin_id,
                user_type=UserType.ADMIN,
                action=AuditAction.KEY_ROTATION,
                resource_type="sekolah",
                resource_id=sekolah_id,
                detail={
                    "old_version": old_version,
                    "new_version": new_version,
                    "dokumen_berhasil": success_count,
                    "dokumen_gagal": error_count,
                },
                ip_address="127.0.0.1",
                status=AuditStatus.SUCCESS
            )
            db.add(audit)
            await db.commit()
    except Exception as ex:
        print(f"[Rotasi] Fatal error: {ex}")


@router.post("/rotate")
async def rotate_master_key(
    req: RotateKeyRequest,
    background_tasks: BackgroundTasks,
    sekolah_id: Optional[int] = Query(None, description="Target ID sekolah yang akan dirotasi"),
    current_admin: Admin = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    if req.confirm != "ROTASI KUNCI MASTER":
        raise HTTPException(status_code=400, detail="Konfirmasi rotasi tidak valid")
        
    target_sekolah_id = sekolah_id or current_admin.sekolah_id
    if not target_sekolah_id:
        raise HTTPException(status_code=400, detail="ID sekolah tidak dispesifikasikan")
        
    sekolah = await db.scalar(select(Sekolah).where(Sekolah.id == target_sekolah_id))
    if not sekolah:
        raise HTTPException(status_code=404, detail="Sekolah tidak ditemukan")

    os.makedirs(SECRETS_DIR, exist_ok=True)
    
    old_version = sekolah.mk_version
    new_version = old_version + 1
    
    old_private_key_pem = None
    if old_version > 0:
        old_key_path = os.path.join(SECRETS_DIR, f"master_key_sekolah_{target_sekolah_id}_v{old_version}.pem")
        legacy_key_path = os.path.join(SECRETS_DIR, f"master_key_v{old_version}.pem")
        
        if os.path.exists(old_key_path):
            with open(old_key_path, "r") as f:
                old_private_key_pem = f.read()
        elif os.path.exists(legacy_key_path):
            with open(legacy_key_path, "r") as f:
                old_private_key_pem = f.read()
        else:
            raise HTTPException(
                status_code=500, 
                detail=f"Private key lama (v{old_version}) untuk sekolah ini tidak ditemukan. Tidak dapat melakukan rotasi."
            )
            
    # Generate kunci baru
    new_public_pem, new_private_pem = generate_master_key()
    
    # Simpan kunci baru
    new_key_path = os.path.join(SECRETS_DIR, f"master_key_sekolah_{target_sekolah_id}_v{new_version}.pem")
    with open(new_key_path, "w") as f:
        f.write(new_private_pem)
        
    # Update DB (Public Key)
    sekolah.public_key_pem = new_public_pem
    sekolah.mk_version = new_version
    
    # Audit log (awal rotasi)
    audit = AuditLog(
        user_id=current_admin.id,
        user_type=UserType.ADMIN,
        action="init_key_rotation",
        resource_type="sekolah",
        resource_id=sekolah.id,
        detail={"new_version": new_version},
        ip_address="127.0.0.1",
        status=AuditStatus.SUCCESS
    )
    db.add(audit)
    
    await db.commit()
    
    # Cek jumlah dokumen untuk re-wrapping
    stmt = select(func.count(Dokumen.id)).join(Siswa).where(Siswa.sekolah_id == target_sekolah_id)
    total_dokumen = await db.scalar(stmt)
    
    if total_dokumen and total_dokumen > 0:
        background_tasks.add_task(
            process_key_rotation,
            sekolah.id, 
            old_version, 
            new_version, 
            old_private_key_pem, 
            new_public_pem, 
            current_admin.id
        )

    return {"message": "Master Key berhasil dibuat/dirotasi", "version": new_version}
