import asyncio
from app.core.database import AsyncSessionLocal
from app.models.wilayah import KabupatenKota
from app.models.sekolah import Sekolah
from sqlalchemy import select

async def update_sekolah():
    async with AsyncSessionLocal() as db:
        # Get Kabupaten
        stmt = select(KabupatenKota).where(KabupatenKota.nama == "Kabupaten Sragen")
        res = await db.execute(stmt)
        kab = res.scalars().first()
        
        if not kab:
            print("Kabupaten Sragen tidak ditemukan!")
            return
            
        # Get all schools
        res_sekolah = await db.execute(select(Sekolah))
        schools = res_sekolah.scalars().all()
        
        for s in schools:
            s.kabupaten_id = kab.id
            
        await db.commit()
        print(f"✅ Berhasil mengupdate {len(schools)} sekolah dengan kabupaten {kab.nama}")

if __name__ == "__main__":
    asyncio.run(update_sekolah())
