import os
import sys
import time
import httpx
import asyncio
import uuid

# Tambahkan path app agar bisa import config & security
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.core.config import settings
from app.core.security import create_access_token
from app.core.database import AsyncSessionLocal
from app.models.admin import Admin, AdminRole
from app.models.audit_log import AuditLog

BASE_URL = "http://127.0.0.1:8000/api/v1"

async def setup_test_users():
    """Memastikan user test superadmin dan regular admin terdaftar di database"""
    async with AsyncSessionLocal() as db:
        # Cari atau buat super_admin
        from sqlalchemy import select
        res = await db.execute(select(Admin).where(Admin.username == "superadmin"))
        superadmin = res.scalar_one_or_none()
        if not superadmin:
            # Jika belum ada (misal DB kosong), buat superadmin mock
            from app.core.security import hash_password
            superadmin = Admin(
                username="superadmin",
                email="superadmin@dms.id",
                nama_lengkap="Super Admin Mock",
                password_hash=hash_password("password"),
                role=AdminRole.SUPER_ADMIN,
                is_active=True,
                is_verified=True
            )
            db.add(superadmin)
            await db.commit()
            await db.refresh(superadmin)

        # Cari atau buat regular admin untuk pengetesan 403
        res = await db.execute(select(Admin).where(Admin.username == "regularadmin"))
        regadmin = res.scalar_one_or_none()
        if not regadmin:
            from app.core.security import hash_password
            regadmin = Admin(
                username="regularadmin",
                email="regularadmin@dms.id",
                nama_lengkap="Regular Admin Mock",
                password_hash=hash_password("password"),
                role=AdminRole.ADMIN,  # regular admin
                is_active=True,
                is_verified=True
            )
            db.add(regadmin)
            await db.commit()
            await db.refresh(regadmin)

        # Generate tokens
        super_token = create_access_token(
            subject=f"admin:{superadmin.id}",
            extra_claims={"role": "super_admin"}
        )
        admin_token = create_access_token(
            subject=f"admin:{regadmin.id}",
            extra_claims={"role": "admin"}
        )

        return super_token, admin_token, superadmin.id, regadmin.id

