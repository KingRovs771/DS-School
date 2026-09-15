import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { dinasApi } from "@/lib/api";
import { 
  DocumentTextIcon, 
  ArrowLeftIcon,
  EyeIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import AdminLayout from "@/components/AdminLayout";
import { useRequireAdmin } from "@/hooks/useAdminAuth";
import PdfModal from "@/components/PdfModal";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import Link from "next/link";

export default function DetailMonitoringSekolahPage() {
  const { isAdminAuthenticated, mounted } = useRequireAdmin();
  const router = useRouter();
  const { sekolah_id } = router.query;
  const sekolahId = Number(sekolah_id);

  const [previewDocId, setPreviewDocId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const { data: sekolahData, isLoading: loadingSekolah } = useQuery({
    queryKey: ["dinas-sekolah-detail", sekolahId],
    queryFn: async () => {
      const res = await dinasApi.getDetailSekolah(sekolahId);
      return res.data;
    },
    enabled: isAdminAuthenticated && !!sekolahId,
  });

  const { data: documents, isLoading: loadingDocs } = useQuery({
    queryKey: ["dinas-sekolah-dokumen", sekolahId],
    queryFn: async () => {
      const res = await dinasApi.getSekolahDokumen(sekolahId);
      return res.data;
    },
    enabled: isAdminAuthenticated && !!sekolahId,
  });

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
        const res = await dinasApi.getDokumenPreviewBlob(previewDocId);
        const url = URL.createObjectURL(res.data);
        if (isMounted) setPreviewUrl(url);
      } catch (err: any) {
        toast.error(err.response?.data?.detail || "Gagal memuat preview dokumen");
        setPreviewDocId(null);
      }
    };
    fetchPreview();
    
    return () => {
      isMounted = false;
    };
  }, [previewDocId]);

  const [search, setSearch] = useState("");
  const [filterKelas, setFilterKelas] = useState("");
  const [filterAngkatan, setFilterAngkatan] = useState("");

  if (!mounted || !isAdminAuthenticated) return null;

  const isLoading = loadingSekolah || loadingDocs;

  // Extract unique classes and generations from documents list
  const uniqueKelas = Array.from(new Set(documents?.map((d: any) => d.siswa?.kelas).filter(Boolean) as string[])).sort();
  const uniqueAngkatan = Array.from(new Set(documents?.map((d: any) => d.siswa?.angkatan).filter(Boolean) as number[])).sort((a, b) => b - a);

  // Filter documents in memory
  const filteredDocuments = documents?.filter((doc: any) => {
    const siswa = doc.siswa || {};
    const matchesSearch = 
      siswa.nama_lengkap?.toLowerCase().includes(search.toLowerCase()) ||
      siswa.nisn?.toLowerCase().includes(search.toLowerCase()) ||
      siswa.nis?.toLowerCase().includes(search.toLowerCase());
      
    const matchesAngkatan = filterAngkatan ? String(siswa.angkatan) === filterAngkatan : true;
    const matchesKelas = filterKelas ? siswa.kelas === filterKelas : true;
    
    return matchesSearch && matchesAngkatan && matchesKelas;
  }) || [];

  return (
    <AdminLayout title="Detail Monitoring Sekolah">
      <Head>
        <title>Detail Dokumen - Monitoring Sekolah</title>
      </Head>

      <div className="space-y-6 font-body">
        
        {/* Header Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D4DDD9]/60">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/dinas/monitoring" className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors">
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <div className="w-10 h-10 bg-[#E0F5EE] rounded-xl flex items-center justify-center">
              <DocumentTextIcon className="w-5 h-5 text-[#14503C]" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-gray-900">
                {sekolahData?.nama || "Memuat Sekolah..."}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">NPSN: {sekolahData?.npsn || "..."}</p>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#D4DDD9]/60 flex flex-col md:flex-row gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Cari nama, NIS, atau NISN siswa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#3DB891]/20 focus:border-[#3DB891] transition-all"
            />
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* Filter Kelas */}
          <div className="w-full md:w-48">
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#3DB891]/20 focus:border-[#3DB891] transition-all"
            >
              <option value="">Semua Kelas</option>
              {uniqueKelas.map((k: any) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          {/* Filter Angkatan */}
          <div className="w-full md:w-48">
            <select
              value={filterAngkatan}
              onChange={(e) => setFilterAngkatan(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#3DB891]/20 focus:border-[#3DB891] transition-all"
            >
              <option value="">Semua Angkatan</option>
              {uniqueAngkatan.map((a: any) => (
                <option key={a} value={a}>Angkatan {a}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#D4DDD9]/60 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center p-20">
              <div className="animate-spin w-8 h-8 border-4 border-[#3DB891] border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-5 py-4">Siswa</th>
                    <th className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-5 py-4">Jenis Dokumen</th>
                    <th className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-5 py-4">Tahun/Semester</th>
                    <th className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-5 py-4">Tgl Unggah</th>
                    <th className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-5 py-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-sm text-neutral-400 font-medium">
                        Belum ada dokumen yang diunggah oleh sekolah ini atau tidak cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc: any) => {
                      const typeLabel = doc.document_type || doc.jenis_dok || "Dokumen";
                      const isRapor = typeLabel.toLowerCase().includes("rapor");
                      const isIjazah = typeLabel.toLowerCase().includes("ijazah");
                      const isTranskrip = typeLabel.toLowerCase().includes("transkrip");

                      return (
                        <tr key={doc.id} className="hover:bg-[#F0FAF6] transition-colors duration-150">
                          <td className="px-5 py-4 font-semibold text-neutral-800">
                            {doc.siswa?.nama_lengkap || "Siswa Tidak Diketahui"}
                            <div className="text-xs font-normal text-neutral-500 font-mono mt-0.5">NISN: {doc.siswa?.nisn || "-"}</div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
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
                          <td className="px-5 py-4 text-neutral-600 font-medium">
                            {doc.tahun_ajaran || "-"} <span className="text-neutral-400 mx-1">•</span> <span className="capitalize">{doc.semester || "-"}</span>
                          </td>
                          <td className="px-5 py-4 text-xs text-neutral-500 font-medium">
                            {new Date(doc.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button 
                                onClick={() => setPreviewDocId(doc.id)} 
                                className="w-8 h-8 bg-[#E0F5EE] hover:bg-[#B8EAD9] rounded-lg flex items-center justify-center text-[#14503C] transition-colors shadow-sm"
                                title="Lihat Preview (Tanpa Download)"
                              >
                                <EyeIcon className="w-4 h-4" />
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
          )}
        </div>

        {/* PDF Preview Modal (Dinas Mode: No Download Button) */}
        {previewDocId && (
          <PdfModal
            isOpen={!!previewDocId}
            onClose={() => setPreviewDocId(null)}
            previewUrl={previewUrl}
            title="Preview Dokumen (Mode Pemantauan)"
            // onDownload is intentionally omitted to disable download for Dinas
          />
        )}

      </div>
    </AdminLayout>
  );
}
