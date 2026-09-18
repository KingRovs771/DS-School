/**
 * pages/admin/siswa.tsx — Manajemen Siswa, CRUD Manual, Bulk Import Excel & Drawer Dokumen
 * Mengikuti spesifikasi [TABLE_COMPONENT], [TYPOGRAPHY], [SPACING_SHADOW] dari DESIGN.md
 */
import { useState, useMemo, useEffect } from "react";
import Head from "next/head";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminSiswaApi, adminDokumenApi, dokumenApi } from "@/lib/api";
import AdminLayout from "@/components/AdminLayout";
import { useRequireAdmin } from "@/hooks/useAdminAuth";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  DocumentArrowUpIcon,
  EyeIcon,
  TrashIcon,
  PencilSquareIcon,
  XMarkIcon,
  AcademicCapIcon,
  CalendarIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ShieldCheckIcon
} from "@heroicons/react/24/solid";
import {
  XMarkIcon as XMarkOutline,
  FolderOpenIcon as FolderOpenOutline,
  EyeIcon as EyeOutline,
  ArrowDownTrayIcon as ArrowDownOutline,
  TrashIcon as TrashOutline
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { formatBytes } from "@/lib/utils";
import PdfModal from "@/components/PdfModal";
import StatusBadge from "@/components/StatusBadge";
import { clsx } from "clsx";

export default function AdminSiswa() {
  useRequireAdmin();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [kelasFilter, setKelasFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  
  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [bulkKelulusanModalOpen, setBulkKelulusanModalOpen] = useState(false);
  const [previewDocId, setPreviewDocId] = useState<number | null>(null);
  const [editSiswaId, setEditSiswaId] = useState<number | null>(null);

  const [bulkKelulusanForm, setBulkKelulusanForm] = useState({
    angkatan: new Date().getFullYear(),
    tahun_lulus: new Date().getFullYear().toString(),
    kelas: "",
  });

  // Edit doc state
  const [editDoc, setEditDoc] = useState<any | null>(null);
  const [editDocFile, setEditDocFile] = useState<File | null>(null);
  const [editDocAlasan, setEditDocAlasan] = useState("");

  // Form tambah siswa manual
  const [newSiswa, setNewSiswa] = useState({
    nis: "",
    nisn: "",
    nama_lengkap: "",
    kelas: "",
    angkatan: new Date().getFullYear(),
    tahun_lulus: "",
    tgl_lahir: "2008-01-01",
    email: "",
    telepon: "",
    sekolah_id: 1,
  });
  // Query ambil data kelas unik
  const { data: availableClasses = [] } = useQuery({
    queryKey: ["admin-siswa-kelas"],
    queryFn: async () => {
      const res = await adminSiswaApi.getClasses();
      return res.data;
    },
  });

  // Query ambil data siswa
  const { data: siswaData, isLoading, refetch } = useQuery({
    queryKey: ["admin-siswa", kelasFilter, search, currentPage],
    queryFn: async () => {
      const res = await adminSiswaApi.getAll({ kelas: kelasFilter, search: search, page: currentPage, limit: 10 });
      return res.data;
    },
  });

  const siswaList = Array.isArray(siswaData) ? siswaData : (siswaData?.items || []);
  const totalPages = Math.ceil((siswaData?.total || 0) / 10);

  // Query ambil dokumen siswa terpilih di Drawer
  const { data: studentDocs = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["student-docs", selectedStudent?.id],
    queryFn: async () => {
      if (!selectedStudent) return [];
      const res = await adminDokumenApi.getAll(selectedStudent.id);
      return res.data;
    },
    enabled: !!selectedStudent,
  });

  // Mutation Tambah Siswa
  const createMutation = useMutation({
    mutationFn: adminSiswaApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-siswa"] });
      toast.success("Siswa baru berhasil didaftarkan!");
      handleCloseAddModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Gagal menambahkan siswa.");
    },
  });

  // Mutation Edit/Update Siswa
  const updateMutation = useMutation({
    mutationFn: (data: { id: number; payload: any }) => adminSiswaApi.update(data.id, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-siswa"] });
      toast.success("Data siswa berhasil diperbarui!");
      handleCloseAddModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Gagal memperbarui data siswa.");
    },
  });

  // Mutation Import Excel
  const importMutation = useMutation({
    mutationFn: adminSiswaApi.importExcel,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-siswa"] });
      toast.success(res.data.message || "Bulk import siswa berhasil!");
      const errs = res.data?.details?.errors;
      if (Array.isArray(errs) && errs.length > 0) {
        const contoh = errs.slice(0, 3).map((e: any) => `Baris ${e.baris}: ${e.alasan}`).join(" • ");
        toast.error(
          `${errs.length} baris dilewati. ${contoh}${errs.length > 3 ? " …" : ""}`,
          { duration: 7000 }
        );
      }
      setImportModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Format file salah atau gagal import.");
    },
  });

  // Mutation Kelulusan Massal
  const bulkKelulusanMutation = useMutation({
    mutationFn: (data: { angkatan: number; tahun_lulus: number | null; kelas?: string }) =>
      adminSiswaApi.bulkKelulusan(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-siswa"] });
      toast.success(res.data.message || "Status kelulusan massal berhasil diperbarui!");
      setBulkKelulusanModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Gagal memperbarui status kelulusan massal.");
    },
  });

  // Mutation Hapus Siswa
  const deleteSiswaMutation = useMutation({
    mutationFn: adminSiswaApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-siswa"] });
      toast.success("Siswa berhasil dihapus dari sistem.");
      if (selectedStudent) setSelectedStudent(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Gagal menghapus siswa.");
    },
  });

  // Mutation Hapus Dokumen Siswa
  const deleteDocMutation = useMutation({
    mutationFn: adminDokumenApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-docs", selectedStudent?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Dokumen berhasil dihapus.");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Gagal menghapus dokumen.");
    },
  });

  const editDocMutation = useMutation({
    mutationFn: (data: { id: number, formData: FormData }) => adminDokumenApi.updateMetadata(data.id, data.formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-docs", selectedStudent?.id] });
      toast.success("Dokumen berhasil diperbarui (Anti-Tampering passed).");
      setEditDoc(null);
      setEditDocFile(null);
      setEditDocAlasan("");
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string' && detail.toLowerCase().includes("hash mismatch") || detail?.includes("Integritas") || detail?.includes("Dekripsi gagal")) {
        toast.error("Anti-Tampering Error: Dokumen lama gagal diverifikasi. File mungkin telah dimanipulasi secara ilegal!");
      } else {
        toast.error(detail || "Gagal mengupdate dokumen.");
      }
    },
  });

  const handleEditDocSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDocAlasan || editDocAlasan.length < 5) {
      toast.error("Alasan edit wajib diisi minimal 5 karakter.");
      return;
    }
    const formData = new FormData();
    formData.append("alasan_edit", editDocAlasan);
    if (editDocFile) {
      formData.append("file", editDocFile);
    }
    editDocMutation.mutate({ id: editDoc.id, formData });
  };

  const handleOpenAddModal = (siswa?: any) => {
    if (siswa) {
      setEditSiswaId(siswa.id);
      setNewSiswa({
        nis: siswa.nis || "",
        nisn: siswa.nisn || "",
        nama_lengkap: siswa.nama_lengkap || "",
        kelas: siswa.kelas || "",
        angkatan: siswa.angkatan || new Date().getFullYear(),
        tahun_lulus: siswa.tahun_lulus ? String(siswa.tahun_lulus) : "",
        tgl_lahir: siswa.tgl_lahir ? siswa.tgl_lahir.split("T")[0] : "2008-01-01",
        email: siswa.email || "",
        telepon: siswa.telepon || "",
        sekolah_id: siswa.sekolah_id || 1,
      });
    } else {
      setEditSiswaId(null);
      setNewSiswa({
        nis: "",
        nisn: "",
        nama_lengkap: "",
        kelas: "",
        angkatan: new Date().getFullYear(),
        tahun_lulus: "",
        tgl_lahir: "2008-01-01",
        email: "",
        telepon: "",
        sekolah_id: 1,
      });
    }
    setAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setAddModalOpen(false);
    setEditSiswaId(null);
    setNewSiswa({
      nis: "",
      nisn: "",
      nama_lengkap: "",
      kelas: "",
      angkatan: new Date().getFullYear(),
      tahun_lulus: "",
      tgl_lahir: "2008-01-01",
      email: "",
      telepon: "",
      sekolah_id: 1,
    });
  };

  const handleAddSiswa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiswa.nis || !newSiswa.nama_lengkap || !newSiswa.kelas) {
      toast.error("NIS, Nama Lengkap, dan Kelas wajib diisi.");
      return;
    }
    const parsedTahunLulus = newSiswa.tahun_lulus ? parseInt(newSiswa.tahun_lulus) : null;
    if (editSiswaId) {
      const { nis, nisn, ...updatePayload } = newSiswa;
      updateMutation.mutate({ 
        id: editSiswaId, 
        payload: { ...updatePayload, tahun_lulus: parsedTahunLulus } 
      });
    } else {
      createMutation.mutate({
        ...newSiswa,
        tahun_lulus: parsedTahunLulus
      });
    }
  };

  const handleImportExcel = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get("file") as File;
    if (!file || file.size === 0) {
      toast.error("Pilih file Excel terlebih dahulu.");
      return;
    }
    importMutation.mutate(file);
  };

  const handleDownloadDoc = async (doc: any) => {
    try {
      const response = await adminDokumenApi.download(doc.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${doc.jenis_dok}_${doc.id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Dokumen berhasil diunduh!");
    } catch (err: any) {
      console.error("Download error:", err);
      toast.error(`Gagal mengunduh dokumen: ${err?.message || "Unknown error"}`);
    }
  };

  // Helper to compute pagination range for beautiful UI/UX
  const getPageNumbers = () => {
    const range: (number | string)[] = [];
    const delta = 1; // Number of pages to show on either side of the current page

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        range.push(i);
      }
    } else {
      range.push(1);

      let start = Math.max(2, currentPage - delta);
      let end = Math.min(totalPages - 1, currentPage + delta);

      if (currentPage <= 3) {
        end = 4;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
      }

      if (start > 2) {
        range.push("...");
      }

      for (let i = start; i <= end; i++) {
        range.push(i);
      }

      if (end < totalPages - 1) {
        range.push("...");
      }

      range.push(totalPages);
    }
    return range;
  };

  const filteredSiswa = siswaList; // now filtered by backend

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

  return (
    <AdminLayout title="Manajemen Profil Siswa">
      <Head>
        <title>Siswa — DokumenSekolah Admin</title>
      </Head>

      <div className="space-y-6 relative font-body text-neutral-800">
        
        {/* Row 1: Actions Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white border border-[#D4DDD9] p-4 rounded-[20px] shadow-sm">
          {/* Search & Filter */}
          <div className="flex flex-1 w-full md:w-auto gap-3">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8FA39B]" />
              <input
                type="text"
                placeholder="Cari nama, NIS, atau email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] focus:ring-2 focus:ring-[#3DB891]/25 transition-all placeholder-[#8FA39B]"
              />
            </div>
            <select
              value={kelasFilter}
              onChange={(e) => {
                setKelasFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-[#D4DDD9] rounded-xl px-4 py-2 text-xs font-bold text-neutral-700 focus:outline-none focus:border-[#3DB891] transition-all"
            >
              <option value="">Semua Kelas</option>
              {availableClasses.map((kls: string) => (
                <option key={kls} value={kls}>
                  {kls}
                </option>
              ))}
            </select>
          </div>

          {/* Add Actions */}
          <div className="flex gap-3 w-full md:w-auto justify-end flex-wrap">
            <button
              onClick={() => setBulkKelulusanModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#EEF3FF] hover:bg-[#DCE6FF] text-[#2B4CBE] border border-[#C5D3F5] text-xs font-bold rounded-xl transition-all shadow-sm"
            >
              <AcademicCapIcon className="w-4 h-4 text-[#2B4CBE]" />
              Kelulusan Massal
            </button>
            <button
              onClick={() => setImportModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-[#F5F8F7] text-neutral-700 border border-[#D4DDD9] text-xs font-bold rounded-xl transition-all shadow-sm"
            >
              <DocumentArrowUpIcon className="w-4 h-4 text-[#208C68]" />
              Import Excel
            </button>
            <button
              onClick={() => handleOpenAddModal()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#208C68] hover:bg-[#14503C] text-white text-xs font-bold rounded-xl transition-all shadow shadow-[#208C68]/10"
            >
              <PlusIcon className="w-4 h-4" />
              Tambah Siswa
            </button>
          </div>
        </div>

        {/* Row 2: Students Table */}
        <div className="bg-white border border-[#D4DDD9] rounded-[20px] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F5F8F7] border-b border-[#D4DDD9]">
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">NIS / NISN</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Nama Lengkap</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Kelas</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Angkatan</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Kontak</th>
                  <th className="px-6 py-3 text-right text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2F0]">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-[#8FA39B]">
                      <div className="w-6 h-6 border-2 border-[#208C68] border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredSiswa.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-[#8FA39B]">
                      <FolderOpenOutline className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-xs font-semibold">Belum ada data siswa ditemukan</p>
                    </td>
                  </tr>
                ) : (
                  filteredSiswa.map((siswa: any, i: number) => (
                    <tr 
                      key={siswa.id} 
                      className="hover:bg-[#F0FAF6] transition-colors duration-120 cursor-pointer"
                      onClick={() => setSelectedStudent(siswa)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-bold text-neutral-800 block">{siswa.nis}</span>
                        <span className="text-[10px] text-[#8FA39B] font-semibold">{siswa.nisn || "—"}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-neutral-900">{siswa.nama_lengkap}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-[#DDF9F0] border border-[#B8EAD9] text-[#0F4C39] text-[10px] font-bold">
                          {siswa.kelas}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-neutral-700 block">{siswa.angkatan}</span>
                        {siswa.tahun_lulus ? (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-100 border border-blue-200 text-blue-800 text-[10px] font-bold">
                            Lulus ({siswa.tahun_lulus})
                          </span>
                        ) : (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                            Siswa Aktif
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={clsx("text-xs block font-medium", siswa.email ? "text-neutral-600" : "text-neutral-400 italic")}>{siswa.email || "Belum ada email"}</span>
                        <span className={clsx("text-[10px] font-semibold block", siswa.telepon ? "text-[#8FA39B]" : "text-neutral-400 italic")}>{siswa.telepon || "Belum ada telp"}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedStudent(siswa)}
                            className="w-[28px] h-[28px] bg-[#E0F5EE] hover:bg-[#B8EAD9] rounded-lg flex items-center justify-center text-[#14503C] transition-colors shadow-sm"
                            title="Detail & Dokumen"
                          >
                            <EyeOutline className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenAddModal(siswa)}
                            className="w-[28px] h-[28px] bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 transition-colors shadow-sm"
                            title="Edit Siswa"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Hapus siswa ${siswa.nama_lengkap} beserta seluruh dokumennya secara permanen?`)) {
                                deleteSiswaMutation.mutate(siswa.id);
                              }
                            }}
                            className="w-[28px] h-[28px] bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center text-red-650 transition-colors shadow-sm"
                            title="Hapus Siswa"
                          >
                            <TrashOutline className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#D4DDD9] bg-[#F5F8F7]">
              <span className="text-xs text-neutral-600 font-medium">
                Menampilkan halaman {currentPage} dari {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#D4DDD9] bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Sebelumnya
                </button>
                <div className="flex gap-1">
                  {getPageNumbers().map((p, idx) => {
                    if (p === "...") {
                      return (
                        <span
                          key={`ellipsis-${idx}`}
                          className="w-7 h-7 flex items-center justify-center text-neutral-400 text-xs font-semibold select-none animate-pulse"
                        >
                          ...
                        </span>
                      );
                    }
                    return (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        className={clsx(
                          "w-7 h-7 rounded-lg text-xs font-bold transition-all flex items-center justify-center",
                          p === currentPage
                            ? "bg-[#208C68] text-white shadow shadow-[#208C68]/20"
                            : "bg-white border border-[#D4DDD9] text-neutral-600 hover:bg-[#F5F8F7]"
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#D4DDD9] bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Drawer Detail Siswa & Dokumen (Right Sidebar) ─── */}
        <div className={clsx(
          "fixed inset-y-0 right-0 w-[420px] bg-white border-l border-[#D4DDD9] shadow-2xl z-40 transform transition-transform duration-350 ease-out p-6 overflow-y-auto flex flex-col font-body",
          selectedStudent ? "translate-x-0" : "translate-x-full"
        )}>
          {selectedStudent && (
            <>
              {/* Header Drawer */}
              <div className="flex items-center justify-between border-b border-[#EDF2F0] pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#14503C] to-[#0A2E1F] flex items-center justify-center text-white font-display font-extrabold text-sm shadow">
                    {selectedStudent.nama_lengkap.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-neutral-950 text-sm">{selectedStudent.nama_lengkap}</h3>
                    <p className="text-[10px] font-bold text-[#208C68] tracking-wider uppercase">Kelas {selectedStudent.kelas}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="w-8 h-8 rounded-lg hover:bg-[#F5F8F7] flex items-center justify-center text-[#8FA39B] hover:text-neutral-700 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Data Diri Detail */}
              <div className="space-y-4 mb-6">
                <h4 className="text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider border-b border-[#EDF2F0] pb-1.5">Data Diri</h4>
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs font-semibold">
                  <div>
                    <span className="text-[#8FA39B] block text-[10px] font-bold uppercase mb-0.5">NIS</span>
                    <span className="text-neutral-800">{selectedStudent.nis}</span>
                  </div>
                  <div>
                    <span className="text-[#8FA39B] block text-[10px] font-bold uppercase mb-0.5">NISN</span>
                    <span className="text-neutral-800">{selectedStudent.nisn || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[#8FA39B] block text-[10px] font-bold uppercase mb-0.5">Angkatan</span>
                    <span className="text-neutral-800">{selectedStudent.angkatan}</span>
                  </div>
                  <div>
                    <span className="text-[#8FA39B] block text-[10px] font-bold uppercase mb-0.5">Tgl Lahir</span>
                    <span className={clsx(selectedStudent.tgl_lahir ? "text-neutral-800" : "text-neutral-400 italic")}>
                      {selectedStudent.tgl_lahir ? new Date(selectedStudent.tgl_lahir).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "Belum diatur"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#8FA39B] block text-[10px] font-bold uppercase mb-0.5">Email</span>
                    <span className={clsx("break-all", selectedStudent.email ? "text-neutral-800" : "text-neutral-400 italic")}>{selectedStudent.email || "Belum diatur"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#8FA39B] block text-[10px] font-bold uppercase mb-0.5">Telepon</span>
                    <span className={clsx(selectedStudent.telepon ? "text-neutral-800" : "text-neutral-400 italic")}>{selectedStudent.telepon || "Belum diatur"}</span>
                  </div>
                </div>
              </div>

              {/* Dokumen Terunggah */}
              <div className="flex-1 flex flex-col min-h-[220px]">
                <h4 className="text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider border-b border-[#EDF2F0] pb-1.5 mb-3 flex justify-between items-center">
                  <span>Daftar Dokumen Terenkripsi</span>
                  <span className="bg-[#E0F5EE] text-[#0F4C39] px-2 py-0.5 rounded-full text-[9px] font-extrabold">{studentDocs.length} File</span>
                </h4>

                {loadingDocs ? (
                  <div className="flex-1 flex items-center justify-center py-12">
                    <div className="w-5 h-5 border-2 border-[#208C68] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : studentDocs.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-12 text-[#8FA39B]">
                    <FolderOpenOutline className="w-10 h-10 mb-2 opacity-35" />
                    <p className="text-xs font-semibold">Belum ada dokumen diunggah</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {studentDocs.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-[#F5F8F7] border border-[#D4DDD9] rounded-xl hover:border-[#3DB891] transition-all">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-neutral-800 truncate">📄 {doc.jenis_dok} {doc.semester && `— Sem ${doc.semester}`}</p>
                          <p className="text-[10px] text-[#8FA39B] font-semibold mt-0.5">T.A. {doc.tahun_ajaran} · {formatBytes(doc.file_size || 0)}</p>
                          {doc.legal_hold && (
                            <span className="inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold tracking-wide">
                              🔒 LEGAL HOLD
                            </span>
                          )}
                          {doc.retention_expires_at && (
                            <p className="text-[10px] text-amber-500 font-medium mt-0.5">
                              ⏳ Kadaluarsa: {new Date(doc.retention_expires_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-3">
                          <button
                            onClick={() => setPreviewDocId(doc.id)}
                            className="p-1.5 bg-[#E0F5EE] hover:bg-[#B8EAD9] rounded-lg text-[#14503C] transition-colors"
                            title="Preview Dokumen"
                          >
                            <EyeOutline className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setEditDoc(doc); setEditDocAlasan(""); setEditDocFile(null); }}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                            title="Edit Dokumen"
                          >
                            <PencilSquareIcon className="w-3.5 h-3.5" />
                          </button>
                          <a
                            onClick={() => handleDownloadDoc(doc)}
                            className="p-1.5 bg-[#EDE0F8] hover:bg-purple-200 rounded-lg text-[#4A1D7A] cursor-pointer transition-colors"
                            title="Download Dokumen"
                          >
                            <ArrowDownOutline className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => {
                              if (confirm("Hapus dokumen ini secara permanen dari sistem?")) {
                                deleteDocMutation.mutate(doc.id);
                              }
                            }}
                            className="p-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-red-650 transition-colors"
                            title="Hapus Dokumen"
                          >
                            <TrashOutline className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ─── Modal Tambah/Edit Siswa Manual ─── */}
        {addModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-[#0A2E1F]/60 backdrop-blur-xs" onClick={handleCloseAddModal} />
            
            <div className="bg-white border border-[#D4DDD9] w-full max-w-lg rounded-[28px] p-6 relative z-10 shadow-2xl overflow-hidden font-body text-neutral-800">
              <div className="flex items-center justify-between border-b border-[#EDF2F0] pb-3 mb-4">
                <h3 className="font-display font-bold text-neutral-950 text-base">
                  {editSiswaId ? "Edit Profil Siswa" : "Registrasi Siswa Baru"}
                </h3>
                <button onClick={handleCloseAddModal} className="w-8 h-8 rounded-lg hover:bg-[#F5F8F7] flex items-center justify-center text-[#8FA39B]">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleAddSiswa} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">NIS *</label>
                    <input
                      type="text"
                      required
                      disabled={!!editSiswaId}
                      value={newSiswa.nis}
                      onChange={(e) => setNewSiswa({ ...newSiswa, nis: e.target.value })}
                      placeholder="e.g. 212204"
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 disabled:opacity-60 focus:outline-none focus:border-[#3DB891]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">NISN</label>
                    <input
                      type="text"
                      disabled={!!editSiswaId}
                      value={newSiswa.nisn}
                      onChange={(e) => setNewSiswa({ ...newSiswa, nisn: e.target.value })}
                      placeholder="e.g. 00812345"
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 disabled:opacity-60 focus:outline-none focus:border-[#3DB891]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={newSiswa.nama_lengkap}
                    onChange={(e) => setNewSiswa({ ...newSiswa, nama_lengkap: e.target.value })}
                    placeholder="Nama Lengkap Siswa"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">Kelas *</label>
                    <input
                      type="text"
                      required
                      value={newSiswa.kelas}
                      onChange={(e) => setNewSiswa({ ...newSiswa, kelas: e.target.value })}
                      placeholder="e.g. XI-IPA1"
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">Angkatan</label>
                    <input
                      type="number"
                      value={newSiswa.angkatan}
                      onChange={(e) => setNewSiswa({ ...newSiswa, angkatan: parseInt(e.target.value) || new Date().getFullYear() })}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">Tahun Lulus</label>
                    <input
                      type="number"
                      value={newSiswa.tahun_lulus}
                      onChange={(e) => setNewSiswa({ ...newSiswa, tahun_lulus: e.target.value })}
                      placeholder="e.g. 2026 (Opsional)"
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">Tanggal Lahir</label>
                    <input
                      type="date"
                      value={newSiswa.tgl_lahir}
                      onChange={(e) => setNewSiswa({ ...newSiswa, tgl_lahir: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">Nomor Telepon</label>
                    <input
                      type="tel"
                      value={newSiswa.telepon}
                      onChange={(e) => setNewSiswa({ ...newSiswa, telepon: e.target.value })}
                      placeholder="085x..."
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">Email</label>
                  <input
                    type="email"
                    value={newSiswa.email}
                    onChange={(e) => setNewSiswa({ ...newSiswa, email: e.target.value })}
                    placeholder="siswa@sekolah.sch.id"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-[#EDF2F0]">
                  <button
                    type="button"
                    onClick={handleCloseAddModal}
                    className="px-4 py-2 text-xs font-bold text-[#4A5350] bg-white border border-[#D4DDD9] rounded-xl hover:bg-[#F5F8F7]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#208C68] hover:bg-[#14503C] rounded-xl disabled:opacity-50"
                  >
                    {editSiswaId 
                      ? (updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan") 
                      : (createMutation.isPending ? "Mendaftarkan..." : "Registrasi")
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── Modal Kelulusan Massal Per Angkatan ─── */}
        {bulkKelulusanModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-[#0A2E1F]/60 backdrop-blur-xs" onClick={() => setBulkKelulusanModalOpen(false)} />
            
            <div className="bg-white border border-[#D4DDD9] w-full max-w-md rounded-[28px] p-6 relative z-10 shadow-2xl overflow-hidden font-body text-neutral-800">
              <div className="flex items-center justify-between border-b border-[#EDF2F0] pb-3 mb-4">
                <h3 className="font-display font-bold text-neutral-950 text-base flex items-center gap-2">
                  <AcademicCapIcon className="w-5 h-5 text-[#4361EE]" />
                  Kelulusan Massal Per Angkatan
                </h3>
                <button onClick={() => setBulkKelulusanModalOpen(false)} className="w-8 h-8 rounded-lg hover:bg-[#F5F8F7] flex items-center justify-center text-[#8FA39B]">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const parsedTahunLulus = bulkKelulusanForm.tahun_lulus.trim() ? parseInt(bulkKelulusanForm.tahun_lulus.trim()) : null;
                  bulkKelulusanMutation.mutate({
                    angkatan: Number(bulkKelulusanForm.angkatan),
                    tahun_lulus: parsedTahunLulus,
                    kelas: bulkKelulusanForm.kelas || undefined
                  });
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">Pilih Angkatan *</label>
                  <input
                    type="number"
                    required
                    value={bulkKelulusanForm.angkatan}
                    onChange={(e) => setBulkKelulusanForm({ ...bulkKelulusanForm, angkatan: parseInt(e.target.value) || new Date().getFullYear() })}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">Siswa pada angkatan ini akan diperbarui status kelulusannya.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">Pilih Kelas (Opsional)</label>
                  <select
                    value={bulkKelulusanForm.kelas}
                    onChange={(e) => setBulkKelulusanForm({ ...bulkKelulusanForm, kelas: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                  >
                    <option value="">Semua Kelas</option>
                    {availableClasses.map((kls: string) => (
                      <option key={kls} value={kls}>{kls}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">Tahun Kelulusan *</label>
                  <input
                    type="number"
                    placeholder="e.g. 2026 (Kosongkan jika ingin mereset ke Siswa Aktif)"
                    value={bulkKelulusanForm.tahun_lulus}
                    onChange={(e) => setBulkKelulusanForm({ ...bulkKelulusanForm, tahun_lulus: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Isi tahun kelulusan (misal `2026`) untuk meluluskan seluruh siswa angkatan, atau kosongkan untuk mereset menjadi Siswa Aktif.
                  </p>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-[#EDF2F0]">
                  <button
                    type="button"
                    onClick={() => setBulkKelulusanModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-[#4A5350] bg-white border border-[#D4DDD9] rounded-xl hover:bg-[#F5F8F7]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={bulkKelulusanMutation.isPending}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#4361EE] hover:bg-[#2B4CBE] rounded-xl disabled:opacity-50 shadow-sm"
                  >
                    {bulkKelulusanMutation.isPending ? "Memproses..." : "Proses Kelulusan Massal"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── Modal Bulk Import Excel ─── */}
        {importModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-[#0A2E1F]/60 backdrop-blur-xs" onClick={() => setImportModalOpen(false)} />
            
            <div className="bg-white border border-[#D4DDD9] w-full max-w-md rounded-[28px] p-6 relative z-10 shadow-2xl overflow-hidden font-body text-neutral-800">
              <div className="flex items-center justify-between border-b border-[#EDF2F0] pb-3 mb-4">
                <h3 className="font-display font-bold text-neutral-950 text-base">Bulk Import Data Siswa</h3>
                <button onClick={() => setImportModalOpen(false)} className="w-8 h-8 rounded-lg hover:bg-[#F5F8F7] flex items-center justify-center text-[#8FA39B]">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleImportExcel} className="space-y-4">
                <div className="p-4 bg-[#FEF3C7] border border-[#FADBB8] rounded-xl text-neutral-800 text-[11px] font-semibold leading-normal">
                  ⚠️ Unduh berkas format Excel template terlebih dahulu. Kolom wajib terisi adalah **nis**, **nama_lengkap**, dan **kelas**.
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">Pilih File (.xlsx / .xls)</label>
                  <input
                    type="file"
                    name="file"
                    accept=".xlsx, .xls"
                    className="w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-[#D4DDD9] file:text-xs file:font-bold file:bg-[#F5F8F7] file:text-neutral-700 hover:file:bg-[#EDF2F0] cursor-pointer"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-[#EDF2F0]">
                  <a
                    href="/templates/import_siswa_template.xlsx"
                    download
                    className="mr-auto px-4 py-2 text-xs font-bold text-[#14503C] hover:underline"
                  >
                    Unduh Template
                  </a>
                  <button
                    type="button"
                    onClick={() => setImportModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-[#4A5350] bg-white border border-[#D4DDD9] rounded-xl hover:bg-[#F5F8F7]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={importMutation.isPending}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#208C68] hover:bg-[#14503C] rounded-xl disabled:opacity-50"
                  >
                    {importMutation.isPending ? "Mengunggah..." : "Import"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PDF Preview Modal */}
        {previewDocId && (
          <PdfModal
            isOpen={!!previewDocId}
            onClose={() => setPreviewDocId(null)}
            previewUrl={previewUrl}
            title="Preview Dokumen Siswa"
            onDownload={() => handleDownloadDoc({ id: previewDocId })}
          />
        )}

        {/* Modal Edit Dokumen (Anti-Tampering) */}
        {editDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-[#0A2E1F]/60 backdrop-blur-xs" onClick={() => setEditDoc(null)} />
            
            <div className="bg-white border border-[#D4DDD9] w-full max-w-md rounded-[28px] p-6 relative z-10 shadow-2xl font-body text-neutral-800">
              <div className="flex items-center justify-between border-b border-[#EDF2F0] pb-3 mb-4">
                <div>
                  <h3 className="font-display font-bold text-neutral-950 text-base flex items-center gap-2">
                    <ShieldCheckIcon className="w-5 h-5 text-green-600" /> 
                    Edit & Verifikasi Dokumen
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-1 font-medium">Sistem Anti-Tampering akan mengecek integritas dokumen asli.</p>
                </div>
                <button onClick={() => setEditDoc(null)} className="w-8 h-8 rounded-lg hover:bg-[#F5F8F7] flex items-center justify-center text-[#8FA39B]">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleEditDocSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">Dokumen Terpilih</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-xs font-bold text-gray-600">
                    {editDoc.jenis_dok} - Versi {editDoc.versi}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">File Pengganti (Opsional)</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setEditDocFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-[9px] text-gray-400 mt-1">Kosongkan jika hanya ingin mengupdate alasan/metadata.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">Alasan Edit (Wajib) *</label>
                  <textarea
                    required
                    rows={3}
                    value={editDocAlasan}
                    onChange={(e) => setEditDocAlasan(e.target.value)}
                    placeholder="Contoh: Koreksi typo pada nilai rapor"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] focus:outline-none focus:border-[#3DB891]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={editDocMutation.isPending}
                    className="w-full bg-[#208C68] hover:bg-[#1A7456] text-white py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {editDocMutation.isPending ? "Memverifikasi..." : "Simpan Perubahan"}
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
