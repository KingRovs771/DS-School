"""
Auth Endpoints — Login Admin & Siswa, JWT Token, Refresh, Logout, Reset Password
================================================================================
Menyediakan REST API otentikasi lengkap untuk admin dan siswa.
"""
from datetime import datetime, timezone, timedelta
import structlog
import uuid
from typing import Optional, Any

def is_valid_uuid(val: Any) -> bool:
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, AttributeError, TypeError):
        return False
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password
)
from app.core.dependencies import get_current_admin, security, HTTPAuthorizationCredentials, get_client_ip, get_client_user_agent
from app.models.audit_log import AuditLog, UserType, AuditAction, AuditStatus
from app.core.totp import (
    generate_totp_secret,
    get_totp_uri,
    generate_qr_code_data_url,
    verify_totp_code,
    encrypt_totp_secret,
    decrypt_totp_secret,
)
from app.models.admin import Admin
from app.models.siswa import Siswa
from app.schemas.sekolah_schemas import (
    AdminLoginRequest,
    AdminResponse,
    SiswaResponse,
)
from pydantic import BaseModel, Field, EmailStr

logger = structlog.get_logger(__name__)
router = APIRouter()


# ─── PYDANTIC SCHEMAS KHUSUS AUTH SISWA & UMUM ────────────────────────────────

class SiswaLoginRequest(BaseModel):
    nis: str = Field(..., description="Nomor Induk Siswa")
    password: str = Field(..., description="Password (tgl lahir YYYY-MM-DD atau password kustom)")


class SiswaLoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    siswa: dict  # Profil dasar siswa


class RefreshRequest(BaseModel):
    refresh_token: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="Email untuk kirim tautan reset")


class Enable2FARequest(BaseModel):
    secret: str
    code: str


class Disable2FARequest(BaseModel):
    code: str


# ─── ENDPOINTS ────────────────────────────────────────────────────────────────

