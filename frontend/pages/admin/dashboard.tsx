/**
 * pages/admin/dashboard.tsx — Dashboard Admin (Gaya DESIGN.md Terpadu)
 * Memenuhi token [DASHBOARD_PAGE], [STAT_CARDS], [DASHBOARD_CONTENT_GRID] dari DESIGN.md
 */
import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminAuditStatsApi, adminAnomaliApi, adminDokumenApi, superAdminApi } from "@/lib/api";
import toast from "react-hot-toast";
import PdfModal from "@/components/PdfModal";
import AdminLayout from "@/components/AdminLayout";
import { useRequireAdmin } from "@/hooks/useAdminAuth";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { 
  DocumentTextIcon, 
  UsersIcon, 
  ArrowDownTrayIcon, 
  ExclamationTriangleIcon,
  ArrowUpTrayIcon,
  ClipboardDocumentListIcon,
  KeyIcon,
  UserPlusIcon,
  EyeIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  BuildingOffice2Icon,
  CloudArrowUpIcon,
} from "@heroicons/react/24/solid";
import { 
  ArrowUpTrayIcon as ArrowUpOutline,
  UserPlusIcon as UserPlusOutline,
  ClipboardDocumentListIcon as ClipboardOutline,
  KeyIcon as KeyOutline,
  EyeIcon as EyeOutline,
  ArrowDownTrayIcon as ArrowDownOutline,
  BuildingOffice2Icon as BuildingOffice2Outline,
  CloudArrowUpIcon as CloudArrowUpOutline,
} from "@heroicons/react/24/outline";
import { formatBytes } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { clsx } from "clsx";

// Data bulanan dummy sebagai fallback
const defaultChartData = [
  { month: "Jan", Upload: 0, Download: 0 },
  { month: "Feb", Upload: 0, Download: 0 },
  { month: "Mar", Upload: 0, Download: 0 },
  { month: "Apr", Upload: 0, Download: 0 },
  { month: "Mei", Upload: 0, Download: 0 },
  { month: "Jun", Upload: 0, Download: 0 },
];

