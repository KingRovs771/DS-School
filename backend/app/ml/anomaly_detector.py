"""
ML Anomaly Detector Module
==========================
Menganalisis pola akses pengguna menggunakan model hybrid Isolation Forest (Scikit-Learn) 
dan LSTM (PyTorch) untuk menentukan tingkat kecurigaan aktivitas (score 0.0 - 1.0).
"""
import os
import pickle
import numpy as np
from sklearn.ensemble import IsolationForest
import torch
import torch.nn as nn
import structlog
from datetime import datetime

logger = structlog.get_logger(__name__)

# Tentukan direktori penyimpanan model ML
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "ml_model")
FOREST_PATH = os.path.join(MODEL_DIR, "anomaly_forest.pkl")
LSTM_PATH = os.path.join(MODEL_DIR, "anomaly_lstm.pt")

class LSTMSeqModel(nn.Module):
    """LSTM untuk menganalisis data runtun waktu (timing intervals & downloads)."""
    def __init__(self, input_dim=2, hidden_dim=16, num_layers=1):
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_dim, 1)
        self.sigmoid = nn.Sigmoid()
        
    def forward(self, x):
        # input x shape: (batch_size, seq_len, input_dim)
        out, (hn, cn) = self.lstm(x)
        last_out = out[:, -1, :]  # Ambil output runtun waktu terakhir
        logits = self.fc(last_out)
        return self.sigmoid(logits)