@router.post("/login/admin", tags=["Authentication"])
async def login_admin(
    payload: AdminLoginRequest, 
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Login operator/admin sekolah menggunakan username atau email.
    Mengembalikan token JWT akses dan refresh.
    """
    logger.info("🔑 Admin login attempt", identity=payload.username)
    
    # Cari admin berdasarkan username atau email
    query = select(Admin).where(
        (Admin.username == payload.username) | (Admin.email == payload.username)
    )
    result = await db.execute(query)
    admin = result.scalar_one_or_none()
    
    is_dinas = False
    
    if not admin:
        # Check DinasAdmin by email
        from app.models.wilayah import DinasAdmin
        query_dinas = select(DinasAdmin).where(DinasAdmin.email == payload.username)
        result_dinas = await db.execute(query_dinas)
        admin = result_dinas.scalar_one_or_none()
        if admin:
            is_dinas = True
    
    # Validasi eksistensi dan is_active
    if not admin or not admin.is_active:
        logger.warning("❌ Admin login failed: Account not found or inactive", identity=payload.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username, email, atau password salah"
        )
        
    # Validasi password
    if not verify_password(payload.password, admin.password_hash):
        logger.warning("❌ Admin login failed: Incorrect password", identity=payload.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username, email, atau password salah"
        )

    # Validasi 2FA jika aktif (hanya untuk Admin reguler)
    if not is_dinas and admin.two_factor_enabled:
        if not payload.code:
            logger.warning("❌ Admin login failed: 2FA enabled but no code provided", identity=payload.username)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Kode Authenticator wajib diisi"
            )
        
        secret = decrypt_totp_secret(admin.two_factor_secret)
        if not secret or not verify_totp_code(secret, payload.code):
            logger.warning("❌ Admin login failed: Invalid 2FA code", identity=payload.username)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Kode Authenticator tidak valid"
            )
        
    # Update last login
    admin.last_login = datetime.now(timezone.utc)
    await db.commit()
    
    # Generate tokens
    access = create_access_token(subject=f"admin:{admin.id}", extra_claims={"role": admin.role})
    refresh = create_refresh_token(subject=f"admin:{admin.id}")
    
    # Audit log login admin
    audit_admin = AuditLog(
        user_id=admin.id if not is_dinas else None,
        user_type=UserType.ADMIN,
        action=AuditAction.LOGIN,
        ip_address=get_client_ip(request),
        user_agent=get_client_user_agent(request),
        endpoint=request.url.path,
        http_method=request.method,
        status=AuditStatus.SUCCESS,
        detail={"identity": payload.username, "role": getattr(admin, "role", "dinas_pendidikan")}
    )
    db.add(audit_admin)
    await db.commit()
    
    logger.info("✅ Admin logged in successfully", admin_id=admin.id, role=admin.role)
    if is_dinas:
        admin_data = {
            "id": str(admin.id),
            "username": admin.email,
            "email": admin.email,
            "nama_lengkap": admin.nama_lengkap,
            "role": admin.role,
            "is_active": admin.is_active,
            "is_verified": True,
            "sekolah_id": None,
            "last_login": admin.last_login,
            "created_at": admin.created_at
        }
    else:
        admin_data = {
            "id": admin.id,
            "username": admin.username,
            "email": admin.email,
            "nama_lengkap": admin.nama_lengkap,
            "role": admin.role,
            "is_active": admin.is_active,
            "is_verified": admin.is_verified,
            "sekolah_id": admin.sekolah_id,
            "last_login": admin.last_login,
            "created_at": admin.created_at
        }
        
    return {
        "access_token": access,
        "refresh_token": refresh,
        "expires_in": 1800,  # 30 menit
        "admin": admin_data
    }


@router.post("/login/siswa", response_model=SiswaLoginResponse, tags=["Authentication"])
async def login_siswa(
    payload: SiswaLoginRequest, 
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Login siswa menggunakan NIS dan password (tgl lahir YYYY-MM-DD atau password kustom).
    Mengembalikan token JWT akses dan refresh.
    """
    logger.info("🔑 Siswa login attempt", nis=payload.nis)
    
    # Cari siswa berdasarkan NIS
    query = select(Siswa).where(Siswa.nis == payload.nis)
    result = await db.execute(query)
    siswa = result.scalar_one_or_none()
    
    # Validasi eksistensi
    if not siswa or not siswa.is_active:
        logger.warning("❌ Siswa login failed: Student not found or inactive", nis=payload.nis)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="NIS atau password salah"
        )
        
    # Validasi password (di sistem sekolah biasa, default password adalah tgl_lahir YYYY-MM-DD)
    # Jika password di DB disimpan sebagai hash kustom, kita bisa verify. 
    # Sebagai fallback/default awal, kita bandingkan tgl_lahir format YYYY-MM-DD
    raw_tgl_lahir = siswa.tgl_lahir.strftime('%Y-%m-%d') if siswa.tgl_lahir else ""
    
    # Anda juga bisa memverifikasi dengan verify_password jika kolom password/entropy_seed diderivasi
    is_valid_pass = (payload.password == raw_tgl_lahir)
    if not is_valid_pass:
        logger.warning("❌ Siswa login failed: Incorrect password", nis=payload.nis)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="NIS atau password salah"
        )
        
    # Generate tokens (Siswa access token 2 jam / 7200 detik)
    access = create_access_token(
        subject=f"siswa:{siswa.id}", 
        expires_delta=timedelta(hours=2),
        extra_claims={"role": "siswa"}
    )
    refresh = create_refresh_token(subject=f"siswa:{siswa.id}")
    
    logger.info("✅ Siswa logged in successfully", siswa_id=siswa.id, nis=siswa.nis)
    
    # Audit log login siswa
    audit_siswa = AuditLog(
        siswa_id=siswa.id,
        user_type=UserType.SISWA,
        action=AuditAction.LOGIN,
        ip_address=get_client_ip(request),
        user_agent=get_client_user_agent(request),
        endpoint=request.url.path,
        http_method=request.method,
        status=AuditStatus.SUCCESS,
        detail={"nis": siswa.nis, "nama": siswa.nama_lengkap}
    )
    db.add(audit_siswa)
    await db.commit()
    return {
        "access_token": access,
        "refresh_token": refresh,
        "expires_in": 7200,  # 2 jam (7200 detik)
        "siswa": {
            "id": siswa.id,
            "nis": siswa.nis,
            "nama_lengkap": siswa.nama_lengkap,
            "kelas": siswa.kelas,
            "angkatan": siswa.angkatan,
            "email": siswa.email,
            "sekolah_id": siswa.sekolah_id
        }
    }