export default function AdminDashboard() {
  const { isAdminAuthenticated, mounted } = useRequireAdmin();
  const { admin } = useAdminAuthStore();

  const isSuperAdmin = admin?.role === 'super_admin';

  const [previewDocId, setPreviewDocId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!previewDocId) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
      }
      return;
    }
    
    let isMounted = true;
    const fetchPreview = async () => {
      try {
        const res = await adminDokumenApi.getPreviewBlob(previewDocId);
        const url = URL.createObjectURL(res.data);
        if (isMounted) setPreviewUrl(url);
      } catch (err) {
        toast.error("Gagal memuat preview dokumen");
      }
    };
    fetchPreview();
    
    return () => {
      isMounted = false;
    };
  }, [previewDocId]);

  const handleDownloadDoc = async (doc: any) => {
    try {
      const response = await adminDokumenApi.download(doc.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${doc.document_type || 'Dokumen'}_${doc.id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Dokumen berhasil diunduh!");
    } catch (err: any) {
      console.error("Download error:", err);
      toast.error(`Gagal mengunduh dokumen: ${err?.message || "Unknown error"}`);
    }
  };

  const { data: statsData, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await adminAuditStatsApi.getStatistik();
      return res.data;
    },
    refetchInterval: 15000,
  });

  const { data: realAlertsData = [] } = useQuery({
    queryKey: ["admin-anomali-alerts"],
    queryFn: async () => {
      const res = await adminAnomaliApi.getAlerts();
      return res.data;
    },
    refetchInterval: 10000,
  });

  // Query ambil data monitoring sekolah (hanya untuk super_admin)
  const { data: schoolsData = [] } = useQuery({
    queryKey: ["superadmin-monitoring-sekolah"],
    queryFn: async () => {
      if (!isSuperAdmin) return [];
      const res = await superAdminApi.getMonitoringSekolah();
      return res.data;
    },
    enabled: !!isSuperAdmin,
    refetchInterval: 20000,
  });

  const stats = statsData?.summary || {
    total_sekolah: 0,
    total_siswa: 0,
    total_dokumen_terenkripsi: 0,
    total_audit_logs: 0,
    storage_used_bytes: 0,
    download_hari_ini: 0,
    siswa_baru_bulan_ini: 0,
    dokumen_baru_bulan_ini: 0
  };

  const recentDocs = statsData?.recent_documents || [];
  const chartData = statsData?.chart_data || defaultChartData;

  if (!mounted || !isAdminAuthenticated) {
    return null;
  }

  if (admin?.role === "dinas_pendidikan") {
    if (typeof window !== "undefined") {
      window.location.href = "/dinas/dashboard";
    }
    return null;
  }

  return (
    <AdminLayout title={isSuperAdmin ? "Overview Analitik Sistem (Super Admin)" : "Overview Analitik"}>
      <Head>
        <title>{isSuperAdmin ? "Dashboard Super Admin — DokumenSekolah" : "Dashboard Admin — DokumenSekolah"}</title>
      </Head>

      <div className="space-y-6 font-body">

        {/* ── [STAT_CARDS] ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Total Sekolah / Total Dokumen */}
          {isSuperAdmin ? (
            <div className="bg-[#DFF2EC] border border-black/5 rounded-[20px] p-5 shadow-sm hover:translate-y-[-2px] hover:shadow-md transition-all duration-200">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[13px] font-semibold text-[#0F4C39]/70 uppercase tracking-wider">Total Sekolah Binaan</span>
                <div className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center">
                  <BuildingOffice2Icon className="w-5 h-5 text-[#1A7A5E]" />
                </div>
              </div>
              <h3 className="text-3xl font-display font-extrabold text-[#0F4C39] leading-none mb-2">{stats.total_sekolah}</h3>
              <div className="flex items-center gap-1 text-[#0F4C39]/65 text-xs font-semibold">
                <span>Sekolah terdaftar di sistem</span>
              </div>
            </div>
          ) : (
            <div className="bg-[#DFF2EC] border border-black/5 rounded-[20px] p-5 shadow-sm hover:translate-y-[-2px] hover:shadow-md transition-all duration-200">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[13px] font-semibold text-[#0F4C39]/70 uppercase tracking-wider">Total Dokumen</span>
                <div className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center">
                  <DocumentTextIcon className="w-5 h-5 text-[#1A7A5E]" />
                </div>
              </div>
              <h3 className="text-3xl font-display font-extrabold text-[#0F4C39] leading-none mb-2">{stats.total_dokumen_terenkripsi}</h3>
              <div className="flex items-center gap-1 text-[#0F4C39]/65 text-xs font-semibold">
                <ArrowUpIcon className="w-3.5 h-3.5 text-[#15803D]" />
                <span>+{stats.dokumen_baru_bulan_ini} bulan ini</span>
              </div>
            </div>
          )}

          {/* Card 2: Total Siswa */}
          <div className="bg-[#DDE9F8] border border-black/5 rounded-[20px] p-5 shadow-sm hover:translate-y-[-2px] hover:shadow-md transition-all duration-200">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[13px] font-semibold text-[#1A3D6B]/70 uppercase tracking-wider">Total Siswa</span>
              <div className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center">
                <UsersIcon className="w-5 h-5 text-[#2563EB]" />
              </div>
            </div>
            <h3 className="text-3xl font-display font-extrabold text-[#1A3D6B] leading-none mb-2">{stats.total_siswa}</h3>
            <div className="flex items-center gap-1 text-[#1A3D6B]/65 text-xs font-semibold">
              <ArrowUpIcon className="w-3.5 h-3.5 text-[#15803D]" />
              <span>+{stats.siswa_baru_bulan_ini} siswa baru</span>
            </div>
          </div>

          {/* Card 3: Total Dokumen (jika super_admin) / Download Hari Ini */}
          {isSuperAdmin ? (
            <div className="bg-[#EDE0F8] border border-black/5 rounded-[20px] p-5 shadow-sm hover:translate-y-[-2px] hover:shadow-md transition-all duration-200">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[13px] font-semibold text-[#4A1D7A]/70 uppercase tracking-wider">Total Dokumen Sistem</span>
                <div className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center">
                  <DocumentTextIcon className="w-5 h-5 text-[#7C3AED]" />
                </div>
              </div>
              <h3 className="text-3xl font-display font-extrabold text-[#4A1D7A] leading-none mb-2">{stats.total_dokumen_terenkripsi}</h3>
              <div className="flex items-center gap-1 text-[#4A1D7A]/65 text-xs font-semibold">
                <ArrowUpIcon className="w-3.5 h-3.5 text-[#15803D]" />
                <span>+{stats.dokumen_baru_bulan_ini} bulan ini</span>
              </div>
            </div>
          ) : (
            <div className="bg-[#EDE0F8] border border-black/5 rounded-[20px] p-5 shadow-sm hover:translate-y-[-2px] hover:shadow-md transition-all duration-200">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[13px] font-semibold text-[#4A1D7A]/70 uppercase tracking-wider">Download Hari Ini</span>
                <div className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center">
                  <ArrowDownTrayIcon className="w-5 h-5 text-[#7C3AED]" />
                </div>
              </div>
              <h3 className="text-3xl font-display font-extrabold text-[#4A1D7A] leading-none mb-2">{stats.download_hari_ini}</h3>
              <div className="flex items-center gap-1 text-[#4A1D7A]/65 text-xs font-semibold">
                <ArrowUpIcon className="w-3.5 h-3.5 text-[#15803D]" />
                <span>Hari ini</span>
              </div>
            </div>
          )}

          {/* Card 4: Total Storage (jika super_admin) / Anomali Aktif */}
          {isSuperAdmin ? (
            <div className="bg-[#E0F0E0] border border-black/5 rounded-[20px] p-5 shadow-sm hover:translate-y-[-2px] hover:shadow-md transition-all duration-200">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[13px] font-semibold text-neutral-800 uppercase tracking-wider">Storage Terpakai</span>
                <div className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center">
                  <ClipboardDocumentListIcon className="w-5 h-5 text-[#15803D]" />
                </div>
              </div>
              <h3 className="text-3xl font-display font-extrabold text-neutral-900 leading-none mb-2">
                {formatBytes(stats.storage_used_bytes)}
              </h3>
              <span className="text-xs font-semibold text-neutral-500">
                Estimasi enkripsi awan
              </span>
            </div>
          ) : (
            <div className={clsx(
              "border border-black/5 rounded-[20px] p-5 shadow-sm hover:translate-y-[-2px] hover:shadow-md transition-all duration-200",
              realAlertsData.length > 0 ? "bg-[#FDE8D8] animate-pulse-dot" : "bg-[#E0F0E0]"
            )}>
              <div className="flex justify-between items-start mb-4">
                <span className="text-[13px] font-semibold uppercase tracking-wider text-neutral-800">Anomali Aktif</span>
                <div className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center">
                  <ExclamationTriangleIcon className={clsx("w-5 h-5", realAlertsData.length > 0 ? "text-[#C2410C]" : "text-[#15803D]")} />
                </div>
              </div>
              <h3 className={clsx("text-3xl font-display font-extrabold leading-none mb-2", realAlertsData.length > 0 ? "text-[#7A2D0F]" : "text-[#14532D]")}>
                {realAlertsData.length}
              </h3>
              <span className={clsx("text-xs font-semibold", realAlertsData.length > 0 ? "text-[#7A2D0F]/70" : "text-[#14532D]/75")}>
                {realAlertsData.length > 0 ? "Perlu perhatian segera" : "Sistem Aman ✓"}
              </span>
            </div>
          )}

        </div>

        {/* ── [DASHBOARD_CONTENT_GRID] ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          
          {/* PANEL KIRI (Konten Utama) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Chart Section */}
            <div className="bg-white border border-neutral-200 rounded-[20px] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-[34px] h-[34px] bg-[#E0F5EE] rounded-xl flex items-center justify-center">
                    <ClipboardDocumentListIcon className="w-[18px] h-[18px] text-[#14503C]" />
                  </div>
                  <h3 className="font-display font-bold text-neutral-950 text-sm">
                    {isSuperAdmin ? "Aktivitas Upload & Akses Sistem per Bulan" : "Upload & Akses per Bulan"}
                  </h3>
                </div>
                <span className="text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-600 px-3 py-1 rounded-lg cursor-pointer font-semibold transition-colors">
                  Filter: 6 bln ▼
                </span>
              </div>
              
              <div className="w-full min-h-[300px] h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F8F7" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8FA39B", fontWeight: 550 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#8FA39B", fontWeight: 550 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#0F3D29", color: "#FFFFFF", borderRadius: "12px", border: "none" }} />
                    <Bar dataKey="Upload" fill="#3DB891" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Download" fill="#EDE0F8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Table Section */}
            {isSuperAdmin ? (
              <div className="bg-white border border-neutral-200 rounded-[20px] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-[34px] h-[34px] bg-[#E0F5EE] rounded-xl flex items-center justify-center">
                      <BuildingOffice2Icon className="w-[18px] h-[18px] text-[#14503C]" />
                    </div>
                    <h3 className="font-display font-bold text-neutral-950 text-sm">Utilisasi Sekolah Terdaftar</h3>
                  </div>
                  <Link href="/admin/monitoring" className="text-xs font-semibold text-[#208C68] hover:text-[#14503C] transition-colors">
                    Detail monitoring →
                  </Link>
                </div>

                <div className="w-full overflow-hidden border border-neutral-200 rounded-xl">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200">
                        <th className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-4 py-2.5 text-left">Nama Sekolah</th>
                        <th className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-4 py-2.5 text-left">NPSN</th>
                        <th className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-4 py-2.5 text-left">Total Siswa</th>
                        <th className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-4 py-2.5 text-left">Total Dokumen</th>
                        <th className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-4 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schoolsData.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-xs text-neutral-400 font-medium">Tidak ada sekolah terdaftar</td>
                        </tr>
                      ) : (
                        schoolsData.slice(0, 5).map((sch: any) => (
                          <tr key={sch.id} className="border-b border-neutral-100 hover:bg-[#F0FAF6] transition-colors duration-120 last:border-none">
                            <td className="px-4 py-3 text-sm text-neutral-800 font-bold">{sch.nama}</td>
                            <td className="px-4 py-3 text-sm text-neutral-500 font-mono font-medium">{sch.npsn}</td>
                            <td className="px-4 py-3 text-sm text-neutral-700 font-semibold">{sch.total_siswa}</td>
                            <td className="px-4 py-3 text-sm text-neutral-700 font-semibold">{sch.total_dokumen}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={clsx(
                                "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold",
                                sch.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                              )}>
                                {sch.is_active ? "Aktif" : "Nonaktif"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-[20px] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-[34px] h-[34px] bg-[#E0F5EE] rounded-xl flex items-center justify-center">
                      <DocumentTextIcon className="w-[18px] h-[18px] text-[#14503C]" />
                    </div>
                    <h3 className="font-display font-bold text-neutral-950 text-sm">Dokumen Terbaru</h3>
                  </div>
                  <Link href="/admin/siswa" className="text-xs font-semibold text-[#208C68] hover:text-[#14503C] transition-colors">
                    Lihat semua →
                  </Link>
                </div>

                <div className="w-full overflow-hidden border border-neutral-200 rounded-xl">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200">
                        <th className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-4 py-2.5 text-left">Jenis</th>
                        <th className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-4 py-2.5 text-left">Siswa</th>
                        <th className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-4 py-2.5 text-left">Angkatan</th>
                        <th className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-4 py-2.5 text-left">Tgl Unggah</th>
                        <th className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-4 py-2.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentDocs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-xs text-neutral-400 font-medium">Tidak ada dokumen terbaru</td>
                        </tr>
                      ) : (
                        recentDocs.slice(0, 5).map((doc: any) => {
                          const typeLabel = doc.document_type || "Dokumen";
                          const isRapor = typeLabel.toLowerCase().includes("rapor");
                          const isIjazah = typeLabel.toLowerCase().includes("ijazah");
                          const isTranskrip = typeLabel.toLowerCase().includes("transkrip");

                          return (
                            <tr key={doc.id} className="border-b border-neutral-100 hover:bg-[#F0FAF6] transition-colors duration-120 last:border-none">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={clsx(
                                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold leading-normal",
                                  isRapor && "bg-[#DFF2EC] text-[#0F4C39]",
                                  isIjazah && "bg-[#FCEEDD] text-[#78350F]",
                                  isTranskrip && "bg-[#EDE0F8] text-[#4A1D7A]",
                                  !isRapor && !isIjazah && !isTranskrip && "bg-[#DDE9F8] text-[#1A3D6B]"
                                )}>
                                  📄 {typeLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-neutral-800 font-semibold">{doc.siswa?.nama_lengkap || "Siswa"}</td>
                              <td className="px-4 py-3 text-sm text-neutral-600 font-medium font-mono">{doc.siswa?.angkatan || "—"}</td>
                              <td className="px-4 py-3 text-xs text-neutral-400 font-semibold">{new Date(doc.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <button onClick={() => setPreviewDocId(doc.id)} className="w-[30px] h-[30px] bg-[#E0F5EE] hover:bg-[#B8EAD9] rounded-lg flex items-center justify-center text-[#14503C] transition-colors shadow-sm">
                                    <EyeOutline className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDownloadDoc(doc)} className="w-[30px] h-[30px] bg-[#EDE0F8] hover:bg-purple-200 rounded-lg flex items-center justify-center text-[#4A1D7A] transition-colors shadow-sm">
                                    <ArrowDownOutline className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>

          {/* PANEL KANAN (Info Panel) */}
          <div className="space-y-6">
            
            {/* [ACTIVITY_FEED] */}
            <div className="bg-white border border-neutral-200 rounded-[20px] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-3">
                <h3 className="font-display font-bold text-neutral-950 text-sm">
                  {isSuperAdmin ? "Anomali Sistem Terbaru" : "Aktivitas Terbaru"}
                </h3>
                <span className="text-[10px] font-extrabold bg-[#FDE8D8] text-[#C2410C] px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse-dot">Live</span>
              </div>
              
              <ul className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {realAlertsData.length === 0 ? (
                  <div className="text-center py-10 text-neutral-400 text-xs font-semibold">Tidak ada aktivitas anomali terdeteksi</div>
                ) : (
                  realAlertsData.slice(0, 5).map((alert: any) => {
                    const isCritical = alert.action === "ANOMALY_CRITICAL";
                    return (
                      <li key={alert.id} className="flex gap-2.5 items-start py-2.5 border-b border-neutral-100 last:border-none">
                        <div className={clsx(
                          "w-2 h-2 rounded-full mt-1.5 shrink-0",
                          isCritical ? "bg-[#DC2626] animate-pulse-dot" : "bg-[#D97706]"
                        )} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-neutral-800 leading-snug">
                            {isCritical ? "Deteksi Anomali Kritis" : "Peringatan Akses IP"} — {alert.ip_address}
                          </p>
                          <div className="flex gap-2 text-[11px] text-neutral-400 font-medium mt-1">
                            <span>{new Date(alert.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB</span>
                            <span>·</span>
                            <span className={clsx("font-bold", isCritical ? "text-[#DC2626]" : "text-[#D97706]")}>
                              {isCritical ? "Anomali" : "Peringatan"}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            {/* [QUICK_ACTION_CARD] */}
            <div className="bg-white border border-neutral-200 rounded-[20px] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-3">
                <h3 className="font-display font-bold text-neutral-950 text-sm">Aksi Cepat</h3>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                
                {isSuperAdmin ? (
                  <>
                    <Link href="/admin/manajemen-sekolah" className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-[#D4DDD9] rounded-xl cursor-pointer hover:border-[#3DB891] hover:bg-[#F0FAF6] transition-all hover:translate-y-[-1px] hover:shadow-sm">
                      <div className="w-10 h-10 bg-[#FCEEDD] rounded-xl flex items-center justify-center">
                        <BuildingOffice2Outline className="w-5 h-5 text-[#D97706]" />
                      </div>
                      <span className="text-xs font-bold text-neutral-700 text-center leading-tight">Kelola Sekolah</span>
                    </Link>

                    <Link href="/admin/manajemen-dinas" className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-[#D4DDD9] rounded-xl cursor-pointer hover:border-[#3DB891] hover:bg-[#F0FAF6] transition-all hover:translate-y-[-1px] hover:shadow-sm">
                      <div className="w-10 h-10 bg-[#DDE9F8] rounded-xl flex items-center justify-center">
                        <BuildingOffice2Outline className="w-5 h-5 text-[#2563EB]" />
                      </div>
                      <span className="text-xs font-bold text-neutral-700 text-center leading-tight">Kelola Dinas</span>
                    </Link>

                    <Link href="/admin/backup" className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-[#D4DDD9] rounded-xl cursor-pointer hover:border-[#3DB891] hover:bg-[#F0FAF6] transition-all hover:translate-y-[-1px] hover:shadow-sm">
                      <div className="w-10 h-10 bg-[#EDE0F8] rounded-xl flex items-center justify-center">
                        <CloudArrowUpOutline className="w-5 h-5 text-[#7C3AED]" />
                      </div>
                      <span className="text-xs font-bold text-neutral-700 text-center leading-tight">Backup Sistem</span>
                    </Link>

                    <Link href="/admin/master-key" className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-[#D4DDD9] rounded-xl cursor-pointer hover:border-[#3DB891] hover:bg-[#F0FAF6] transition-all hover:translate-y-[-1px] hover:shadow-sm">
                      <div className="w-10 h-10 bg-[#E0F0E0] rounded-xl flex items-center justify-center">
                        <KeyOutline className="w-5 h-5 text-[#15803D]" />
                      </div>
                      <span className="text-xs font-bold text-neutral-700 text-center leading-tight">Master Keys</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/admin/upload" className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-[#D4DDD9] rounded-xl cursor-pointer hover:border-[#3DB891] hover:bg-[#F0FAF6] transition-all hover:translate-y-[-1px] hover:shadow-sm">
                      <div className="w-10 h-10 bg-[#FCEEDD] rounded-xl flex items-center justify-center">
                        <ArrowUpOutline className="w-5 h-5 text-[#D97706]" />
                      </div>
                      <span className="text-xs font-bold text-neutral-700 text-center leading-tight">Upload Dok</span>
                    </Link>

                    <Link href="/admin/siswa" className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-[#D4DDD9] rounded-xl cursor-pointer hover:border-[#3DB891] hover:bg-[#F0FAF6] transition-all hover:translate-y-[-1px] hover:shadow-sm">
                      <div className="w-10 h-10 bg-[#DDE9F8] rounded-xl flex items-center justify-center">
                        <UserPlusOutline className="w-5 h-5 text-[#2563EB]" />
                      </div>
                      <span className="text-xs font-bold text-neutral-700 text-center leading-tight">Siswa Baru</span>
                    </Link>

                    <Link href="/admin/audit-log" className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-[#D4DDD9] rounded-xl cursor-pointer hover:border-[#3DB891] hover:bg-[#F0FAF6] transition-all hover:translate-y-[-1px] hover:shadow-sm">
                      <div className="w-10 h-10 bg-[#DFF2EC] rounded-xl flex items-center justify-center">
                        <ClipboardOutline className="w-5 h-5 text-[#1A7A5E]" />
                      </div>
                      <span className="text-xs font-bold text-neutral-700 text-center leading-tight">Audit Log</span>
                    </Link>

                    <Link href="/admin/master-key" className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-[#D4DDD9] rounded-xl cursor-pointer hover:border-[#3DB891] hover:bg-[#F0FAF6] transition-all hover:translate-y-[-1px] hover:shadow-sm">
                      <div className="w-10 h-10 bg-[#E0F0E0] rounded-xl flex items-center justify-center">
                        <KeyOutline className="w-5 h-5 text-[#15803D]" />
                      </div>
                      <span className="text-xs font-bold text-neutral-700 text-center leading-tight">Master Key</span>
                    </Link>
                  </>
                )}

              </div>
            </div>

          </div>

        </div>

        {/* PDF Preview Modal */}
        {previewDocId && (
          <PdfModal
            isOpen={!!previewDocId}
            onClose={() => setPreviewDocId(null)}
            previewUrl={previewUrl}
            title="Preview Dokumen Terbaru"
            onDownload={() => handleDownloadDoc({ id: previewDocId, document_type: 'Preview' })}
          />
        )}

      </div>
    </AdminLayout>
  );
}
