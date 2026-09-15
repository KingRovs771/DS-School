import asyncio
import jwt
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

SECRET_KEY = "DMS_SUPER_SECRET_KEY_SEKOLAH_2026_CHANGE_THIS"
ALGORITHM = "HS256"

def create_token(subject, role):
    expire = datetime.now(timezone.utc) + timedelta(minutes=60)
    payload = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
        "role": role
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

token = create_token("admin:3", "super_admin")

import urllib.request
req = urllib.request.Request("http://localhost:8000/api/v1/admin/retention-policy", headers={"Authorization": f"Bearer {token}"})
try:
    with urllib.request.urlopen(req) as res:
        print(res.read().decode())
except Exception as e:
    print(e.read().decode() if hasattr(e, 'read') else str(e))
