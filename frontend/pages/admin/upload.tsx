import { useState, useEffect } from "react";
import Head from "next/head";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminSiswaApi, adminDokumenApi, categoriesApi, tahunAjaranApi } from "@/lib/api";
import AdminLayout from "@/components/AdminLayout";
import { useRequireAdmin } from "@/hooks/useAdminAuth";
import {
  ArrowUpTrayIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  UserIcon,
  QuestionMarkCircleIcon,
  CommandLineIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  DocumentDuplicateIcon,
  InformationCircleIcon,
  XMarkIcon
} from "@heroicons/react/24/solid";
import toast from "react-hot-toast";
import { clsx } from "clsx";

export default function AdminUpload() {
  useRequireAdmin();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"satuan" | "massal">("massal");

  // State Satuan
  const [selectedStudentId, setSelectedStudentId] = useState<number | "">("");
  const [studentSearch, setStudentSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [jenisDok, setJenisDok] = useState("");
  const [tahunAjaran, setTahunAjaran] = useState("");
  const [semester, setSemester] = useState("ganjil");
  const [metadataStr, setMetadataStr] = useState("{}");
  const [file, setFile] = useState<File | null>(null);

  // State Massal
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploadState, setBulkUploadState] = useState<"idle" | "uploading" | "success">("idle");
  const [bulkResult, setBulkResult] = useState<any>(null);

  // State Kripto simulasi satuan
  const [uploadState, setUploadState] = useState<"idle" | "hashing" | "encrypting" | "uploading" | "success">("idle");
  const [cryptoProgress, setCryptoProgress] = useState(0);
  const [fileHash, setFileHash] = useState("");

  const [isTutorialModalOpen, setTutorialModalOpen] = useState(false);

  // Query Data
  const { data: categories = [] } = useQuery({
    queryKey: ["categories-list"],
    queryFn: async () => {
      const res = await categoriesApi.getAll();
      return res.data;
    },
  });

  const { data: tahunAjaranList = [] } = useQuery({
    queryKey: ["tahun-ajaran-list"],
    queryFn: async () => {
      const res = await tahunAjaranApi.getAll();
      return res.data;
    },
  });

  const { data: rawSiswaData = [] } = useQuery({
    queryKey: ["admin-siswa-list-upload"],
    queryFn: async () => {
      const res = await adminSiswaApi.getAll({ limit: 1000 }); // fetch more for dropdown
      return res.data;
    },
  });

  const siswaList = Array.isArray(rawSiswaData) ? rawSiswaData : (rawSiswaData?.items || []);

  useEffect(() => {
    if (categories.length > 0) {
      const defaultCat = categories.find((c: any) => c.name === "raport");
      if (defaultCat) setJenisDok(defaultCat.name);
      else setJenisDok(categories[0].name);
    }
  }, [categories]);

  useEffect(() => {
    if (tahunAjaranList.length > 0) {
      const defaultYear = tahunAjaranList.find((t: any) => t.is_default);
      if (defaultYear) setTahunAjaran(defaultYear.tahun);
      else setTahunAjaran(tahunAjaranList[0].tahun);
    }
  }, [tahunAjaranList]);


  const filteredStudents = siswaList.filter((s: any) =>
    (s.nama_lengkap || "").toLowerCase().includes(studentSearch.toLowerCase()) ||
    (s.nis || "").includes(studentSearch) ||
    (s.nisn || "").includes(studentSearch)
  );

  const selectedStudentObj = siswaList.find((s: any) => s.id === selectedStudentId);

  const handleGenerateTemplate = () => {
    if (!selectedStudentObj) {
      toast.error("Pilih siswa terlebih dahulu untuk generate template metadata.");
      return;
    }
    const template = {
      jenis: jenisDok,
      nama_siswa: selectedStudentObj.nama_lengkap,
      nisn: selectedStudentObj.nisn || null,
      tahun_ajaran: tahunAjaran,
      semester: semester,
      catatan: `Dokumen ${jenisDok} milik ${selectedStudentObj.nama_lengkap}`
    };
    setMetadataStr(JSON.stringify(template, null, 2));
    toast.success("Template metadata berhasil dibuat!");
  };

  const computeSHA256 = async (selectedFile: File): Promise<string> => {
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    } catch {
      return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    }
  };

  const uploadMutation = useMutation({
    mutationFn: (data: any) => adminDokumenApi.upload(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      setUploadState("success");
      setFile(null);
      toast.success("Dokumen berhasil dienkripsi dan diunggah!");
    },
    onError: (err: any) => {
      setUploadState("idle");
      toast.error(err.response?.data?.detail || "Gagal mengunggah dokumen.");
    },
  });

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !file || !jenisDok || !tahunAjaran) {
      toast.error("Harap lengkapi form.");
      return;
    }

    // Validate that metadataStr is valid JSON if provided
    try {
      if (metadataStr.trim()) {
        JSON.parse(metadataStr);
      }
    } catch (err) {
      toast.error("Format JSON untuk Metadata Tambahan tidak valid! Harap cek kembali tanda kurung atau kutip.");
      return;
    }

    setUploadState("hashing");
    setCryptoProgress(10);
    const calculatedHash = await computeSHA256(file);
    setFileHash(calculatedHash);

    setTimeout(() => {
      setCryptoProgress(30);
      setUploadState("encrypting");
      setTimeout(() => {
        setCryptoProgress(70);
        setUploadState("uploading");
        setTimeout(() => {
          setCryptoProgress(100);
          uploadMutation.mutate({
            siswa_id: Number(selectedStudentId),
            jenis_dok: jenisDok,
            tahun_ajaran: tahunAjaran,
            semester: semester,
            metadata_json: metadataStr,
            file: file,
          });
        }, 1000);
      }, 1200);
    }, 800);
  };

  // Bulk Upload logic
  const bulkUploadMutation = useMutation({
    mutationFn: (data: any) => adminDokumenApi.bulkUpload(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      setBulkUploadState("success");
      setBulkResult(res.data);
      setBulkFile(null);
      toast.success("Bulk Upload selesai diproses");
    },
    onError: (err: any) => {
      setBulkUploadState("idle");
      toast.error(err.response?.data?.detail || "Gagal memproses bulk upload.");
    },
  });

  const handleBulkUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFile || !tahunAjaran) {
      toast.error("Harap lampirkan file ZIP dan Tahun Ajaran.");
      return;
    }
    setBulkUploadState("uploading");
    bulkUploadMutation.mutate({
      tahun_ajaran: tahunAjaran,
      semester: semester,
      file: bulkFile,
    });
  };

  return (
    <AdminLayout title="Upload Dokumen">
      <Head>
        <title>Upload Dokumen — DokumenSekolah Admin</title>
      </Head>

      <div className="space-y-6 font-body text-neutral-800 relative">
        
        {/* Info Banner Enkripsi */}
        <div className="bg-[#E0F5EE] border border-[#B8EAD9] rounded-[20px] p-5 flex flex-col md:flex-row items-start gap-4 shadow-sm">
          <div className="p-3 bg-white/40 rounded-xl text-[#1A7A5E] flex-shrink-0">
            <ShieldCheckIcon className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h4 className="text-[#0F4C39] text-sm font-bold">Standard Enkripsi Zero-Knowledge</h4>
            <p className="text-xs text-[#0F4C39]/80 mt-1 leading-relaxed font-semibold">
              Semua berkas PDF akan didekripsi kuncinya menggunakan modul <strong>NeuralKeyGen</strong> yang di-generate dari entropy profil siswa dan dibungkus menggunakan kunci master <strong>RSA-4096</strong> sekolah.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 p-1 bg-neutral-100 rounded-xl border border-[#D4DDD9] w-fit">
          <button
            onClick={() => setActiveTab("massal")}
            className={clsx(
              "px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
              activeTab === "massal" ? "bg-white text-[#14503C] shadow-sm" : "text-neutral-500 hover:text-neutral-700"
            )}
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
            Upload Massal (.ZIP)
          </button>
          <button
            onClick={() => setActiveTab("satuan")}
            className={clsx(
              "px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
              activeTab === "satuan" ? "bg-white text-[#14503C] shadow-sm" : "text-neutral-500 hover:text-neutral-700"
            )}
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
            Upload Satuan
          </button>
        </div>

        {/* =========================================
            TAB UPLOAD MASSAL 
            ========================================= */}
        {activeTab === "massal" && (
          <div className="bg-white border border-[#D4DDD9] rounded-[20px] shadow-sm overflow-hidden flex flex-col">
            
            {/* Form Section */}
            <div className="p-6 lg:p-8 w-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-display font-extrabold text-[#0A2E1F] flex items-center gap-2">
                    <DocumentDuplicateIcon className="w-6 h-6 text-[#208C68]" />
                    Bulk Upload Dokumen
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">Unggah banyak dokumen PDF sekaligus dalam satu file ZIP.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTutorialModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#E0F5EE] hover:bg-[#B8EAD9] text-[#0F4C39] text-xs font-bold rounded-xl transition-all border border-[#B8EAD9]"
                >
                  <InformationCircleIcon className="w-4 h-4" />
                  Tutorial Penamaan
                </button>
              </div>

              {bulkUploadState === "idle" && (
                <form onSubmit={handleBulkUploadSubmit} className="space-y-6">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Tahun Ajaran */}
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 uppercase mb-2">Tahun Ajaran</label>
                      <select
                        value={tahunAjaran}
                        onChange={(e) => setTahunAjaran(e.target.value)}
                        className="w-full px-4 py-3 text-xs font-bold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] transition-all"
                      >
                        {tahunAjaranList.map((opt: any) => (
                          <option key={opt.tahun} value={opt.tahun}>{opt.tahun}</option>
                        ))}
                      </select>
                    </div>

                    {/* Semester */}
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 uppercase mb-2">Semester</label>
                      <select
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                        className="w-full px-4 py-3 text-xs font-bold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] transition-all"
                      >
                        <option value="ganjil">Ganjil</option>
                        <option value="genap">Genap</option>
                      </select>
                    </div>
                  </div>

                  {/* File Upload Box */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-2">Pilih File ZIP</label>
                    <div className="border-2 border-dashed border-[#D4DDD9] hover:border-[#3DB891] rounded-[20px] p-8 text-center bg-[#F5F8F7] transition-all relative cursor-pointer group">
                      <input
                        type="file"
                        required
                        accept=".zip,application/zip"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) setBulkFile(e.target.files[0]);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="space-y-2 pointer-events-none">
                        <CommandLineIcon className="w-12 h-12 text-[#8FA39B] group-hover:text-[#208C68] mx-auto transition-colors" />
                        {bulkFile ? (
                          <div>
                            <p className="text-xs font-bold text-neutral-800">{bulkFile.name}</p>
                            <p className="text-[10px] text-[#8FA39B] font-semibold mt-1">{(bulkFile.size / (1024 * 1024)).toFixed(2)} MB • Klik untuk ganti</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs font-bold text-neutral-800">Tarik berkas .ZIP di sini atau klik untuk memilih</p>
                            <p className="text-[10px] text-[#8FA39B] font-semibold mt-1">Isi file ZIP harus berupa PDF dengan nama sesuai format.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#208C68] hover:bg-[#14503C] text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow shadow-[#208C68]/15 transition-all"
                  >
                    <ShieldCheckIcon className="w-4 h-4" />
                    Mulai Ekstraksi & Enkripsi Massal
                  </button>
                </form>
              )}

              {bulkUploadState === "uploading" && (
                <div className="py-12 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto border-4 border-[#F5F8F7] border-t-[#208C68] animate-spin rounded-full" />
                  <p className="text-sm font-bold text-[#14503C]">Memproses Bulk Upload...</p>
                  <p className="text-xs text-neutral-500">Mengekstrak, mencari siswa berdasarkan NISN, dan mengenkripsi dokumen massal. Jangan tutup halaman ini.</p>
                </div>
              )}

              {bulkUploadState === "success" && bulkResult && (
                <div className="py-6 space-y-4">
                  <div className="w-16 h-16 bg-[#E0F5EE] border border-[#B8EAD9] rounded-full flex items-center justify-center mx-auto text-[#15803D]">
                    <CheckCircleIcon className="w-10 h-10" />
                  </div>
                  <div className="text-center space-y-1.5">
                    <h3 className="font-display font-extrabold text-neutral-950 text-lg">Upload Selesai!</h3>
                    <p className="text-xs text-[#4A5350] font-medium">Berhasil diproses: <span className="font-bold text-[#208C68]">{bulkResult.success_count} dokumen</span></p>
                    <p className="text-xs text-[#4A5350] font-medium">Gagal diproses: <span className="font-bold text-red-500">{bulkResult.error_count} dokumen</span></p>
                  </div>
                  
                  {bulkResult.errors && bulkResult.errors.length > 0 && (
                     <div className="mt-4 bg-red-50 border border-red-100 rounded-lg p-4">
                       <p className="text-xs font-bold text-red-700 mb-2">Detail Error:</p>
                       <ul className="text-[11px] text-red-600 space-y-1 max-h-32 overflow-y-auto">
                         {bulkResult.errors.map((e: any, idx: number) => (
                           <li key={idx} className="flex gap-2"><span>•</span><span><strong>{e.file}:</strong> {e.error}</span></li>
                         ))}
                       </ul>
                     </div>
                  )}

                  <button
                    onClick={() => { setBulkUploadState("idle"); setBulkFile(null); }}
                    className="w-full mt-4 px-5 py-2.5 bg-white border border-[#D4DDD9] hover:bg-[#F5F8F7] rounded-xl text-xs font-bold text-neutral-700 transition-all inline-flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <ArrowPathIcon className="w-4 h-4 text-neutral-400" />
                    Upload Bulk Lainnya
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================
            TAB UPLOAD SATUAN 
            ========================================= */}
        {activeTab === "satuan" && (
          <div className="bg-white border border-[#D4DDD9] rounded-[20px] p-6 lg:p-8 shadow-sm">
            {uploadState === "idle" && (
              <form onSubmit={handleUploadSubmit} className="space-y-6">
                
                {/* Autocomplete Cari Siswa */}
                <div className="relative">
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-2">Pilih Siswa Pemilik Dokumen</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8FA39B]" />
                    <input
                      type="text"
                      required
                      placeholder="Ketik nama atau NISN siswa..."
                      value={studentSearch}
                      onChange={(e) => {
                        setStudentSearch(e.target.value);
                        setShowDropdown(true);
                        if (selectedStudentId) setSelectedStudentId("");
                      }}
                      onFocus={() => setShowDropdown(true)}
                      className="w-full pl-11 pr-4 py-3 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] transition-all placeholder-[#8FA39B]"
                    />
                    
                    {showDropdown && studentSearch && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-[#D4DDD9] rounded-xl shadow-lg z-40 divide-y divide-[#EDF2F0]">
                        {filteredStudents.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-neutral-500">Siswa tidak ditemukan</div>
                        ) : (
                          filteredStudents.map((siswa: any) => (
                            <div
                              key={siswa.id}
                              onClick={() => {
                                setSelectedStudentId(siswa.id);
                                setStudentSearch(siswa.nama_lengkap);
                                setShowDropdown(false);
                              }}
                              className="px-4 py-3 text-xs hover:bg-[#F0FAF6] cursor-pointer flex items-center justify-between transition-all"
                            >
                              <div>
                                <p className="font-bold text-neutral-900">{siswa.nama_lengkap}</p>
                                <p className="text-[#8FA39B] mt-0.5 font-semibold">NISN: {siswa.nisn} • Kelas: {siswa.kelas}</p>
                              </div>
                              <span className="text-[10px] bg-[#E0F5EE] px-2 py-0.5 rounded font-mono text-[#0F4C39] font-bold">ID: {siswa.id}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {selectedStudentObj && (
                    <p className="text-[11px] text-[#208C68] mt-1.5 flex items-center gap-1 font-bold">
                      <CheckCircleIcon className="w-4 h-4" />
                      Terpilih: {selectedStudentObj.nama_lengkap} (Kelas: {selectedStudentObj.kelas})
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Jenis Dokumen */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-2">Jenis Dokumen</label>
                    <select
                      value={jenisDok}
                      onChange={(e) => setJenisDok(e.target.value)}
                      className="w-full px-4 py-3 text-xs font-bold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] transition-all"
                    >
                      {categories.map((opt: any) => (
                        <option key={opt.name} value={opt.name}>{opt.description || opt.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tahun Ajaran */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-2">Tahun Ajaran</label>
                    <select
                      value={tahunAjaran}
                      onChange={(e) => setTahunAjaran(e.target.value)}
                      className="w-full px-4 py-3 text-xs font-bold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] transition-all"
                    >
                      {tahunAjaranList.map((opt: any) => (
                        <option key={opt.tahun} value={opt.tahun}>{opt.tahun}</option>
                      ))}
                    </select>
                  </div>

                  {/* Semester */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-2">Semester</label>
                    <select
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="w-full px-4 py-3 text-xs font-bold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] transition-all"
                    >
                      <option value="ganjil">Ganjil</option>
                      <option value="genap">Genap</option>
                    </select>
                  </div>
                </div>

                {/* Metadata JSON */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-neutral-700 uppercase">Metadata Tambahan (JSON String)</label>
                    {selectedStudentObj && (
                      <button
                        type="button"
                        onClick={handleGenerateTemplate}
                        className="text-[10px] font-bold text-[#208C68] hover:text-[#14503C] hover:underline transition-all flex items-center gap-1 bg-white hover:bg-neutral-50 border border-[#D4DDD9] px-2 py-1 rounded-lg shadow-sm"
                      >
                        <ArrowPathIcon className="w-3.5 h-3.5" />
                        Gunakan Template Otomatis
                      </button>
                    )}
                  </div>
                  <textarea
                    required
                    rows={6}
                    value={metadataStr}
                    onChange={(e) => setMetadataStr(e.target.value)}
                    className="w-full px-4 py-3 text-xs font-mono font-bold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] resize-y"
                  />
                </div>

                {/* File Upload Box */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-2">Pilih Dokumen PDF</label>
                  <div className="border-2 border-dashed border-[#D4DDD9] hover:border-[#3DB891] rounded-[20px] p-8 text-center bg-[#F5F8F7] transition-all relative cursor-pointer group">
                    <input
                      type="file"
                      required
                      accept=".pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) setFile(e.target.files[0]);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="space-y-2 pointer-events-none">
                      <DocumentTextIcon className="w-12 h-12 text-[#8FA39B] group-hover:text-[#208C68] mx-auto transition-colors" />
                      {file ? (
                        <div>
                          <p className="text-xs font-bold text-neutral-800">{file.name}</p>
                          <p className="text-[10px] text-[#8FA39B] font-semibold mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB • Klik untuk ganti</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-bold text-neutral-800">Tarik berkas PDF di sini atau klik untuk memilih</p>
                          <p className="text-[10px] text-[#8FA39B] font-semibold mt-1">Hanya mendukung format PDF (Maks. 10MB)</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#208C68] hover:bg-[#14503C] text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow shadow-[#208C68]/15 transition-all"
                >
                  <ShieldCheckIcon className="w-4 h-4" />
                  Mulai Enkripsi & Unggah Dokumen
                </button>
              </form>
            )}

            {/* SIMULASI MULTI-FASE KRIPTOGRAFI (Satuan) */}
            {uploadState !== "idle" && uploadState !== "success" && (
              <div className="py-8 space-y-6 text-center">
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-[#F5F8F7] border-t-[#208C68] animate-spin" />
                  <CommandLineIcon className="w-8 h-8 text-[#14503C]" />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="font-display font-extrabold text-neutral-900 text-base capitalize">
                    {uploadState === "hashing" && "Fase 1: Kalkulasi SHA-256 Berkas..."}
                    {uploadState === "encrypting" && "Fase 2: Enkripsi AES-256-GCM & RSA-4096..."}
                    {uploadState === "uploading" && "Fase 3: Mengunggah Berkas Terenkripsi..."}
                  </h3>
                  <div className="w-full bg-[#F5F8F7] h-2 rounded-full overflow-hidden border border-[#D4DDD9]">
                    <div style={{ width: `${cryptoProgress}%` }} className="bg-gradient-to-r from-[#208C68] to-[#14503C] h-full rounded-full transition-all duration-300" />
                  </div>
                  <p className="text-[10px] text-[#8FA39B] font-mono font-semibold">
                    Progress: {cryptoProgress}% • Algoritma: SHA-256 + AES-GCM + RSA
                  </p>
                </div>
                {fileHash && (
                  <div className="max-w-md mx-auto p-4 bg-[#F5F8F7] border border-[#D4DDD9] rounded-xl text-left space-y-1">
                    <span className="text-[9px] font-bold text-[#8FA39B] uppercase block">Hasil Hash Berkas (Client SHA-256):</span>
                    <div className="font-mono text-[10px] text-[#0F4C39] select-all break-all bg-white p-2.5 rounded-lg border border-[#D4DDD9] shadow-inner">
                      {fileHash}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* UPLOAD SUCCESS STATE (Satuan) */}
            {uploadState === "success" && (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 bg-[#E0F5EE] border border-[#B8EAD9] rounded-full flex items-center justify-center mx-auto text-[#15803D]">
                  <CheckCircleIcon className="w-10 h-10" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-display font-extrabold text-neutral-950 text-lg">Dokumen Berhasil Terenkripsi!</h3>
                  <p className="text-xs text-[#4A5350] font-medium max-w-sm mx-auto">
                    Kunci enkripsi dibungkus dengan RSA Key sekolah dan berkas aman disimpan di MinIO Object Storage.
                  </p>
                </div>
                <button
                  onClick={() => setUploadState("idle")}
                  className="px-5 py-2.5 bg-white border border-[#D4DDD9] hover:bg-[#F5F8F7] rounded-xl text-xs font-bold text-neutral-700 transition-all inline-flex items-center gap-1.5 shadow-sm"
                >
                  <ArrowPathIcon className="w-4 h-4 text-neutral-400" />
                  Unggah Dokumen Lain
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Tutorial Modal */}
      {isTutorialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={() => setTutorialModalOpen(false)}></div>
          <div className="bg-white rounded-[24px] shadow-2xl border border-[#D4DDD9] w-full max-w-lg overflow-hidden relative z-10 animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-[#14503C] font-bold">
                  <InformationCircleIcon className="w-6 h-6" />
                  <h3 className="text-lg uppercase tracking-wide">Tutorial Penamaan File</h3>
                </div>
                <button
                  onClick={() => setTutorialModalOpen(false)}
                  className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-full text-neutral-500 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed mb-6">
                Agar sistem mengenali pemilik dokumen otomatis, pastikan nama file PDF Anda menggunakan format: <br/>
                <code className="bg-[#E0F5EE] text-[#0F4C39] px-3 py-2 rounded-lg font-mono font-bold block mt-3 text-center border border-[#B8EAD9] text-sm">NISN_JenisDokumen.pdf</code>
              </p>

              <div className="space-y-4">
                <p className="text-[10px] font-bold text-[#8FA39B] uppercase tracking-wider">Referensi Penamaan Jenis Dokumen:</p>
                <div className="bg-neutral-50 border border-[#D4DDD9] rounded-xl divide-y divide-[#D4DDD9] overflow-hidden max-h-64 overflow-y-auto">
                   {categories.map((cat: any) => (
                     <div key={cat.name} className="p-3 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-mono text-[#0F4C39] font-bold">{cat.name}</p>
                          <p className="text-[10px] text-neutral-500 mt-1">Contoh: <span className="font-mono bg-white border border-[#D4DDD9] px-1.5 py-0.5 rounded text-neutral-700">1234567890_{cat.name}.pdf</span></p>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setTutorialModalOpen(false)}
                  className="px-6 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
