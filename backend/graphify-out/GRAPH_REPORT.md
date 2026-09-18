# Graph Report - app  (2026-09-15)

## Corpus Check
- 101 files · ~51,304 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 3, .ini 2, .pt 2)

## Summary
- 1075 nodes · 2937 edges · 65 communities (52 shown, 1 thin omitted)
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 482 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- sindas.py
- auth.py
- endpoints/backup.py
- admin_documents.py
- database.py
- documents.py
- superadmin_monitoring.py
- Siswa
- endpoints/sekolah.py
- superadmin_users.py
- document_service.py
- models/__init__.py
- admin_siswa.py
- endpoints/tahun_ajaran.py
- schemas/__init__.py
- AuditLog
- FastAPI
- security.py
- ml/__init__.py
- sekolah_schemas.py
- admin_master_key.py
- User
- dinas.py
- NeuralKeyGen
- AnomalyDetector
- test_student_keygen.py
- DinasAdmin
- endpoints/retention.py
- RetentionPolicy
- env.py
- BackupService
- AdminRole
- datetime
- get_audit_log
- StudentFeatureExtractor
- Dokumen
- create_access_token
- TestIndexValidation
- list_categories
- minio_client.py
- test_watermark_verify.py
- NeuralKeyGen
- import_students_via_excel
- list_users
- Admin
- student_keygen.py
- RetentionLog
- 005_add_sindas_sync_log.py
- conftest.py
- get_security_alerts
- get_retention_manager
- neural_keygen.py
- AdminListResponse

## God Nodes (most connected - your core abstractions)
1. `Admin` - 116 edges
2. `Siswa` - 78 edges
3. `Sekolah` - 76 edges
4. `Dokumen` - 49 edges
5. `AuditLog` - 47 edges
6. `Base` - 43 edges
7. `DinasAdmin` - 43 edges
8. `UserType` - 35 edges
9. `AuditStatus` - 29 edges
10. `AdminRole` - 27 edges

## Surprising Connections (you probably didn't know these)
- `test_engine()` --uses--> `Base`  [INFERRED]
  tests/conftest.py → app/core/database.py
- `TestDokumenModel` --uses--> `AdminRole`  [INFERRED]
  tests/test_schema_db.py → app/models/admin.py
- `main()` --uses--> `Admin`  [INFERRED]
  check_admins.py → app/models/admin.py
- `main()` --uses--> `Admin`  [INFERRED]
  reset_superadmin.py → app/models/admin.py
- `main()` --uses--> `Admin`  [INFERRED]
  test_verify_clean.py → app/models/admin.py

## Import Cycles
- None detected.

## Communities (65 total, 1 thin omitted)

### Community 0 - "sindas.py"
Cohesion: 0.06
Nodes (55): _get_mock_sindas_data(), get_mock_sindas_siswa(), get_mock_sindas_students(), get_sindas_sync_logs(), get_sindas_sync_status(), pull_from_sindas(), AsyncSession, get (+47 more)

### Community 1 - "auth.py"
Cohesion: 0.07
Nodes (53): change_password(), ChangePasswordRequest, Disable2FARequest, disable_2fa(), Enable2FARequest, enable_2fa(), get_current_user_me(), is_valid_uuid() (+45 more)

### Community 2 - "endpoints/backup.py"
Cohesion: 0.10
Nodes (36): BackupScheduleResponse, BackupScheduleUpdateRequest, calculate_next_run(), create_backup_manual(), download_backup(), get_backup_schedule(), get_backup_status(), list_backups() (+28 more)

### Community 3 - "admin_documents.py"
Cohesion: 0.10
Nodes (35): admin_download_document(), admin_preview_document(), bulk_upload_document(), construct_minio_path(), get_all_documents(), AsyncSession, BackgroundTasks, get (+27 more)

### Community 4 - "database.py"
Cohesion: 0.12
Nodes (25): Admin Anomali Endpoints — Monitoring Security Alerts…, get_db(), AsyncSession, Database setup — SQLAlchemy async engine & session factory, FastAPI dependency: yield a database session., get_current_active_admin(), get_current_admin(), get_current_any_user() (+17 more)

### Community 5 - "documents.py"
Cohesion: 0.10
Nodes (28): download_document(), get_my_documents(), preview_document(), AsyncSession, get, Request, Documents Endpoints (Siswa) — List, Preview, Download + Watermark…, Mengunduh dokumen PDF terenkripsi, mendekripsi kontennya, dan menyematkan… (+20 more)

