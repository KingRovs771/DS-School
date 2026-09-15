import io
import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, AsyncSessionLocal
from app.core.dependencies import get_current_admin, get_super_admin
from app.services.backup_service import backup_service
from app.models.backup import BackupRecord
from app.models.admin import Admin
from app.models.audit_log import AuditLog, UserType, AuditStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/backup", tags=["Backup & Restore"])

MAX_RESTORE_SIZE = 2 * 1024 * 1024 * 1024  # 2GB max upload

async def _run_backup_task(record_id: str, admin_id: int):
    logger.info("Starting background manual backup task", record_id=record_id, admin_id=admin_id)
    async with AsyncSessionLocal() as db:
        record_uuid = uuid.UUID(record_id)
        record = await db.get(BackupRecord, record_uuid)
        if not record:
            logger.error("BackupRecord not found in background task", record_id=record_id)
            return

        try:
            result = backup_service.create_backup(dibuat_oleh_id=admin_id)
            record.nama_file = result["nama_file"]
            record.ukuran_bytes = result["ukuran_bytes"]
            record.checksum_sha256 = result["checksum_sha256"]
            record.manifest_json = result["manifest_json"]
            record.storage_path = result["storage_path"]
            record.status = "done"
            record.completed_at = datetime.now(timezone.utc)
            await db.commit()

            audit = AuditLog(
                user_id=admin_id,
                user_type=UserType.ADMIN,
                action="backup_created",
                ip_address="127.0.0.1",
                status=AuditStatus.SUCCESS,
                detail={"backup_id": record_id, "tipe": "manual"}
            )
            db.add(audit)
            await db.commit()
            logger.info("Background manual backup task completed successfully", record_id=record_id)
        except Exception as e:
            logger.error("Background manual backup task failed", record_id=record_id, error=str(e))
            record.status = "failed"
            record.error_message = str(e)
            record.completed_at = datetime.now(timezone.utc)
            await db.commit()

            audit = AuditLog(
                user_id=admin_id,
                user_type=UserType.ADMIN,
                action="backup_created",
                ip_address="127.0.0.1",
                status=AuditStatus.FAILED,
                error_message=str(e),
                detail={"backup_id": record_id, "tipe": "manual"}
            )
            db.add(audit)
            await db.commit()

