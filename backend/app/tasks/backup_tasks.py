import asyncio
import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import select
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from celery import shared_task
from app.core.config import settings
from app.services.backup_service import backup_service
from app.models.backup import BackupRecord, BackupScheduleConfig
from app.models.audit_log import AuditLog, UserType, AuditStatus

logger = logging.getLogger(__name__)

def get_task_session_maker():
    task_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    return async_sessionmaker(bind=task_engine, class_=AsyncSession, expire_on_commit=False), task_engine

async def _save_backup_result_async(result):
    session_factory, task_engine = get_task_session_maker()
    try:
        async with session_factory() as db:
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
                user_agent="Celery-Worker/1.0",
                status=AuditStatus.SUCCESS,
                detail={"backup_id": str(record.id), "tipe": "scheduled"}
            )
            db.add(audit)
            await db.commit()
    finally:
        await task_engine.dispose()

@shared_task(name="run_scheduled_backup", bind=True, max_retries=3)
def run_scheduled_backup(self):
    """Backup otomatis — dieksekusi oleh worker."""
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


async def _check_and_run_async():
    from app.api.v1.endpoints.backup import calculate_next_run
    session_factory, task_engine = get_task_session_maker()
    try:
        async with session_factory() as db:
            res = await db.execute(select(BackupScheduleConfig).where(BackupScheduleConfig.id == 1))
            config = res.scalar_one_or_none()
            if not config:
                # Inisialisasi konfigurasi default jika belum ada
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

            if not config.is_active:
                return {"status": "skipped", "reason": "backup otomatis nonaktif"}

            wib = ZoneInfo("Asia/Jakarta")
            now_wib = datetime.now(wib)
            current_time = now_wib.strftime("%H:%M")

            if current_time != config.time_of_day:
                return {"status": "skipped", "reason": f"bukan waktu eksekusi ({current_time} != {config.time_of_day})"}

            # Cek frekuensi
            if config.frequency == "weekly":
                if now_wib.weekday() != (config.day_of_week if config.day_of_week is not None else 0):
                    return {"status": "skipped", "reason": f"bukan hari eksekusi (weekday {now_wib.weekday()} != {config.day_of_week})"}
            elif config.frequency == "monthly":
                if now_wib.day != (config.day_of_month if config.day_of_month is not None else 1):
                    return {"status": "skipped", "reason": f"bukan tanggal eksekusi (tanggal {now_wib.day} != {config.day_of_month})"}

            # Cek apakah sudah pernah berjalan dalam 120 detik terakhir (mencegah double trigger)
            now_utc = datetime.now(timezone.utc)
            if config.last_run_at:
                elapsed_seconds = (now_utc - config.last_run_at).total_seconds()
                if elapsed_seconds < 120:
                    return {"status": "skipped", "reason": "sudah dijalankan dalam siklus ini"}

            # Update last_run_at dan hitung next_run_at SEBELUM eksekusi untuk mencegah race condition
            config.last_run_at = now_utc
            config.next_run_at = calculate_next_run(
                config.is_active,
                config.frequency,
                config.time_of_day,
                config.day_of_week,
                config.day_of_month
            )
            await db.commit()
            return {"status": "execute"}
    finally:
        await task_engine.dispose()


@shared_task(name="check_and_run_scheduled_backup")
def check_and_run_scheduled_backup():
    """Memeriksa apakah saat ini adalah waktu yang dijadwalkan untuk backup otomatis (dijalankan Celery Beat per 60 detik)."""
    try:
        check_result = asyncio.run(_check_and_run_async())
        if check_result.get("status") == "execute":
            logger.info("[Backup Scheduler] Waktu cocok, memicu run_scheduled_backup.delay()...")
            run_scheduled_backup.delay()
            return {"status": "triggered"}
        return check_result
    except Exception as exc:
        logger.error(f"[Backup Scheduler] Error saat memeriksa jadwal: {exc}")
        return {"status": "error", "error": str(exc)}

