import os
import io
import json
import hashlib
import tarfile
import zipfile
import subprocess
import tempfile
import structlog
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Union

from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes

from app.core.config import settings
from app.core.minio_client import get_minio_client

logger = structlog.get_logger(__name__)

class BackupService:
    """
    Mengelola proses backup dan restore DMS Sekolah.
    Format .dms.bak = ZIP berisi:
      - db.dump.enc       (database dump terenkripsi)
      - files.tar.enc     (MinIO objects terenkripsi)
      - manifest.json     (metadata + checksums)
    """

    FORMAT_VERSION = "1.0"

    def __init__(self):
        self.minio = get_minio_client()
        # Kunci enkripsi dari settings
        self.backup_key = bytes.fromhex(settings.BACKUP_ENCRYPTION_KEY)

    def _encrypt(self, data: bytes) -> bytes:
        """Enkripsi AES-256-GCM. Output: nonce(16) + tag(16) + ciphertext"""
        nonce = get_random_bytes(16)
        cipher = AES.new(self.backup_key, AES.MODE_GCM, nonce=nonce)
        ciphertext, tag = cipher.encrypt_and_digest(data)
        return nonce + tag + ciphertext

    def _decrypt(self, data: bytes) -> bytes:
        """Dekripsi AES-256-GCM"""
        nonce, tag, ciphertext = data[:16], data[16:32], data[32:]
        cipher = AES.new(self.backup_key, AES.MODE_GCM, nonce=nonce)
        return cipher.decrypt_and_verify(ciphertext, tag)

    def _sha256(self, data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    def create_backup(self, dibuat_oleh_id: Optional[Union[int, str]] = None) -> dict:
        """
        Buat backup lengkap: database + file MinIO.
        Return: dict dengan data backup.
        """
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp = Path(tmp_dir)

            # ── STEP 1: Dump PostgreSQL ──────────────────────────────────
            logger.info("Starting database dump...")
            db_dump_path = tmp / "db.dump"
            
            env = os.environ.copy()
            env["PGPASSWORD"] = settings.POSTGRES_PASSWORD

            result = subprocess.run([
                "pg_dump",
                "-h", settings.POSTGRES_HOST,
                "-p", str(settings.POSTGRES_PORT),
                "-U", settings.POSTGRES_USER,
                "-d", settings.POSTGRES_DB,
                "--format=custom",  # format custom agar bisa di-restore dengan pg_restore
                f"--file={db_dump_path}"
            ], env=env, capture_output=True, text=True)

            if result.returncode != 0:
                logger.error("pg_dump failed", stderr=result.stderr)
                raise RuntimeError(f"pg_dump gagal: {result.stderr}")

            db_raw = db_dump_path.read_bytes()
            db_enc = self._encrypt(db_raw)
            db_hash = self._sha256(db_raw)
            (tmp / "db.dump.enc").write_bytes(db_enc)

            # ── STEP 2: Backup file MinIO ────────────────────────────────
            logger.info("Archiving MinIO objects...")
            tar_path = tmp / "files.tar"
            file_count = 0
            
            with tarfile.open(tar_path, "w") as tar:
                objects = self.minio.list_objects(
                    settings.MINIO_BUCKET_DOCUMENTS,
                    recursive=True
                )
                for obj in objects:
                    if obj.is_dir or obj.object_name.endswith('/'):
                        continue
                    try:
                        response = self.minio.get_object(
                            settings.MINIO_BUCKET_DOCUMENTS, obj.object_name
                        )
                        content = response.read()
                        info = tarfile.TarInfo(name=obj.object_name)
                        info.size = len(content)
                        tar.addfile(info, io.BytesIO(content))
                        file_count += 1
                    except Exception as e:
                        logger.error(f"Gagal membaca file dari MinIO: {obj.object_name}", error=str(e))
                        raise e

            files_raw = tar_path.read_bytes()
            files_enc = self._encrypt(files_raw)
            files_hash = self._sha256(files_raw)
            (tmp / "files.tar.enc").write_bytes(files_enc)

            # ── STEP 3: Manifest JSON ────────────────────────────────────
            logger.info("Creating backup manifest...")
            manifest = {
                "format_version": self.FORMAT_VERSION,
                "app": "DMS Sekolah",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "database": {
                    "checksum_sha256": db_hash,
                    "size_bytes": len(db_raw),
                    "file": "db.dump.enc"
                },
                "files": {
                    "checksum_sha256": files_hash,
                    "size_bytes": len(files_raw),
                    "file_count": file_count,
                    "file": "files.tar.enc"
                }
            }
            manifest_bytes = json.dumps(manifest, indent=2).encode()
            (tmp / "manifest.json").write_bytes(manifest_bytes)

            # ── STEP 4: Zip semua menjadi .dms.bak ──────────────────────
            logger.info("Packaging to .dms.bak...")
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            bak_name = f"dms_backup_{timestamp}.dms.bak"
            bak_path = tmp / bak_name

            with zipfile.ZipFile(bak_path, "w", zipfile.ZIP_STORED) as zf:
                zf.write(tmp / "db.dump.enc", "db.dump.enc")
                zf.write(tmp / "files.tar.enc", "files.tar.enc")
                zf.write(tmp / "manifest.json", "manifest.json")

            bak_raw = bak_path.read_bytes()
            bak_hash = self._sha256(bak_raw)

            # ── STEP 5: Upload ke MinIO backup bucket ───────────────────
            logger.info("Uploading to MinIO backup bucket...")
            storage_path = f"backups/{bak_name}"
            
            # Pastikan bucket exists (backup client safety)
            if not self.minio.bucket_exists(settings.MINIO_BUCKET_BACKUP):
                self.minio.make_bucket(settings.MINIO_BUCKET_BACKUP)
                
            self.minio.put_object(
                settings.MINIO_BUCKET_BACKUP,
                storage_path,
                io.BytesIO(bak_raw),
                length=len(bak_raw),
                content_type="application/octet-stream"
            )

            logger.info(f"Backup created successfully: {bak_name} ({len(bak_raw)/1e6:.2f} MB)")
            return {
                "nama_file": bak_name,
                "ukuran_bytes": len(bak_raw),
                "checksum_sha256": bak_hash,
                "manifest_json": manifest,
                "storage_path": storage_path,
                "status": "done"
            }

    def get_download_stream(self, storage_path: str):
        """Ambil stream file backup dari MinIO untuk download"""
        return self.minio.get_object(settings.MINIO_BUCKET_BACKUP, storage_path)

    def restore_backup(self, bak_file_bytes: bytes, dry_run: bool = False) -> dict:
        """
        Restore dari file .dms.bak yang diupload.
        dry_run=True → hanya verifikasi tanpa eksekusi.
        """
        errors = []
        warnings = []

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp = Path(tmp_dir)

            # ── STEP 1: Buka ZIP ─────────────────────────────────────────
            logger.info("Opening backup file...")
            try:
                with zipfile.ZipFile(io.BytesIO(bak_file_bytes)) as zf:
                    names = zf.namelist()
                    required = {"db.dump.enc", "files.tar.enc", "manifest.json"}
                    missing = required - set(names)
                    if missing:
                        raise ValueError(f"File backup tidak lengkap: {missing}")
                    zf.extractall(tmp)
            except zipfile.BadZipFile:
                return {"success": False, "error": "File bukan format .dms.bak yang valid"}

            # ── STEP 2: Baca & validasi manifest ─────────────────────────
            logger.info("Validating manifest...")
            manifest = json.loads((tmp / "manifest.json").read_bytes())

            if manifest.get("format_version") != self.FORMAT_VERSION:
                warnings.append(f"Format versi berbeda: {manifest.get('format_version')} vs {self.FORMAT_VERSION}")

            # ── STEP 3: Verifikasi checksum ───────────────────────────────
            logger.info("Verifying checksums...")
            db_enc_raw = (tmp / "db.dump.enc").read_bytes()
            files_enc_raw = (tmp / "files.tar.enc").read_bytes()

            # Dekripsi untuk verifikasi
            try:
                db_raw = self._decrypt(db_enc_raw)
                files_raw = self._decrypt(files_enc_raw)
            except Exception as e:
                return {"success": False, "error": f"Gagal dekripsi — kunci salah atau file rusak: {e}"}

            db_hash_actual = self._sha256(db_raw)
            files_hash_actual = self._sha256(files_raw)

            if db_hash_actual != manifest["database"]["checksum_sha256"]:
                errors.append("Checksum database tidak cocok — file mungkin rusak atau dimanipulasi")

            if files_hash_actual != manifest["files"]["checksum_sha256"]:
                errors.append("Checksum files tidak cocok — file mungkin rusak atau dimanipulasi")

            if errors:
                return {"success": False, "errors": errors, "dry_run": dry_run}

            if dry_run:
                return {
                    "success": True,
                    "dry_run": True,
                    "manifest": manifest,
                    "warnings": warnings,
                    "message": "Verifikasi berhasil. Jalankan restore sesungguhnya dengan dry_run=false"
                }

            # ── STEP 4: Restore database ──────────────────────────────────
            logger.info("Restoring database...")
            db_dump_path = tmp / "db_restore.dump"
            db_dump_path.write_bytes(db_raw)

            env = os.environ.copy()
            env["PGPASSWORD"] = settings.POSTGRES_PASSWORD

            result = subprocess.run([
                "pg_restore",
                "-h", settings.POSTGRES_HOST,
                "-p", str(settings.POSTGRES_PORT),
                "-U", settings.POSTGRES_USER,
                "-d", settings.POSTGRES_DB,
                "--clean",             # drop objects sebelum create
                "--if-exists",
                "--no-owner",
                str(db_dump_path)
            ], env=env, capture_output=True, text=True)

            # pg_restore sering mengeluarkan warning yang bukan error fatal
            if result.returncode != 0:
                # Cek jika satu-satunya error adalah unrecognized configuration parameter "transaction_timeout"
                cleaned_stderr = "\n".join([
                    line for line in result.stderr.strip().split("\n")
                    if "transaction_timeout" not in line and "errors ignored on restore" not in line
                ])
                if "error" in cleaned_stderr.lower() or "critical" in cleaned_stderr.lower():
                    logger.error("pg_restore failed", stderr=result.stderr)
                    return {"success": False, "error": f"pg_restore gagal: {result.stderr}"}
                else:
                    logger.warning("pg_restore finished with ignored warnings", stderr=result.stderr)

            # ── STEP 5: Restore file MinIO ────────────────────────────────
            logger.info("Restoring MinIO objects...")
            
            # Hapus semua file lama di bucket dokumen untuk sinkronisasi identik
            existing_objects = self.minio.list_objects(settings.MINIO_BUCKET_DOCUMENTS, recursive=True)
            for obj in existing_objects:
                if not obj.is_dir:
                    self.minio.remove_object(settings.MINIO_BUCKET_DOCUMENTS, obj.object_name)

            with tarfile.open(fileobj=io.BytesIO(files_raw), mode="r") as tar:
                for member in tar.getmembers():
                    if member.isdir():
                        continue
                    content = tar.extractfile(member)
                    if content:
                        data = content.read()
                        self.minio.put_object(
                            settings.MINIO_BUCKET_DOCUMENTS,
                            member.name,
                            io.BytesIO(data),
                            length=len(data)
                        )

            logger.info("Restore completed successfully!")
            return {
                "success": True,
                "manifest": manifest,
                "warnings": warnings,
                "message": "Restore berhasil. Sistem telah dipulihkan."
            }

backup_service = BackupService()
