"""
Category endpoints with multi-tenant isolation support.
"""
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_admin, get_current_any_user
from app.models.document import Category
from app.models.sekolah import Sekolah
from app.schemas.document import CategoryCreate, CategoryResponse

router = APIRouter()


@router.get("", response_model=list[CategoryResponse])
@router.get("/", response_model=list[CategoryResponse])
async def list_categories(
    sekolah_id: Optional[int] = Query(None, description="Filter berdasarkan ID sekolah"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_any_user),
):
    """
    Mengambil daftar kategori.
    - Admin Sekolah melihat kategori global (sekolah_id is NULL) dan kategori sekolah mereka.
    - Dinas melihat kategori global dan kategori dari sekolah-sekolah binaannya (atau sekolah spesifik yang dipilih).
    - Super Admin melihat semua kategori atau filter berdasarkan sekolah.
    """
    query = select(Category)
    
    role_str = getattr(user, "role", None)
    if role_str:
        role_val = getattr(role_str, "value", role_str)
        if role_val in ("admin", "tu_sekolah"):
            # Paksa filter ke sekolah admin bersangkutan
            active_sekolah_id = user.sekolah_id
            query = query.where(Category.sekolah_id == active_sekolah_id)
        elif role_val == "dinas_pendidikan":
            if sekolah_id:
                # Verifikasi sekolah ada di wilayah Dinas
                stmt_sch = select(Sekolah.id).where(
                    Sekolah.id == sekolah_id,
                    Sekolah.kabupaten_id == user.kabupaten_id
                )
                res_sch = await db.execute(stmt_sch)
                if not res_sch.scalar():
                    raise HTTPException(status_code=403, detail="Sekolah di luar wilayah pantauan Anda")
                query = query.where(Category.sekolah_id == sekolah_id)
            else:
                # Dinas melihat semua kategori dari sekolah-sekolah di wilayahnya
                stmt_schs = select(Sekolah.id).where(Sekolah.kabupaten_id == user.kabupaten_id)
                res_schs = await db.execute(stmt_schs)
                binaan_ids = [row[0] for row in res_schs.all()]
                query = query.where(Category.sekolah_id.in_(binaan_ids))
        elif role_val == "super_admin":
            if sekolah_id:
                query = query.where(Category.sekolah_id == sekolah_id)
    else:
        # Siswa/User biasa, paksa filter ke sekolah siswa tersebut
        active_sekolah_id = getattr(user, "sekolah_id", None)
        if active_sekolah_id:
            query = query.where(Category.sekolah_id == active_sekolah_id)
        else:
            query = query.where(Category.sekolah_id.is_(None))

    query = query.order_by(Category.name.asc())
    result = await db.execute(query)
    cats = list(result.scalars().all())

    # Jika sekolah_id ditentukan, sertakan juga jenis dokumen yang telah diupload pada tabel Dokumen sekolah ini
    target_sch_id = None
    if sekolah_id:
        target_sch_id = sekolah_id
    elif role_str and getattr(role_str, "value", role_str) in ("admin", "tu_sekolah") and getattr(user, "sekolah_id", None):
        target_sch_id = user.sekolah_id

    if target_sch_id:
        from app.models.dokumen import Dokumen
        from app.models.siswa import Siswa
        from sqlalchemy import distinct
        stmt_docs = (
            select(distinct(Dokumen.jenis_dok))
            .join(Siswa, Siswa.id == Dokumen.siswa_id)
            .where(Siswa.sekolah_id == target_sch_id)
        )
        res_docs = await db.execute(stmt_docs)
        doc_types = [row[0] for row in res_docs.all() if row[0]]
        existing_cat_names = {c.name.lower() for c in cats}
        
        for dt in doc_types:
            if dt.lower() not in existing_cat_names:
                new_cat = Category(
                    name=dt,
                    description=dt.replace("_", " ").title(),
                    color="#10B981",
                    sekolah_id=target_sch_id
                )
                db.add(new_cat)
                await db.commit()
                await db.refresh(new_cat)
                cats.append(new_cat)
                existing_cat_names.add(dt.lower())

    return cats


@router.post("/", response_model=CategoryResponse, status_code=201)
async def create_category(
    payload: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_admin),
):
    """
    Membuat kategori baru.
    - Admin sekolah hanya bisa membuat kategori untuk sekolahnya sendiri.
    - Super Admin bisa membuat kategori global (sekolah_id = None) atau spesifik sekolah.
    """
    role_val = getattr(user.role, "value", user.role)
    
    insert_data = payload.model_dump()
    if role_val != "super_admin":
        insert_data["sekolah_id"] = user.sekolah_id
        
    # Cek keunikan nama pada scope sekolah tersebut (atau global)
    check_stmt = select(Category).where(
        and_(
            Category.name == insert_data["name"],
            Category.sekolah_id == insert_data.get("sekolah_id")
        )
    )
    res_check = await db.execute(check_stmt)
    if res_check.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Kategori '{insert_data['name']}' sudah ada di sekolah ini/global"
        )

    cat = Category(**insert_data)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/{cat_id}", status_code=204)
async def delete_category(
    cat_id: int,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_admin),
):
    """
    Menghapus kategori.
    - Admin sekolah hanya bisa menghapus kategori milik sekolahnya sendiri.
    - Kategori global (sekolah_id is NULL) tidak boleh dihapus oleh admin biasa.
    """
    result = await db.execute(select(Category).where(Category.id == cat_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
        
    role_val = getattr(user.role, "value", user.role)
    if role_val != "super_admin":
        if cat.sekolah_id is None:
            raise HTTPException(status_code=403, detail="Kategori global tidak boleh dihapus oleh Admin Sekolah")
        if cat.sekolah_id != user.sekolah_id:
            raise HTTPException(status_code=403, detail="Anda tidak diizinkan menghapus kategori sekolah lain")
            
    await db.delete(cat)
    await db.commit()
