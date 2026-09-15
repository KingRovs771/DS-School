from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth, 
    users, 
    documents, 
    categories,
    admin_documents,
    admin_siswa,
    admin_audit_stats,
    verify,
    anomali,
    tahun_ajaran,
    sindas,
    admin_master_key,
    sekolah,
    dinas,
    superadmin_users,
    superadmin_monitoring,
    retention,
    backup,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(documents.router, prefix="/dokumen", tags=["Siswa Documents"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(tahun_ajaran.router, prefix="/tahun-ajaran", tags=["Tahun Ajaran"])
api_router.include_router(verify.router, prefix="/verify", tags=["Document Verification"])

# Admin Operations
api_router.include_router(admin_documents.router, prefix="/admin/dokumen", tags=["Admin Documents"])
api_router.include_router(admin_siswa.router, prefix="/admin/siswa", tags=["Admin Siswa"])
api_router.include_router(admin_audit_stats.router, prefix="/admin", tags=["Admin Audit & Stats"])
api_router.include_router(anomali.router, prefix="/admin/anomali", tags=["Admin Security & Anomaly"])
api_router.include_router(admin_master_key.router, prefix="/admin/master-key", tags=["Admin Master Key"])

# SINDAS Integration
api_router.include_router(sindas.router, prefix="/sindas", tags=["SINDAS Integration"])

# Biodata Sekolah & Dinas
api_router.include_router(sekolah.router, prefix="/sekolah", tags=["Sekolah Biodata"])
api_router.include_router(dinas.router, prefix="/dinas", tags=["Dinas Pengawasan"])

api_router.include_router(superadmin_users.router)
api_router.include_router(superadmin_monitoring.router)

# Retention Policy & Legal Hold
api_router.include_router(retention.router, prefix="/admin", tags=["Retention & Legal Hold"])

# Backup & Restore
api_router.include_router(backup.router, prefix="/admin", tags=["Backup & Restore"])
