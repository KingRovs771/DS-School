"""
Application Configuration — menggunakan Pydantic Settings
"""
import json
from functools import lru_cache
from typing import List, Union

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── App ────────────────────────────────────────────────────────────
    APP_NAME: str = "DMS Sekolah"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "change-me-in-production"
    ALLOWED_ORIGINS: Union[str, List[str]] = ["http://localhost:3000"]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except json.JSONDecodeError:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        raise ValueError(f"Invalid type for ALLOWED_ORIGINS: {type(v)}")

    # ── Database ───────────────────────────────────────────────────────
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "dms_sekolah"
    POSTGRES_USER: str = "dms_user"
    POSTGRES_PASSWORD: str = "your-strong-db-password"
    DATABASE_URL: str = "postgresql+asyncpg://dms_user:your-strong-db-password@postgres:5432/dms_sekolah"


    # ── Redis ──────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_PASSWORD: str = ""

    # ── MinIO ──────────────────────────────────────────────────────────
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ROOT_USER: str = "minioadmin"
    MINIO_ROOT_PASSWORD: str = "minioadmin"
    MINIO_BUCKET_DOCUMENTS: str = "dms-documents"
    MINIO_BUCKET_AVATARS: str = "dms-avatars"
    MINIO_USE_SSL: bool = False

    # ── JWT ────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "jwt-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Email ──────────────────────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@dms-sekolah.id"
    EMAIL_FROM_NAME: str = "DMS Sekolah"

    # ── ML ─────────────────────────────────────────────────────────────
    ML_MODEL_PATH: str = "/ml_model/model.pt"
    ML_DEVICE: str = "cpu"
    ML_KEY_LENGTH: int = 32
    ML_BATCH_SIZE: int = 16
    ENABLE_ANOMALY_DETECTION: bool = True

    # ── Logging ────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    # ── SINDAS Integration ─────────────────────────────────────────────────
    SINDAS_API_BASE_URL: str = ""                   # Base URL REST API SINDAS
    SINDAS_API_KEY: str = ""                        # API Key untuk pull data dari SINDAS
    SINDAS_WEBHOOK_SECRET: str = "change-me"        # Secret untuk verifikasi signature webhook
    SINDAS_DEFAULT_SEKOLAH_ID: int = 1              # Fallback sekolah_id jika tidak ada di payload
    SINDAS_ENABLED: bool = True                     # Feature flag — matikan jika SINDAS tidak tersedia

    # ── Backup ─────────────────────────────────────────────────────────────
    BACKUP_ENCRYPTION_KEY: str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    MINIO_BUCKET_BACKUP: str = "dms-backup"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