class AnomalyDetector:
    """Detektor Anomali Sesi Pengguna Hybrid."""
    def __init__(self):
        self.forest = None
        self.lstm_model = None
        self.initialize_models()

    def initialize_models(self):
        """Muat model yang sudah ada dari disk, atau inisialisasi model baru dengan data sintetis normal."""
        from app.core.config import settings
        if not settings.ENABLE_ANOMALY_DETECTION:
            logger.info("🔌 ML anomaly detector is disabled in settings. Skipping model initialization.")
            return
        os.makedirs(MODEL_DIR, exist_ok=True)
        
        # 1. Load / Fit Isolation Forest
        if os.path.exists(FOREST_PATH):
            try:
                with open(FOREST_PATH, "rb") as f:
                    self.forest = pickle.load(f)
                logger.info("Loaded Isolation Forest model from disk successfully")
            except Exception as e:
                logger.error("Failed to load Isolation Forest from disk, retraining default", error=str(e))
                self._fit_default_forest()
        else:
            self._fit_default_forest()
            
        # 2. Load / Initialize PyTorch LSTM
        self.lstm_model = LSTMSeqModel(input_dim=2, hidden_dim=16)
        if os.path.exists(LSTM_PATH):
            try:
                self.lstm_model.load_state_dict(torch.load(LSTM_PATH))
                self.lstm_model.eval()
                logger.info("Loaded LSTM Sequence model from disk successfully")
            except Exception as e:
                logger.error("Failed to load LSTM weights from disk, saving default", error=str(e))
                self._save_default_lstm()
        else:
            self._save_default_lstm()

    def _fit_default_forest(self):
        """Melatih Isolation Forest default dengan data sintetis pola interaksi normal daylight."""
        logger.info("Fitting default Isolation Forest with daylight synthetic normal data...")
        self.forest = IsolationForest(n_estimators=50, contamination=0.05, random_state=42)
        
        # Sintetis normal: jam (8-16), hari (0-4), is_new_ip (0), is_new_ua (0), downloads (0-2), interval (10s - 120s), geo (0)
        np.random.seed(42)
        n_samples = 200
        hours = np.random.randint(8, 17, size=n_samples)
        days = np.random.randint(0, 5, size=n_samples)
        new_ip = np.zeros(n_samples)
        new_ua = np.zeros(n_samples)
        downloads = np.random.randint(0, 3, size=n_samples)
        intervals = np.random.uniform(10.0, 120.0, size=n_samples)
        geo_scores = np.random.uniform(0.0, 0.1, size=n_samples)
        
        X_train = np.column_stack([hours, days, new_ip, new_ua, downloads, intervals, geo_scores])
        self.forest.fit(X_train)
        
        try:
            with open(FOREST_PATH, "wb") as f:
                pickle.dump(self.forest, f)
            logger.info("Default Isolation Forest saved to disk")
        except Exception as e:
            logger.error("Failed to save default Isolation Forest", error=str(e))

    def _save_default_lstm(self):
        """Menyimpan model default LSTM yang terinisiasi ke disk."""
        logger.info("Saving initialized default LSTM weights to disk...")
        self.lstm_model.eval()
        try:
            torch.save(self.lstm_model.state_dict(), LSTM_PATH)
            logger.info("Default LSTM model saved to disk")
        except Exception as e:
            logger.error("Failed to save default LSTM weights", error=str(e))

    def score_login(self, session_features: dict) -> float:
        """
        Mengevaluasi fitur sesi saat ini dan mengembalikan nilai anomali (0.0 - 1.0).
        Semakin mendekati 1.0, aktivitas semakin mencurigakan (anomali tinggi).
        """
        from app.core.config import settings
        if not settings.ENABLE_ANOMALY_DETECTION:
            return 0.0
            
        try:
            # 1. Feature Extraction & Static Scoring (Isolation Forest)
            hour = int(session_features.get("hour", datetime.now().hour))
            day_of_week = int(session_features.get("day_of_week", datetime.now().weekday()))
            is_new_ip = 1.0 if session_features.get("is_new_ip", False) else 0.0
            is_new_ua = 1.0 if session_features.get("is_new_ua", False) else 0.0
            downloads = float(session_features.get("download_count_1h", 0))
            interval = float(session_features.get("time_interval", 60.0))
            geo_score = float(session_features.get("geo_score", 0.0))
            
            x_static = np.array([[hour, day_of_week, is_new_ip, is_new_ua, downloads, interval, geo_score]])
            
            # Isolation forest decision_function: skor lebih rendah (negatif) menandakan outlier
            raw_forest_score = self.forest.decision_function(x_static)[0]
            # Normalisasi ke skala 0.0 - 1.0
            forest_score = np.clip((0.15 - raw_forest_score) / 0.4, 0.0, 1.0)
            
            # 2. Sequential Scoring (LSTM)
            # Track runtun waktu sekuensial interval & download counts terakhir
            seq_intervals = session_features.get("recent_intervals", [interval] * 5)
            seq_downloads = session_features.get("recent_downloads", [downloads] * 5)
            
            # Pad / Truncate agar panjang list sekuensial tepat 5 langkah
            if len(seq_intervals) < 5:
                seq_intervals = [interval] * (5 - len(seq_intervals)) + list(seq_intervals)
            else:
                seq_intervals = list(seq_intervals[-5:])
                
            if len(seq_downloads) < 5:
                seq_downloads = [downloads] * (5 - len(seq_downloads)) + list(seq_downloads)
            else:
                seq_downloads = list(seq_downloads[-5:])
                
            seq_data = np.column_stack([seq_intervals, seq_downloads])
            x_seq = torch.tensor([seq_data], dtype=torch.float32)
            
            with torch.no_grad():
                lstm_score = self.lstm_model(x_seq).item()
                
            # Deteksi aksi beruntun super cepat (bot/scraping indikator)
            fast_actions = sum(1 for t in seq_intervals if t < 1.5)
            if fast_actions >= 3:
                lstm_score = max(lstm_score, 0.85)

            # Skor Hybrid: 60% Isolation Forest (Static Features) + 40% LSTM (Sequential Patterns)
            combined_score = 0.6 * forest_score + 0.4 * lstm_score
            
            # Amplifikasi Aturan Kritis Keamanan
            # Aturan 1: Aksi beruntun ekstrim dengan volume unduh tinggi
            if downloads > 15 and interval < 1.0:
                combined_score = max(combined_score, 0.95)
                
            # Aturan 2: Login dari IP baru pada dini hari di luar jam wajar
            if (hour < 5 or hour > 22) and is_new_ip > 0:
                combined_score = max(combined_score, 0.75)
                
            return float(np.clip(combined_score, 0.0, 1.0))
            
        except Exception as e:
            logger.error("Error calculating ML anomaly score, using fallback rule engine", error=str(e))
            return self._fallback_rule_score(session_features)

    def _fallback_rule_score(self, f: dict) -> float:
        """Rule engine fallback untuk menghitung skor jika komputasi ML error."""
        score = 0.1
        if f.get("is_new_ip", False): score += 0.25
        if f.get("is_new_ua", False): score += 0.15
        if f.get("download_count_1h", 0) > 10: score += 0.3
        if f.get("time_interval", 60.0) < 1.5: score += 0.35
        hour = f.get("hour", datetime.now().hour)
        if hour < 5 or hour > 22: score += 0.15
        return float(min(score, 1.0))

    def retrain_model(self, audit_logs: list) -> bool:
        """
        Retrain model secara berkala menggunakan data riwayat log audit nyata.
        logs: list dari model SQLAlchemy AuditLog.
        """
        logger.info("Initializing weekly model retraining with audit log history...", logs_found=len(audit_logs))
        if len(audit_logs) < 10:
            logger.warning("Not enough logs found to retrain. Retraining requires at least 10 entries.")
            return False
            
        try:
            X_data = []
            for log in audit_logs:
                dt = log.created_at
                hour = dt.hour
                day_of_week = dt.weekday()
                
                # Cek detail IP/UA baru
                log_detail_str = str(log.detail).lower() if log.detail else ""
                is_new_ip = 1.0 if "new_ip" in log_detail_str else 0.0
                is_new_ua = 1.0 if "new_ua" in log_detail_str else 0.0
                
                downloads = 5.0 if log.action == "dokumen_download" else 0.0
                
                interval = 30.0
                if log.detail and isinstance(log.detail, dict):
                    interval = float(log.detail.get("interval", 30.0))
                    
                geo_score = 0.5 if is_new_ip > 0.0 else 0.0
                
                X_data.append([hour, day_of_week, is_new_ip, is_new_ua, downloads, interval, geo_score])
                
            X_train = np.array(X_data)
            
            # Latih ulang Isolation Forest
            new_forest = IsolationForest(n_estimators=50, contamination=0.05, random_state=42)
            new_forest.fit(X_train)
            
            # Ganti model memori & simpan berkas
            self.forest = new_forest
            with open(FOREST_PATH, "wb") as f:
                pickle.dump(self.forest, f)
                
            logger.info("Model Isolation Forest successfully retrained", training_shape=X_train.shape)
            return True
            
        except Exception as e:
            logger.error("Failed weekly retraining", error=str(e))
            return False

# Export instance tunggal global
anomaly_detector = AnomalyDetector()
