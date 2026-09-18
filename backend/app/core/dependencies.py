"""
Dependencies — FastAPI Dependency Injection untuk Otentikasi & Otorisasi
======================================================================
Menyediakan helper otentikasi yang kuat untuk validasi JWT Admin dan Siswa.
"""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

def get_client_ip(request: Request) -> str:
    """Ekstrak IP Address klien yang sebenarnya (mendukung X-Forwarded-For dan X-Real-IP dari Nginx/Proxy)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"

def get_client_user_agent(request: Request) -> str:
    """Ekstrak Browser User-Agent dari request header."""
    ua = request.headers.get("user-agent")
    return ua.strip() if ua else "Unknown"

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models.admin import Admin
from app.models.wilayah import DinasAdmin
from app.models.siswa import Siswa
from app.models.user import User
import structlog

logger = structlog.get_logger(__name__)
security = HTTPBearer()


import uuid
from typing import Union, Any

def is_valid_uuid(val: Any) -> bool:
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Union[Admin, DinasAdmin]:
    """Dependency: Memvalidasi token JWT dan mengembalikan objek Admin atau DinasAdmin yang login."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token tidak valid atau kadaluarsa",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        subject: str = payload.get("sub", "")
        role = payload.get("role")
        if not subject or not subject.startswith("admin:"):
            raise credentials_exception
        
        raw_id = subject.split(":")[1]
        
        if role == "dinas_pendidikan" or subject.startswith("dinas:"):
            if not is_valid_uuid(raw_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="ID dinas tidak valid"
                )
            result = await db.execute(select(DinasAdmin).where(DinasAdmin.id == raw_id))
            dinas = result.scalar_one_or_none()
            if dinas is None or not dinas.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Akun dinas tidak aktif atau tidak ditemukan"
                )
            return dinas
        else:
            try:
                admin_id = int(raw_id)
                result = await db.execute(select(Admin).where(Admin.id == admin_id))
                admin = result.scalar_one_or_none()
                if admin and admin.is_active:
                    return admin
            except ValueError:
                pass
                
            # Fallback: jika raw_id adalah valid UUID, cek DinasAdmin
            if is_valid_uuid(raw_id):
                result = await db.execute(select(DinasAdmin).where(DinasAdmin.id == raw_id))
                dinas = result.scalar_one_or_none()
                if dinas and dinas.is_active:
                    return dinas

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akun admin/dinas tidak aktif atau tidak ditemukan"
            )
    except HTTPException:
        raise
    except Exception:
        raise credentials_exception


async def get_current_siswa(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Siswa:
    """Dependency: Memvalidasi token JWT dan mengembalikan objek Siswa yang login."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token tidak valid atau kadaluarsa",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        subject: str = payload.get("sub", "")
        if not subject or not subject.startswith("siswa:"):
            raise credentials_exception
        siswa_id = int(subject.split(":")[1])
    except Exception:
        raise credentials_exception

    result = await db.execute(select(Siswa).where(Siswa.id == siswa_id))
    siswa = result.scalar_one_or_none()
    if siswa is None or not siswa.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun siswa tidak aktif atau tidak ditemukan"
        )
    return siswa


async def get_super_admin(
    current_admin: Admin = Depends(get_current_admin),
) -> Admin:
    """Dependency: Memastikan admin yang login memiliki hak akses super_admin."""
    if current_admin.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya Super Admin yang diijinkan mengakses modul ini"
        )
    return current_admin


async def get_tu_sekolah(
    current_admin: Admin = Depends(get_current_admin),
) -> Admin:
    """Dependency: Memastikan admin yang login memiliki hak akses tu_sekolah, admin, atau super_admin."""
    if current_admin.role not in ("tu_sekolah", "admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya Tata Usaha (TU), Admin, atau Super Admin yang diijinkan"
        )
    return current_admin


async def get_current_dinas_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> DinasAdmin:
    """Dependency: Memvalidasi token JWT dan mengembalikan objek DinasAdmin yang login."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token tidak valid atau kadaluarsa",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        logger.error(f"DEBUG_PAYLOAD: {payload}")
        if payload.get("role") != "dinas_pendidikan":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses hanya untuk Dinas Pendidikan (Role Anda: {payload.get('role')})"
            )
        
        subject: str = payload.get("sub", "")
        if not subject:
            raise credentials_exception
            
        if subject.startswith("dinas:"):
            dinas_id = subject.split(":")[1]
        elif subject.startswith("admin:"):
            dinas_id = subject.split(":")[1]
        else:
            raise credentials_exception

        if not is_valid_uuid(dinas_id):
            raise credentials_exception
    except Exception as e:
        logger.error(f"DEBUG_EXCEPTION in get_current_dinas_admin: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise credentials_exception

    result = await db.execute(select(DinasAdmin).where(DinasAdmin.id == dinas_id))
    dinas = result.scalar_one_or_none()
    if dinas is None or not dinas.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun dinas tidak aktif atau tidak ditemukan"
        )
    return dinas


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Legacy dependency: Mengembalikan User lama."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token tidak valid atau kadaluarsa",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        subject: str = payload.get("sub", "")
        if subject.startswith("admin:"):
            user_id = int(subject.split(":")[1])
        elif subject.startswith("siswa:"):
            user_id = int(subject.split(":")[1])
        else:
            user_id = int(subject)
    except Exception:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Legacy dependency: Memastikan user lama adalah admin."""
    if current_user.role != "admin" and current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak"
        )
    return current_user


async def get_current_any_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """Dependency: Memvalidasi token JWT dan mengembalikan Admin, DinasAdmin, atau Siswa yang aktif."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token tidak valid atau kadaluarsa",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        subject: str = payload.get("sub", "")
        role = payload.get("role")
        if not subject:
            raise credentials_exception
        
        if subject.startswith("siswa:"):
            siswa_id = int(subject.split(":")[1])
            result = await db.execute(select(Siswa).where(Siswa.id == siswa_id))
            siswa = result.scalar_one_or_none()
            if siswa and siswa.is_active:
                return siswa
        elif subject.startswith("dinas:"):
            dinas_id = subject.split(":")[1]
            if is_valid_uuid(dinas_id):
                result = await db.execute(select(DinasAdmin).where(DinasAdmin.id == dinas_id))
                dinas = result.scalar_one_or_none()
                if dinas and dinas.is_active:
                    return dinas
        elif subject.startswith("admin:"):
            raw_id = subject.split(":")[1]
            if role == "dinas_pendidikan" and is_valid_uuid(raw_id):
                result = await db.execute(select(DinasAdmin).where(DinasAdmin.id == raw_id))
                dinas = result.scalar_one_or_none()
                if dinas and dinas.is_active:
                    return dinas
            
            try:
                admin_id = int(raw_id)
                result = await db.execute(select(Admin).where(Admin.id == admin_id))
                admin = result.scalar_one_or_none()
                if admin and admin.is_active:
                    return admin
            except ValueError:
                pass

            # Fallback: jika raw_id adalah valid UUID, cek DinasAdmin
            if is_valid_uuid(raw_id):
                result = await db.execute(select(DinasAdmin).where(DinasAdmin.id == raw_id))
                dinas = result.scalar_one_or_none()
                if dinas and dinas.is_active:
                    return dinas
    except Exception:
        raise credentials_exception
    raise credentials_exception
