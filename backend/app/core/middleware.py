"""
FastAPI Middleware — Deteksi Anomali Akses ML Otomatis
======================================================
Menyadap setiap request HTTP, mengekstrak fitur akses secara dinamis, 
dan mengambil tindakan (lanjutkan, log peringatan, atau blokir 403) berdasarkan skor detektor.
"""
import time
from datetime import datetime, timezone, timedelta
import structlog
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import select, func

from app.core.database import AsyncSessionLocal
from app.core.dependencies import get_client_ip, get_client_user_agent
from app.core.security import decode_token
from app.ml.anomaly_detector import anomaly_detector
from app.models.audit_log import AuditLog, UserType, AuditAction, AuditStatus

logger = structlog.get_logger(__name__)

# Daftar path bypass agar tidak terjadi penguncian sesi terkunci permanen
EXCLUDED_PATHS = [
    "/health",
    "/metrics",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/favicon.ico",
    "/api/v1/auth/login", # Endpoint login biarkan lewat ke handler agar user bisa input
    "/api/v1/verify" # Verifikasi QR Code dilewati agar scan tetap lancar
]

class AnomalyDetectionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 1. Bypass rute yang dikecualikan
        path = request.url.path
        if any(path.startswith(p) for p in EXCLUDED_PATHS):
            return await call_next(request)

        # 2. Ekstrak identitas dasar user dari Authorization header
        user_id = None
        user_type = UserType.GUEST
        
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = decode_token(token)
                subject = payload.get("sub", "")
                if subject.startswith("siswa:"):
                    user_id = int(subject.split(":")[1])
                    user_type = UserType.SISWA
                elif subject.startswith("admin:"):
                    user_id = int(subject.split(":")[1])
                    user_type = UserType.ADMIN
            except Exception:
                pass

        # 3. Kumpulkan data fitur sesi via database local session
        ip_address = get_client_ip(request)
        user_agent = get_client_user_agent(request)
        now_dt = datetime.now(timezone.utc)
        
        is_new_ip = False
        is_new_ua = False
        downloads_1h = 0
        time_interval = 60.0
        
        recent_intervals = [60.0] * 5
        recent_downloads = [0] * 5
        
        async with AsyncSessionLocal() as db:
            try:
                # Cek IP address baru untuk user bersangkutan
                if user_id:
                    ip_clause = (
                        (AuditLog.siswa_id == user_id) if user_type == UserType.SISWA 
                        else (AuditLog.user_id == user_id)
                    )
                    # Cek IP
                    ip_query = select(AuditLog).where(ip_clause & (AuditLog.ip_address == ip_address)).limit(1)
                    ip_res = await db.execute(ip_query)
                    is_new_ip = ip_res.scalar_one_or_none() is None
                    
                    # Cek User Agent
                    ua_query = select(AuditLog).where(ip_clause & (AuditLog.user_agent == user_agent)).limit(1)
                    ua_res = await db.execute(ua_query)
                    is_new_ua = ua_res.scalar_one_or_none() is None
                else:
                    # Guest: Cek riwayat IP/UA global dalam 1 hari terakhir
                    one_day_ago = now_dt - timedelta(days=1)
                    ip_query = select(AuditLog).where((AuditLog.ip_address == ip_address) & (AuditLog.created_at >= one_day_ago)).limit(1)
                    ip_res = await db.execute(ip_query)
                    is_new_ip = ip_res.scalar_one_or_none() is None

                # Hitung total download dokumen oleh IP ini dalam 1 jam terakhir
                one_hour_ago = now_dt - timedelta(hours=1)
                dl_query = select(func.count(AuditLog.id)).where(
                    (AuditLog.ip_address == ip_address) & 
                    (AuditLog.action == "dokumen_download") & 
                    (AuditLog.created_at >= one_hour_ago)
                )
                dl_res = await db.execute(dl_query)
                downloads_1h = dl_res.scalar() or 0
                
                # Ambil 6 riwayat log terakhir untuk menghitung sequence timing interval
                recent_clause = (
                    (AuditLog.ip_address == ip_address) if not user_id 
                    else (
                        ((AuditLog.siswa_id == user_id) if user_type == UserType.SISWA else (AuditLog.user_id == user_id)) & 
                        (AuditLog.user_type == user_type)
                    )
                )
                recent_query = select(AuditLog).where(recent_clause).order_by(AuditLog.created_at.desc()).limit(6)
                recent_res = await db.execute(recent_query)
                recent_logs = recent_res.scalars().all()
                
                # Hitung interval waktu berturut-turut
                if recent_logs:
                    # Interval aksi saat ini dengan aksi log terdekat
                    t_last = recent_logs[0].created_at
                    # Make t_last offset-aware if needed
                    if t_last.tzinfo is None:
                        t_last = t_last.replace(tzinfo=timezone.utc)
                    time_interval = max((now_dt - t_last).total_seconds(), 0.1)
                    
                    # Hitung runtun 5 interval dan download sebelumnya
                    temp_intervals = []
                    temp_downloads = []
                    for i in range(len(recent_logs) - 1):
                        t_curr = recent_logs[i].created_at
                        t_prev = recent_logs[i+1].created_at
                        if t_curr.tzinfo is None: t_curr = t_curr.replace(tzinfo=timezone.utc)
                        if t_prev.tzinfo is None: t_prev = t_prev.replace(tzinfo=timezone.utc)
                        
                        delta = max((t_curr - t_prev).total_seconds(), 0.1)
                        temp_intervals.append(delta)
                        
                        dl_val = 5 if recent_logs[i].action == "dokumen_download" else 0
                        temp_downloads.append(dl_val)
                        
                    # Pad lists
                    for val in temp_intervals:
                        recent_intervals.append(val)
                    recent_intervals = recent_intervals[-5:]
                    
                    for val in temp_downloads:
                        recent_downloads.append(val)
                    recent_downloads = recent_downloads[-5:]
                    
            except Exception as db_err:
                logger.error("Failed to query recent logs for features", error=str(db_err))

        # 4. Susun dict fitur sesi untuk model ML
        # Mocking geo_score: range IP lokal = 0.0, IP publik tak dikenal = 0.5
        geo_score = 0.0
        if not ip_address.startswith(("127.", "192.168.", "10.")):
            geo_score = 0.5

        features = {
            "hour": now_dt.hour,
            "day_of_week": now_dt.weekday(),
            "is_new_ip": is_new_ip,
            "is_new_ua": is_new_ua,
            "download_count_1h": downloads_1h,
            "time_interval": time_interval,
            "geo_score": geo_score,
            "recent_intervals": recent_intervals,
            "recent_downloads": recent_downloads
        }

        # 5. Hitung Skor Anomali via ML
        anomaly_score = anomaly_detector.score_login(features)
        
        # 6. Ambil Aksi Berdasarkan Skor
        if anomaly_score > 0.7:
            # BLOKIR: Critical security alert
            logger.warn("🚨 CRITICAL ANOMALY DETECTED: Blocking Request!", score=anomaly_score, ip=ip_address, path=path)
            
            async with AsyncSessionLocal() as db_log:
                new_log = AuditLog(
                    siswa_id=user_id if user_type == UserType.SISWA else None,
                    user_id=user_id if user_type == UserType.ADMIN else None,
                    user_type=user_type,
                    action="ANOMALY_CRITICAL",
                    ip_address=ip_address,
                    user_agent=user_agent,
                    endpoint=path,
                    http_method=request.method,
                    status=AuditStatus.BLOCKED,
                    error_message=f"Blokir akses otomatis. Skor anomali ML: {anomaly_score:.2f}",
                    detail={"features": features, "score": anomaly_score}
                )
                db_log.add(new_log)
                await db_log.commit()
                
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": f"Akses diblokir oleh sistem deteksi anomali ML (Skor: {anomaly_score:.2f})"}
            )
            
        elif anomaly_score >= 0.3:
            # WARNING: Log alert & lanjutkan
            logger.warn("⚠️ WARNING ANOMALY DETECTED: Logged for monitoring!", score=anomaly_score, ip=ip_address, path=path)
            
            async with AsyncSessionLocal() as db_log:
                new_log = AuditLog(
                    siswa_id=user_id if user_type == UserType.SISWA else None,
                    user_id=user_id if user_type == UserType.ADMIN else None,
                    user_type=user_type,
                    action="ANOMALY_WARNING",
                    ip_address=ip_address,
                    user_agent=user_agent,
                    endpoint=path,
                    http_method=request.method,
                    status=AuditStatus.SUCCESS,
                    error_message=f"Peringatan anomali ML: {anomaly_score:.2f}",
                    detail={"features": features, "score": anomaly_score}
                )
                db_log.add(new_log)
                await db_log.commit()

        # 7. Lanjutkan request normal
        return await call_next(request)
