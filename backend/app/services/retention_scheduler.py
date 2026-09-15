"""
Retention Scheduler Service
===========================
Layanan background menggunakan APScheduler untuk menjalankan
pengecekan kebijakan retensi dokumen secara otomatis setiap hari.
"""
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)


async def check_retention_policies() -> dict:
    """
    Task harian: cek dokumen yang sudah melewati retention_expires_at.
    - SKIP dokumen dengan legal_hold = True (KRITIS)
    - Jalankan aksi: archive | delete | notify_only
    - Tulis ke retention_log dan audit_log
    Dijadwalkan jam 01:00 WIB (18:00 UTC sebelumnya) via APScheduler.
    """
    from app.core.database import AsyncSessionLocal
    from app.models.dokumen import Dokumen
    from app.models.retention import RetentionPolicy, RetentionLog
    from app.models.audit_log import AuditLog, UserType

    now = datetime.now(timezone.utc)
    processed = 0
    skipped_hold = 0

    try:
        async with AsyncSessionLocal() as db:
            # Dokumen yang sudah expired (tanpa legal hold)
            result = await db.execute(
                select(Dokumen)
                .options(selectinload(Dokumen.siswa))
                .where(
                    and_(
                        Dokumen.retention_expires_at != None,
                        Dokumen.retention_expires_at <= now,
                        Dokumen.legal_hold == False,
                    )
                )
            )
            expired_docs = result.scalars().all()

            for doc in expired_docs:
                # Cari kebijakan retensi yang berlaku
                pol_result = await db.execute(
                    select(RetentionPolicy).where(
                        and_(
                            RetentionPolicy.jenis_dok == doc.jenis_dok,
                            RetentionPolicy.sekolah_id == doc.siswa.sekolah_id,
                            RetentionPolicy.is_active == True,
                        )
                    )
                )
                policy = pol_result.scalar_one_or_none()
                if not policy:
                    continue

                # Eksekusi aksi
                if policy.aksi_setelah == "archive":
                    from app.models.dokumen import StatusDokumen
                    doc.status = StatusDokumen.ARCHIVED
                    aksi = "archived"
                elif policy.aksi_setelah == "delete":
                    from app.models.dokumen import StatusDokumen
                    doc.status = StatusDokumen.ARCHIVED
                    aksi = "soft_deleted"
                else:
                    aksi = "notified_only"

                # Tulis retention_log
                db.add(RetentionLog(
                    dokumen_id=doc.id,
                    aksi=aksi,
                    alasan=f"Retention policy otomatis: {policy.durasi_hari} hari untuk {doc.jenis_dok}",
                ))

                # Tulis audit_log
                db.add(AuditLog(
                    user_type=UserType.SYSTEM,
                    action=f"retention_{aksi}",
                    dokumen_id=doc.id,
                    resource_type="dokumen",
                    resource_id=doc.id,
                    ip_address="127.0.0.1",
                    endpoint="/system/retention-check",
                ))
                processed += 1

            await db.commit()
            logger.info(f"[Retention] Check selesai: {processed} diproses, {skipped_hold} diskip (legal hold)")

        # Jalankan notifikasi dokumen akan expired
        await send_expiry_notifications()

    except Exception as e:
        logger.error(f"[Retention] Error saat check_retention_policies: {e}", exc_info=True)

    return {"processed": processed, "skipped_hold": skipped_hold}


async def send_expiry_notifications() -> None:
    """
    Kirim notifikasi ke admin sekolah untuk dokumen yang akan expired
    dalam N hari ke depan (sesuai notif_hari_sebelum di policy).
    """
    from app.core.database import AsyncSessionLocal
    from app.models.dokumen import Dokumen
    from app.models.retention import RetentionPolicy
    from app.models.notifikasi import Notifikasi, TipeNotifikasi
    from sqlalchemy.orm import selectinload

    now = datetime.now(timezone.utc)

    try:
        async with AsyncSessionLocal() as db:
            # Ambil semua policy aktif untuk tahu notif_hari_sebelum
            pol_result = await db.execute(
                select(RetentionPolicy).where(RetentionPolicy.is_active == True)
            )
            policies = pol_result.scalars().all()

            # Kumpulkan semua horizon notifikasi yang unik
            horizons = list(set(p.notif_hari_sebelum for p in policies))

            for days_before in horizons:
                horizon = now + timedelta(days=days_before)
                window_start = now + timedelta(days=days_before - 1)

                result = await db.execute(
                    select(Dokumen)
                    .options(selectinload(Dokumen.siswa))
                    .where(
                        and_(
                            Dokumen.retention_expires_at != None,
                            Dokumen.retention_expires_at >= window_start,
                            Dokumen.retention_expires_at <= horizon,
                            Dokumen.legal_hold == False,
                        )
                    )
                )
                docs = result.scalars().all()

                for doc in docs:
                    sisa = (doc.retention_expires_at - now).days
                    db.add(Notifikasi(
                        admin_id=None,  # Broadcast ke semua admin sekolah
                        sekolah_id=doc.siswa.sekolah_id,
                        tipe=TipeNotifikasi.INFO if hasattr(TipeNotifikasi, 'INFO') else "info",
                        judul="Dokumen Akan Kadaluarsa",
                        pesan=(
                            f"Dokumen {doc.jenis_dok} milik siswa ID {doc.siswa_id} "
                            f"akan kadaluarsa dalam {sisa} hari "
                            f"(pada {doc.retention_expires_at.strftime('%d %b %Y')})."
                        ),
                        is_read=False,
                    ))

            await db.commit()
            logger.info("[Retention] Notifikasi expiry berhasil dikirim")

    except Exception as e:
        logger.error(f"[Retention] Error saat send_expiry_notifications: {e}", exc_info=True)