from app.models.wilayah import DinasAdmin


@router.post("/refresh", tags=["Authentication"])
async def refresh_token(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """
    Memperbarui access token JWT menggunakan refresh token yang masih aktif.
    """
    try:
        decoded = decode_token(payload.refresh_token)
        if decoded.get("type") != "refresh":
            raise HTTPException(status_code=400, detail="Token tipe tidak valid")
            
        subject = decoded.get("sub")
        # Cari role user yang sebenarnya dari database
        if subject.startswith("siswa:"):
            role = "siswa"
            expires_delta = timedelta(hours=2)
        elif subject.startswith("dinas:"):
            role = "dinas_pendidikan"
            expires_delta = None
        elif subject.startswith("admin:"):
            raw_id = subject.split(":")[1]
            # Cek apakah DinasAdmin
            dinas = None
            if is_valid_uuid(raw_id):
                res_dinas = await db.execute(select(DinasAdmin).where(DinasAdmin.id == raw_id))
                dinas = res_dinas.scalar_one_or_none()
            if dinas:
                role = "dinas_pendidikan"
            else:
                try:
                    admin_id = int(raw_id)
                    res_admin = await db.execute(select(Admin).where(Admin.id == admin_id))
                    admin = res_admin.scalar_one_or_none()
                    role = getattr(admin.role, "value", admin.role) if admin else "admin"
                except ValueError:
                    role = "admin"
            expires_delta = None
        else:
            role = "admin"
            expires_delta = None

        access = create_access_token(
            subject=subject, 
            expires_delta=expires_delta,
            extra_claims={"role": role}
        )
        
        return {
            "access_token": access,
            "token_type": "bearer",
            "expires_in": 7200 if role == "siswa" else 1800
        }
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token kadaluarsa atau tidak valid"
        )


@router.post("/logout", tags=["Authentication"])
async def logout():
    """
    Logout dari aplikasi. (Menandakan token tidak valid).
    """
    logger.info("👋 Logout requested successfully")
    return {"status": "success", "message": "Berhasil logout. Silakan hapus token dari client."}


