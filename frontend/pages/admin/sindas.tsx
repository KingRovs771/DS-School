/**
 * pages/admin/sindas.tsx — Dashboard Monitoring Integrasi SINDAS
 * Mengikuti spesifikasi [TABLE_COMPONENT], [TYPOGRAPHY], [SPACING_SHADOW] dari DESIGN.md
 */
import Head from "next/head";
import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useRequireAdmin } from "@/hooks/useAdminAuth";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { sekolahApi } from "@/lib/api";
import {
  useSindasSyncStatus,
  useSindasSyncLogs,
  usePullSindas,
  SindasSyncLog,
} from "@/hooks/useSindas";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  WifiIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleStackIcon,
  BoltIcon,
  SparklesIcon
} from "@heroicons/react/24/solid";
import { clsx } from "clsx";

// ─── Utility Helpers ─────────────────────────────────────────────────────────

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}d yang lalu`;
  if (diff < 3600) return `${Math.round(diff / 60)}m yang lalu`;
  if (diff < 86400) return `${Math.round(diff / 3600)}j yang lalu`;
  return `${Math.round(diff / 86400)}h yang lalu`;
}

// ─── Sub Components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SindasSyncLog["status"] }) {
  const isSuccess = status === "success";
  const isSkipped = status === "skipped";

  return (
    <span className={clsx(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize",
      isSuccess && "bg-[#E0F5EE] text-[#0F4C39]",
      isSkipped && "bg-[#FEF3C7] text-[#78350F]",
      !isSuccess && !isSkipped && "bg-red-50 text-red-650"
    )}>
      {isSuccess ? (
        <CheckCircleIcon className="w-3.5 h-3.5 text-[#208C68]" />
      ) : isSkipped ? (
        <ExclamationTriangleIcon className="w-3.5 h-3.5 text-[#D97706]" />
      ) : (
        <XCircleIcon className="w-3.5 h-3.5 text-red-500" />
      )}
      {status === "success" ? "Berhasil" : status === "skipped" ? "Dilewati" : "Gagal"}
    </span>
  );
}

function EventTypeBadge({ type }: { type: SindasSyncLog["event_type"] }) {
  const isCreated = type === "created";
  const isUpdated = type === "updated";
  const isDeleted = type === "deleted";

  return (
    <span className={clsx(
      "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase",
      isCreated && "bg-[#E0F5EE] text-[#0F4C39]",
      isUpdated && "bg-[#DDE9F8] text-[#1A3D6B]",
      isDeleted && "bg-red-50 text-red-650",
      !isCreated && !isUpdated && !isDeleted && "bg-[#EDE0F8] text-[#4A1D7A]"
    )}>
      {type === "created" ? "Baru" : type === "updated" ? "Update" : type === "deleted" ? "Hapus" : "Pull"}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  bgClass,
  iconColor,
  fgColor,
  subtext,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  bgClass: string;
  iconColor: string;
  fgColor: string;
  subtext?: string;
}) {
  return (
    <div className={clsx("border border-black/5 rounded-[20px] p-5 shadow-sm hover:translate-y-[-2px] hover:shadow-md transition-all duration-200", bgClass)}>
      <div className="flex justify-between items-start mb-4">
        <span className={clsx("text-[13px] font-semibold uppercase tracking-wider", fgColor)}>{label}</span>
        <div className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center">
          <Icon className={clsx("w-5 h-5", iconColor)} />
        </div>
      </div>
      <h3 className={clsx("text-3xl font-display font-extrabold leading-none mb-2", fgColor)}>{value}</h3>
      {subtext && <span className={clsx("text-xs font-medium", fgColor)}>{subtext}</span>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminSindas() {
  useRequireAdmin();

  const [page, setPage] = useState(1);
  const limit = 8;

  // State untuk form konfigurasi API SINDAS
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  // Query konfigurasi SINDAS sekolah
  const { isLoading: loadingConfig } = useQuery({
    queryKey: ["sekolah-sindas-config"],
    queryFn: async () => {
      const res = await sekolahApi.getSindasConfig();
      setApiUrl(res.data.sindas_api_url || "");
      setApiKey(res.data.sindas_api_key || "");
      return res.data;
    }
  });

  // Query status koneksi & statistik sinkronisasi
  const { data: statusData, isLoading: loadingStatus, refetch: refetchStatus } = useSindasSyncStatus();

  // Query logs aktivitas sinkronisasi SINDAS
  const { data: logsData, isLoading: loadingLogs, refetch: refetchLogs } = useSindasSyncLogs({ page, limit });

  // Mutation Pull SINDAS manual
  const pullMutation = usePullSindas();

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await sekolahApi.updateSindasConfig({
        sindas_api_url: apiUrl,
        sindas_api_key: apiKey
      });
      toast.success("Konfigurasi API SINDAS berhasil disimpan!");
      refetchStatus();
      refetchLogs();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal menyimpan konfigurasi API SINDAS.");
    } finally {
      setSaving(false);
    }
  };

  const handleManualPull = () => {
    if (confirm("Mulai sinkronisasi data siswa dari eksternal SINDAS API?")) {
      pullMutation.mutate({ limit: 50000 }, {
        onSuccess: (res: any) => {
          toast.success(res.data?.message || "Sinkronisasi SINDAS selesai!");
          refetchStatus();
          refetchLogs();
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.detail || "Gagal sinkronisasi data dari SINDAS.");
        },
      });
    }
  };

  const statusInfo = statusData || {
    sindas_enabled: false,
    sindas_api_configured: false,
    today_total: 0,
    today_success: 0,
    today_failed: 0,
    today_skipped: 0,
    last_sync_at: null,
    last_sync_nis: null,
    total_all_time: 0,
  };

  const isOnline = statusInfo.sindas_enabled && statusInfo.sindas_api_configured;
  const syncLogs = logsData || [];

  return (
    <AdminLayout title="Integrasi Eksternal SINDAS">
      <Head>
        <title>SINDAS Integration — DokumenSekolah Admin</title>
      </Head>

      <div className="space-y-6 font-body text-neutral-800">

        {/* Configuration Form */}
        <div className="bg-white border border-[#D4DDD9] rounded-[20px] p-6 shadow-sm">
          <h3 className="font-display font-bold text-neutral-950 text-sm mb-4">Pengaturan API SINDAS</h3>
          {loadingConfig ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin w-5 h-5 border-2 border-[#3DB891] border-t-transparent rounded-full" />
            </div>
          ) : (
            <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div className="space-y-1.5">
                <label htmlFor="apiUrl" className="text-xs font-bold text-gray-500 uppercase tracking-wide">Link API SINDAS (Base URL)</label>
                <input
                  id="apiUrl"
                  type="text"
                  placeholder="Contoh: http://localhost:8000/api/v1/sindas/mock-api/siswa"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full pl-4 pr-4 py-2.5 bg-gray-50 border border-gray-250 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#3DB891]/20 focus:border-[#3DB891] transition-all"
                  required
                />
              </div>
              
              <div className="flex gap-3">
                <div className="space-y-1.5 flex-1">
                  <label htmlFor="apiKey" className="text-xs font-bold text-gray-500 uppercase tracking-wide">API Key SINDAS</label>
                  <input
                    id="apiKey"
                    type="password"
                    placeholder="Masukkan API Key/Token..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full pl-4 pr-4 py-2.5 bg-gray-50 border border-gray-250 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#3DB891]/20 focus:border-[#3DB891] transition-all"
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-3 bg-[#208C68] hover:bg-[#14503C] disabled:bg-neutral-300 disabled:text-neutral-500 text-white text-xs font-bold rounded-xl transition-all shadow shadow-[#208C68]/15 disabled:shadow-none whitespace-nowrap self-end h-[42px] flex items-center justify-center min-w-[100px]"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : "Simpan"}
                </button>
              </div>
            </form>
          )}
        </div>
        
        {/* Status Banner */}
        <div className={clsx(
          "border rounded-[20px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm",
          isOnline ? "bg-[#E0F0E0] border-[#C2E3C2] text-[#14532D]" : "bg-red-50 border-red-200 text-red-700"
        )}>
          <div className="flex items-start sm:items-center gap-4">
            <div className="p-3 bg-white/40 rounded-xl flex-shrink-0">
              <WifiIcon className={clsx("w-6 h-6", isOnline ? "text-[#15803D]" : "text-red-500")} />
            </div>
            <div>
              <h4 className="text-sm font-bold">Koneksi SINDAS API: {isOnline ? "ONLINE" : "OFFLINE"}</h4>
              <p className={clsx("text-xs font-semibold mt-0.5", isOnline ? "text-[#14532D]/80" : "text-red-700/80")}>
                {isOnline 
                  ? `Koneksi sinkronisasi sehat. Jadwal sinkronisasi otomatis berjalan aktif.`
                  : "Server eksternal SINDAS tidak terhubung. Periksa konfigurasi SINDAS_API_KEY / BASE_URL."
                }
              </p>
            </div>
          </div>
          
          <button
            onClick={handleManualPull}
            disabled={pullMutation.isPending || !isOnline}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-[#208C68] hover:bg-[#14503C] disabled:bg-neutral-300 disabled:text-neutral-500 text-white text-xs font-bold rounded-xl transition-all shadow shadow-[#208C68]/15 disabled:shadow-none whitespace-nowrap"
          >
            {pullMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : <ArrowDownTrayIcon className="w-4 h-4" />}
            Tarik Data SINDAS Manual
          </button>
        </div>

        {/* ─── Grid Statistik ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={CircleStackIcon}
            label="Total Sync Hari Ini"
            value={statusInfo.today_total}
            bgClass="bg-[#DFF2EC]"
            iconColor="text-[#1A7A5E]"
            fgColor="text-[#0F4C39]"
            subtext="Event sinkronisasi diproses hari ini"
          />
          <StatCard
            icon={SparklesIcon}
            label="Sync Sukses Hari Ini"
            value={statusInfo.today_success}
            bgClass="bg-[#DDE9F8]"
            iconColor="text-[#2563EB]"
            fgColor="text-[#1A3D6B]"
            subtext="Siswa berhasil diperbarui hari ini"
          />
          <StatCard
            icon={ClockIcon}
            label="Sync Terakhir"
            value={timeAgo(statusInfo.last_sync_at)}
            bgClass="bg-[#EDE0F8]"
            iconColor="text-[#7C3AED]"
            fgColor="text-[#4A1D7A]"
            subtext={statusInfo.last_sync_at ? formatDateTime(statusInfo.last_sync_at) : "Belum pernah"}
          />
        </div>

        {/* ─── Log Audit Sinkronisasi SINDAS ─── */}
        <div className="bg-white border border-[#D4DDD9] rounded-[20px] overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[#EDF2F0] bg-[#F5F8F7] flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-neutral-950 text-sm">Riwayat Sinkronisasi Terbaru</h3>
              <p className="text-[11px] font-semibold text-[#8FA39B] mt-0.5">Audit log dari integrasi eksternal SINDAS</p>
            </div>
            <button
              onClick={() => { refetchStatus(); refetchLogs(); }}
              className="p-2 bg-white border border-[#D4DDD9] hover:bg-[#F5F8F7] text-neutral-400 hover:text-neutral-700 rounded-xl transition-all"
              title="Refresh Log"
            >
              <ArrowPathIcon className="w-4 h-4 text-neutral-400" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F5F8F7] border-b border-[#D4DDD9]">
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Aktivitas</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Jenis Event</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Waktu Sync</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">IP / Trigger</th>
                  <th className="px-6 py-3 text-right text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2F0]">
                {loadingLogs ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-[#8FA39B]">
                      <div className="w-6 h-6 border-2 border-[#208C68] border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : syncLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-[#8FA39B]">
                      <CircleStackIcon className="w-10 h-10 mx-auto mb-2 opacity-35" />
                      <p className="text-xs font-semibold">Belum ada riwayat aktivitas sinkronisasi</p>
                    </td>
                  </tr>
                ) : (
                  syncLogs.map((log: SindasSyncLog) => (
                    <tr key={log.id} className="hover:bg-[#F0FAF6] transition-colors duration-120">
                      <td className="px-6 py-4 text-xs font-bold text-neutral-800 truncate max-w-xs" title={log.error_message || `Sync event ${log.event_id || ""}`}>
                        {log.error_message || `Sinkronisasi NIS ${log.nis_sindas || "—"}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <EventTypeBadge type={log.event_type} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-[#8FA39B]">
                        {formatDateTime(log.processed_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-[#0F4C39] font-bold">
                        {log.event_id || "system"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <StatusBadge status={log.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-[#EDF2F0] flex items-center justify-between bg-[#F5F8F7]">
            <span className="text-[11px] font-bold text-[#8FA39B]">Halaman {page}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                className="p-1.5 bg-white border border-[#D4DDD9] hover:bg-[#F5F8F7] rounded-lg text-[#8FA39B] hover:text-neutral-750 transition-colors disabled:opacity-50"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button
                disabled={syncLogs.length < limit}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 bg-white border border-[#D4DDD9] hover:bg-[#F5F8F7] rounded-lg text-[#8FA39B] hover:text-neutral-750 transition-colors disabled:opacity-50"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