### Community 6 - "superadmin_monitoring.py"
Cohesion: 0.11
Nodes (30): dinas_preview_document(), Preview dokumen (tanpa opsi download) khusus Dinas, _decrypt_superadmin_doc(), get_sekolah_detail(), list_dokumen_sekolah(), list_sekolah_monitoring(), list_siswa_sekolah(), AsyncSession (+22 more)

### Community 7 - "Siswa"
Cohesion: 0.11
Nodes (18): validates, Tabel: sekolah Menyimpan data master sekolah., Sekolah, validates, Tabel: siswa Data pribadi siswa + seed entropy untuk pembangkitan kunci…, Siswa, AsyncSession, Email siswa harus unik secara global. (+10 more)

### Community 8 - "endpoints/sekolah.py"
Cohesion: 0.12
Nodes (29): create_sekolah(), get_sekolah_biodata(), get_sindas_config(), KabupatenResponse, KabupatenSyncRequest, list_kabupaten(), list_sekolah(), AsyncSession (+21 more)

### Community 9 - "superadmin_users.py"
Cohesion: 0.13
Nodes (28): create_admin_sekolah(), create_dinas_user(), delete_admin_sekolah(), delete_dinas_user(), list_admin_sekolah(), list_dinas_users(), AsyncSession, delete (+20 more)

### Community 10 - "document_service.py"
Cohesion: 0.16
Nodes (24): Category endpoints with multi-tenant isolation support., Category, DocumentAccessLevel, DocumentStatus, DocumentVersion, str, Document model — tabel documents & categories, Riwayat versi dokumen. (+16 more)

### Community 11 - "models/__init__.py"
Cohesion: 0.11
Nodes (20): JenisDokumen, str, Jenis dokumen akademik siswa., Models package — registrasi semua model SQLAlchemy. Import order PENTING untuk…, Notifikasi, str, Model: Notifikasi ================= Notifikasi in-app untuk siswa (dan admin).…, Tabel: notifikasi Notifikasi in-app untuk siswa. Indexes: - ix_notif_siswa_id… (+12 more)

### Community 12 - "admin_siswa.py"
Cohesion: 0.11
Nodes (25): bulk_update_kelulusan(), BulkKelulusanRequest, create_student(), delete_student(), get_classes(), get_student_detail(), get_students(), AsyncSession (+17 more)

### Community 13 - "endpoints/tahun_ajaran.py"
Cohesion: 0.13
Nodes (24): create_tahun_ajaran(), delete_tahun_ajaran(), get_default_tahun_ajaran(), list_tahun_ajaran(), Any, AsyncSession, delete, get (+16 more)

### Community 14 - "schemas/__init__.py"
Cohesion: 0.18
Nodes (18): User management endpoints, str, User model — tabel users, UserRole, ChangePasswordRequest, LoginRequest, BaseModel, field_validator (+10 more)

### Community 15 - "AuditLog"
Cohesion: 0.14
Nodes (20): AnomalyDetectionMiddleware, AuditLog, AuditStatus, str, Model: AuditLog =============== Audit trail lengkap untuk setiap aksi yang…, Tipe aktor yang melakukan aksi., Hasil dari aksi yang dicatat., Tabel: audit_log Immutable audit trail — hanya INSERT, tidak ada UPDATE/DELETE.… (+12 more)

### Community 16 - "FastAPI"
Cohesion: 0.11
Nodes (18): get_settings(), field_validator, Application Configuration — menggunakan Pydantic Settings, Settings, create_app(), health_check(), lifespan(), patched_get_route_name() (+10 more)

### Community 17 - "security.py"
Cohesion: 0.14
Nodes (18): hash_password(), Melakukan hashing password menggunakan algoritma Argon2id secara aman.…, Memverifikasi password mentah terhadap string hash Argon2id. Aman dari timing…, verify_password(), Security utilities — JWT, password hashing, OAuth2, Verify a plain-text password. Supports Argon2id and fallback to legacy bcrypt., verify_password(), Model: Admin ============ Akun administrator yang mengelola DMS sekolah.… (+10 more)

### Community 18 - "ml/__init__.py"
Cohesion: 0.14
Nodes (14): ByteEmbedding, DocumentEncoder, NeuralKeyGenModel, Tensor, NeuralKeyGen Model Architecture ================================ Model encoder…, Embed byte values (0-255) ke dense vectors., Bi-LSTM encoder untuk representasi dokumen., Lengkap model NeuralKeyGen: Byte sequence → embedding → encoder → key… (+6 more)

### Community 19 - "sekolah_schemas.py"
Cohesion: 0.16
Nodes (23): AdminLoginRequest, AdminResponse, AdminTokenResponse, AdminUpdate, AuditLogList, AuditLogResponse, DokumenApprovalRequest, DokumenBase (+15 more)

