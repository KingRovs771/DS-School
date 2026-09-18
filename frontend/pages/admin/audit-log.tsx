/**
 * pages/admin/audit-log.tsx — Immutable Audit Trail Viewer dengan Fitur Filter & Eksport CSV/Excel
 * Mengikuti spesifikasi [TABLE_COMPONENT], [TYPOGRAPHY], [SPACING_SHADOW] dari DESIGN.md
 */
import { useState } from "react";
import Head from "next/head";
import { useQuery } from "@tanstack/react-query";
import { adminAuditStatsApi } from "@/lib/api";
import AdminLayout from "@/components/AdminLayout";
import { useRequireAdmin } from "@/hooks/useAdminAuth";
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon
} from "@heroicons/react/24/solid";
import {
  DocumentTextIcon as DocumentTextOutline,
  ClockIcon as ClockOutline
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { clsx } from "clsx";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

export default function AdminAuditLog() {
  useRequireAdmin();

  const [userType, setUserType] = useState("");
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const maskId = (id: number | string | null | undefined): string => {
    if (!id) return "—";
    const str = id.toString();
    if (str.length <= 2) return "***" + str;
    return "***" + str.slice(-2);
  };

  // Query ambil data audit logs
  const { data: logs = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-audit-logs", userType, action, status],
    queryFn: async () => {
      const res = await adminAuditStatsApi.getAuditLog(userType, action, status);
      return res.data;
    },
  });

  // Filter logs berdasarkan search term (IP, User Agent, User ID)
  const filteredLogs = logs.filter((log: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const uid = (log.user_id || log.siswa_id || "").toString();
    return (
      (log.ip_address && log.ip_address.toLowerCase().includes(term)) ||
      (log.user_agent && log.user_agent.toLowerCase().includes(term)) ||
      uid.includes(term) ||
      log.action.toLowerCase().includes(term)
    );
  });

  // Ekspor ke CSV Client-Side
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error("Tidak ada data log untuk diekspor!");
      return;
    }

    const headers = ["ID", "User ID", "User Type", "Aksi", "IP Address", "User Agent", "Status", "Kapan"];
    const rows = filteredLogs.map((log: any) => [
      log.id,
      maskId(log.user_id || log.siswa_id),
      log.user_type,
      log.action,
      log.ip_address,
      (log.user_agent || "").replace(/,/g, " "), // hindari koma parsing error
      log.status,
      log.created_at,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DMS_School_Audit_Log_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Audit Log berhasil diekspor ke berkas CSV!");
  };

  return (
    <AdminLayout title="Buku Audit Immutable (Audit Trail)">
      <Head>
        <title>Audit Trail — DokumenSekolah Admin</title>
      </Head>

      <div className="space-y-6 font-body text-neutral-800">
        
        {/* Row 1: Filter Panel */}
        <div className="bg-white border border-[#D4DDD9] p-5 rounded-[20px] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-neutral-800 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <FunnelIcon className="w-4 h-4 text-[#208C68]" />
              Filter Penelusuran Audit
            </h4>
            <div className="flex gap-2">
              <button
                onClick={() => refetch()}
                className="p-2 bg-white border border-[#D4DDD9] hover:bg-[#F5F8F7] text-neutral-400 hover:text-neutral-700 rounded-xl transition-all"
                title="Refresh Log"
              >
                <ArrowPathIcon className={clsx("w-4 h-4", isFetching && "animate-spin text-[#208C68]")} />
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#D4DDD9] hover:bg-[#F5F8F7] text-xs font-bold text-neutral-700 rounded-xl transition-all shadow-sm"
              >
                <ArrowDownTrayIcon className="w-3.5 h-3.5 text-[#208C68]" />
                Ekspor (.csv)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Search Term */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8FA39B]" />
              <input
                type="text"
                placeholder="Cari IP, aksi, atau user ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] placeholder-[#8FA39B]"
              />
            </div>

            {/* User Type */}
            <select
              value={userType}
              onChange={(e) => setUserType(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
            >
              <option value="">Semua Peran User</option>
              <option value="admin">Admin</option>
              <option value="siswa">Siswa</option>
            </select>

            {/* Action */}
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
            >
              <option value="">Semua Jenis Aksi</option>
              <option value="login">Login</option>
              <option value="login_admin">Login Admin</option>
              <option value="login_siswa">Login Siswa</option>
              <option value="tambah_siswa">Tambah Siswa</option>
              <option value="upload_dokumen">Upload Dokumen</option>
              <option value="download_dokumen">Download Dokumen</option>
              <option value="delete_dokumen">Delete Dokumen</option>
              <option value="backup_created">Buat Backup</option>
              <option value="backup_downloaded">Unduh Backup</option>
            </select>

            {/* Status */}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
            >
              <option value="">Semua Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="anomaly">Anomaly</option>
            </select>
          </div>
        </div>

        {/* Row 2: Logs Table */}
        <div className="bg-white border border-[#D4DDD9] rounded-[20px] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F5F8F7] border-b border-[#D4DDD9]">
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Nama Aksi</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">ID & Peran</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">IP Address</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Browser Agent</th>
                  <th className="px-6 py-3 text-right text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Kapan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2F0]">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <div className="w-6 h-6 border-2 border-[#208C68] border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-[#8FA39B]">
                      <DocumentTextOutline className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-xs font-semibold">Tidak ada log aktivitas audit</p>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log: any, i: number) => {
                    const isSuccess = log.status === "success";
                    const isAnomaly = log.status === "anomaly";

                    return (
                      <tr key={log.id || i} className="hover:bg-[#F0FAF6] transition-colors duration-120">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={clsx(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold capitalize",
                            isSuccess && "bg-[#E0F5EE] text-[#0F4C39]",
                            isAnomaly && "bg-[#FDE8D8] text-[#7A2D0F] border border-[#FBCBB8] animate-pulse-dot",
                            !isSuccess && !isAnomaly && "bg-red-50 text-red-650"
                          )}>
                            {isSuccess ? (
                              <CheckCircleIcon className="w-3.5 h-3.5 text-[#208C68]" />
                            ) : isAnomaly ? (
                              <InformationCircleIcon className="w-3.5 h-3.5 text-[#C2410C]" />
                            ) : (
                              <XCircleIcon className="w-3.5 h-3.5 text-red-500" />
                            )}
                            {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs font-bold text-neutral-800 block capitalize">
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs font-bold text-neutral-800 block">UID: {maskId(log.user_id || log.siswa_id)}</span>
                          <span className="text-[10px] text-[#8FA39B] font-bold uppercase block">{log.user_type}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-neutral-600">{log.ip_address || "—"}</td>
                        <td className="px-6 py-4 max-w-xs truncate text-xs text-neutral-600 font-semibold" title={log.user_agent}>
                          {log.user_agent || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-semibold text-[#8FA39B]">
                          <span className="inline-flex items-center gap-1">
                            <ClockOutline className="w-3.5 h-3.5" />
                            {log.created_at ? format(new Date(log.created_at), "d MMM, HH:mm", { locale: localeId }) : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
