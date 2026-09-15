import enum
from datetime import datetime, timezone
import uuid

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

class RegistrasiStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class RegistrasiSekolah(Base):
    __tablename__ = "registrasi_sekolah"

    __table_args__ = (
        Index("ix_registrasi_status", "status"),
        Index("ix_registrasi_kabupaten", "kabupaten_id"),
        {"comment": "Pendaftaran sekolah publik sebelum disetujui dinas"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Data Sekolah
    nama_sekolah: Mapped[str] = mapped_column(String(255), nullable=False)
    kode_npsn: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    alamat: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Wilayah (Wajib karena ini penentu siapa yang approve)
    kabupaten_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kabupaten_kota.id"), nullable=False
    )
    
    # PIC Data (yang mendaftarkan)
    nama_pic: Mapped[str] = mapped_column(String(255), nullable=False)
    email_pic: Mapped[str] = mapped_column(String(255), nullable=False)
    telepon_pic: Mapped[str] = mapped_column(String(20), nullable=False)
    
    # Status
    status: Mapped[RegistrasiStatus] = mapped_column(
        Enum(RegistrasiStatus, name="registrasi_status_enum", values_callable=lambda obj: [e.value for e in obj]),
        default=RegistrasiStatus.PENDING,
        nullable=False
    )
    
    # Timestamps
    tanggal_daftar: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    tanggal_diproses: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    
    # Relationship
    kabupaten = relationship("KabupatenKota")
