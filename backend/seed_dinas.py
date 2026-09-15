import asyncio
from app.core.database import AsyncSessionLocal
from app.models.wilayah import KabupatenKota, DinasAdmin
from app.core.security import hash_password
import uuid

async def seed_dinas():
    async with AsyncSessionLocal() as db:
        # 1. Buat KabupatenKota
        kab = KabupatenKota(
            nama="Kabupaten Sragen",
            provinsi="Jawa Tengah"
        )
        db.add(kab)
        await db.commit()
        await db.refresh(kab)
        
        # 2. Buat Dinas Admin
        admin = DinasAdmin(
            email="dinas_sragen@dinas.id",
            password_hash=hash_password("dinas123"),
            nama_lengkap="Dinas Pendidikan Sragen",
            kabupaten_id=kab.id,
            is_active=True
        )
        db.add(admin)
        await db.commit()
        
        print("✅ Berhasil membuat Dinas Admin 'dinas_sragen' (password: dinas123)")

if __name__ == "__main__":
    asyncio.run(seed_dinas())
