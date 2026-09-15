"""
TahunAjaran endpoints — per sekolah isolation
"""
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_admin, get_current_any_user
from app.models.tahun_ajaran import TahunAjaran
from app.models.admin import Admin
from app.models.siswa import Siswa
from app.schemas.sekolah_schemas import TahunAjaranCreate, TahunAjaranResponse

router = APIRouter()


def _resolve_sekolah_id(current_user: Any, query_sekolah_id: Optional[int] = None) -> Optional[int]:
    """
    Resolve sekolah_id untuk filtering.
    - Admin dengan sekolah_id: wajib pakai sekolah admin, ignore query.
    - Super admin (sekolah_id=None): pakai query_sekolah_id jika ada, else None (artinya lihat semua).
    - Siswa: pakai siswa.sekolah_id
    """
    if isinstance(current_user, Admin):
        if current_user.sekolah_id is not None:
            return current_user.sekolah_id
        # super_admin
        return query_sekolah_id
    if isinstance(current_user, Siswa):
        return current_user.sekolah_id
    # Fallback: coba ambil attribute sekolah_id jika ada
    return getattr(current_user, "sekolah_id", query_sekolah_id)


@router.get("/", response_model=list[TahunAjaranResponse])
async def list_tahun_ajaran(
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_any_user),
    sekolah_id: Optional[int] = Query(None, description="Filter sekolah (hanya super_admin)"),
):
    """Mengambil daftar tahun ajaran per sekolah."""
    target_sekolah_id = _resolve_sekolah_id(current_user, sekolah_id)

    stmt = select(TahunAjaran).order_by(TahunAjaran.tahun.desc())
    if target_sekolah_id is not None:
        stmt = stmt.where(TahunAjaran.sekolah_id == target_sekolah_id)
    # jika super_admin tanpa filter dan target None -> kembalikan semua (lintas sekolah)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/default", response_model=TahunAjaranResponse)
async def get_default_tahun_ajaran(
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_any_user),
    sekolah_id: Optional[int] = Query(None, description="Filter sekolah (hanya super_admin)"),
):
    """Mengambil tahun ajaran default per sekolah."""
    target_sekolah_id = _resolve_sekolah_id(current_user, sekolah_id)
    if target_sekolah_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sekolah_id wajib diisi untuk super_admin"
        )
    result = await db.execute(
        select(TahunAjaran).where(
            TahunAjaran.sekolah_id == target_sekolah_id,
            TahunAjaran.is_default == True,
        )
    )
    default_year = result.scalar_one_or_none()
    if not default_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tahun ajaran default tidak diset untuk sekolah ini"
        )
    return default_year


@router.post("/", response_model=TahunAjaranResponse, status_code=201)
async def create_tahun_ajaran(
    payload: TahunAjaranCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
):
    """Membuat tahun ajaran baru per sekolah (Hanya Admin)."""
    # Resolve sekolah_id: prioritas sekolah admin, fallback payload.sekolah_id untuk super_admin
    if current_admin.sekolah_id is not None:
        sekolah_id = current_admin.sekolah_id
    else:
        # super_admin wajib kirim sekolah_id
        if payload.sekolah_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Super admin wajib mengisi sekolah_id"
            )
        sekolah_id = payload.sekolah_id

    # Cek duplikat per sekolah
    existing = await db.execute(
        select(TahunAjaran).where(
            TahunAjaran.sekolah_id == sekolah_id,
            TahunAjaran.tahun == payload.tahun,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tahun ajaran '{payload.tahun}' sudah terdaftar di sekolah ini"
        )

    # Jika diset default, hilangkan default lain HANYA di sekolah yang sama
    if payload.is_default:
        await db.execute(
            update(TahunAjaran)
            .where(TahunAjaran.sekolah_id == sekolah_id)
            .values(is_default=False)
        )

    new_year = TahunAjaran(
        tahun=payload.tahun,
        is_default=payload.is_default,
        sekolah_id=sekolah_id,
    )
    db.add(new_year)
    await db.commit()
    await db.refresh(new_year)
    return new_year


@router.put("/{id}/set-default", response_model=TahunAjaranResponse)
async def set_default_tahun_ajaran(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
):
    """Mengubah tahun ajaran tertentu menjadi default per sekolah (Hanya Admin)."""
    result = await db.execute(select(TahunAjaran).where(TahunAjaran.id == id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tahun ajaran tidak ditemukan"
        )

    # Enforce isolasi sekolah
    if current_admin.sekolah_id is not None and target.sekolah_id != current_admin.sekolah_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tidak dapat mengubah tahun ajaran sekolah lain"
        )

    # Set semua di sekolah yang sama ke False
    await db.execute(
        update(TahunAjaran)
        .where(TahunAjaran.sekolah_id == target.sekolah_id)
        .values(is_default=False)
    )

    target.is_default = True
    await db.commit()
    await db.refresh(target)
    return target


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tahun_ajaran(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
):
    """Menghapus tahun ajaran per sekolah (Hanya Admin)."""
    result = await db.execute(select(TahunAjaran).where(TahunAjaran.id == id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tahun ajaran tidak ditemukan"
        )

    if current_admin.sekolah_id is not None and target.sekolah_id != current_admin.sekolah_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tidak dapat menghapus tahun ajaran sekolah lain"
        )

    await db.delete(target)
    await db.commit()
