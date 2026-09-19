"""
Admin Anomali Endpoints — Monitoring Security Alerts
=====================================================
Menyediakan REST API penelusuran alert keamanan anomali bagi administrator sekolah.
"""
import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.models.admin import Admin
from app.models.audit_log import AuditLog
from app.schemas.sekolah_schemas import AuditLogResponse

logger = structlog.get_logger(__name__)
router = APIRouter()

@router.get("", response_model=list[AuditLogResponse], tags=["Admin Security & Anomaly"])
async def get_security_alerts(
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Mengambil seluruh data peringatan anomali (ANOMALY_WARNING dan ANOMALY_CRITICAL)
    yang terekam di sistem log audit demi keamanan DMS.
    """
    logger.info("🔍 Admin fetching security anomaly alerts", admin_id=current_admin.id)
    
    query = select(AuditLog).where(
        AuditLog.action.in_(["ANOMALY_WARNING", "ANOMALY_CRITICAL"])
    ).order_by(AuditLog.created_at.desc()).limit(100)
    
    result = await db.execute(query)
    alerts = result.scalars().all()
    return alerts
