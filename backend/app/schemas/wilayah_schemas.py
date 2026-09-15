from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

class DinasAdminBase(BaseModel):
    nama_lengkap: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    kabupaten_id: UUID
    is_active: bool = True

class DinasAdminCreate(DinasAdminBase):
    password: str = Field(..., min_length=8)

class DinasAdminUpdate(BaseModel):
    nama_lengkap: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    kabupaten_id: Optional[UUID] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=8)

class DinasAdminResponse(DinasAdminBase):
    id: UUID
    role: str
    last_login: Optional[datetime] = None
    created_at: datetime
    
    # Nested relation for display in frontend
    nama_kabupaten: Optional[str] = None

    model_config = {"from_attributes": True}

class DinasAdminList(BaseModel):
    items: list[DinasAdminResponse]
    total: int
    page: int
    size: int