### Community 20 - "admin_master_key.py"
Cohesion: 0.13
Nodes (22): get_master_key_status(), list_schools_master_keys(), MasterKeyStatusResponse, process_key_rotation(), AsyncSession, BackgroundTasks, BaseModel, get (+14 more)

### Community 21 - "User"
Cohesion: 0.20
Nodes (12): Document, User, DocumentService, AsyncSession, UploadFile, Full-text search + filter dokumen., Update metadata dokumen., Approve atau reject dokumen (admin only). (+4 more)

### Community 22 - "dinas.py"
Cohesion: 0.17
Nodes (15): approve_registrasi(), list_registrasi_sekolah(), post, Melihat daftar pendaftaran sekolah untuk wilayah dinas ini. Strategi matching…, Menyetujui pendaftaran sekolah, pindahkan ke master sekolah & buat admin, Menolak pendaftaran sekolah, reject_registrasi(), Base (+7 more)

### Community 23 - "NeuralKeyGen"
Cohesion: 0.12
Nodes (13): NeuralKeyGen, Neural network-based document key generator. Menghasilkan unique identifier /…, Load model dari file .pt ke memori., Fallback: SHA-256 based key ketika model tidak tersedia., Generate key menggunakan neural network., Generate document key dari konten binary., Async wrapper untuk generate_key., Generate keys untuk banyak dokumen sekaligus. (+5 more)

### Community 24 - "AnomalyDetector"
Cohesion: 0.13
Nodes (10): AnomalyDetector, LSTMSeqModel, Menyimpan model default LSTM yang terinisiasi ke disk., Mengevaluasi fitur sesi saat ini dan mengembalikan nilai anomali (0.0 - 1.0).…, Rule engine fallback untuk menghitung skor jika komputasi ML error., Retrain model secara berkala menggunakan data riwayat log audit nyata. logs:…, LSTM untuk menganalisis data runtun waktu (timing intervals & downloads)., Detektor Anomali Sesi Pengguna Hybrid. (+2 more)

### Community 25 - "test_student_keygen.py"
Cohesion: 0.12
Nodes (18): Memverifikasi apakah test_key yang diberikan cocok dengan kunci yang diderivasi…, verify_key(), dummy_siswa_1(), dummy_siswa_2(), fixture, Unit Tests untuk NeuralKeyGen Profil Siswa…, PROPERTI 2: Zero-Storage — Verifikasi kunci sukses secara deterministik tanpa…, PROPERTI 3: Collision-Resistant — Tidak ada dua siswa berbeda yang menghasilkan… (+10 more)

### Community 26 - "DinasAdmin"
Cohesion: 0.19
Nodes (12): get_audit_trail_logs(), get_dashboard_statistics(), AsyncSession, get, Admin Audit & Stats Endpoints — Audit Trail Logs & Dashboard Statistik…, Mengambil seluruh data penelusuran audit trail (Immutable Audit Log) sekolah.…, Mengambil data dashboard ringkasan statistik sekolah untuk visualisasi: -…, DinasAdmin (+4 more)

### Community 27 - "endpoints/retention.py"
Cohesion: 0.28
Nodes (14): create_retention_policy(), post, Retention Policy & Legal Hold Endpoints…, Buat kebijakan retensi untuk sekolah tertentu., set_legal_hold(), DokumenAkanExpiredItem, LegalHoldRead, LegalHoldSetRequest (+6 more)

### Community 28 - "RetentionPolicy"
Cohesion: 0.16
Nodes (15): delete_retention_policy(), list_dokumen_akan_expired(), list_retention_policies(), AsyncSession, delete, get, put, Request (+7 more)

### Community 29 - "env.py"
Cohesion: 0.18
Nodes (14): do_run_migrations(), get_sync_url(), get_url(), Alembic env.py — Async SQLAlchemy support…, Entrypoint untuk mode online — jalankan event loop asyncio., Ambil DATABASE_URL dari app settings., URL sinkron untuk offline/run_migrations_offline., Mode offline: generate SQL script tanpa koneksi ke database. Berguna untuk… (+6 more)

### Community 30 - "BackupService"
Cohesion: 0.18
Nodes (7): BackupService, Ambil stream file backup dari MinIO untuk download, Restore dari file .dms.bak yang diupload. dry_run=True → hanya verifikasi tanpa…, Mengelola proses backup dan restore DMS Sekolah. Format .dms.bak = ZIP berisi:…, Enkripsi AES-256-GCM. Output: nonce(16) + tag(16) + ciphertext, Buat backup lengkap: database + file MinIO. Return: dict dengan data backup., Path

