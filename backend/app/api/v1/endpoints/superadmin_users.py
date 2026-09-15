from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_super_admin
from app.core.security import hash_password
from app.models.wilayah import DinasAdmin, KabupatenKota
from app.models.admin import Admin, AdminRole
from app.models.sekolah import Sekolah
from app.schemas.wilayah_schemas import (
    DinasAdminCreate, DinasAdminUpdate, DinasAdminResponse, DinasAdminList
)
from app.schemas.sekolah_schemas import (
    AdminCreate, AdminUpdate, AdminResponse
)

router = APIRouter(prefix="/superadmin/users", tags=["Super Admin Users"])

# ─────────────────────────────────────────────────────────────────────────────
# Manajemen DinasAdmin
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/dinas", response_model=DinasAdminList)
async def list_dinas_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    kabupaten_id: Optional[UUID] = None,
    super_admin: Admin = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Melihat daftar seluruh pengguna Dinas Pendidikan."""
    query = select(DinasAdmin).options(selectinload(DinasAdmin.kabupaten))
    count_query = select(func.count()).select_from(DinasAdmin)

    if search:
        search_filter = DinasAdmin.nama_lengkap.ilike(f"%{search}%") | DinasAdmin.email.ilike(f"%{search}%")
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
        
    if kabupaten_id:
        query = query.where(DinasAdmin.kabupaten_id == kabupaten_id)
        count_query = count_query.where(DinasAdmin.kabupaten_id == kabupaten_id)

    total = await db.scalar(count_query) or 0
    query = query.offset((page - 1) * size).limit(size).order_by(DinasAdmin.created_at.desc())
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    response_items = []
    for user in users:
        # inject nama_kabupaten manually for response
        data = DinasAdminResponse.model_validate(user)
        if user.kabupaten:
            data.nama_kabupaten = user.kabupaten.nama
        response_items.append(data)
        
    return {"items": response_items, "total": total, "page": page, "size": size}

@router.post("/dinas", response_model=DinasAdminResponse, status_code=201)
async def create_dinas_user(
    payload: DinasAdminCreate,
    super_admin: Admin = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Menambahkan akun Dinas Pendidikan baru."""
    # Cek duplikat email
    existing = await db.execute(select(DinasAdmin).where(DinasAdmin.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email sudah digunakan")
        
    # Validasi Kabupaten
    kabupaten = await db.execute(select(KabupatenKota).where(KabupatenKota.id == payload.kabupaten_id))
    if not kabupaten.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Kabupaten/Kota tidak ditemukan")

    new_user = DinasAdmin(
        nama_lengkap=payload.nama_lengkap,
        email=payload.email,
        kabupaten_id=payload.kabupaten_id,
        is_active=payload.is_active,
        password_hash=hash_password(payload.password),
        role="dinas_pendidikan"
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    response = DinasAdminResponse.model_validate(new_user)
    return response

@router.put("/dinas/{user_id}", response_model=DinasAdminResponse)
async def update_dinas_user(
    user_id: UUID,
    payload: DinasAdminUpdate,
    super_admin: Admin = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Memperbarui informasi atau mereset password akun Dinas."""
    result = await db.execute(select(DinasAdmin).where(DinasAdmin.id == user_id).options(selectinload(DinasAdmin.kabupaten)))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="Akun Dinas tidak ditemukan")
        
    if payload.email and payload.email != user.email:
        existing = await db.execute(select(DinasAdmin).where(DinasAdmin.email == payload.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email sudah digunakan oleh akun lain")
            
    if payload.kabupaten_id and payload.kabupaten_id != user.kabupaten_id:
        kab = await db.execute(select(KabupatenKota).where(KabupatenKota.id == payload.kabupaten_id))
        if not kab.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Kabupaten/Kota tidak ditemukan")
            
    update_data = payload.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        user.password_hash = hash_password(update_data.pop("password"))
        
    for k, v in update_data.items():
        setattr(user, k, v)
        
    await db.commit()
    await db.refresh(user)
    
    response = DinasAdminResponse.model_validate(user)
    if user.kabupaten:
        response.nama_kabupaten = user.kabupaten.nama
    return response

@router.delete("/dinas/{user_id}", status_code=204)
async def delete_dinas_user(
    user_id: UUID,
    super_admin: Admin = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Menghapus akun Dinas Pendidikan secara permanen."""
    result = await db.execute(select(DinasAdmin).where(DinasAdmin.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="Akun Dinas tidak ditemukan")
        
    await db.delete(user)
    await db.commit()
    return None

# ─────────────────────────────────────────────────────────────────────────────
# Manajemen TU / Admin Sekolah
# ─────────────────────────────────────────────────────────────────────────────

from pydantic import BaseModel

class AdminListResponse(BaseModel):
    items: list[AdminResponse]
    total: int
    page: int
    size: int

@router.get("/admin-sekolah")
async def list_admin_sekolah(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    sekolah_id: Optional[int] = None,
    role: Optional[AdminRole] = None,
    super_admin: Admin = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Melihat seluruh Admin & TU Sekolah lintas tenant."""
    # Exclude super_admin from results to prevent accidental modification
    query = select(Admin).where(Admin.role != AdminRole.SUPER_ADMIN).options(selectinload(Admin.sekolah))
    count_query = select(func.count()).select_from(Admin).where(Admin.role != AdminRole.SUPER_ADMIN)
    
    if search:
        search_filter = Admin.nama_lengkap.ilike(f"%{search}%") | Admin.username.ilike(f"%{search}%") | Admin.email.ilike(f"%{search}%")
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
        
    if sekolah_id:
        query = query.where(Admin.sekolah_id == sekolah_id)
        count_query = count_query.where(Admin.sekolah_id == sekolah_id)
        
    if role:
        query = query.where(Admin.role == role)
        count_query = count_query.where(Admin.role == role)
        
    total = await db.scalar(count_query) or 0
    query = query.offset((page - 1) * size).limit(size).order_by(Admin.created_at.desc())
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    # We will enrich the response with school name on the frontend if needed, 
    # but let's just return AdminResponse for now. It includes sekolah_id.
    response_items = [AdminResponse.model_validate(u) for u in users]
    
    return {"items": response_items, "total": total, "page": page, "size": size}

@router.post("/admin-sekolah", response_model=AdminResponse, status_code=201)
async def create_admin_sekolah(
    payload: AdminCreate,
    super_admin: Admin = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Menambahkan Admin atau TU Sekolah baru."""
    if payload.role == AdminRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Tidak dapat membuat Super Admin dari endpoint ini")
        
    if payload.sekolah_id:
        sekolah = await db.execute(select(Sekolah).where(Sekolah.id == payload.sekolah_id))
        if not sekolah.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Sekolah tidak ditemukan")
            
    existing_username = await db.execute(select(Admin).where(Admin.username == payload.username))
    if existing_username.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username sudah digunakan")
        
    existing_email = await db.execute(select(Admin).where(Admin.email == payload.email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email sudah digunakan")
        
    new_user = Admin(
        username=payload.username,
        email=payload.email,
        nama_lengkap=payload.nama_lengkap,
        password_hash=hash_password(payload.password),
        role=payload.role,
        sekolah_id=payload.sekolah_id,
        is_active=True,
        is_verified=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return new_user

@router.put("/admin-sekolah/{user_id}", response_model=AdminResponse)
async def update_admin_sekolah(
    user_id: int,
    payload: AdminUpdate,
    super_admin: Admin = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Memperbarui atau mereset akun Admin / TU Sekolah."""
    result = await db.execute(select(Admin).where(Admin.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="Akun tidak ditemukan")
        
    if user.role == AdminRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Tidak dapat mengubah data Super Admin lain")
        
    if payload.role and payload.role == AdminRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Tidak dapat mempromosikan ke Super Admin")
        
    update_data = payload.model_dump(exclude_unset=True)
    
    if "password" in update_data and update_data["password"]:
        user.password_hash = hash_password(update_data.pop("password"))
        
    for k, v in update_data.items():
        setattr(user, k, v)
        
    await db.commit()
    await db.refresh(user)
    
    return user

@router.delete("/admin-sekolah/{user_id}", status_code=204)
async def delete_admin_sekolah(
    user_id: int,
    super_admin: Admin = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Menghapus akun Admin / TU Sekolah secara permanen."""
    result = await db.execute(select(Admin).where(Admin.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="Akun tidak ditemukan")
        
    if user.role == AdminRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Tidak dapat menghapus Super Admin")
        
    await db.delete(user)
    await db.commit()
    return None

