import io
import uuid
from typing import Optional
import logging
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status, Query, Header, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, AsyncSessionLocal
from app.core.dependencies import get_current_admin, get_super_admin, get_client_ip, get_client_user_agent
from app.core.security import decode_token
from app.services.backup_service import backup_service
from app.models.backup import BackupRecord, BackupScheduleConfig
from app.models.admin import Admin
from app.models.audit_log import AuditLog, UserType, AuditStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/backup", tags=["Backup & Restore"])

MAX_RESTORE_SIZE = 2 * 1024 * 1024 * 1024  # 2GB max upload


class BackupScheduleResponse(BaseModel):
    is_active: bool
    frequency: str
    time_of_day: str
    day_of_week: Optional[int] = None
    day_of_month: Optional[int] = None
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BackupScheduleUpdateRequest(BaseModel):
    is_active: bool
    frequency: str = Field("daily", pattern="^(daily|weekly|monthly)$")
    time_of_day: str = Field("02:00", pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    day_of_week: Optional[int] = Field(0, ge=0, le=6)
    day_of_month: Optional[int] = Field(1, ge=1, le=31)


def calculate_next_run(
    is_active: bool,
    frequency: str,
    time_of_day: str,
    day_of_week: Optional[int] = 0,
    day_of_month: Optional[int] = 1,
) -> Optional[datetime]:
    if not is_active:
        return None

    try:
        hour, minute = map(int, time_of_day.split(":"))
    except Exception:
        hour, minute = 2, 0

    wib = ZoneInfo("Asia/Jakarta")
    now_wib = datetime.now(wib)

    if frequency == "daily":
        candidate = now_wib.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= now_wib:
            candidate += timedelta(days=1)
        return candidate.astimezone(timezone.utc)

    elif frequency == "weekly":
        target_day = day_of_week if day_of_week is not None else 0  # 0=Monday
        days_ahead = (target_day - now_wib.weekday()) % 7
        candidate = (now_wib + timedelta(days=days_ahead)).replace(
            hour=hour, minute=minute, second=0, microsecond=0
        )
        if days_ahead == 0 and candidate <= now_wib:
            candidate += timedelta(days=7)
        return candidate.astimezone(timezone.utc)

    elif frequency == "monthly":
        target_day = day_of_month if day_of_month is not None else 1
        target_day = max(1, min(target_day, 28))
        try:
            candidate = now_wib.replace(day=target_day, hour=hour, minute=minute, second=0, microsecond=0)
        except ValueError:
            candidate = now_wib.replace(day=28, hour=hour, minute=minute, second=0, microsecond=0)

        if candidate <= now_wib:
            year = now_wib.year + (1 if now_wib.month == 12 else 0)
            month = 1 if now_wib.month == 12 else now_wib.month + 1
            candidate = candidate.replace(year=year, month=month)

        return candidate.astimezone(timezone.utc)

    return None

async def _run_backup_task(record_id: str, admin_id: int, client_ip: str = "127.0.0.1", client_ua: str = "Unknown"):
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
                ip_address=client_ip,
                user_agent=client_ua,
                endpoint="/api/v1/admin/backup/create",
                http_method="POST",
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
                ip_address=client_ip,
                user_agent=client_ua,
                endpoint="/api/v1/admin/backup/create",
                http_method="POST",
                status=AuditStatus.FAILED,
                error_message=str(e),
                detail={"backup_id": record_id, "tipe": "manual"}
            )
            db.add(audit)
            await db.commit()

