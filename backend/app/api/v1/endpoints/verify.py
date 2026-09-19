"""
Verify Endpoints — Verifikasi QR Code Dokumen Terenkripsi
==========================================================
Endpoint publik tanpa otentikasi untuk memvalidasi tanda tangan digital dokumen PDF.
Mengembalikan tampilan visual sertifikasi keaslian dokumen.
"""
import structlog
from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.watermark import verify_signed_token
from app.models.siswa import Siswa
from app.models.dokumen import Dokumen
from app.models.audit_log import AuditLog, UserType, AuditStatus

logger = structlog.get_logger(__name__)
router = APIRouter()

@router.get("/{token}", response_class=HTMLResponse, tags=["Document Verification"])
async def verify_document_token(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Menerima token verifikasi URL, melakukan validasi tanda tangan HMAC-SHA256,
    dan menyajikan halaman status sertifikasi keaslian dokumen interaktif.
    """
    logger.info("🔍 QR Code verification request received", token_prefix=token[:10])
    
    # 1. Validasi token HMAC
    result = verify_signed_token(token, settings.SECRET_KEY)
    
    is_valid = result.get("valid", False)
    siswa = None
    dokumen = None
    
    if is_valid:
        siswa_id = result.get("siswa_id")
        doc_id = result.get("doc_id")
        
        # Ambil detail siswa dari database
        siswa_query = select(Siswa).where(Siswa.id == siswa_id)
        siswa_res = await db.execute(siswa_query)
        siswa = siswa_res.scalar_one_or_none()
        
        # Ambil detail dokumen dari database
        doc_query = select(Dokumen).where(Dokumen.id == doc_id)
        doc_res = await db.execute(doc_query)
        dokumen = doc_res.scalar_one_or_none()
        
        # Jika data di database tidak cocok, gagalkan validitas
        if not siswa or not dokumen:
            is_valid = False
            
    # 2. Catat riwayat verifikasi ke Audit Log
    new_log = AuditLog(
        siswa_id=siswa.id if siswa else None,
        user_type=UserType.GUEST,
        action="dokumen_verify",
        dokumen_id=dokumen.id if dokumen else None,
        resource_type="dokumen",
        resource_id=dokumen.id if dokumen else None,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        status=AuditStatus.SUCCESS if is_valid else AuditStatus.FAILED,
        detail={"token_prefix": token[:15], "validity": "VALID" if is_valid else "INVALID"}
    )
    db.add(new_log)
    await db.commit()
    
    # 3. Render halaman HTML responsif premium
    status_color = "emerald" if is_valid else "rose"
    status_text = "VALID & ASLI" if is_valid else "INVALID / PALSU"
    status_icon = "✓" if is_valid else "✗"
    
    student_name = siswa.nama_lengkap if siswa else "-"
    student_nis = siswa.nis if siswa else "-"
    student_kelas = siswa.kelas if siswa else "-"
    doc_type = dokumen.jenis_dok.upper().replace("_", " ") if dokumen else "-"
    doc_ta = dokumen.tahun_ajaran if dokumen else "-"
    doc_semester = dokumen.semester.upper() if dokumen else "-"
    doc_hash = dokumen.file_hash_sha256 if dokumen else "-"
    download_time = result.get("download_at", "-")
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sertifikat Verifikasi Dokumen — DMS Sekolah</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: 'Inter', sans-serif;
            }}
            body {{
                background-color: #0f172a;
                color: #f1f5f9;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 20px;
                position: relative;
                overflow-x: hidden;
            }}
            /* Ambient Glow */
            .glow-bg {{
                position: absolute;
                width: 500px;
                height: 500px;
                border-radius: 50%;
                filter: blur(150px);
                z-index: 0;
                opacity: 0.15;
            }}
            .glow-indigo {{
                top: -10%;
                left: -10%;
                background-color: #6366f1;
            }}
            .glow-purple {{
                bottom: -10%;
                right: -10%;
                background-color: #a855f7;
            }}
            .container {{
                width: 100%;
                max-width: 550px;
                background-color: rgba(30, 41, 59, 0.4);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 32px;
                padding: 35px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                z-index: 10;
                position: relative;
            }}
            .logo-header {{
                text-align: center;
                margin-bottom: 25px;
            }}
            .logo-box {{
                display: inline-flex;
                width: 48px;
                height: 48px;
                background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
                border-radius: 14px;
                align-items: center;
                justify-content: center;
                font-weight: 800;
                font-size: 20px;
                color: #fff;
                box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.4);
                margin-bottom: 12px;
            }}
            .logo-header h1 {{
                font-size: 18px;
                font-weight: 700;
                color: #fff;
                letter-spacing: 0.5px;
            }}
            .logo-header p {{
                font-size: 11px;
                color: #64748b;
                margin-top: 3px;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                font-weight: 600;
            }}
            /* Seal Status Badge */
            .seal-container {{
                text-align: center;
                margin: 20px 0 30px 0;
            }}
            .seal-badge {{
                display: inline-flex;
                flex-direction: column;
                align-items: center;
                padding: 24px 35px;
                border-radius: 24px;
                width: 100%;
                position: relative;
                overflow: hidden;
            }}
            .seal-badge.{status_color} {{
                background-color: rgba({"16, 185, 129" if is_valid else "239, 68, 68"}, 0.08);
                border: 1px solid rgba({"16, 185, 129" if is_valid else "239, 68, 68"}, 0.25);
            }}
            .seal-icon {{
                width: 56px;
                height: 56px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 12px;
                color: #fff;
                box-shadow: 0 8px 20px rgba(0,0,0,0.2);
            }}
            .seal-icon.emerald {{
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            }}
            .seal-icon.rose {{
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            }}
            .seal-title {{
                font-size: 20px;
                font-weight: 800;
                letter-spacing: 1px;
            }}
            .seal-title.emerald {{ color: #34d399; }}
            .seal-title.rose {{ color: #f87171; }}
            .seal-desc {{
                font-size: 11px;
                color: #94a3b8;
                margin-top: 6px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }}
            /* Data Grid Card */
            .data-section {{
                background-color: rgba(15, 23, 42, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.04);
                border-radius: 20px;
                padding: 20px;
                margin-bottom: 25px;
            }}
            .section-title {{
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                color: #6366f1;
                margin-bottom: 15px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
                padding-bottom: 8px;
            }}
            .data-row {{
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                padding: 8px 0;
                border-bottom: 1px solid rgba(255,255,255,0.02);
            }}
            .data-row:last-child {{
                border-bottom: none;
            }}
            .data-label {{
                color: #94a3b8;
                font-weight: 500;
            }}
            .data-value {{
                color: #f8fafc;
                font-weight: 600;
                text-align: right;
                max-width: 250px;
                word-break: break-all;
            }}
            .hash-mono {{
                font-family: 'Courier New', Courier, monospace;
                font-size: 11px;
                color: #818cf8;
            }}
            /* Footer */
            .footer-info {{
                text-align: center;
                font-size: 10px;
                color: #475569;
                text-transform: uppercase;
                letter-spacing: 1px;
                line-height: 1.5;
            }}
        </style>
    </head>
    <body>
        <div class="glow-bg glow-indigo"></div>
        <div class="glow-bg glow-purple"></div>

        <div class="container">
            <!-- Header -->
            <div class="logo-header">
                <div class="logo-box">🔒</div>
                <h1>DMS SEKOLAH</h1>
                <p>Arsip & Keamanan Dokumen Elektronik</p>
            </div>

            <!-- Validation Seal -->
            <div class="seal-container">
                <div class="seal-badge {status_color}">
                    <div class="seal-icon {status_color}">{status_icon}</div>
                    <div class="seal-title {status_color}">{status_text}</div>
                    <div class="seal-desc">SERTIFIKASI KEASLIAN KRIPTOGRAFIS</div>
                </div>
            </div>

            <!-- Student Data -->
            <div class="data-section">
                <div class="section-title">Informasi Siswa</div>
                <div class="data-row">
                    <span class="data-label">Nama Lengkap</span>
                    <span class="data-value">{student_name}</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Nomor Induk Siswa (NIS)</span>
                    <span class="data-value">{student_nis}</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Kelas</span>
                    <span class="data-value">{student_kelas}</span>
                </div>
            </div>

            <!-- Document Data -->
            <div class="data-section">
                <div class="section-title">Informasi Dokumen</div>
                <div class="data-row">
                    <span class="data-label">Jenis Dokumen</span>
                    <span class="data-value">{doc_type}</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Tahun Ajaran / Semester</span>
                    <span class="data-value">{doc_ta} / {doc_semester}</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Checksum SHA-256</span>
                    <span class="data-value hash-mono">{doc_hash}</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Waktu Pengunduhan</span>
                    <span class="data-value">{download_time} WIB</span>
                </div>
            </div>

            <!-- Footer Info -->
            <div class="footer-info">
                DMS SEKOLAH SECURE GATEWAY &bull; VERIFICATION PORTAL<br>
                SISTEM TANDA TANGAN DIGITAL TERINTEGRASI &bull; 2026
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content, status_code=status.HTTP_200_OK)
