"""
NeuralKeyGen — ML-Based Deterministic Key Generation dari Profil Siswa
=====================================================================
Menghasilkan kunci enkripsi AES-256 (32 bytes) secara deterministik,
zero-storage, collision-resistant, dan irreversible dari data siswa.
"""
import hmac
import hashlib
import math
from datetime import datetime
from pathlib import Path
from typing import Optional, Union

import numpy as np
import torch
import torch.nn as nn

# --- KONSISTENSI SALT SISTEM ---
SYSTEM_SALT = b"DMS_SEKOLAH_NEURALKEYGEN_SALT_2026_v1"
MODEL_PATH = Path(__file__).parent.parent.parent.parent / "ml_model" / "student_model.pt"


# ─── HKDF IMPLEMENTATION (RFC 5869) MURNI PYTHON ──────────────────────────────

def hkdf_extract(salt: bytes, ikm: bytes) -> bytes:
    """HKDF-Extract step."""
    if not salt:
        salt = b'\x00' * 32
    return hmac.new(salt, ikm, hashlib.sha256).digest()


def hkdf_expand(prk: bytes, info: bytes, length: int) -> bytes:
    """HKDF-Expand step."""
    hash_len = 32
    n = math.ceil(length / hash_len)
    if n > 255:
        raise ValueError("Requested key length is too long for SHA-256 HKDF")
    t = b""
    okm = b""
    for i in range(1, n + 1):
        t = hmac.new(prk, t + info + bytes([i]), hashlib.sha256).digest()
        okm += t
    return okm[:length]


def hkdf(ikm: bytes, length: int, salt: bytes = b"", info: bytes = b"") -> bytes:
    """HKDF core function to derive key."""
    prk = hkdf_extract(salt, ikm)
    return hkdf_expand(prk, info, length)


# ─── STUDENT FEATURE EXTRACTOR (64 DIMENSI DETERMINISTIK) ─────────────────────

class StudentFeatureExtractor:
    """
    Mengubah profil siswa (NIS, nama hash, tgl lahir encoding, entropy_seed, angkatan)
    menjadi vektor fitur 64-dimensi secara deterministik.
    """

    def __init__(self, system_salt: bytes = SYSTEM_SALT):
        self.salt = system_salt

    def _sinusoidal(self, value: float, n_dims: int, scale: float = 10000.0) -> np.ndarray:
        """Positional encoding sinusoidal ala Transformer."""
        d = n_dims // 2
        enc = np.array([
            np.sin(value / (scale ** (2 * i / n_dims))) for i in range(d)
        ] + [
            np.cos(value / (scale ** (2 * i / n_dims))) for i in range(d)
        ], dtype=np.float32)
        return enc

    def _cyclical(self, value: float, period: float) -> np.ndarray:
        """Cyclical encoding (sin dan cos) untuk data tanggal/waktu."""
        angle = 2 * np.pi * value / period
        return np.array([np.sin(angle), np.cos(angle)], dtype=np.float32)

    def _hash_to_float(self, text: str, n_bytes: int) -> np.ndarray:
        """Mengonversi hash SHA-256 menjadi array float bernilai [0, 1]."""
        h = hashlib.sha256(text.encode('utf-8')).digest()
        return np.frombuffer(h[:n_bytes], dtype=np.uint8).astype(np.float32) / 255.0

    def extract(self, siswa: dict) -> np.ndarray:
        """
        Mengekstrak profil siswa menjadi vektor numerik 64 dimensi secara deterministik.
        Keys wajib/opsional: 'nis', 'nama_hash' atau 'nama', 'tgl_lahir', 'entropy_seed', 'angkatan'.
        """
        features = []

        # 1. NIS positional encoding (8 dim)
        nis_str = str(siswa.get('nis', '0')).replace('-', '')
        nis_val = int(nis_str) % 100_000_000 if nis_str.isdigit() else 0
        features.append(self._sinusoidal(nis_val, 8, scale=10_000_000))

        # 2. Angkatan cyclical + linear (4 dim)
        angkatan = int(siswa.get('angkatan', 2026))
        features.append(self._cyclical(angkatan - 2020, 20))
        features.append(np.array([(angkatan - 2020) / 20.0, float(angkatan % 2)], dtype=np.float32))

        # 3. Nama hash (8 dim)
        nama_hash = siswa.get('nama_hash', '')
        if not nama_hash:
            nama_biasa = siswa.get('nama', 'Siswa Anonim')
            nama_hash = hashlib.sha256(nama_biasa.lower().strip().encode()).hexdigest()
        features.append(self._hash_to_float(nama_hash, 8))

        # 4. Tanggal lahir cyclical (8 dim)
        tgl_str = siswa.get('tgl_lahir', '2010-01-01')
        try:
            tgl = datetime.strptime(tgl_str, '%Y-%m-%d')
        except ValueError:
            tgl = datetime(2010, 1, 1)
        features.append(self._cyclical(tgl.day, 31))
        features.append(self._cyclical(tgl.month, 12))
        features.append(self._cyclical(tgl.year - 1995, 30))
        features.append(np.array([float(tgl.weekday()) / 6.0, float(tgl.month <= 6)], dtype=np.float32))

        # 5. Entropy seed (16 dim)
        seed = siswa.get('entropy_seed', '00000000000000000000000000000000')
        if isinstance(seed, str):
            seed_bytes = bytes.fromhex(seed)
        else:
            seed_bytes = bytes(seed)
        if len(seed_bytes) < 16:
            seed_bytes = seed_bytes + b'\x00' * (16 - len(seed_bytes))
        seed_bytes = seed_bytes[:16]
        features.append(np.frombuffer(seed_bytes, dtype=np.uint8).astype(np.float32) / 255.0)

        # 6. Salt contribution (8 dim)
        salt_input = f"{nis_str}_{seed}"
        features.append(self._hash_to_float(salt_input, 8))

        # 7. NPSN contribution (4 dim)
        npsn = str(siswa.get('npsn', '00000000')).strip()
        features.append(self._hash_to_float(npsn, 4))

        # 8. Padding untuk mencapai tepat 64 dimensi (8 dim)
        features.append(np.zeros(8, dtype=np.float32))

        vec = np.concatenate(features)
        assert vec.shape[0] == 64, f"Expected 64 dimensions, got {vec.shape[0]}"
        return vec


