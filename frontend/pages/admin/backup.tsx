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
  CheckCircleIcon
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

export default function BackupPage() {
  const { isAdminAuthenticated, mounted } = useRequireAdmin();
  const admin = useAdminAuthStore((s) => s.admin);
  const isSuperAdmin = admin?.role === 'super_admin';

  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pollingId, setPollingId] = useState<string | null>(null);

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
    }
  }, [isAdminAuthenticated]);

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
      const res = await api.get("/admin/backup");
      setBackups(res.data.data);
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

  const handleDownload = async (backup: BackupRecord) => {
    try {
      toast.loading("Mempersiapkan unduhan...", { id: "download" });
      const res = await api.get(`/admin/backup/${backup.id}/download`, {
        responseType: "blob"
      });
      
      const blob = new Blob([res.data], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", backup.nama_file);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Unduhan dimulai", { id: "download" });
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal mengunduh file backup", { id: "download" });
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

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D4DDD9]/60 flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-xl">
              <CalendarDaysIcon className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Jadwal Backup Otomatis</p>
              <h3 className="text-sm font-bold text-gray-900 mt-2">
                Setiap hari jam 02:00 WIB
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Celery Beat Scheduler</p>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Left panel: List & Create */}
          <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-[#D4DDD9]/60 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-display font-bold text-gray-900">Arsip Backup</h3>
                <p className="text-xs text-gray-500">Daftar file backup sistem (.dms.bak)</p>
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
              <div className="overflow-x-auto">
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
                      backups.map((b) => (
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
                            {b.status === "done" && isSuperAdmin && (
                              <button 
                                onClick={() => handleDownload(b)}
                                title="Download File Backup"
                                className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
                              >
                                <ArrowDownTrayIcon className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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

      </div>
    </AdminLayout>
  );
}
