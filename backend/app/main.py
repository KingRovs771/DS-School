"""
DMS Sekolah — FastAPI Application Entry Point
"""
import asyncio
import threading
import time
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
import prometheus_fastapi_instrumentator.routing as pfir_routing
from sqlalchemy import select

# Monkeypatch prometheus_fastapi_instrumentator to prevent AttributeError with _IncludedRouter in FastAPI >= 0.111.0
def patched_get_route_name(scope, routes, route_name=None):
    from starlette.routing import Match, Mount
    for route in routes:
        try:
            match, child_scope = route.matches(scope)
            if match == Match.FULL:
                r_path = getattr(route, "path", "")
                route_name = r_path
                child_scope = {**scope, **child_scope}
                if isinstance(route, Mount) and getattr(route, "routes", None):
                    child_route_name = patched_get_route_name(child_scope, route.routes, route_name)
                    if child_route_name is None:
                        route_name = None
                    else:
                        route_name += child_route_name
                return route_name
            elif match == Match.PARTIAL and route_name is None:
                route_name = getattr(route, "path", "")
        except Exception:
            continue
    return None

pfir_routing._get_route_name = patched_get_route_name

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import engine, Base
from app.core.minio_client import init_minio_buckets
from app.core.middleware import AnomalyDetectionMiddleware

logger = structlog.get_logger(__name__)


def start_weekly_retraining_scheduler():
    """Memulai background daemon thread untuk retraining model pendeteksi anomali mingguan."""
    def run_scheduler():
        logger.info("⏰ Background scheduler weekly retraining thread started")
        while True:
            # Tidur selama 1 minggu (604800 detik)
            # Untuk kemudahan testing, daemon ini berjalan stabil tanpa memblokir process utama
            time.sleep(604800)
            
            logger.info("⏰ Background scheduler triggering weekly anomaly model retraining...")
            async def trigger():
                from app.core.database import AsyncSessionLocal
                from app.models.audit_log import AuditLog
                from app.ml.anomaly_detector import anomaly_detector
                
                async with AsyncSessionLocal() as db:
                    try:
                        res = await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(1000))
                        logs = res.scalars().all()
                        anomaly_detector.retrain_model(logs)
                    except Exception as e:
                        logger.error("Weekly background retrain failed to query database", error=str(e))
                        
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(trigger())
                loop.close()
            except Exception as e:
                logger.error("Error in weekly background retraining execution", error=str(e))
                
    thread = threading.Thread(target=run_scheduler, daemon=True)
    thread.start()
    logger.info("✅ Weekly ML model retraining scheduler registered successfully")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup & shutdown hooks."""
    # ── Startup ──────────────────────────────────────────────────────
    logger.info("🚀 Starting DMS Sekolah API", version=settings.APP_VERSION)

    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables initialized")

    # Initialize MinIO buckets
    await init_minio_buckets()
    logger.info("✅ MinIO buckets initialized")

    # Start Anomaly Retraining weekly scheduler background thread
    if settings.ENABLE_ANOMALY_DETECTION:
        start_weekly_retraining_scheduler()

    # ── APScheduler: Retention Policy Check (harian jam 01:00 WIB = 18:00 UTC) ──
    from app.services.retention_scheduler import check_retention_policies
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        check_retention_policies,
        trigger=CronTrigger(hour=18, minute=0),   # 18:00 UTC = 01:00 WIB
        id="check_retention_policies",
        name="Daily Retention Policy Check",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("✅ Retention scheduler terdaftar — berjalan setiap hari jam 01:00 WIB")

    yield

    # ── Shutdown ─────────────────────────────────────────────────────
    scheduler.shutdown(wait=False)
    await engine.dispose()
    logger.info("👋 DMS Sekolah API shut down gracefully")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Document Management System untuk Sekolah",
        docs_url="/api/docs" if settings.DEBUG else None,
        redoc_url="/api/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # ── Middleware ────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])
    if settings.ENABLE_ANOMALY_DETECTION:
        app.add_middleware(AnomalyDetectionMiddleware) # ML Anomaly detection middleware

    # ── Routes ────────────────────────────────────────────────────────
    app.include_router(api_router, prefix="/api/v1")

    # ── Metrics ──────────────────────────────────────────────────────
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")

    return app


app = create_app()


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}

