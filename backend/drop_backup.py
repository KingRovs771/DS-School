import asyncio
from app.core.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        await conn.execute(text("DROP TABLE IF EXISTS backup_records CASCADE"))
        print("Dropped backup_records successfully.")

if __name__ == "__main__":
    asyncio.run(main())
