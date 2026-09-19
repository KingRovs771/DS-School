"""
Crypto Module — Core Cryptographic & Encryption Utilities untuk DMS Sekolah
========================================================================
Berisi implementasi standar industri untuk:
1. AES-256-GCM untuk enkripsi file dokumen sekolah.
2. HKDF-SHA256 untuk derivasi kunci enkripsi dokumen dari kunci siswa.
3. RSA-4096 untuk Master Key Sekolah (pembungkusan/wrapping kunci siswa).
4. Argon2id untuk password hashing aman.
5. SHA-256 untuk verifikasi integritas file.
6. Key Rotation: re-enkripsi dokumen siswa jika entropy_seed diubah.
"""
import base64
import hashlib
import secrets
from typing import Tuple

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


# ─── 1. HKDF KEY DERIVATION Helper ──────────────────────────────────────────

def _derive_document_key(student_key: bytes, salt: bytes) -> bytes:
    """Menderivasi kunci AES-256 khusus untuk dokumen dari student master key."""
    hkdf_inst = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        info=b"DMS_DOCUMENT_ENCRYPTION_KEY_v1"
    )
    return hkdf_inst.derive(student_key)


# ─── 2. AES-256-GCM FILE ENCRYPTION ──────────────────────────────────────────

def encrypt_document(file_bytes: bytes, student_key: bytes) -> bytes:
    """
    Mengeenkripsi konten file menggunakan AES-256-GCM.
    Kunci AES unik untuk dokumen dide-derive menggunakan HKDF dengan nonce sebagai salt.
    Output: bytes berupa gabungan `nonce` (12 bytes) + `ciphertext` (termasuk 16 bytes tag di akhir).
    """
    # Buat nonce acak 12 bytes untuk AES-GCM
    nonce = secrets.token_bytes(12)
    
    # Derive kunci AES-256 khusus untuk file dokumen ini
    aes_key = _derive_document_key(student_key, nonce)
    
    # Enkripsi dengan AESGCM
    aesgcm = AESGCM(aes_key)
    ciphertext = aesgcm.encrypt(nonce, file_bytes, None)
    
    # Gabungkan nonce di depan agar file mandiri untuk didekripsi
    return nonce + ciphertext


def decrypt_document(encrypted_bytes: bytes, student_key: bytes) -> bytes:
    """
    Mendekripsi file terenkripsi AES-256-GCM.
    Memisahkan nonce dari ciphertext, lalu mendekripsinya secara aman.
    """
    if len(encrypted_bytes) < 12 + 16:
        raise ValueError("Invalid ciphertext length: file is corrupted or too short")
        
    # Ekstrak nonce (12 bytes)
    nonce = encrypted_bytes[:12]
    ciphertext = encrypted_bytes[12:]
    
    # Derive kunci AES-256 dari student master key
    aes_key = _derive_document_key(student_key, nonce)
    
    # Dekripsi
    aesgcm = AESGCM(aes_key)
    return aesgcm.decrypt(nonce, ciphertext, None)


# ─── 3. RSA-4096 MASTER KEY PAIR GENERATOR ────────────────────────────────────

def generate_master_key() -> Tuple[str, str]:
    """
    Menghasilkan pasangan kunci Master Key RSA-4096 milik sekolah.
    Mengembalikan: (public_key_pem_string, private_key_pem_string).
    """
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=4096
    )
    public_key = private_key.public_key()
    
    # Export Private Key ke PEM format
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    
    # Export Public Key ke PEM format
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')
    
    return public_pem, private_pem


# ─── 4. RSA KEY WRAPPING ──────────────────────────────────────────────────────

def wrap_student_key(student_key: bytes, master_public_key_pem: str) -> str:
    """
    Membungkus kunci unik siswa (32 bytes) menggunakan Master Public Key sekolah (RSA-4096)
    agar dapat disimpan dengan aman di database.
    Menggunakan padding RSA-OAEP dengan hash SHA-256.
    Mengembalikan: Base64 string dari kunci terbungkus.
    """
    public_key = serialization.load_pem_public_key(master_public_key_pem.encode('utf-8'))
    
    # Pastikan public_key adalah kunci RSA
    if not isinstance(public_key, rsa.RSAPublicKey):
        raise ValueError("Provided key is not an RSA public key")
        
    wrapped = public_key.encrypt(
        student_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    return base64.b64encode(wrapped).decode('utf-8')


def unwrap_student_key(wrapped_key_b64: str, master_private_key_pem: str) -> bytes:
    """
    Membuka bungkus kunci unik siswa menggunakan Master Private Key sekolah (RSA-4096).
    Mengembalikan: 32 bytes student_key mentah.
    """
    private_key = serialization.load_pem_private_key(
        master_private_key_pem.encode('utf-8'),
        password=None
    )
    
    # Pastikan private_key adalah kunci RSA
    if not isinstance(private_key, rsa.RSAPrivateKey):
        raise ValueError("Provided key is not an RSA private key")
        
    wrapped_bytes = base64.b64decode(wrapped_key_b64.encode('utf-8'))
    
    unwrapped = private_key.decrypt(
        wrapped_bytes,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    return unwrapped


# ─── 5. ARGON2ID PASSWORD HASHING ─────────────────────────────────────────────

def hash_password(password: str) -> str:
    """
    Melakukan hashing password menggunakan algoritma Argon2id secara aman.
    Parameter yang digunakan memenuhi standar RFC 9106 (m=65536, t=3, p=4).
    Mengembalikan: Format string standar PHC ($argon2id$v=19$...).
    """
    salt = secrets.token_bytes(16)
    argon2id = Argon2id(
        salt=salt,
        length=32,
        iterations=3,
        lanes=4,
        memory_cost=65536
    )
    res = argon2id.derive_phc_encoded(password.encode('utf-8'))
    if isinstance(res, bytes):
        return res.decode('utf-8')
    return res


def verify_password(password: str, hash_string: str) -> bool:
    """
    Memverifikasi password mentah terhadap string hash Argon2id.
    Aman dari timing attacks.
    """
    try:
        # Argon2id.verify_phc_encoded expects str for the hash_string
        Argon2id.verify_phc_encoded(password.encode('utf-8'), hash_string)
        return True
    except Exception:
        return False


# ─── 6. SHA-256 FILE HASHING ──────────────────────────────────────────────────

def compute_file_hash(file_bytes: bytes) -> str:
    """Menghitung nilai hash SHA-256 dari konten file untuk integritas."""
    return hashlib.sha256(file_bytes).hexdigest()


# ─── 7. KEY ROTATION (RE-ENKRIPSI FILE DOKUMEN) ───────────────────────────────

def rotate_student_document_key(
    encrypted_file_bytes: bytes,
    old_student_key: bytes,
    new_student_key: bytes
) -> bytes:
    """
    Melakukan re-enkripsi dokumen saat seed/kunci siswa berubah.
    1. Mendekripsi file menggunakan kunci siswa lama.
    2. Mengenkrpsi kembali file yang didekripsi menggunakan kunci siswa baru.
    Kembalian: bytes file terenkripsi baru siap di-upload ke MinIO.
    """
    # 1. Dekripsi menggunakan kunci lama
    decrypted_content = decrypt_document(encrypted_file_bytes, old_student_key)
    
    # 2. Enkripsi ulang menggunakan kunci baru
    return encrypt_document(decrypted_content, new_student_key)
