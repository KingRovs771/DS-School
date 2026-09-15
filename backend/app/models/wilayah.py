from datetime import datetime, timezone
import uuid
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from app.core.database import Base

class KabupatenKota(Base):
    __tablename__ = "kabupaten_kota"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    nama: Mapped[str] = mapped_column(String(200), nullable=False)
    provinsi: Mapped[str] = mapped_column(String(100), nullable=False)
    kode_kemendagri: Mapped[str | None] = mapped_column(String(10), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    dinas_admins = relationship("DinasAdmin", back_populates="kabupaten", cascade="all, delete-orphan")
    sekolah_list = relationship("Sekolah", back_populates="kabupaten")

class DinasAdmin(Base):
    __tablename__ = "dinas_admin"
    
    __table_args__ = (
        Index("idx_dinas_admin_kabupaten", "kabupaten_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    kabupaten_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kabupaten_kota.id"), nullable=False
    )
    nama_lengkap: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="dinas_pendidikan", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    kabupaten = relationship("KabupatenKota", back_populates="dinas_admins")

    @validates("nama_lengkap")
    def validate_nama_lengkap(self, key, value):
        if value is not None:
            return " ".join([word.capitalize() for word in value.split()])
        return value