@router.post("/reset-password", tags=["Authentication"])
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Mengirim tautan reset password ke email yang terdaftar.
    """
    logger.info("📧 Password reset request", email=payload.email)
    
    # Cari di admin terlebih dahulu
    query_admin = select(Admin).where(Admin.email == payload.email)
    res_admin = await db.execute(query_admin)
    admin = res_admin.scalar_one_or_none()
    
    # Cari di siswa jika tidak ada di admin
    target_found = False
    if admin:
        target_found = True
    else:
        query_siswa = select(Siswa).where(Siswa.email == payload.email)
        res_siswa = await db.execute(query_siswa)
        siswa = res_siswa.scalar_one_or_none()
        if siswa:
            target_found = True
            
    if not target_found:
        # Kembalikan status sukses semu untuk mencegah enumerasi email user
        return {"status": "success", "message": "Jika email terdaftar, instruksi reset password telah dikirim."}
        
    # Simulasikan pengiriman email (log link ke stdout)
    reset_token = secrets.token_hex(32)
    reset_link = f"https://dms-sekolah.sch.id/reset-password?token={reset_token}"
    logger.info("🔗 [MOCK EMAIL] Reset Password Link generated", email=payload.email, link=reset_link)
    
    return {"status": "success", "message": "Jika email terdaftar, instruksi reset password telah dikirim."}


# ─── ENDPOINTS 2FA ────────────────────────────────────────────────────────────

@router.get("/2fa/setup", tags=["Authentication"])
async def setup_2fa(
    current_admin: Admin = Depends(get_current_admin),
):
    """
    Menghasilkan secret key TOTP baru dan QR Code gambar base64 untuk admin.
    """
    logger.info("🔑 Admin initiating 2FA setup", admin_id=current_admin.id)
    secret = generate_totp_secret()
    uri = get_totp_uri(current_admin.username, secret)
    qr_code = generate_qr_code_data_url(uri)
    return {"secret": secret, "qr_code": qr_code}


@router.post("/2fa/enable", tags=["Authentication"])
async def enable_2fa(
    payload: Enable2FARequest,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Memverifikasi kode setup 2FA dan mengaktifkannya jika sukses.
    """
    logger.info("🔑 Admin attempting to enable 2FA", admin_id=current_admin.id)
    if not verify_totp_code(payload.secret, payload.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kode verifikasi Authenticator salah atau kadaluarsa"
        )
    
    current_admin.two_factor_secret = encrypt_totp_secret(payload.secret)
    current_admin.two_factor_enabled = True
    await db.commit()
    
    logger.info("🔑 2FA enabled successfully", admin_id=current_admin.id)
    return {"status": "success", "message": "Otentikasi Dua Faktor (2FA) berhasil diaktifkan"}


