import { useState, useEffect } from "react";
import Head from "next/head";
import AdminLayout from "@/components/AdminLayout";
import { useRequireAdmin } from "@/hooks/useAdminAuth";
import { PlusIcon, PowerIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import api from "@/lib/api";

interface Sekolah {
  id: number;
  nama: string;
  kode: string;
  alamat: string | null;
  is_active: boolean;
  created_at: string;
}

export default function ManajemenSekolahPage() {
  const { isAdminAuthenticated, mounted } = useRequireAdmin();
  const [sekolahList, setSekolahList] = useState<Sekolah[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    nama: "",
    kode: "",
    alamat: "",
    kota: "",
    provinsi: "",
    kode_pos: "",
    telepon: "",
    email: "",
    website: "",
    master_key: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Wilayah State
  const [provinces, setProvinces] = useState<{code: string, name: string}[]>([]);
  const [regencies, setRegencies] = useState<{code: string, name: string}[]>([]);
  const [selectedProv, setSelectedProv] = useState("");
  const [selectedRegency, setSelectedRegency] = useState("");

  const generateMasterKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
    let key = '';
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < array.length; i++) {
      key += chars[array[i] % chars.length];
    }
    setFormData(prev => ({ ...prev, master_key: key }));
  };

  const copyToClipboard = () => {
    if (formData.master_key) {
      navigator.clipboard.writeText(formData.master_key);
      toast.success("Master Key berhasil disalin!");
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    generateMasterKey();
  };


  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchSekolahList();
      fetchProvinces();
    }
  }, [isAdminAuthenticated]);

  const fetchProvinces = async () => {
    try {
      const res = await fetch("/api/wilayah/provinces");
      const data = await res.json();
      setProvinces(data.data);
    } catch (error) {
      console.error("Gagal memuat daftar provinsi", error);
    }
  };

  const handleProvChange = async (provCode: string) => {
    setSelectedProv(provCode);
    setSelectedRegency("");
    setRegencies([]);
    
    // Temukan nama provinsi dan simpan ke form
    const provName = provinces.find(p => p.code === provCode)?.name || "";
    setFormData(prev => ({ ...prev, provinsi: provName, kota: "" }));

    if (provCode) {
      try {
        const res = await fetch(`/api/wilayah/regencies/${provCode}`);
        const data = await res.json();
        setRegencies(data.data);
      } catch (error) {
        console.error("Gagal memuat daftar kabupaten", error);
      }
    }
  };

  const handleRegencyChange = (regCode: string) => {
    setSelectedRegency(regCode);
    const regName = regencies.find(r => r.code === regCode)?.name || "";
    setFormData(prev => ({ ...prev, kota: regName }));
  };

  const fetchSekolahList = async () => {
    try {
      setLoading(true);
      const res = await api.get("/sekolah/");
      setSekolahList(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal mengambil daftar sekolah");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    if (!confirm(`Apakah Anda yakin ingin ${currentStatus ? "menonaktifkan" : "mengaktifkan"} akses sekolah ini?`)) return;
    try {
      await api.put(`/sekolah/${id}/status`, null, {
        params: { is_active: !currentStatus }
      });
      toast.success("Status sekolah berhasil diubah");
      fetchSekolahList();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal mengubah status sekolah");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.master_key.length < 32) {
      toast.error("Master Key harus minimal 32 karakter");
      return;
    }
    
    try {
      setSubmitting(true);
      await api.post("/sekolah/", formData);
      toast.success("Sekolah baru berhasil didaftarkan. Akun TU otomatis terbuat.");
      setIsModalOpen(false);
      setFormData({
        nama: "", kode: "", alamat: "", kota: "", provinsi: "",
        kode_pos: "", telepon: "", email: "", website: "", master_key: ""
      });
      setSelectedProv("");
      setSelectedRegency("");
      setRegencies([]);
      fetchSekolahList();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal mendaftarkan sekolah");
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted || !isAdminAuthenticated) return null;

  return (
    <AdminLayout title="Manajemen Sekolah (Super Admin)">
      <Head>
        <title>Manajemen Sekolah - Super Admin DS</title>
      </Head>

      <div className="space-y-6 font-body">
        
        {/* Header Action */}
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-[#D4DDD9]/60">
          <div>
            <h2 className="text-xl font-display font-bold text-gray-900">Daftar Tenant Sekolah</h2>
            <p className="text-sm text-gray-500 mt-1">Kelola sekolah yang terdaftar dalam sistem DokumenSekolah.</p>
          </div>
          <button 
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#3DB891] hover:bg-[#208C68] text-white rounded-xl font-bold shadow-sm transition-colors text-sm"
          >
            <PlusIcon className="w-5 h-5" />
            Tambah Sekolah
          </button>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#D4DDD9]/60 overflow-hidden">
          {loading ? (
            <div className="flex justify-center p-20">
              <div className="animate-spin w-8 h-8 border-4 border-[#3DB891] border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[11px] uppercase tracking-widest text-gray-500 font-bold border-b border-gray-200">
                    <th className="py-4 px-6">ID</th>
                    <th className="py-4 px-6">NPSN</th>
                    <th className="py-4 px-6">Nama Sekolah</th>
                    <th className="py-4 px-6">Alamat</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium text-gray-700 divide-y divide-gray-100">
                  {sekolahList.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-gray-400">Belum ada sekolah terdaftar.</td></tr>
                  ) : (
                    sekolahList.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-6 text-gray-500">#{row.id}</td>
                        <td className="py-4 px-6 font-mono font-bold">{row.kode}</td>
                        <td className="py-4 px-6 text-gray-900 font-bold">{row.nama}</td>
                        <td className="py-4 px-6 truncate max-w-[200px] text-gray-500">{row.alamat || "-"}</td>
                        <td className="py-4 px-6">
                          {row.is_active ? (
                            <span className="inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-green-100 text-green-700">Aktif</span>
                          ) : (
                            <span className="inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-red-100 text-red-700">Suspended</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button 
                            onClick={() => handleToggleStatus(row.id, row.is_active)}
                            title={row.is_active ? "Nonaktifkan (Suspend)" : "Aktifkan"}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
                          >
                            <PowerIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Modal Tambah Sekolah */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-display font-bold text-gray-900">Daftarkan Sekolah Baru</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nama Sekolah <span className="text-red-500">*</span></label>
                  <input required type="text" value={formData.nama} onChange={(e) => setFormData({...formData, nama: e.target.value})} className="w-full px-4 py-2 border rounded-xl focus:border-[#3DB891] focus:ring-2 focus:ring-[#3DB891]/20 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">NPSN / Kode <span className="text-red-500">*</span></label>
                  <input required type="text" value={formData.kode} onChange={(e) => setFormData({...formData, kode: e.target.value})} className="w-full px-4 py-2 border rounded-xl focus:border-[#3DB891] focus:ring-2 focus:ring-[#3DB891]/20 outline-none transition-all" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Master Key Enkripsi <span className="text-red-500">* (Wajib Simpan)</span></label>
                  <div className="flex items-center gap-2">
                    <input required type="text" value={formData.master_key} onChange={(e) => setFormData({...formData, master_key: e.target.value})} placeholder="Masukkan minimal 32 karakter..." className="flex-1 px-4 py-2 border rounded-xl focus:border-[#3DB891] focus:ring-2 focus:ring-[#3DB891]/20 outline-none transition-all font-mono text-sm" />
                    <button type="button" onClick={generateMasterKey} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors whitespace-nowrap">
                      Generate
                    </button>
                    <button type="button" onClick={copyToClipboard} className="px-3 py-2 bg-[#3DB891] hover:bg-[#208C68] text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1 whitespace-nowrap">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      Salin
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Gunakan string acak dan serahkan kepada TU (bisa dicopy). Super Admin tidak bisa melihatnya lagi setelah ini.</p>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Alamat Lengkap</label>
                  <textarea value={formData.alamat} onChange={(e) => setFormData({...formData, alamat: e.target.value})} className="w-full px-4 py-2 border rounded-xl focus:border-[#3DB891] focus:ring-2 focus:ring-[#3DB891]/20 outline-none transition-all" rows={2}></textarea>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Provinsi</label>
                  <select
                    value={selectedProv}
                    onChange={(e) => handleProvChange(e.target.value)}
                    className="w-full px-4 py-2 border rounded-xl focus:border-[#3DB891] focus:ring-2 focus:ring-[#3DB891]/20 outline-none transition-all"
                  >
                    <option value="" disabled>-- Pilih Provinsi --</option>
                    {provinces.map(prov => (
                      <option key={prov.code} value={prov.code}>{prov.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Kota</label>
                  <select
                    value={selectedRegency}
                    onChange={(e) => handleRegencyChange(e.target.value)}
                    disabled={!selectedProv || regencies.length === 0}
                    className="w-full px-4 py-2 border rounded-xl focus:border-[#3DB891] focus:ring-2 focus:ring-[#3DB891]/20 outline-none transition-all disabled:opacity-50"
                  >
                    <option value="" disabled>-- Pilih Kota --</option>
                    {regencies.map(reg => (
                      <option key={reg.code} value={reg.code}>{reg.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 border rounded-xl focus:border-[#3DB891] focus:ring-2 focus:ring-[#3DB891]/20 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Telepon</label>
                  <input type="text" value={formData.telepon} onChange={(e) => setFormData({...formData, telepon: e.target.value})} className="w-full px-4 py-2 border rounded-xl focus:border-[#3DB891] focus:ring-2 focus:ring-[#3DB891]/20 outline-none transition-all" />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800 text-sm">
                <span className="text-xl">ℹ️</span>
                <p>Setelah sekolah berhasil dibuat, akun <b>TU Sekolah</b> akan dibuat otomatis dengan username <code>tu_[npsn]</code> dan password <code>[npsn]</code>.</p>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors">Batal</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-[#3DB891] hover:bg-[#208C68] text-white rounded-xl font-bold transition-colors disabled:opacity-50">
                  {submitting ? "Menyimpan..." : "Daftarkan Sekolah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
