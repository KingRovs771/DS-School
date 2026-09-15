import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.admin import Admin

async def main():
    session = AsyncSessionLocal()
    res = await session.execute(select(Admin))
    for a in res.scalars().all():
        print(f"ID: {a.id}, Username: {a.username}, Role: {a.role}, IsActive: {a.is_active}")
    await session.close()

if __name__ == "__main__":
    asyncio.run(main())