@router.post("/create")
async def create_backup_manual(
    request: Request,
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
    client_ip = get_client_ip(request)
    client_ua = get_client_user_agent(request)
    background_tasks.add_task(_run_backup_task, str(record.id), admin.id, client_ip, client_ua)

    return {"backup_id": str(record.id), "status": "running",
            "message": "Backup sedang berjalan. Cek status via GET /admin/backup/{id}/status"}

@router.get("")
async def list_backups(
    limit: Optional[int] = Query(5, description="Batas jumlah riwayat backup (default 5)"),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """List riwayat backup tersedia (default 5 terbaru)"""
    stmt = select(BackupRecord).order_by(desc(BackupRecord.created_at))
    if limit is not None and limit > 0:
        stmt = stmt.limit(limit)
    else:
        stmt = stmt.limit(5)
    records = await db.execute(stmt)
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
    request: Request,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Download file .dms.bak — Mendukung Bearer token header atau query parameter ?token=... (hanya Super Admin)"""
    jwt_token = token
    if not jwt_token and authorization and authorization.startswith("Bearer "):
        jwt_token = authorization.split(" ")[1]
        
    if not jwt_token:
        raise HTTPException(status_code=401, detail="Token autentikasi tidak ditemukan")
        
    try:
        payload = decode_token(jwt_token)
        sub = payload.get("sub", "")
        if not sub.startswith("admin:"):
            raise HTTPException(status_code=403, detail="Hanya akun admin yang diizinkan mengunduh backup")
        admin_id = int(sub.split(":")[1])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Token tidak valid atau kadaluarsa")

    admin = await db.get(Admin, admin_id)
    if not admin or not admin.is_active:
        raise HTTPException(status_code=403, detail="Akun admin tidak aktif atau tidak ditemukan")

    if admin.role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Hanya Super Admin atau Admin yang diizinkan mengunduh backup")

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
        ip_address=get_client_ip(request),
        user_agent=get_client_user_agent(request),
        endpoint=request.url.path,
        http_method=request.method,
        status=AuditStatus.SUCCESS,
        detail={"backup_id": backup_id, "nama_file": record.nama_file}
    )
    db.add(audit)
    await db.commit()

    def iterfile():
        try:
            while chunk := stream.read(64 * 1024):
                yield chunk
        finally:
            stream.close()
            stream.release_conn()

    return StreamingResponse(
        iterfile(),
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

@router.get("/schedule", response_model=BackupScheduleResponse)
async def get_backup_schedule(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Mendapatkan pengaturan jadwal backup otomatis saat ini."""
    res = await db.execute(select(BackupScheduleConfig).where(BackupScheduleConfig.id == 1))
    config = res.scalar_one_or_none()
    if not config:
        next_run = calculate_next_run(True, "daily", "02:00", 0, 1)
        config = BackupScheduleConfig(
            id=1,
            is_active=True,
            frequency="daily",
            time_of_day="02:00",
            day_of_week=0,
            day_of_month=1,
            next_run_at=next_run,
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)

    return BackupScheduleResponse(
        is_active=config.is_active,
        frequency=config.frequency,
        time_of_day=config.time_of_day,
        day_of_week=config.day_of_week,
        day_of_month=config.day_of_month,
        last_run_at=config.last_run_at,
        next_run_at=config.next_run_at,
        updated_at=config.updated_at,
    )


@router.put("/schedule", response_model=BackupScheduleResponse)
async def update_backup_schedule(
    payload: BackupScheduleUpdateRequest,
    request: Request,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Memperbarui pengaturan jadwal backup otomatis (Hanya Super Admin)."""
    res = await db.execute(select(BackupScheduleConfig).where(BackupScheduleConfig.id == 1))
    config = res.scalar_one_or_none()
    if not config:
        config = BackupScheduleConfig(id=1)
        db.add(config)

    next_run = calculate_next_run(
        payload.is_active,
        payload.frequency,
        payload.time_of_day,
        payload.day_of_week,
        payload.day_of_month,
    )

    config.is_active = payload.is_active
    config.frequency = payload.frequency
    config.time_of_day = payload.time_of_day
    config.day_of_week = payload.day_of_week
    config.day_of_month = payload.day_of_month
    config.next_run_at = next_run
    config.updated_at = datetime.now(timezone.utc)
    config.updated_by = admin.id

    client_ip = get_client_ip(request)
    client_ua = get_client_user_agent(request)

    audit = AuditLog(
        user_id=admin.id,
        user_type=UserType.ADMIN,
        action="backup_schedule_updated",
        ip_address=client_ip,
        user_agent=client_ua,
        endpoint="/api/v1/admin/backup/schedule",
        http_method="PUT",
        status=AuditStatus.SUCCESS,
        detail={
            "is_active": payload.is_active,
            "frequency": payload.frequency,
            "time_of_day": payload.time_of_day,
            "day_of_week": payload.day_of_week,
            "day_of_month": payload.day_of_month,
            "next_run_at": next_run.isoformat() if next_run else None,
        }
    )
    db.add(audit)
    await db.commit()
    await db.refresh(config)

    return BackupScheduleResponse(
        is_active=config.is_active,
        frequency=config.frequency,
        time_of_day=config.time_of_day,
        day_of_week=config.day_of_week,
        day_of_month=config.day_of_month,
        last_run_at=config.last_run_at,
        next_run_at=config.next_run_at,
        updated_at=config.updated_at,
    )


@router.post("/restore")
async def restore_backup(
    file: UploadFile = File(...),
    konfirmasi: str = "SAYA MENGERTI RESTORE AKAN MENIMPA DATA SAAT INI",
    request: Request = None,
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

    client_ip = get_client_ip(request) if request else "127.0.0.1"
    client_ua = get_client_user_agent(request) if request else "Unknown"

    # Catat intent di audit_log SEBELUM eksekusi
    db.add(AuditLog(
        user_id=admin.id,
        user_type=UserType.ADMIN,
        action="restore_started",
        ip_address=client_ip,
        user_agent=client_ua,
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
            ip_address=client_ip,
            user_agent=client_ua,
            status=AuditStatus.SUCCESS if result["success"] else AuditStatus.FAILED,
            detail=result
        ))
        await new_db.commit()

    if not result["success"]:
        raise HTTPException(500, detail=result)

    return result
