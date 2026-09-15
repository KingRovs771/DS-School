/**
 * pages/dokumen.tsx — Halaman daftar dokumen siswa
 * Mengikuti spesifikasi [TABLE_COMPONENT], [TYPOGRAPHY], [SPACING_SHADOW] dari DESIGN.md
 */
import { useState, useMemo, useEffect } from "react";
import Head from "next/head";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FolderIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  ChevronDownIcon,
  FolderOpenIcon,
  AdjustmentsHorizontalIcon,
  ArrowPathIcon
} from "@heroicons/react/24/solid";
import {
  EyeIcon as EyeOutline,
  ArrowDownTrayIcon as ArrowDownOutline,
  FolderOpenIcon as FolderOpenOutline
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import toast from "react-hot-toast";
import { clsx } from "clsx";

import Layout from "@/components/Layout";
import { DocumentRowSkeleton } from "@/components/Skeleton";
import StatusBadge from "@/components/StatusBadge";
import PdfModal from "@/components/PdfModal";
import { dokumenApi, categoriesApi, tahunAjaranApi } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";

interface Dokumen {
  id: number;
  jenis_dok: string;
  tahun_ajaran: string;
  semester?: string;
  status?: string;
  created_at?: string;
  metadata_json?: Record<string, unknown>;
}

export default function DokumenPage() {
  const { isAuthenticated, mounted } = useRequireAuth();

  const [search, setSearch] = useState("");
  const [filterJenis, setFilterJenis] = useState("");
  const [filterTahun, setFilterTahun] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Dokumen | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!previewDoc) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
      }
      return;
    }
    
    let isMounted = true;
    const fetchPreview = async () => {
      try {
        const res = await dokumenApi.getPreviewBlob(previewDoc.id);
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
  }, [previewDoc]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dokumen-saya"],
    queryFn: () => dokumenApi.getSaya().then(r => r.data),
    enabled: isAuthenticated,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.getAll().then(r => r.data),
    enabled: isAuthenticated,
  });

  const { data: tahunAjaranData } = useQuery({
    queryKey: ["tahun-ajaran"],
    queryFn: () => tahunAjaranApi.getAll().then(r => r.data),
    enabled: isAuthenticated,
  });

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {
      rapor: "Rapor",
      raport: "Raport Akademik",
      ijazah: "Ijazah",
      khs: "KHS",
      transkrip_nilai: "Transkrip Nilai",
      sertifikat: "Sertifikat",
      surat_ket: "Surat Keterangan",
      surat_keterangan: "Surat Keterangan",
      lainnya: "Lainnya",
    };
    if (categoriesData) {
      categoriesData.forEach((c: any) => {
        map[c.name] = c.description || c.name;
      });
    }
    return map;
  }, [categoriesData]);

  const getJenisLabel = (jenis: string) => {
    if (categoryMap[jenis]) return categoryMap[jenis];
    return jenis
      .replace(/_/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  const jenisOptions = useMemo(() => {
    const options = [{ value: "", label: "Semua Jenis" }];
    if (categoriesData) {
      categoriesData.forEach((c: any) => {
        options.push({ value: c.name, label: c.description || c.name });
      });
    } else {
      options.push(
        { value: "rapor", label: "Rapor" },
        { value: "ijazah", label: "Ijazah" },
        { value: "khs", label: "KHS" },
        { value: "sertifikat", label: "Sertifikat" },
        { value: "transkrip_nilai", label: "Transkrip Nilai" }
      );
    }
    return options;
  }, [categoriesData]);

  const tahunOptions = useMemo(() => {
    const options = [{ value: "", label: "Semua Tahun Ajaran" }];
    if (tahunAjaranData) {
      tahunAjaranData.forEach((t: any) => {
        options.push({ value: t.tahun, label: t.tahun });
      });
    }
    return options;
  }, [tahunAjaranData]);

  const dokumen = useMemo(() => {
    if (!data) return [];
    const list = Array.isArray(data) ? data : (data.items || []);
    return list.filter((dok: Dokumen) => {
      const matchSearch =
        dok.jenis_dok.toLowerCase().includes(search.toLowerCase()) ||
        dok.tahun_ajaran.toLowerCase().includes(search.toLowerCase()) ||
        (dok.semester && `sem ${dok.semester}`.includes(search.toLowerCase()));

      const matchJenis = filterJenis ? dok.jenis_dok === filterJenis : true;
      const matchTahun = filterTahun ? dok.tahun_ajaran === filterTahun : true;

      return matchSearch && matchJenis && matchTahun;
    });
  }, [data, search, filterJenis, filterTahun]);

  const handleDownload = async (dok: Dokumen) => {
    if (downloadingId) return;
    setDownloadingId(dok.id);
    try {
      const response = await dokumenApi.download(dok.id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${getJenisLabel(dok.jenis_dok)}_${dok.tahun_ajaran.replace("/", "-")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Dokumen berhasil diunduh!");
    } catch {
      toast.error("Gagal mengunduh dokumen. Coba lagi.");
    } finally {
      setDownloadingId(null);
    }
  };

  if (!mounted || !isAuthenticated) return null;

  return (
    <>
      <Head>
        <title>Dokumen Saya — DokumenSekolah</title>
        <meta name="description" content="Daftar lengkap dokumen akademik siswa" />
      </Head>
      <Layout>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
        >
          <div>
            <h2 className="text-2xl font-display font-extrabold text-[#0D0F0E]">Dokumen Akademik</h2>
            <p className="text-xs font-semibold text-[#4A5350] mt-0.5">
              {isLoading ? "Memuat..." : `${dokumen.length} dokumen ditemukan`}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="sm:ml-auto flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-neutral-800 bg-white border border-[#D4DDD9] rounded-xl hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
          >
            <ArrowPathIcon className="w-4 h-4 text-neutral-400" /> Perbarui
          </button>
        </motion.div>

        {/* Filter & Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-[20px] border border-[#D4DDD9] shadow-sm p-4 mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8FA39B]" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari dokumen..."
                id="search-dokumen"
                className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] focus:ring-2 focus:ring-[#3DB891]/25 transition-all placeholder-[#8FA39B]"
              />
            </div>

            {/* Toggle Filters */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-neutral-700 bg-white border border-[#D4DDD9] rounded-xl hover:bg-[#F5F8F7] transition-all"
            >
              <AdjustmentsHorizontalIcon className="w-4 h-4 text-neutral-400" />
              Filter
              {(filterJenis || filterTahun) && (
                <span className="w-5 h-5 bg-[#208C68] text-white text-[10px] rounded-full flex items-center justify-center font-extrabold">
                  {[filterJenis, filterTahun].filter(Boolean).length}
                </span>
              )}
              <ChevronDownIcon className={clsx("w-3 h-3 text-neutral-400 transition-transform", showFilters && "rotate-180")} />
            </button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#D4DDD9]"
            >
              <div>
                <label className="block text-[11px] font-bold text-[#4A5350] mb-1.5 uppercase">Jenis Dokumen</label>
                <select
                  id="filter-jenis"
                  value={filterJenis}
                  onChange={e => setFilterJenis(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                >
                  {jenisOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#4A5350] mb-1.5 uppercase">Tahun Ajaran</label>
                <select
                  id="filter-tahun"
                  value={filterTahun}
                  onChange={e => setFilterTahun(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                >
                  {tahunOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Table & Lists */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[20px] border border-[#D4DDD9] shadow-sm overflow-hidden"
        >
          {isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#8FA39B]">
              <FolderOpenOutline className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-bold text-sm text-neutral-700 mb-1">Gagal memuat dokumen</p>
              <p className="text-xs font-medium mb-4">Periksa koneksi Anda dan coba lagi</p>
              <button onClick={() => refetch()} className="px-4 py-2 text-xs font-bold bg-[#208C68] hover:bg-[#14503C] text-white rounded-xl shadow transition-colors">
                Coba Lagi
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table [TABLE_COMPONENT] */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#F5F8F7] border-b border-[#D4DDD9]">
                      <th className="px-5 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Jenis Dokumen</th>
                      <th className="px-5 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Tahun Ajaran</th>
                      <th className="px-5 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Semester</th>
                      <th className="px-5 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Tanggal Upload</th>
                      <th className="px-5 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-right text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDF2F0]">
                    {isLoading ? (
                      [...Array(5)].map((_, i) => <DocumentRowSkeleton key={i} />)
                    ) : dokumen.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-[#8FA39B]">
                          <FolderOpenOutline className="w-10 h-10 mx-auto mb-3 opacity-30" />
                          <p className="text-xs font-semibold">
                            {search || filterJenis || filterTahun ? "Tidak ada dokumen sesuai filter" : "Belum ada dokumen tersedia"}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      dokumen.map((dok: any, i: number) => {
                        const isRapor = dok.jenis_dok?.toLowerCase().includes("rapor");
                        const isIjazah = dok.jenis_dok?.toLowerCase().includes("ijazah");
                        const isTranskrip = dok.jenis_dok?.toLowerCase().includes("transkrip");

                        return (
                          <motion.tr
                            key={dok.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.03 }}
                            className="hover:bg-[#F0FAF6] transition-colors duration-120"
                          >
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className={clsx(
                                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold leading-normal",
                                isRapor && "bg-[#DFF2EC] text-[#0F4C39]",
                                isIjazah && "bg-[#FCEEDD] text-[#78350F]",
                                isTranskrip && "bg-[#EDE0F8] text-[#4A1D7A]",
                                !isRapor && !isIjazah && !isTranskrip && "bg-[#DDE9F8] text-[#1A3D6B]"
                              )}>
                                📄 {getJenisLabel(dok.jenis_dok)}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-sm font-semibold text-neutral-700">{dok.tahun_ajaran}</td>
                            <td className="px-5 py-4 text-sm font-medium text-neutral-600">
                              {dok.semester ? `Semester ${dok.semester}` : "—"}
                            </td>
                            <td className="px-5 py-4 text-xs font-semibold text-[#8FA39B]">
                              {dok.created_at ? format(new Date(dok.created_at), "d MMM yyyy", { locale: localeId }) : "—"}
                            </td>
                            <td className="px-5 py-4">
                              <StatusBadge status={dok.status || "approved"} />
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  id={`btn-preview-${dok.id}`}
                                  onClick={() => setPreviewDoc(dok)}
                                  className="w-[30px] h-[30px] bg-[#E0F5EE] hover:bg-[#B8EAD9] rounded-lg flex items-center justify-center text-[#14503C] transition-colors shadow-sm"
                                  title="Preview"
                                >
                                  <EyeOutline className="w-4 h-4" />
                                </button>
                                <button
                                  id={`btn-download-${dok.id}`}
                                  onClick={() => handleDownload(dok)}
                                  disabled={downloadingId === dok.id}
                                  className="w-[30px] h-[30px] bg-[#EDE0F8] hover:bg-purple-250 rounded-lg flex items-center justify-center text-[#4A1D7A] transition-colors shadow-sm disabled:opacity-50"
                                  title="Unduh"
                                >
                                  {downloadingId === dok.id ? (
                                    <div className="w-3.5 h-3.5 border border-purple-800 border-t-transparent rounded-full animate-spin" />
                                  ) : <ArrowDownOutline className="w-4 h-4" />}
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden divide-y divide-[#EDF2F0]">
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="px-4 py-4 space-y-2">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 bg-[#EDF2F0] animate-pulse rounded-lg flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-[#EDF2F0] animate-pulse rounded w-3/4" />
                          <div className="h-3 bg-[#EDF2F0] animate-pulse rounded w-1/2" />
                        </div>
                      </div>
                    </div>
                  ))
                ) : dokumen.length === 0 ? (
                  <div className="py-12 text-center text-[#8FA39B]">
                    <FolderOpenOutline className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-xs font-semibold">Belum ada dokumen tersedia</p>
                  </div>
                ) : (
                  dokumen.map((dok: any) => {
                    const isRapor = dok.jenis_dok?.toLowerCase().includes("rapor");
                    const isIjazah = dok.jenis_dok?.toLowerCase().includes("ijazah");
                    const isTranskrip = dok.jenis_dok?.toLowerCase().includes("transkrip");

                    return (
                      <div key={dok.id} className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className={clsx(
                            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                            isRapor && "bg-[#DFF2EC] text-[#0F4C39]",
                            isIjazah && "bg-[#FCEEDD] text-[#78350F]",
                            isTranskrip && "bg-[#EDE0F8] text-[#4A1D7A]",
                            !isRapor && !isIjazah && !isTranskrip && "bg-[#DDE9F8] text-[#1A3D6B]"
                          )}>
                            <FolderIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-neutral-800">
                                {getJenisLabel(dok.jenis_dok)}
                              </span>
                              <StatusBadge status={dok.status || "approved"} />
                            </div>
                            <p className="text-xs font-semibold text-[#8FA39B]">
                              T.A. {dok.tahun_ajaran} {dok.semester ? `· Semester ${dok.semester}` : ""}
                            </p>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => setPreviewDoc(dok)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-[#14503C] bg-[#E0F5EE] hover:bg-[#B8EAD9] rounded-xl border border-[#B8EAD9] transition-all"
                              >
                                <EyeOutline className="w-3.5 h-3.5" /> Preview
                              </button>
                              <button
                                onClick={() => handleDownload(dok)}
                                disabled={downloadingId === dok.id}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-[#4A1D7A] bg-[#EDE0F8] hover:bg-purple-200 rounded-xl border border-purple-250 transition-all disabled:opacity-50"
                              >
                                {downloadingId === dok.id ? (
                                  <div className="w-3.5 h-3.5 border border-purple-800 border-t-transparent rounded-full animate-spin" />
                                ) : <ArrowDownOutline className="w-3.5 h-3.5" />}
                                Unduh
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </motion.div>

        {/* PDF Preview Modal */}
        {previewDoc && (
          <PdfModal
            isOpen={!!previewDoc}
            onClose={() => setPreviewDoc(null)}
            previewUrl={previewUrl}
            title={`${getJenisLabel(previewDoc.jenis_dok)} — ${previewDoc.tahun_ajaran}`}
            onDownload={() => handleDownload(previewDoc)}
          />
        )}
      </Layout>
    </>
  );
}