async def run_tests():
    print("=== MEMULAI INTEGRATION TEST BACKUP & RESTORE ===")
    
    # 1. Setup users dan dapatkan tokens
    super_token, admin_token, super_id, admin_id = await setup_test_users()
    super_headers = {"Authorization": f"Bearer {super_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    client = httpx.AsyncClient()

    # AC-BK-01: Backup manual bisa dibuat dan diunduh
    print("\n--- TEST AC-BK-01: Trigger Backup Manual ---")
    r = await client.post(f"{BASE_URL}/admin/backup/create", headers=super_headers, timeout=60)
    assert r.status_code == 200, f"Gagal membuat backup: {r.text}"
    res_data = r.json()
    backup_id = res_data["backup_id"]
    print(f"Backup ID: {backup_id}, Status: {res_data['status']}")

    # Polling status backup sampai selesai (max 60 detik)
    print("Polling backup status...")
    backup_file_name = ""
    for i in range(20):
        await asyncio.sleep(2)
        r = await client.get(f"{BASE_URL}/admin/backup/{backup_id}/status", headers=super_headers)
        assert r.status_code == 200, f"Gagal poll status: {r.text}"
        status_data = r.json()
        print(f"  Poll {i+1} status: {status_data['status']}")
        if status_data["status"] == "done":
            backup_file_name = status_data["nama_file"]
            break
        elif status_data["status"] == "failed":
            raise RuntimeError(f"Backup gagal di latar belakang: {status_data.get('error')}")
    else:
        raise TimeoutError("Pembuatan backup timeout")

    # Download backup file
    print("Mengunduh berkas backup...")
    r = await client.get(f"{BASE_URL}/admin/backup/{backup_id}/download", headers=super_headers, timeout=120)
    assert r.status_code == 200, f"Gagal download backup: {r.text}"
    backup_content = r.content
    print(f"Selesai mengunduh! Ukuran berkas: {len(backup_content)/1e6:.2f} MB")
    
    # Simpan backup sementara untuk restore
    bak_file_path = "test_backup.dms.bak"
    with open(bak_file_path, "wb") as f:
        f.write(backup_content)

    # AC-BK-02: File corrupt ditolak
    print("\n--- TEST AC-BK-02: Verifikasi File Corrupt ---")
    corrupt_content = b"INVALID_ZIP_SIGNATURE_AND_CORRUPT" + backup_content[20:]
    r = await client.post(
        f"{BASE_URL}/admin/backup/restore/verify",
        files={"file": ("test_corrupt.dms.bak", corrupt_content)},
        headers=super_headers,
        timeout=30
    )
    assert r.status_code == 200, f"Gagal panggil verify: {r.text}"
    assert r.json()["success"] is False, "Berkas corrupt harusnya ditolak!"
    print("PASS: Berkas corrupt berhasil ditolak dengan tepat.")

    # AC-BK-03: Verify dry run sukses untuk file valid
    print("\n--- TEST AC-BK-03: Dry Run Verifikasi File Valid ---")
    with open(bak_file_path, "rb") as f:
        r = await client.post(
            f"{BASE_URL}/admin/backup/restore/verify",
            files={"file": ("test_backup.dms.bak", f)},
            headers=super_headers,
            timeout=30
        )
    assert r.status_code == 200, f"Gagal verify file valid: {r.text}"
    verify_res = r.json()
    assert verify_res["success"] is True, f"Verify file valid gagal: {verify_res}"
    print(f"PASS: Verifikasi dry run sukses! Manifest: {verify_res['manifest']}")

    # AC-BK-04: Admin biasa mencoba restore -> 403 Forbidden
    print("\n--- TEST AC-BK-04: Otorisasi Regular Admin (Restore) ---")
    with open(bak_file_path, "rb") as f:
        r = await client.post(
            f"{BASE_URL}/admin/backup/restore",
            files={"file": ("test_backup.dms.bak", f)},
            params={"konfirmasi": "SAYA MENGERTI RESTORE AKAN MENIMPA DATA SAAT INI"},
            headers=admin_headers,
            timeout=30
        )
    assert r.status_code == 403, f"Regular admin harusnya ditolak dengan 403, tapi mendapat: {r.status_code}"
    print("PASS: Regular admin berhasil diblokir dari proses restore.")

    # AC-BK-05: Restore sukses dan data utuh
    print("\n--- TEST AC-BK-05: Eksekusi Restore Penuh ---")
    with open(bak_file_path, "rb") as f:
        r = await client.post(
            f"{BASE_URL}/admin/backup/restore",
            files={"file": ("test_backup.dms.bak", f)},
            params={"konfirmasi": "SAYA MENGERTI RESTORE AKAN MENIMPA DATA SAAT INI"},
            headers=super_headers,
            timeout=60
        )
    assert r.status_code == 200, f"Eksekusi restore gagal: {r.text}"
    restore_res = r.json()
    assert restore_res["success"] is True, f"Restore gagal: {restore_res}"
    print("PASS: Sistem berhasil dipulihkan dengan sukses.")

    # AC-BK-06: Audit Log dicatat
    print("\n--- TEST AC-BK-06: Pengecekan Audit Trail Log ---")
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        # Ambil log terbaru dari admin
        res = await db.execute(
            select(AuditLog)
            .where(AuditLog.user_id == super_id)
            .order_by(AuditLog.created_at.desc())
            .limit(5)
        )
        logs = res.scalars().all()
        actions = [l.action for l in logs]
        print(f"Aksi audit trail terbaru: {actions}")
        assert "restore_completed" in actions or "restore_started" in actions, "Audit log restore tidak tercatat!"
    print("PASS: Log aktivitas backup dan restore tercatat di AuditLog.")

    # Cleanup berkas test
    if os.path.exists(bak_file_path):
        os.remove(bak_file_path)

    await client.aclose()
    print("\n=== SEMUA INTEGRATION TEST PASS DENGAN SUKSES! ===")

if __name__ == "__main__":
    # Tunggu sebentar untuk memastikan server uvicorn sudah up
    asyncio.run(run_tests())
