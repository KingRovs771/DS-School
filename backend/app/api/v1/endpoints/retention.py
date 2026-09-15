"""
Retention Policy & Legal Hold Endpoints
=========================================
Mengelola kebijakan retensi dokumen per sekolah dan status Legal Hold.

Endpoints:
    GET    /admin/retention-policy              — list kebijakan (Dinas & Super Admin)
    POST   /admin/retention-policy              — buat kebijakan baru (Dinas ONLY - Bulk)
    PUT    /admin/retention-policy/{jenis_dok}  — update kebijakan (Dinas ONLY - Bulk)
    DELETE /admin/retention-policy/{jenis_dok}  — hapus kebijakan (Dinas ONLY - Bulk)
    GET    /admin/dokumen/akan-expired          — dokumen akan kadaluarsa dalam N hari
    POST   /admin/dokumen/{doc_id}/legal-hold   — set legal hold (Dinas ONLY)
    DELETE /admin/dokumen/{doc_id}/legal-hold   — unset legal hold (Dinas ONLY)
"""
import structlog
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Union
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import decode_token
from app.core.dependencies import security
from app.models.admin import Admin
from app.models.wilayah import DinasAdmin, KabupatenKota
from app.models.sekolah import Sekolah
from app.models.dokumen import Dokumen
from app.models.siswa import Siswa
from app.models.retention import RetentionPolicy, RetentionLog
from app.models.audit_log import AuditLog, UserType, AuditStatus
from app.schemas.retention import (
    RetentionPolicyCreate,
    RetentionPolicyUpdate,
    RetentionPolicyRead,
    LegalHoldSetRequest,
    LegalHoldRead,
    DokumenAkanExpiredItem,
    RetentionLogRead,
)

logger = structlog.get_logger(__name__)
router = APIRouter()

