import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import AdminLayout from "@/components/AdminLayout";
import { useRequireAdmin } from "@/hooks/useAdminAuth";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { 
  ArrowDownTrayIcon, 
  ArrowPathIcon, 
  CloudArrowUpIcon, 
  ExclamationTriangleIcon,
  CircleStackIcon,
  CalendarDaysIcon,
  CpuChipIcon,
  CheckCircleIcon,
  ClockIcon,
  Cog6ToothIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import api from "@/lib/api";

interface BackupRecord {
  id: string;
  nama_file: string;
  ukuran_mb: number;
  status: string;
  tipe: string;
  created_at: string;
  restored_at: string | null;
}

interface BackupSchedule {
  is_active: boolean;
  frequency: "daily" | "weekly" | "monthly";
  time_of_day: string;
  day_of_week?: number | null;
  day_of_month?: number | null;
  last_run_at?: string | null;
  next_run_at?: string | null;
  updated_at?: string | null;
}

const NAMA_HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export default function BackupPage() {
  const { isAdminAuthenticated, mounted } = useRequireAdmin();
  const admin = useAdminAuthStore((s) => s.admin);
  const isSuperAdmin = admin?.role === 'super_admin';

  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pollingId, setPollingId] = useState<string | null>(null);

  // Automatic Schedule State
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Form State for Schedule Modal
  const [formActive, setFormActive] = useState(true);
  const [formFrequency, setFormFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [formTime, setFormTime] = useState("02:00");
  const [formDayOfWeek, setFormDayOfWeek] = useState(0);
  const [formDayOfMonth, setFormDayOfMonth] = useState(1);

  // Restore State
  const [restoreStep, setRestoreStep] = useState<1 | 2>(1);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchBackups();
      fetchSchedule();
    }
  }, [isAdminAuthenticated]);

  const fetchSchedule = async () => {
    try {
      setLoadingSchedule(true);
      const res = await api.get("/admin/backup/schedule");
      setSchedule(res.data);
      setFormActive(res.data.is_active);
      setFormFrequency(res.data.frequency);
      setFormTime(res.data.time_of_day);
      setFormDayOfWeek(res.data.day_of_week ?? 0);
      setFormDayOfMonth(res.data.day_of_month ?? 1);
    } catch (err: any) {
      console.error("Gagal memuat jadwal backup:", err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSchedule(true);
      const payload = {
        is_active: formActive,
        frequency: formFrequency,
        time_of_day: formTime,
        day_of_week: formFrequency === "weekly" ? formDayOfWeek : null,
        day_of_month: formFrequency === "monthly" ? formDayOfMonth : null,
      };
      const res = await api.put("/admin/backup/schedule", payload);
      setSchedule(res.data);
      setIsScheduleModalOpen(false);
      toast.success("Jadwal backup otomatis berhasil diperbarui!");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal menyimpan jadwal backup");
    } finally {
      setSavingSchedule(false);
    }
  };

  // Polling for active backup creation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (pollingId) {
      interval = setInterval(async () => {
        try {
          const res = await api.get(`/admin/backup/${pollingId}/status`);
          const status = res.data.status;
          if (status === "done") {
            toast.success("Backup berhasil diselesaikan!");
            setPollingId(null);
            setCreating(false);
            fetchBackups();
          } else if (status === "failed") {
            toast.error(`Backup gagal: ${res.data.error || "Error tidak diketahui"}`);
            setPollingId(null);
            setCreating(false);
            fetchBackups();
          }
        } catch {
          setPollingId(null);
          setCreating(false);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [pollingId]);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/backup?limit=5");
      setBackups((res.data.data || []).slice(0, 5));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal memuat daftar backup");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (creating) return;
    try {
      setCreating(true);
      const res = await api.post("/admin/backup/create");
      const backupId = res.data.backup_id;
      setPollingId(backupId);
      toast.success("Proses backup dimulai di latar belakang...");
      fetchBackups();
    } catch (err: any) {
      setCreating(false);
      toast.error(err.response?.data?.detail || "Gagal memicu backup");
    }
  };

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (backup: BackupRecord) => {
    if (downloadingId) return;
    try {
      setDownloadingId(backup.id);
      toast.loading(`Menyiapkan pengunduhan: ${backup.nama_file}...`, { id: "download-backup" });

      const response = await api.get(`/admin/backup/${backup.id}/download`, {
        responseType: "blob",
      });

      // Buat blob URL dan trigger download langsung di browser
      const blob = new Blob([response.data], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", backup.nama_file);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Berhasil mengunduh berkas: ${backup.nama_file}`, { id: "download-backup" });
    } catch (err: any) {
      console.error("Gagal mengunduh backup:", err);
      let errorMsg = "Gagal mengunduh berkas backup";

      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          if (json.detail) errorMsg = json.detail;
        } catch {
          // fallback
        }
      } else if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      }

      toast.error(errorMsg, { id: "download-backup", duration: 5000 });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setRestoreFile(e.target.files[0]);
      setVerifyResult(null);
      setRestoreStep(1);
    }
  };

  const handleVerify = async () => {
    if (!restoreFile) return;
    try {
      setRestoring(true);
      const formData = new FormData();
      formData.append("file", restoreFile);

      toast.loading("Memverifikasi berkas backup...", { id: "verify" });
      const res = await api.post("/admin/backup/restore/verify", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.data.success) {
        setVerifyResult(res.data.manifest);
        setRestoreStep(2);
        toast.success("Verifikasi berkas berhasil!", { id: "verify" });
      } else {
        toast.error(res.data.error || "Berkas tidak valid atau corrupt", { id: "verify" });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal memverifikasi berkas backup", { id: "verify" });
    } finally {
      setRestoring(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile || confirmText !== "SAYA MENGERTI RESTORE AKAN MENIMPA DATA SAAT INI") {
      toast.error("Teks konfirmasi harus ditulis persis sama.");
      return;
    }

    try {
      setRestoring(true);
      const formData = new FormData();
      formData.append("file", restoreFile);

      toast.loading("Sedang memulihkan sistem... Harap tunggu, jangan tutup halaman ini.", { id: "restore" });
      const res = await api.post("/admin/backup/restore", formData, {
        params: { konfirmasi: confirmText },
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.data.success) {
        toast.success("Restorasi berhasil! Halaman akan dimuat ulang.", { id: "restore" });
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        toast.error(res.data.error || "Gagal memulihkan sistem", { id: "restore" });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal memulihkan sistem", { id: "restore" });
    } finally {
      setRestoring(false);
    }
  };

  const handleResetRestore = () => {
    setRestoreFile(null);
    setVerifyResult(null);
    setConfirmText("");
    setRestoreStep(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!mounted || !isAdminAuthenticated) return null;

  const totalBackupSize = backups
    .filter(b => b.status === "done")
    .reduce((acc, curr) => acc + curr.ukuran_mb, 0);

  return (
    <AdminLayout title="Sistem Backup & Restore (Super Admin)">
      <Head>
        <title>Sistem Backup & Restore - Super Admin DS</title>
      </Head>

      <div className="space-y-6 font-body">
        
        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D4DDD9]/60 flex items-center gap-4">
            <div className="p-3 bg-[#3DB891]/10 rounded-xl">
              <CircleStackIcon className="w-8 h-8 text-[#3DB891]" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Backup</p>
              <h3 className="text-2xl font-display font-extrabold text-gray-900 mt-1">
                {backups.length} Berkas
              </h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D4DDD9]/60 flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <CpuChipIcon className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ukuran Penyimpanan</p>
              <h3 className="text-2xl font-display font-extrabold text-gray-900 mt-1">
                {totalBackupSize.toFixed(2)} MB
              </h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D4DDD9]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${schedule?.is_active ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                  <CalendarDaysIcon className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Jadwal Backup Otomatis</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      schedule?.is_active ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-600"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${schedule?.is_active ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                      {schedule?.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                </div>
              </div>

              {isSuperAdmin && (
                <button
                  onClick={() => {
                    if (schedule) {
                      setFormActive(schedule.is_active);
                      setFormFrequency(schedule.frequency);
                      setFormTime(schedule.time_of_day);
                      setFormDayOfWeek(schedule.day_of_week ?? 0);
                      setFormDayOfMonth(schedule.day_of_month ?? 1);
                    }
                    setIsScheduleModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F8F7] hover:bg-[#E0F5EE] text-[#208C68] hover:text-[#0F4C39] border border-[#D4DDD9] rounded-xl text-xs font-bold transition-all shadow-sm"
                  title="Atur Jadwal Otomatis"
                >
                  <Cog6ToothIcon className="w-3.5 h-3.5" />
                  Atur Jadwal
                </button>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100">
              <h4 className="text-sm font-bold text-gray-900">
                {!schedule ? (
                  "Memuat jadwal..."
                ) : !schedule.is_active ? (
                  <span className="text-gray-400 font-semibold">Otomatisasi Dimatikan</span>
                ) : schedule.frequency === "daily" ? (
                  `Setiap hari jam ${schedule.time_of_day} WIB`
                ) : schedule.frequency === "weekly" ? (
                  `Setiap ${NAMA_HARI[schedule.day_of_week ?? 0]} jam ${schedule.time_of_day} WIB`
                ) : (
                  `Tanggal ${schedule.day_of_month ?? 1} tiap bulan jam ${schedule.time_of_day} WIB`
                )}
              </h4>
              <p className="text-[11px] text-gray-500 mt-1">
                {schedule?.is_active && schedule?.next_run_at ? (
                  <>Berikutnya: <span className="font-semibold text-neutral-800">{new Date(schedule.next_run_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} WIB</span></>
                ) : (
                  "Hanya backup manual yang aktif"
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Panel Pengaturan Jadwal Backup Otomatis (Inline Card) */}
        <div id="jadwal-backup-section" className="bg-white p-6 rounded-2xl shadow-sm border border-[#D4DDD9]/60 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#E0F5EE] rounded-xl text-[#208C68]">
                <ClockIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-display font-bold text-gray-900 flex items-center gap-2">
                  Pengaturan Jadwal Backup Otomatis
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    formActive ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-600"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${formActive ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                    {formActive ? "Aktif" : "Nonaktif"}
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Atur frekuensi dan jam pencadangan otomatis seluruh database dan berkas dokumen terenkripsi (.dms.bak).
                </p>
              </div>
            </div>

            {/* Quick Toggle Button */}
            <div className="flex items-center gap-3 bg-[#F5F8F7] px-4 py-2.5 rounded-xl border border-[#D4DDD9]">
              <span className="text-xs font-bold text-gray-700">
                {formActive ? "Backup Otomatis Aktif" : "Backup Otomatis Dimatikan"}
              </span>
              <button
                type="button"
                onClick={() => setFormActive(!formActive)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  formActive ? "bg-[#3DB891]" : "bg-gray-300"
                }`}
                title={formActive ? "Klik untuk mematikan" : "Klik untuk menghidupkan"}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formActive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveSchedule} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              {/* Frekuensi */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Frekuensi Pencadangan</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "daily", label: "Harian" },
                    { id: "weekly", label: "Mingguan" },
                    { id: "monthly", label: "Bulanan" },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      disabled={!formActive}
                      onClick={() => setFormFrequency(item.id as any)}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all text-center disabled:opacity-50 ${
                        formFrequency === item.id
                          ? "bg-[#E0F5EE] border-[#208C68] text-[#0F4C39] shadow-sm font-extrabold"
                          : "bg-white border-[#D4DDD9] text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hari / Tanggal */}
              <div>
                {formFrequency === "weekly" ? (
                  <>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Hari Pelaksanaan</label>
                    <select
                      disabled={!formActive}
                      value={formDayOfWeek}
                      onChange={(e) => setFormDayOfWeek(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] disabled:opacity-50"
                    >
                      {NAMA_HARI.map((hari, idx) => (
                        <option key={idx} value={idx}>
                          Setiap Hari {hari}
                        </option>
                      ))}
                    </select>
                  </>
                ) : formFrequency === "monthly" ? (
                  <>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Tanggal Setiap Bulan</label>
                    <select
                      disabled={!formActive}
                      value={formDayOfMonth}
                      onChange={(e) => setFormDayOfMonth(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] disabled:opacity-50"
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((tgl) => (
                        <option key={tgl} value={tgl}>
                          Tanggal {tgl} setiap bulan
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Pola Jadwal</label>
                    <div className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#D4DDD9] bg-gray-50 text-neutral-500">
                      Berjalan otomatis setiap hari
                    </div>
                  </>
                )}
              </div>

              {/* Waktu Pelaksanaan */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Jam Eksekusi (WIB)</label>
                <input
                  type="time"
                  disabled={!formActive}
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] disabled:opacity-50"
                />
              </div>
            </div>

            {/* Preview Box & Save Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-[#F5F8F7] border border-[#D4DDD9] rounded-xl">
              <div className="flex items-center gap-2 text-xs text-neutral-700">
                <CheckCircleIcon className="w-5 h-5 text-[#208C68] shrink-0" />
                <span>
                  {formActive ? (
                    <>
                      <strong>Ringkasan:</strong> Sistem akan mencadangkan data secara otomatis{" "}
                      {formFrequency === "daily"
                        ? "setiap hari"
                        : formFrequency === "weekly"
                        ? `setiap hari ${NAMA_HARI[formDayOfWeek]}`
                        : `setiap tanggal ${formDayOfMonth}`}{" "}
                      pukul <strong>{formTime} WIB</strong>.
                    </>
                  ) : (
                    <>
                      <strong className="text-gray-500">Status:</strong> Backup otomatis dinonaktifkan. Pencadangan hanya dapat dilakukan manual melalui tombol "Backup Sekarang".
                    </>
                  )}
                </span>
              </div>

              <button
                type="submit"
                disabled={savingSchedule}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#3DB891] hover:bg-[#208C68] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-bold shadow-sm transition-colors text-xs flex items-center justify-center gap-2 shrink-0"
              >
                {savingSchedule ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Pengaturan Jadwal"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Action Panel */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Left panel: List & Create */}
          <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-[#D4DDD9]/60 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-display font-bold text-gray-900">Arsip Backup</h3>
                <p className="text-xs text-gray-500">Daftar 5 arsip backup sistem terbaru (.dms.bak)</p>
              </div>
              <button 
                onClick={handleCreateBackup}
                disabled={creating}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#3DB891] hover:bg-[#208C68] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-bold shadow-sm transition-colors text-sm"
              >
                <ArrowPathIcon className={`w-4 h-4 ${creating ? "animate-spin" : ""}`} />
                {creating ? "Membuat Backup..." : "Backup Sekarang"}
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center p-12">
                <div className="animate-spin w-8 h-8 border-4 border-[#3DB891] border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="overflow-x-auto space-y-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] uppercase tracking-widest text-gray-500 font-bold border-b border-gray-200">
                      <th className="py-3 px-4">Nama File</th>
                      <th className="py-3 px-4">Ukuran</th>
                      <th className="py-3 px-4">Tipe</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-medium text-gray-700 divide-y divide-gray-100">
                    {backups.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400">
                          Belum ada arsip backup yang dibuat.
                        </td>
                      </tr>
                    ) : (
                      backups
                        .slice(0, 5)
                        .map((b) => (
                          <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-gray-900 max-w-[200px] truncate" title={b.nama_file}>
                              {b.nama_file}
                            </td>
                            <td className="py-3 px-4">{b.ukuran_mb.toFixed(2)} MB</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                b.tipe === "manual" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                              }`}>
                                {b.tipe}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                b.status === "done" ? "bg-green-50 text-green-700" : 
                                b.status === "running" ? "bg-blue-50 text-blue-700 animate-pulse" :
                                "bg-red-50 text-red-700"
                              }`}>
                                {b.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {b.status === "done" && (
                                <button 
                                  onClick={() => handleDownload(b)}
                                  disabled={downloadingId === b.id}
                                  title="Download File Backup (.dms.bak)"
                                  className="p-1.5 bg-gray-100 hover:bg-[#E0F5EE] text-gray-700 hover:text-[#208C68] disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-1 text-xs"
                                >
                                  <ArrowDownTrayIcon className={`w-4 h-4 ${downloadingId === b.id ? "animate-bounce text-[#3DB891]" : ""}`} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>

                {/* Footer Informasi Pembatasan 5 Baris */}
                {backups.length > 0 && (
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500">
                    <p>
                      Menampilkan <span className="font-bold text-neutral-800">{Math.min(backups.length, 5)}</span> baris arsip backup terbaru
                    </p>
                    {backups.length > 5 && (
                      <span className="text-[11px] font-medium text-gray-400">
                        (Dibatasi 5 baris dari total {backups.length} arsip)
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right panel: Restore */}
          {isSuperAdmin && (
            <div className="w-full lg:w-[400px] bg-white p-6 rounded-2xl shadow-sm border border-[#D4DDD9]/60 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="pb-4 border-b border-gray-100">
                  <h3 className="text-lg font-display font-bold text-gray-900">Restorasi Sistem</h3>
                  <p className="text-xs text-gray-500">Pulihkan database & berkas MinIO dari cadangan</p>
                </div>

                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex gap-3 text-red-800">
                  <ExclamationTriangleIcon className="w-6 h-6 shrink-0 text-red-600" />
                  <div>
                    <h4 className="text-xs font-extrabold uppercase">Peringatan Keras</h4>
                    <p className="text-[10px] mt-1 leading-relaxed">
                      Proses restore akan **menimpa** seluruh database dan menghapus semua dokumen yang diupload setelah tanggal backup dibuat.
                    </p>
                  </div>
                </div>

                {restoreStep === 1 ? (
                  <div className="space-y-4">
                    <label className="block text-xs font-bold text-gray-700">Pilih Berkas Backup (.dms.bak)</label>
                    <div className="border-2 border-dashed border-[#D4DDD9] rounded-2xl p-6 text-center hover:border-[#3DB891] transition-colors cursor-pointer bg-gray-50/50" onClick={() => fileInputRef.current?.click()}>
                      <CloudArrowUpIcon className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 font-bold">
                        {restoreFile ? restoreFile.name : "Klik untuk memilih file..."}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">Hanya mendukung format .dms.bak</p>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept=".bak" 
                        className="hidden" 
                      />
                    </div>

                    {restoreFile && (
                      <button
                        onClick={handleVerify}
                        disabled={restoring}
                        className="w-full py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-sm transition-colors"
                      >
                        {restoring ? "Memverifikasi..." : "Verifikasi File Backup"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2 text-green-800">
                        <CheckCircleIcon className="w-5 h-5 text-green-600" />
                        <h4 className="text-xs font-bold uppercase">Berkas Terverifikasi</h4>
                      </div>
                      <div className="text-[10px] text-green-800 space-y-1 font-medium">
                        <p><strong>Aplikasi:</strong> {verifyResult.app}</p>
                        <p><strong>Dibuat Pada:</strong> {new Date(verifyResult.created_at).toLocaleString()}</p>
                        <p><strong>Database:</strong> {(verifyResult.database.size_bytes / 1e6).toFixed(2)} MB</p>
                        <p><strong>File Dokumen:</strong> {verifyResult.files.file_count} File ({(verifyResult.files.size_bytes / 1e6).toFixed(2)} MB)</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-700 leading-relaxed">
                        Tulis kalimat konfirmasi berikut untuk membuka restore:
                        <code className="block bg-gray-100 p-2 rounded-lg font-mono text-[9px] mt-1 select-all">
                          SAYA MENGERTI RESTORE AKAN MENIMPA DATA SAAT INI
                        </code>
                      </label>
                      <input 
                        type="text" 
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="Ketik kalimat konfirmasi..."
                        className="w-full px-4 py-2.5 border rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-xs transition-all" 
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleResetRestore}
                        disabled={restoring}
                        className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleRestore}
                        disabled={restoring || confirmText !== "SAYA MENGERTI RESTORE AKAN MENIMPA DATA SAAT INI"}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl text-xs transition-colors"
                      >
                        {restoring ? "Memulihkan..." : "Restore Sekarang"}
                      </button>
                    </div>
                  </div>
                )}

              </div>
              <p className="text-[9px] text-gray-400 text-center">
                Aktivitas restorasi akan tercatat secara permanen di audit trail log.
              </p>
            </div>
          )}

        </div>

        {/* Modal Atur Jadwal Backup Otomatis */}
        {isScheduleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[24px] max-w-lg w-full p-6 shadow-2xl border border-[#D4DDD9] space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#E0F5EE] rounded-xl text-[#208C68]">
                    <ClockIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-display font-bold text-gray-900">Atur Jadwal Backup Otomatis</h3>
                    <p className="text-xs text-gray-500">Sesuaikan frekuensi dan waktu backup sistem</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSchedule} className="space-y-4">
                {/* Toggle ON/OFF */}
                <div className="flex items-center justify-between p-4 bg-[#F5F8F7] border border-[#D4DDD9] rounded-2xl">
                  <div>
                    <p className="text-xs font-bold text-gray-900">Status Backup Otomatis</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {formActive ? "Sistem akan membuat cadangan otomatis secara berkala." : "Backup otomatis dimatikan (hanya manual)."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormActive(!formActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formActive ? "bg-[#3DB891]" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        formActive ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {formActive && (
                  <div className="space-y-4 pt-1">
                    {/* Frequency */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Frekuensi Pencadangan</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "daily", label: "Setiap Hari" },
                          { id: "weekly", label: "Mingguan" },
                          { id: "monthly", label: "Bulanan" },
                        ].map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => setFormFrequency(item.id as any)}
                            className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                              formFrequency === item.id
                                ? "bg-[#E0F5EE] border-[#208C68] text-[#0F4C39] shadow-sm"
                                : "bg-white border-[#D4DDD9] text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Day of Week (Weekly) */}
                    {formFrequency === "weekly" && (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Pilih Hari</label>
                        <select
                          value={formDayOfWeek}
                          onChange={(e) => setFormDayOfWeek(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                        >
                          {NAMA_HARI.map((hari, idx) => (
                            <option key={idx} value={idx}>
                              Hari {hari}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Day of Month (Monthly) */}
                    {formFrequency === "monthly" && (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Pilih Tanggal Setiap Bulan</label>
                        <select
                          value={formDayOfMonth}
                          onChange={(e) => setFormDayOfMonth(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                        >
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((tgl) => (
                            <option key={tgl} value={tgl}>
                              Tanggal {tgl}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-gray-400 mt-1">Dibatasi hingga tanggal 28 agar berlaku valid di seluruh bulan.</p>
                      </div>
                    )}

                    {/* Time of Day */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Jam Eksekusi (Waktu Indonesia Barat - WIB)
                      </label>
                      <input
                        type="time"
                        value={formTime}
                        onChange={(e) => setFormTime(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Direkomendasikan di luar jam kerja (misal pukul 01:00 - 04:00 WIB).</p>
                    </div>

                    {/* Preview Box */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs">
                      <p className="font-bold flex items-center gap-1.5">
                        <CheckCircleIcon className="w-4 h-4 text-blue-600" />
                        Ringkasan Jadwal:
                      </p>
                      <p className="text-[11px] mt-1 text-blue-800">
                        {formFrequency === "daily"
                          ? `Backup akan dijalankan secara otomatis setiap hari pada pukul ${formTime} WIB.`
                          : formFrequency === "weekly"
                          ? `Backup akan dijalankan secara otomatis setiap hari ${NAMA_HARI[formDayOfWeek]} pada pukul ${formTime} WIB.`
                          : `Backup akan dijalankan secara otomatis setiap tanggal ${formDayOfMonth} tiap bulan pada pukul ${formTime} WIB.`}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsScheduleModalOpen(false)}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingSchedule}
                    className="flex-1 py-2.5 bg-[#3DB891] hover:bg-[#208C68] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    {savingSchedule ? (
                      <>
                        <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      "Simpan Pengaturan"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
