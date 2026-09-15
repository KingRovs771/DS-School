"""
Endpoints: SINDAS Integration
==============================
REST API untuk integrasi SINDAS ↔ DMS Sekolah.

Endpoint yang tersedia:
  POST /sindas/webhook       — Terima event real-time dari SINDAS (public + signature)
  GET  /sindas/sync-logs     — Riwayat sinkronisasi (admin)
  GET  /sindas/sync-status   — Statistik sync hari ini (admin)
  POST /sindas/pull          — Trigger pull manual dari API SINDAS (super_admin)
"""
from __future__ import annotations

import json
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_admin, get_tu_sekolah
from app.models.admin import Admin
from app.models.sindas_sync_log import SindasSyncLog, SindasSyncStatus
from app.schemas.sindas_schemas import (
    SindasWebhookPayload,
    SindasWebhookResponse,
    SindasSyncLogResponse,
    SindasSyncStatusResponse,
    SindasPullRequest,
    SindasPullResponse,
)
from app.services.sindas_service import SindasService

logger = structlog.get_logger(__name__)
router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
#  POST /sindas/webhook
#  Endpoint publik (terproteksi signature) untuk menerima event dari SINDAS
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/webhook",
    response_model=SindasWebhookResponse,
    status_code=status.HTTP_200_OK,
    summary="Terima webhook event dari SINDAS",
    description=(
        "Endpoint publik yang menerima event real-time dari SINDAS. "
        "Setiap request diverifikasi menggunakan HMAC-SHA256 signature "
        "via header `X-SINDAS-Signature`. "
        "Event yang didukung: `created`, `updated`, `deleted`."
    ),
)
async def receive_sindas_webhook(
    request: Request,
    x_sindas_signature: Optional[str] = Header(None, alias="X-SINDAS-Signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint utama penerima event dari SINDAS.

    SINDAS harus dikonfigurasi untuk mengirim webhook ke:
    `POST https://<domain-dms>/api/v1/sindas/webhook`

    Headers yang diperlukan:
    - `Content-Type: application/json`
    - `X-SINDAS-Signature: sha256=<hmac_hex>` (jika SINDAS_WEBHOOK_SECRET dikonfigurasi)
    """
    if not settings.SINDAS_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Integrasi SINDAS sedang dinonaktifkan",
        )

    # Baca raw body untuk verifikasi signature
    raw_body = await request.body()

    # Verifikasi signature HMAC-SHA256
    if not SindasService.verify_webhook_signature(raw_body, x_sindas_signature):
        logger.warning(
            "🚫 SINDAS webhook ditolak: signature tidak valid",
            ip=request.client.host if request.client else "unknown",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Signature webhook tidak valid. Periksa konfigurasi SINDAS_WEBHOOK_SECRET.",
        )

    # Parse payload
    try:
        raw_payload = json.loads(raw_body)
        payload = SindasWebhookPayload(**raw_payload)
    except Exception as exc:
        logger.error("❌ SINDAS webhook: payload tidak valid", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Format payload tidak valid: {str(exc)}",
        )

    logger.info(
        "📨 SINDAS webhook diterima",
        event_type=payload.event_type,
        nis=payload.data.nis,
        event_id=payload.event_id,
        ip=request.client.host if request.client else "unknown",
    )

    # Proses event
    log_entry = await SindasService.process_webhook(
        payload=payload,
        raw_payload=raw_payload,
        db=db,
    )

    return SindasWebhookResponse(
        status="accepted",
        message=f"Event '{payload.event_type}' untuk NIS {payload.data.nis} berhasil diproses",
        log_id=log_entry.id,
        siswa_id=log_entry.siswa_id,
    )


# ══════════════════════════════════════════════════════════════════════════════
#  GET /sindas/sync-status
#  Statistik sinkronisasi hari ini (admin)
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/sync-status",
    response_model=SindasSyncStatusResponse,
    summary="Status sinkronisasi SINDAS",
    description="Menampilkan statistik sinkronisasi SINDAS hari ini: total event, berhasil, gagal, dan terlewati.",
)
async def get_sindas_sync_status(
    current_admin: Admin = Depends(get_tu_sekolah),
    db: AsyncSession = Depends(get_db),
):
    """
    Menampilkan status koneksi SINDAS dan statistik sinkronisasi.
    Hanya dapat diakses oleh TU Sekolah / Admin Sekolah.
    """
    if not current_admin.sekolah_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun Anda tidak terkait dengan sekolah manapun",
        )
    return await SindasService.get_sync_status(db, sekolah_id=current_admin.sekolah_id)


# ══════════════════════════════════════════════════════════════════════════════
#  GET /sindas/sync-logs
#  Riwayat log sinkronisasi (admin)
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/sync-logs",
    response_model=list[SindasSyncLogResponse],
    summary="Riwayat log sinkronisasi SINDAS",
    description="Daftar log event yang telah diproses dari SINDAS, diurutkan dari yang terbaru.",
)
async def get_sindas_sync_logs(
    page: int = Query(default=1, ge=1, description="Halaman"),
    limit: int = Query(default=50, ge=1, le=200, description="Jumlah record per halaman"),
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
        description="Filter berdasarkan status: success | failed | skipped",
    ),
    nis: Optional[str] = Query(default=None, description="Filter berdasarkan NIS siswa"),
    current_admin: Admin = Depends(get_tu_sekolah),
    db: AsyncSession = Depends(get_db),
):
    """
    Mengembalikan riwayat sinkronisasi SINDAS dengan dukungan filter dan paginasi.
    Hanya dapat diakses oleh TU Sekolah / Admin Sekolah.
    """
    if not current_admin.sekolah_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun Anda tidak terkait dengan sekolah manapun",
        )
        
    query = select(SindasSyncLog).where(SindasSyncLog.sekolah_id == current_admin.sekolah_id).order_by(desc(SindasSyncLog.processed_at))

    if status_filter:
        try:
            query = query.where(SindasSyncLog.status == SindasSyncStatus(status_filter))
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Status tidak valid. Pilihan: success, failed, skipped",
            )
    if nis:
        query = query.where(SindasSyncLog.nis_sindas == nis)

    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    logs = result.scalars().all()

    logger.info(
        "📋 TU Sekolah mengakses sync logs SINDAS",
        admin_id=current_admin.id,
        sekolah_id=current_admin.sekolah_id,
        count=len(logs),
    )
    return logs


# ══════════════════════════════════════════════════════════════════════════════
#  POST /sindas/pull
#  Trigger pull manual data dari API SINDAS (super_admin)
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/pull",
    response_model=SindasPullResponse,
    summary="Pull manual data siswa dari SINDAS",
    description=(
        "Menarik data siswa secara aktif dari REST API SINDAS. "
        "**Hanya dapat diakses oleh TU Sekolah / Admin Sekolah.**"
    ),
)
async def pull_from_sindas(
    payload: SindasPullRequest,
    current_admin: Admin = Depends(get_tu_sekolah),
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger sinkronisasi aktif: DMS menarik data dari API SINDAS.
    Hanya dapat diakses oleh TU Sekolah / Admin Sekolah.
    """
    if not settings.SINDAS_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Integrasi SINDAS sedang dinonaktifkan (SINDAS_ENABLED=false)",
        )

    if not current_admin.sekolah_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun Anda tidak terkait dengan sekolah manapun",
        )

    # Force sekolah_id to match current_admin.sekolah_id
    payload.sekolah_id = current_admin.sekolah_id

    logger.info(
        "🔄 TU Sekolah trigger pull manual SINDAS",
        admin_id=current_admin.id,
        sekolah_id=current_admin.sekolah_id,
        request=payload.model_dump(),
    )

    result = await SindasService.pull_from_sindas(payload, db)
    return result