# ─── Custom Dependency ────────────────────────────────────────────────────────
async def get_retention_manager(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Union[DinasAdmin, Admin]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token tidak valid atau kadaluarsa",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        role = payload.get("role")
        logger.error(f"DEBUG_RETENTION_PAYLOAD: {payload}")
        subject = payload.get("sub", "")
        if not subject:
            raise credentials_exception

        if role == "dinas_pendidikan":
            if subject.startswith("dinas:"):
                dinas_id = subject.split(":")[1]
            elif subject.startswith("admin:"):
                dinas_id = subject.split(":")[1]
            else:
                raise credentials_exception
            
            result = await db.execute(select(DinasAdmin).where(DinasAdmin.id == dinas_id))
            dinas = result.scalar_one_or_none()
            if not dinas or not dinas.is_active:
                raise HTTPException(status_code=403, detail="Akun dinas tidak aktif")
            return dinas
            
        elif role == "super_admin":
            if not subject.startswith("admin:"):
                raise credentials_exception
            admin_id = int(subject.split(":")[1])
            result = await db.execute(select(Admin).where(Admin.id == admin_id))
            admin = result.scalar_one_or_none()
            logger.error(f"DEBUG_SUPER_ADMIN: subject={subject}, role={role}, admin={admin}, is_active={admin.is_active if admin else None}, db_role={admin.role if admin else None}, role_value={getattr(admin.role, 'value', admin.role) if admin else None}")
            if not admin or not admin.is_active or getattr(admin.role, 'value', admin.role) != "super_admin":
                logger.error(f"DEBUG: Raising 403 for super_admin")
                raise HTTPException(status_code=403, detail="Akses ditolak")
            logger.error(f"DEBUG: Returning admin for super_admin")
            return admin
        else:
            logger.error(f"DEBUG_ROLE: Unknown role '{role}' with subject '{subject}'. Payload: {payload}")
            raise HTTPException(status_code=403, detail="Hanya Dinas Pendidikan atau Super Admin yang diijinkan")
            
    except HTTPException:
        raise
    except Exception:
        raise credentials_exception


# ─── Retention Policy CRUD ────────────────────────────────────────────────────

@router.get(
    "/retention-policy",
    response_model=List[RetentionPolicyRead],
    summary="List kebijakan retensi (Global Dinas)",
)
async def list_retention_policies(
    sekolah_id: Optional[int] = Query(None, description="Filter berdasarkan ID sekolah"),
    manager: Union[DinasAdmin, Admin] = Depends(get_retention_manager),
    db: AsyncSession = Depends(get_db),
):
    """List kebijakan retensi. 
    Jika sekolah_id tidak disediakan, dinas admin melihat seluruh kebijakan sekolah di wilayahnya,
    dan super_admin melihat seluruh kebijakan.
    """
    query = select(RetentionPolicy).order_by(RetentionPolicy.sekolah_id, RetentionPolicy.jenis_dok)
    
    if isinstance(manager, DinasAdmin):
        # Cari semua sekolah di wilayah Dinas
        res_sekolah = await db.execute(select(Sekolah.id).where(Sekolah.kabupaten_id == manager.kabupaten_id))
        school_ids = [row[0] for row in res_sekolah.all()]
        if not school_ids:
            return []
        query = query.where(RetentionPolicy.sekolah_id.in_(school_ids))
        
        if sekolah_id:
            if sekolah_id not in school_ids:
                raise HTTPException(status_code=403, detail="Sekolah di luar wilayah Anda")
            query = query.where(RetentionPolicy.sekolah_id == sekolah_id)
    else:
        if sekolah_id:
            query = query.where(RetentionPolicy.sekolah_id == sekolah_id)
            
    result = await db.execute(query)
    return result.scalars().all()


@router.post(
    "/retention-policy",
    response_model=RetentionPolicyRead,
    status_code=status.HTTP_201_CREATED,
    summary="Buat kebijakan retensi baru",
)
async def create_retention_policy(
    body: RetentionPolicyCreate,
    manager: Union[DinasAdmin, Admin] = Depends(get_retention_manager),
    db: AsyncSession = Depends(get_db),
):
    """Buat kebijakan retensi untuk sekolah tertentu."""
    if not isinstance(manager, DinasAdmin):
        raise HTTPException(status_code=403, detail="Hanya Dinas Pendidikan yang dapat membuat kebijakan")

    # Verifikasi sekolah berada di wilayah Dinas
    stmt_sekolah = select(Sekolah).where(
        Sekolah.id == body.sekolah_id,
        Sekolah.kabupaten_id == manager.kabupaten_id
    )
    sekolah = (await db.execute(stmt_sekolah)).scalar_one_or_none()
    if not sekolah:
        raise HTTPException(status_code=403, detail="Sekolah ini tidak terdaftar di wilayah pantauan Anda")

    existing = await db.execute(select(RetentionPolicy).where(
        RetentionPolicy.sekolah_id == body.sekolah_id,
        RetentionPolicy.jenis_dok == body.jenis_dok,
    ))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Kebijakan untuk '{body.jenis_dok}' di sekolah ini sudah ada")

    policy = RetentionPolicy(
        sekolah_id=body.sekolah_id,
        jenis_dok=body.jenis_dok,
        durasi_hari=body.durasi_hari,
        aksi_setelah=body.aksi_setelah,
        notif_hari_sebelum=body.notif_hari_sebelum,
        is_active=body.is_active,
        created_by=None,
    )
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    logger.info("Retention policy dibuat", sekolah_id=body.sekolah_id, jenis_dok=body.jenis_dok, dinas_id=str(manager.id))
    return policy


@router.put(
    "/retention-policy/{policy_id}",
    response_model=RetentionPolicyRead,
    summary="Update kebijakan retensi",
)
async def update_retention_policy(
    policy_id: int,
    body: RetentionPolicyUpdate,
    manager: Union[DinasAdmin, Admin] = Depends(get_retention_manager),
    db: AsyncSession = Depends(get_db),
):
    """Update kebijakan retensi spesifik."""
    if not isinstance(manager, DinasAdmin):
        raise HTTPException(status_code=403, detail="Hanya Dinas Pendidikan yang dapat mengubah kebijakan")

    ref_policy = (await db.execute(select(RetentionPolicy).where(RetentionPolicy.id == policy_id))).scalar_one_or_none()
    if not ref_policy:
        raise HTTPException(status_code=404, detail="Kebijakan tidak ditemukan")

    # Verifikasi kepemilikan wilayah
    stmt_check = select(Sekolah).where(
        Sekolah.id == ref_policy.sekolah_id,
        Sekolah.kabupaten_id == manager.kabupaten_id
    )
    if not (await db.execute(stmt_check)).scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Kebijakan sekolah di luar wilayah pantauan Anda")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ref_policy, field, value)
    ref_policy.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(ref_policy)
    return ref_policy


@router.delete(
    "/retention-policy/{policy_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Hapus kebijakan retensi",
)
async def delete_retention_policy(
    policy_id: int,
    manager: Union[DinasAdmin, Admin] = Depends(get_retention_manager),
    db: AsyncSession = Depends(get_db),
):
    """Hapus kebijakan retensi spesifik."""
    if not isinstance(manager, DinasAdmin):
        raise HTTPException(status_code=403, detail="Hanya Dinas Pendidikan yang dapat menghapus kebijakan")

    ref_policy = (await db.execute(select(RetentionPolicy).where(RetentionPolicy.id == policy_id))).scalar_one_or_none()
    if not ref_policy:
        raise HTTPException(status_code=404, detail="Kebijakan tidak ditemukan")

    # Verifikasi kepemilikan wilayah
    stmt_check = select(Sekolah).where(
        Sekolah.id == ref_policy.sekolah_id,
        Sekolah.kabupaten_id == manager.kabupaten_id
    )
    if not (await db.execute(stmt_check)).scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Kebijakan sekolah di luar wilayah pantauan Anda")

    await db.execute(delete(RetentionPolicy).where(
        RetentionPolicy.id == policy_id
    ))
    
    await db.commit()


# ─── Dokumen Akan Expired ─────────────────────────────────────────────────────

@router.get(
    "/dokumen/akan-expired",
    response_model=List[DokumenAkanExpiredItem],
    summary="List dokumen yang akan kadaluarsa",
)
async def list_dokumen_akan_expired(
    hari: int = Query(30, ge=1, le=365, description="Tampilkan dokumen yang akan expired dalam N hari"),
    manager: Union[DinasAdmin, Admin] = Depends(get_retention_manager),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=hari)

    query = (
        select(Dokumen)
        .options(selectinload(Dokumen.siswa))
        .where(
            and_(
                Dokumen.retention_expires_at != None,
                Dokumen.retention_expires_at >= now,
                Dokumen.retention_expires_at <= horizon,
                Dokumen.legal_hold == False,
            )
        )
        .order_by(Dokumen.retention_expires_at)
    )

    if isinstance(manager, DinasAdmin):
        res_sekolah = await db.execute(select(Sekolah.id).where(Sekolah.kabupaten_id == manager.kabupaten_id))
        school_ids = [row[0] for row in res_sekolah.all()]
        if not school_ids:
            return []
        
        result_siswa = await db.execute(select(Siswa.id).where(Siswa.sekolah_id.in_(school_ids)))
        siswa_ids = [r[0] for r in result_siswa.fetchall()]
        if not siswa_ids:
            return []
        query = query.where(Dokumen.siswa_id.in_(siswa_ids))

    result = await db.execute(query)
    docs = result.scalars().all()

    items = []
    for doc in docs:
        sisa = max(0, (doc.retention_expires_at - now).days)
        items.append(DokumenAkanExpiredItem(
            id=doc.id,
            jenis_dok=doc.jenis_dok,
            tahun_ajaran=doc.tahun_ajaran,
            siswa_id=doc.siswa_id,
            siswa_nama=doc.siswa.nama_lengkap if doc.siswa else "-",
            siswa_nisn=doc.siswa.nisn if doc.siswa else "-",
            sekolah_id=doc.siswa.sekolah_id if doc.siswa else 0,
            retention_expires_at=doc.retention_expires_at,
            sisa_hari=sisa,
            legal_hold=doc.legal_hold,
            status=doc.status.value if hasattr(doc.status, "value") else str(doc.status),
        ))
    return items


# ─── Legal Hold ───────────────────────────────────────────────────────────────

@router.post(
    "/dokumen/{doc_id}/legal-hold",
    response_model=LegalHoldRead,
    summary="Set Legal Hold pada dokumen",
)
async def set_legal_hold(
    doc_id: int,
    body: LegalHoldSetRequest,
    request: Request,
    manager: Union[DinasAdmin, Admin] = Depends(get_retention_manager),
    db: AsyncSession = Depends(get_db),
):
    if not isinstance(manager, DinasAdmin):
        raise HTTPException(status_code=403, detail="Hanya Dinas Pendidikan yang dapat mengelola Legal Hold")

    doc = (await db.execute(
        select(Dokumen).options(selectinload(Dokumen.siswa)).where(Dokumen.id == doc_id)
    )).scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    if doc.legal_hold:
        raise HTTPException(status_code=409, detail="Dokumen sudah dalam status Legal Hold")

    sekolah = (await db.execute(select(Sekolah).where(Sekolah.id == doc.siswa.sekolah_id))).scalar_one_or_none()
    if not sekolah or sekolah.kabupaten_id != manager.kabupaten_id:
        raise HTTPException(status_code=403, detail="Dokumen di luar wilayah Anda")

    now = datetime.now(timezone.utc)
    doc.legal_hold = True
    doc.legal_hold_by = None 
    doc.legal_hold_at = now
    doc.legal_hold_alasan = body.alasan

    db.add(AuditLog(
        user_id=None,
        user_id_str=str(manager.id),
        user_type=UserType.DINAS,
        action="legal_hold_set",
        dokumen_id=doc.id,
        resource_type="dokumen",
        resource_id=doc.id,
        ip_address=request.client.host if request.client else "unknown",
        endpoint=str(request.url),
        http_method="POST",
    ))

    db.add(RetentionLog(
        dokumen_id=doc.id,
        aksi="legal_hold_set",
        alasan=body.alasan,
        dilakukan_oleh=None,
    ))

    await db.commit()
    await db.refresh(doc)
    logger.info("Legal hold SET by dinas", doc_id=doc_id, dinas_id=str(manager.id))

    return LegalHoldRead(
        dokumen_id=doc.id,
        legal_hold=doc.legal_hold,
        legal_hold_at=doc.legal_hold_at,
        legal_hold_alasan=doc.legal_hold_alasan,
        legal_hold_by=doc.legal_hold_by,
    )


@router.delete(
    "/dokumen/{doc_id}/legal-hold",
    response_model=LegalHoldRead,
    summary="Release Legal Hold",
)
async def unset_legal_hold(
    doc_id: int,
    request: Request,
    manager: Union[DinasAdmin, Admin] = Depends(get_retention_manager),
    db: AsyncSession = Depends(get_db),
):
    if not isinstance(manager, DinasAdmin):
        raise HTTPException(status_code=403, detail="Hanya Dinas Pendidikan yang dapat mengelola Legal Hold")

    doc = (await db.execute(
        select(Dokumen).options(selectinload(Dokumen.siswa)).where(Dokumen.id == doc_id)
    )).scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    if not doc.legal_hold:
        raise HTTPException(status_code=409, detail="Dokumen tidak dalam status Legal Hold")

    sekolah = (await db.execute(select(Sekolah).where(Sekolah.id == doc.siswa.sekolah_id))).scalar_one_or_none()
    if not sekolah or sekolah.kabupaten_id != manager.kabupaten_id:
        raise HTTPException(status_code=403, detail="Dokumen di luar wilayah Anda")

    doc.legal_hold = False
    doc.legal_hold_by = None
    doc.legal_hold_at = None
    doc.legal_hold_alasan = None

    db.add(AuditLog(
        user_id=None,
        user_id_str=str(manager.id),
        user_type=UserType.DINAS,
        action="legal_hold_released",
        dokumen_id=doc.id,
        resource_type="dokumen",
        resource_id=doc.id,
        ip_address=request.client.host if request.client else "unknown",
        endpoint=str(request.url),
        http_method="DELETE",
    ))

    db.add(RetentionLog(
        dokumen_id=doc.id,
        aksi="legal_hold_released",
        alasan=f"Dilepas oleh Dinas Pendidikan",
        dilakukan_oleh=None,
    ))

    await db.commit()
    await db.refresh(doc)
    logger.info("Legal hold RELEASED by dinas", doc_id=doc_id, dinas_id=str(manager.id))

    return LegalHoldRead(
        dokumen_id=doc.id,
        legal_hold=doc.legal_hold,
        legal_hold_at=doc.legal_hold_at,
        legal_hold_alasan=doc.legal_hold_alasan,
        legal_hold_by=doc.legal_hold_by,
    )