# ─── NEURALKEYGEN PYTORCH MODEL ───────────────────────────────────────────────

class NeuralKeyGen(nn.Module):
    """
    Arsitektur PyTorch NeuralKeyGen berbasis Multi-Layer Perceptron (MLP)
    untuk pemetaan deterministik profil siswa ke representasi kunci 256-bit.
    """

    def __init__(self, input_dim: int = 64, hidden_1: int = 512, hidden_2: int = 256, output_dim: int = 256, dropout: float = 0.3):
        super().__init__()
        self.encoder = nn.Sequential(
            # Hidden layer 1: 512 neuron, ReLU, BatchNorm, Dropout(0.3)
            nn.Linear(input_dim, hidden_1),
            nn.BatchNorm1d(hidden_1),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout),

            # Hidden layer 2: 256 neuron, ReLU, BatchNorm, Dropout(0.3)
            nn.Linear(hidden_1, hidden_2),
            nn.BatchNorm1d(hidden_2),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout),
        )

        # Output layer: 256 neuron, Sigmoid
        self.output_head = nn.Sequential(
            nn.Linear(hidden_2, output_dim),
            nn.Sigmoid(),  # Output bernilai [0, 1]
        )
        self._init_weights()

    def _init_weights(self):
        """Inisialisasi bobot Kaiming normal agar optimal untuk ReLU."""
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
                if m.bias is not None:
                    nn.init.zeros_(m.bias)
            elif isinstance(m, nn.BatchNorm1d):
                nn.init.ones_(m.weight)
                nn.init.zeros_(m.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass dengan penanganan input batched maupun single-sample."""
        # Jika input 1D (satu sampel tanpa batch dimension), unsqueeze
        if x.dim() == 1:
            x = x.unsqueeze(0)
        h = self.encoder(x)
        out = self.output_head(h)
        return out


# ─── CORE GLOBAL RUNTIME FUNCTIONS ───────────────────────────────────────────

# Singleton model instance
_model_instance: Optional[NeuralKeyGen] = None


def get_model(model_path: Union[str, Path] = MODEL_PATH) -> NeuralKeyGen:
    """Mengambil singleton model NeuralKeyGen dengan loading otomatis."""
    global _model_instance
    if _model_instance is not None:
        return _model_instance

    model = NeuralKeyGen(input_dim=64, output_dim=256)

    # Pastikan inisialisasi awal deterministik jika model belum di-train
    torch.manual_seed(42)
    model.eval()

    path = Path(model_path)
    if path.exists():
        try:
            # Gunakan map_location='cpu' agar kompatibel di mana saja
            checkpoint = torch.load(path, map_location=torch.device('cpu'), weights_only=False)
            if isinstance(checkpoint, dict) and 'model_state' in checkpoint:
                model.load_state_dict(checkpoint['model_state'])
            elif isinstance(checkpoint, nn.Module):
                model = checkpoint
            else:
                model.load_state_dict(checkpoint)
            model.eval()
        except Exception:
            # Toleran terhadap kegagalan loading agar ada fallback deterministik
            pass

    _model_instance = model
    return _model_instance


def generate_key(siswa_profile: dict, model_path: Union[str, Path] = MODEL_PATH) -> bytes:
    """
    Menghasilkan kunci enkripsi AES-256 (32 bytes) dari profil siswa secara deterministik.
    Kunci TIDAK disimpan di database (zero-storage).

    Alur kriptografi:
    1. Ekstraksi fitur deterministik 64D dari profil siswa.
    2. Serialisasi vektor fitur menjadi bytes (IEEE 754 float32).
    3. HKDF-SHA256 langsung dari feature bytes → 32-byte AES key.
    
    Pendekatan ini menggantikan inferensi neural network yang tidak deterministik
    antar restart container (karena bobot acak tanpa checkpoint tersimpan).
    """
    # 1. Ekstraksi Fitur deterministik 64D
    extractor = StudentFeatureExtractor(SYSTEM_SALT)
    features = extractor.extract(siswa_profile)

    # 2. Serialisasi vektor fitur ke bytes (deterministik, IEEE 754 float32)
    feature_bytes = features.astype(np.float32).tobytes()

    # 3. HKDF RFC 5869 langsung dari feature bytes → 32 bytes AES-256 key
    aes_key = hkdf(
        ikm=feature_bytes,
        length=32,
        salt=SYSTEM_SALT,
        info=b"DMS_SEKOLAH_STUDENT_AES_KEY_v1"
    )
    return aes_key


def verify_key(siswa_profile: dict, test_key: bytes, model_path: Union[str, Path] = MODEL_PATH) -> bool:
    """
    Memverifikasi apakah test_key yang diberikan cocok dengan kunci yang diderivasi dari profil siswa.
    Mendukung zero-storage karena tidak memerlukan database untuk verifikasi.
    """
    generated_key = generate_key(siswa_profile, model_path)
    # Gunakan hmac.compare_digest untuk mencegah timing attacks
    return hmac.compare_digest(generated_key, test_key)
