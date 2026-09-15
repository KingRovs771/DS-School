import asyncio
import logging
from celery import shared_task
from app.services.backup_service import backup_service
from app.core.database import AsyncSessionLocal
from app.models.backup import BackupRecord
from app.models.audit_log import AuditLog, UserType, AuditStatus

logger = logging.getLogger(__name__)

async def _save_backup_result_async(result):
    async with AsyncSessionLocal() as db:
        record = BackupRecord(
            nama_file=result["nama_file"],
            ukuran_bytes=result["ukuran_bytes"],
            checksum_sha256=result["checksum_sha256"],
            manifest_json=result["manifest_json"],
            storage_path=result["storage_path"],
            status="done",
            tipe="scheduled"
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)

        audit = AuditLog(
            user_id=None,
            user_type=UserType.SYSTEM,
            action="backup_created",
            ip_address="127.0.0.1",
            status=AuditStatus.SUCCESS,
            detail={"backup_id": str(record.id), "tipe": "scheduled"}
        )
        db.add(audit)
        await db.commit()

@shared_task(name="run_scheduled_backup", bind=True, max_retries=3)
def run_scheduled_backup(self):
    """Backup otomatis — dijadwalkan Celery Beat setiap hari jam 02:00 WIB"""
    try:
        logger.info("[Backup] Memulai backup terjadwal...")
        result = backup_service.create_backup(dibuat_oleh_id=None)
        
        # Run async save in sync context
        asyncio.run(_save_backup_result_async(result))
        
        logger.info(f"[Backup] Backup terjadwal selesai: {result['nama_file']}")
        return {"success": True, "nama_file": result["nama_file"]}
        
    except Exception as exc:
        logger.error(f"[Backup] Gagal: {exc}")
        raise self.retry(exc=exc, countdown=300)  # retry 5 menit