@router.post("/create")
async def create_backup_manual(
    background_tasks: BackgroundTasks,
    admin: Admin = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Trigger backup manual. Proses berjalan di background."""
    # Buat record pending dulu
    record = BackupRecord(
        nama_file="pending...",
        ukuran_bytes=0,
        checksum_sha256="",
        manifest_json={},
        status="running",
        tipe="manual",
        dibuat_oleh=admin.id
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    # Jalankan di background
    background_tasks.add_task(_run_backup_task, str(record.id), admin.id)

    return {"backup_id": str(record.id), "status": "running",
            "message": "Backup sedang berjalan. Cek status via GET /admin/backup/{id}/status"}

@router.get("")
async def list_backups(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """List semua backup tersedia (terbaru di atas)"""
    records = await db.execute(
        select(BackupRecord).order_by(desc(BackupRecord.created_at)).limit(50)
    )
    return {"data": [
        {
            "id": str(r.id),
            "nama_file": r.nama_file,
            "ukuran_mb": round(r.ukuran_bytes / 1e6, 2),
            "status": r.status,
            "tipe": r.tipe,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "restored_at": r.restored_at.isoformat() if r.restored_at else None,
        }
        for r in records.scalars()
    ]}

@router.get("/{backup_id}/status")
async def get_backup_status(
    backup_id: str,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Cek status backup (berguna untuk polling saat backup berjalan)"""
    record = await db.get(BackupRecord, uuid.UUID(backup_id))
    if not record:
        raise HTTPException(404, "Backup tidak ditemukan")
    return {"id": backup_id, "status": record.status,
            "nama_file": record.nama_file,
            "error": record.error_message}

@router.get("/{backup_id}/download")
async def download_backup(
    backup_id: str,
    admin: Admin = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Download file .dms.bak — hanya Super Admin"""
    record = await db.get(BackupRecord, uuid.UUID(backup_id))
    if not record:
        raise HTTPException(404, "Backup tidak ditemukan")
    if record.status != "done":
        raise HTTPException(400, f"Backup belum siap (status: {record.status})")

    # Ambil stream dari MinIO
    stream = backup_service.get_download_stream(record.storage_path)

    # Catat di audit_log
    audit = AuditLog(
        user_id=admin.id,
        user_type=UserType.ADMIN,
        action="backup_downloaded",
        ip_address="0.0.0.0",
        status=AuditStatus.SUCCESS,
        detail={"backup_id": backup_id, "nama_file": record.nama_file}
    )
    db.add(audit)
    await db.commit()

    return StreamingResponse(
        stream,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{record.nama_file}"',
            "Content-Length": str(record.ukuran_bytes),
            "X-Checksum-SHA256": record.checksum_sha256
        }
    )

@router.post("/restore/verify")
async def verify_backup(
    file: UploadFile = File(...),
    admin: Admin = Depends(get_super_admin)
):
    """
    DRY RUN — verifikasi file .dms.bak tanpa eksekusi restore.
    Jalankan ini dulu sebelum restore sesungguhnya.
    """
    if not file.filename.endswith(".dms.bak"):
        raise HTTPException(422, "File harus berekstensi .dms.bak")

    content = await file.read()
    if len(content) > MAX_RESTORE_SIZE:
        raise HTTPException(413, "File terlalu besar (maks 2GB)")

    result = backup_service.restore_backup(content, dry_run=True)
    return result

@router.post("/restore")
async def restore_backup(
    file: UploadFile = File(...),
    konfirmasi: str = "SAYA MENGERTI RESTORE AKAN MENIMPA DATA SAAT INI",
    admin: Admin = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    RESTORE SESUNGGUHNYA — hanya Super Admin.
    Wajib sertakan konfirmasi string yang tepat.
    PERINGATAN: Semua data saat ini akan ditimpa!
    """
    KONFIRMASI_STRING = "SAYA MENGERTI RESTORE AKAN MENIMPA DATA SAAT INI"
    if konfirmasi != KONFIRMASI_STRING:
        raise HTTPException(400, f"Konfirmasi tidak valid. Ketik persis: {KONFIRMASI_STRING}")

    if not file.filename.endswith(".dms.bak"):
        raise HTTPException(422, "File harus berekstensi .dms.bak")

    content = await file.read()
    if len(content) > MAX_RESTORE_SIZE:
        raise HTTPException(413, "File terlalu besar (maks 2GB)")

    # Catat intent di audit_log SEBELUM eksekusi
    db.add(AuditLog(
        user_id=admin.id,
        user_type=UserType.ADMIN,
        action="restore_started",
        ip_address="0.0.0.0",
        status=AuditStatus.SUCCESS,
        detail={"file_name": file.filename, "ukuran": len(content)}
    ))
    await db.commit()

    result = backup_service.restore_backup(content, dry_run=False)

    # Bersihkan connection pool agar asyncpg memuat ulang type OIDs yang berubah akibat restore
    await db.bind.dispose()

    # Gunakan session baru dengan koneksi baru agar tidak terkena cache lookup error
    async with AsyncSessionLocal() as new_db:
        new_db.add(AuditLog(
            user_id=admin.id,
            user_type=UserType.ADMIN,
            action="restore_completed" if result["success"] else "restore_failed",
            ip_address="0.0.0.0",
            status=AuditStatus.SUCCESS if result["success"] else AuditStatus.FAILED,
            detail=result
        ))
        await new_db.commit()

    if not result["success"]:
        raise HTTPException(500, detail=result)

    return result