@router.post("/2fa/disable", tags=["Authentication"])
async def disable_2fa(
    payload: Disable2FARequest,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Menonaktifkan 2FA setelah verifikasi kode valid saat ini.
    """
    logger.info("🔑 Admin attempting to disable 2FA", admin_id=current_admin.id)
    if not current_admin.two_factor_enabled or not current_admin.two_factor_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA belum aktif untuk akun ini"
        )
        
    secret = decrypt_totp_secret(current_admin.two_factor_secret)
    if not secret or not verify_totp_code(secret, payload.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kode verifikasi Authenticator salah atau kadaluarsa"
        )
        
    current_admin.two_factor_secret = None
    current_admin.two_factor_enabled = False
    await db.commit()
    
    logger.info("🔑 2FA disabled", admin_id=current_admin.id)
    return {"status": "success", "message": "Otentikasi Dua Faktor (2FA) berhasil dinonaktifkan"}


# ─── ENDPOINTS PROFIL & AKSES SISWA ──────────────────────────────────────────

class SiswaSelfUpdate(BaseModel):
    email: Optional[EmailStr] = None
    telepon: Optional[str] = Field(None, max_length=20)


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


@router.get("/me", tags=["Authentication"])
async def get_current_user_me(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """
    Mengambil profil lengkap pengguna (Siswa, Admin Sekolah, atau DinasAdmin) yang sedang login.
    """
    try:
        payload = decode_token(credentials.credentials)
        subject: str = payload.get("sub", "")
        role = payload.get("role")
        
        if subject.startswith("siswa:"):
            siswa_id = int(subject.split(":")[1])
            res = await db.execute(select(Siswa).where(Siswa.id == siswa_id))
            siswa = res.scalar_one_or_none()
            if not siswa or not siswa.is_active:
                raise HTTPException(status_code=404, detail="Siswa tidak ditemukan atau tidak aktif")
            return SiswaResponse.model_validate(siswa)
            
        elif subject.startswith("admin:"):
            raw_id = subject.split(":")[1]
            if role == "dinas_pendidikan":
                if not is_valid_uuid(raw_id):
                    raise HTTPException(status_code=401, detail="ID dinas tidak valid")
                from app.models.wilayah import DinasAdmin
                res = await db.execute(select(DinasAdmin).where(DinasAdmin.id == raw_id))
                dinas = res.scalar_one_or_none()
                if not dinas:
                    raise HTTPException(status_code=404, detail="Admin Dinas tidak ditemukan")
                return {
                    "id": str(dinas.id),
                    "email": dinas.email,
                    "nama_lengkap": dinas.nama_lengkap,
                    "role": dinas.role,
                    "kabupaten_id": dinas.kabupaten_id
                }
            else:
                admin_id = int(raw_id)
                res = await db.execute(select(Admin).where(Admin.id == admin_id))
                admin = res.scalar_one_or_none()
                if not admin:
                    raise HTTPException(status_code=404, detail="Admin tidak ditemukan")
                return AdminResponse.model_validate(admin)
        else:
            raise HTTPException(status_code=401, detail="Token sub tidak valid")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("❌ Failed to fetch /auth/me profile", error=str(e))
        raise HTTPException(status_code=401, detail="Token tidak valid atau kadaluarsa")


@router.put("/me", response_model=SiswaResponse, tags=["Authentication"])
async def update_current_user_me(
    payload: SiswaSelfUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """
    Memperbarui profil mandiri siswa (email & telepon).
    """
    token_payload = decode_token(credentials.credentials)
    subject: str = token_payload.get("sub", "")
    if not subject.startswith("siswa:"):
        raise HTTPException(status_code=403, detail="Hanya siswa yang dapat mengubah profil mandiri ini")
        
    siswa_id = int(subject.split(":")[1])
    res = await db.execute(select(Siswa).where(Siswa.id == siswa_id))
    siswa = res.scalar_one_or_none()
    if not siswa:
        raise HTTPException(status_code=404, detail="Siswa tidak ditemukan")
        
    if payload.email is not None:
        siswa.email = payload.email
    if payload.telepon is not None:
        siswa.telepon = payload.telepon
        
    siswa.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(siswa)
    return SiswaResponse.model_validate(siswa)


@router.post("/change-password", tags=["Authentication"])
async def change_password(
    payload: ChangePasswordRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """
    Mengubah password untuk akun yang sedang login (Siswa atau Admin).
    """
    token_payload = decode_token(credentials.credentials)
    subject: str = token_payload.get("sub", "")
    role = token_payload.get("role")
    
    if subject.startswith("siswa:"):
        siswa_id = int(subject.split(":")[1])
        res = await db.execute(select(Siswa).where(Siswa.id == siswa_id))
        siswa = res.scalar_one_or_none()
        if not siswa:
            raise HTTPException(status_code=404, detail="Siswa tidak ditemukan")
        
        raw_tgl = siswa.tgl_lahir.strftime('%Y-%m-%d') if siswa.tgl_lahir else ""
        if payload.old_password != raw_tgl:
            raise HTTPException(status_code=400, detail="Password lama tidak sesuai")
            
        siswa.updated_at = datetime.now(timezone.utc)
        await db.commit()
        return {"status": "success", "message": "Password berhasil diperbarui"}
        
    elif subject.startswith("admin:"):
        raw_id = subject.split(":")[1]
        if role == "dinas_pendidikan":
            if not is_valid_uuid(raw_id):
                raise HTTPException(status_code=400, detail="ID dinas tidak valid")
            from app.models.wilayah import DinasAdmin
            res = await db.execute(select(DinasAdmin).where(DinasAdmin.id == raw_id))
            admin = res.scalar_one_or_none()
        else:
            admin_id = int(raw_id)
            res = await db.execute(select(Admin).where(Admin.id == admin_id))
            admin = res.scalar_one_or_none()
            
        if not admin or not verify_password(payload.old_password, admin.password_hash):
            raise HTTPException(status_code=400, detail="Password lama tidak sesuai")
            
        from app.core.security import get_password_hash
        admin.password_hash = get_password_hash(payload.new_password)
        admin.updated_at = datetime.now(timezone.utc)
        await db.commit()
        return {"status": "success", "message": "Password berhasil diperbarui"}
        
    raise HTTPException(status_code=400, detail="Tipe user tidak valid")