### Community 31 - "AdminRole"
Cohesion: 0.23
Nodes (13): hash_password(), Hash a plain-text password using Argon2id., AdminRole, str, Hierarki peran administrator., Memastikan user test superadmin dan regular admin terdaftar di database, run_tests(), setup_test_users() (+5 more)

### Community 32 - "datetime"
Cohesion: 0.14
Nodes (4): ML Anomaly Detector Module ========================== Menganalisis pola akses…, ActivityLog model — audit trail semua aktivitas pengguna, Model: TahunAjaran ================== Data tahun ajaran akademik yang aktif dan…, datetime

### Community 33 - "get_audit_log"
Cohesion: 0.21
Nodes (14): AuditLogResponse, detail_sekolah(), get_audit_log(), list_sekolah_wilayah(), AsyncSession, BaseModel, get, Detail satu sekolah — WAJIB verifikasi sekolah dalam wilayah dinas (+6 more)

### Community 34 - "StudentFeatureExtractor"
Cohesion: 0.21
Nodes (9): Mengubah profil siswa (NIS, nama hash, tgl lahir encoding, entropy_seed,…, Positional encoding sinusoidal ala Transformer., Cyclical encoding (sin dan cos) untuk data tanggal/waktu., Mengonversi hash SHA-256 menjadi array float bernilai [0, 1]., Mengekstrak profil siswa menjadi vektor numerik 64 dimensi secara…, StudentFeatureExtractor, ndarray, Menjamin bahwa range nilai fitur berada dalam batas normal dan panjang 64. (+1 more)

### Community 35 - "Dokumen"
Cohesion: 0.15
Nodes (12): delete_document(), delete, Menghapus dokumen akademik siswa secara permanen dari sistem., list_dokumen_sekolah(), List dokumen untuk suatu sekolah (metadata) bagi Dinas, AsyncSession, get, Request (+4 more)

### Community 36 - "create_access_token"
Cohesion: 0.21
Nodes (10): create_access_token(), create_refresh_token(), Any, Create a signed JWT access token., Create a signed JWT refresh token., AsyncSession, Authenticate user dan return JWT tokens., Issue new access token menggunakan refresh token. (+2 more)

### Community 37 - "TestIndexValidation"
Cohesion: 0.24
Nodes (6): AdminCreate, DokumenCreate, field_validator, SiswaCreate, Validasi Pydantic schemas., TestIndexValidation

### Community 38 - "list_categories"
Cohesion: 0.22
Nodes (11): create_category(), delete_category(), list_categories(), Any, AsyncSession, delete, get, post (+3 more)

### Community 39 - "minio_client.py"
Cohesion: 0.18
Nodes (10): delete_file(), get_presigned_url(), init_minio_buckets(), MinIO client initialization & bucket management, Create required buckets if they don't exist., Upload file ke MinIO dan return URL-nya., Generate a presigned URL for temporary access., Hapus file dari MinIO. (+2 more)

### Community 40 - "test_watermark_verify.py"
Cohesion: 0.25
Nodes (10): apply_watermark_and_qr(), create_signed_token(), generate_qr_code_image(), Test Watermark and QR Code Generation (Standalone Integration Test)…, Menghasilkan kode QR dalam format PNG (bytes)., Membuat signed token berisi siswa_id, doc_id, dan timestamp download., Verifikasi keabsahan token HMAC-SHA256., Menyematkan watermark diagonal dan QR code pojok kanan bawah PDF. (+2 more)

### Community 41 - "NeuralKeyGen"
Cohesion: 0.24
Nodes (7): get_model(), NeuralKeyGen, Tensor, Arsitektur PyTorch NeuralKeyGen berbasis Multi-Layer Perceptron (MLP) untuk…, Inisialisasi bobot Kaiming normal agar optimal untuk ReLU., Forward pass dengan penanganan input batched maupun single-sample., Mengambil singleton model NeuralKeyGen dengan loading otomatis.

### Community 42 - "import_students_via_excel"
Cohesion: 0.33
Nodes (8): import_students_via_excel(), clean_email(), clean_gender(), clean_phone(), clean_val(), to_int(), UploadFile, Melakukan import massal (bulk import) data siswa baru via Excel. Secara…

### Community 43 - "list_users"
Cohesion: 0.25
Nodes (9): get_user(), list_users(), AsyncSession, get, List semua user (admin only)., Ambil data user by ID., Update profil sendiri., update_my_profile() (+1 more)

### Community 44 - "Admin"
Cohesion: 0.25
Nodes (6): get_tu_sekolah(), Dependency: Memastikan admin yang login memiliki hak akses tu_sekolah, admin,…, Admin, validates, Tabel: admin Akun pengelola DMS. Terikat ke satu sekolah (kecuali super_admin).…, main()

### Community 45 - "student_keygen.py"
Cohesion: 0.32
Nodes (7): hkdf(), hkdf_expand(), hkdf_extract(), NeuralKeyGen — ML-Based Deterministic Key Generation dari Profil Siswa…, HKDF core function to derive key., Menguji keselarasan implementasi HKDF murni kami dengan uji vektor standar., test_hkdf_rfc5869_compliance()

### Community 46 - "RetentionLog"
Cohesion: 0.33
Nodes (4): AksiRetensi, str, Tabel: retention_log Immutable log setiap aksi retensi yang dieksekusi., RetentionLog

### Community 47 - "005_add_sindas_sync_log.py"
Cohesion: 0.40
Nodes (4): downgrade(), Hapus tabel sindas_sync_log dan enum types., Buat tabel sindas_sync_log dan enum types yang dibutuhkan., upgrade()

### Community 48 - "conftest.py"
Cohesion: 0.60
Nodes (4): db_session(), event_loop(), fixture, test_engine()

### Community 49 - "get_security_alerts"
Cohesion: 0.50
Nodes (4): get_security_alerts(), AsyncSession, get, Mengambil seluruh data peringatan anomali (ANOMALY_WARNING dan…

### Community 50 - "get_retention_manager"
Cohesion: 0.50
Nodes (4): get_retention_manager(), is_valid_uuid(), Any, HTTPAuthorizationCredentials

### Community 51 - "neural_keygen.py"
Cohesion: 0.50
Nodes (3): get_neural_keygen(), NeuralKeyGen — Core wrapper untuk model ML penghasil kunci dokumen, Singleton instance of NeuralKeyGen (FastAPI dependency).

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Admin` connect `Admin` to `sindas.py`, `auth.py`, `endpoints/backup.py`, `admin_documents.py`, `database.py`, `superadmin_monitoring.py`, `Siswa`, `endpoints/sekolah.py`, `superadmin_users.py`, `models/__init__.py`, `admin_siswa.py`, `endpoints/tahun_ajaran.py`, `security.py`, `admin_master_key.py`, `dinas.py`, `DinasAdmin`, `endpoints/retention.py`, `RetentionPolicy`, `AdminRole`, `get_audit_log`, `Dokumen`, `import_students_via_excel`, `get_security_alerts`, `get_retention_manager`?**
  _High betweenness centrality (0.180) - this node is a cross-community bridge._
- **Why does `Siswa` connect `Siswa` to `sindas.py`, `auth.py`, `admin_documents.py`, `database.py`, `documents.py`, `superadmin_monitoring.py`, `document_service.py`, `models/__init__.py`, `admin_siswa.py`, `endpoints/tahun_ajaran.py`, `admin_master_key.py`, `dinas.py`, `DinasAdmin`, `endpoints/retention.py`, `RetentionPolicy`, `get_audit_log`, `Dokumen`, `list_categories`, `import_students_via_excel`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Why does `Sekolah` connect `Siswa` to `sindas.py`, `get_audit_log`, `admin_documents.py`, `Dokumen`, `documents.py`, `list_categories`, `superadmin_monitoring.py`, `endpoints/sekolah.py`, `superadmin_users.py`, `document_service.py`, `models/__init__.py`, `admin_master_key.py`, `dinas.py`, `DinasAdmin`, `endpoints/retention.py`, `RetentionPolicy`, `AdminRole`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Are the 85 inferred relationships involving `Admin` (e.g. with `get_audit_trail_logs()` and `get_dashboard_statistics()`) actually correct?**
  _`Admin` has 85 INFERRED edges - model-reasoned connections that need verification._
- **Are the 50 inferred relationships involving `Siswa` (e.g. with `get_audit_trail_logs()` and `get_dashboard_statistics()`) actually correct?**
  _`Siswa` has 50 INFERRED edges - model-reasoned connections that need verification._
- **Are the 48 inferred relationships involving `Sekolah` (e.g. with `get_audit_trail_logs()` and `get_dashboard_statistics()`) actually correct?**
  _`Sekolah` has 48 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `datetime` (e.g. with `get_dashboard_statistics()` and `.extract()`) actually correct?**
  _`datetime` has 2 INFERRED edges - model-reasoned connections that need verification._