# ══════════════════════════════════════════════════════════════════════════════
#  GET /sindas/mock-api/siswa
#  Mock API SINDAS untuk simulasi sinkronisasi
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/mock-api/siswa",
    summary="Mock API SINDAS untuk Simulasi",
    description="Mengembalikan data simulasi siswa dari SINDAS.",
)
async def get_mock_sindas_siswa(
    limit: int = Query(default=10, ge=1),
    kelas: Optional[str] = Query(default=None),
    sekolah_id: Optional[int] = Query(default=None),
):
    """
    Mock endpoint untuk menyimulasikan API eksternal SINDAS.
    """
    return await _get_mock_sindas_data(limit, kelas, sekolah_id)


@router.get(
    "/mock-api/students",
    summary="Mock API SINDAS untuk Simulasi (Alternative)",
    description="Mengembalikan data simulasi siswa dari SINDAS.",
)
async def get_mock_sindas_students(
    limit: int = Query(default=10, ge=1),
    kelas: Optional[str] = Query(default=None),
    sekolah_id: Optional[int] = Query(default=None),
):
    return await _get_mock_sindas_data(limit, kelas, sekolah_id)


async def _get_mock_sindas_data(
    limit: int = Query(default=10, ge=1),
    kelas: Optional[str] = Query(default=None),
    sekolah_id: Optional[int] = Query(default=None),
):
    # Buat beberapa data simulasi siswa
    mock_students = [
        {
            "nis": "222301",
            "nisn": "0087654321",
            "nama": "Andi Wijaya SINDAS",
            "kelas": "XI-IPA1",
            "jurusan": "IPA",
            "angkatan": 2022,
            "jenis_kelamin": "L",
            "tgl_lahir": "2007-04-12",
            "tempat_lahir": "Surakarta",
            "agama": "Islam",
            "alamat": "Jl. Slamet Riyadi No. 45",
            "email": "andi.sindas@sch.id",
            "telepon": "081234567890",
            "nama_ortu": "Bambang Wijaya",
            "sekolah_id": sekolah_id or 1,
            "npsn": "20310801"
        },
        {
            "nis": "222302",
            "nisn": "0087654322",
            "nama": "Budi Santoso SINDAS",
            "kelas": "XI-IPA1",
            "jurusan": "IPA",
            "angkatan": 2022,
            "jenis_kelamin": "L",
            "tgl_lahir": "2007-08-22",
            "tempat_lahir": "Surakarta",
            "agama": "Islam",
            "alamat": "Jl. Adi Sucipto No. 12",
            "email": "budi.sindas@sch.id",
            "telepon": "081234567891",
            "nama_ortu": "Hadi Santoso",
            "sekolah_id": sekolah_id or 1,
            "npsn": "20310801"
        },
        {
            "nis": "222303",
            "nisn": "0087654323",
            "nama": "Citra Lestari SINDAS",
            "kelas": "XI-IPA2",
            "jurusan": "IPA",
            "angkatan": 2022,
            "jenis_kelamin": "P",
            "tgl_lahir": "2007-11-05",
            "tempat_lahir": "Surakarta",
            "agama": "Kristen",
            "alamat": "Jl. Jend. Sudirman No. 89",
            "email": "citra.sindas@sch.id",
            "telepon": "081234567892",
            "nama_ortu": "Lestari",
            "sekolah_id": sekolah_id or 1,
            "npsn": "20310802"
        },
        {
            "nis": "212208",
            "nisn": "0071234568",
            "nama": "Dewi Sartika SINDAS",
            "kelas": "XII-IPA1",
            "jurusan": "IPA",
            "angkatan": 2021,
            "jenis_kelamin": "P",
            "tgl_lahir": "2006-03-18",
            "tempat_lahir": "Surakarta",
            "agama": "Islam",
            "alamat": "Jl. Kartini No. 15",
            "email": "dewi.sindas@sch.id",
            "telepon": "081234567893",
            "nama_ortu": "Sartono",
            "sekolah_id": sekolah_id or 1,
            "npsn": "20310801"
        },
        {
            "nis": "212209",
            "nisn": "0071234569",
            "nama": "Eko Prasetyo SINDAS",
            "kelas": "XII-IPA2",
            "jurusan": "IPA",
            "angkatan": 2021,
            "jenis_kelamin": "L",
            "tgl_lahir": "2006-07-29",
            "tempat_lahir": "Surakarta",
            "agama": "Islam",
            "alamat": "Jl. Ronggowarsito No. 74",
            "email": "eko.sindas@sch.id",
            "telepon": "081234567894",
            "nama_ortu": "Prasetyo",
            "sekolah_id": sekolah_id or 1,
            "npsn": "99999999"
        }
    ]

    # Filter berdasarkan kelas jika ada
    if kelas:
        mock_students = [s for s in mock_students if s["kelas"] == kelas]

    # Kembalikan sesuai limit
    res_students = mock_students[:limit]
    return {"data": res_students, "total": len(res_students)}
