import { useState, useEffect } from "react";
import Head from "next/head";
import AdminLayout from "@/components/AdminLayout";
import { superAdminApi, sekolahApi } from "@/lib/api";
import { useRequireAdmin } from "@/hooks/useAdminAuth";
import toast from "react-hot-toast";
import { BuildingOfficeIcon, PlusIcon, PencilSquareIcon, TrashIcon, XMarkIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";

interface DinasUser {
  id: string;
  nama_lengkap: string;
  email: string;
  role: string;
  is_active: boolean;
  kabupaten_id: string;
  nama_kabupaten: string | null;
  last_login: string | null;
}

export default function ManajemenDinasPage() {
  const { isAdminAuthenticated, mounted } = useRequireAdmin();
  const [users, setUsers] = useState<DinasUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Search
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const limit = 15;

  // Wilayah State
  const [provinces, setProvinces] = useState<{code: string, name: string}[]>([]);
  const [regencies, setRegencies] = useState<{code: string, name: string}[]>([]);
  const [selectedProv, setSelectedProv] = useState("");
  const [selectedRegency, setSelectedRegency] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    nama_lengkap: "",
    email: "",
    password: "",
    is_active: true
  });
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchUsers();
      fetchProvinces();
    }
  }, [page, appliedSearch, isAdminAuthenticated]);

  const fetchUsers = async () => {
    if (!isAdminAuthenticated) return;
    try {
      setLoading(true);
      const res = await superAdminApi.getDinasUsers({ page, size: limit, search: appliedSearch });
      setUsers(res.data.items);
      setTotal(res.data.total);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal mengambil data user Dinas");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !isAdminAuthenticated) return null;

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(search);
    setPage(1);
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setEditId(null);
    setFormData({
      nama_lengkap: "",
      email: "",
      password: "",
      is_active: true
    });
    setSelectedProv("");
    setSelectedRegency("");
    setRegencies([]);
    setShowModal(true);
  };

  const openEditModal = (user: DinasUser) => {
    setIsEditing(true);
    setEditId(user.id);
    setFormData({
      nama_lengkap: user.nama_lengkap,
      email: user.email,
      password: "", 
      is_active: user.is_active
    });
    // Kita reset dulu pilihan dropdown wilayah saat Edit, 
    // karena user tidak menyimpan provinsi di DB (hanya kabupaten_id). 
    // Jadi admin harus memilih ulang jika ingin mengganti, atau biarkan kosong jika tidak diganti.
    setSelectedProv("");
    setSelectedRegency("");
    setRegencies([]);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalKabupatenId = undefined;

      // Jika admin memilih wilayah baru dari dropdown
      if (selectedProv && selectedRegency) {
        const provName = provinces.find(p => p.code === selectedProv)?.name || "";
        const regencyName = regencies.find(r => r.code === selectedRegency)?.name || "";
        
        const syncRes = await sekolahApi.syncKabupaten({
          provinsi: provName,
          nama: regencyName,
          kode_kemendagri: selectedRegency
        });
        finalKabupatenId = syncRes.data.id;
      } else if (!isEditing) {
        toast.error("Silakan pilih Provinsi dan Kabupaten untuk user baru");
        setSaving(false);
        return;
      }

      const payload: any = {
        nama_lengkap: formData.nama_lengkap,
        email: formData.email,
        is_active: formData.is_active
      };

      if (finalKabupatenId) {
        payload.kabupaten_id = finalKabupatenId;
      }
      
      if (!isEditing) {
        if (!formData.password) {
          toast.error("Password wajib diisi untuk user baru");
          setSaving(false);
          return;
        }
        payload.password = formData.password;
        await superAdminApi.createDinasUser(payload);
        toast.success("User Dinas berhasil dibuat!");
      } else {
        if (formData.password) {
          payload.password = formData.password;
        }
        await superAdminApi.updateDinasUser(editId!, payload);
        toast.success("User Dinas berhasil diperbarui!");
      }
      
      setShowModal(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal menyimpan data user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await superAdminApi.deleteDinasUser(deleteId);
      toast.success("User Dinas berhasil dihapus!");
      setDeleteId(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal menghapus data user");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout title="Manajemen Dinas">
      <Head>
        <title>Manajemen Dinas - Admin DokumenSekolah</title>
      </Head>

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <form onSubmit={handleSearch} className="w-full md:w-96 relative">
          <input
            type="text"
            placeholder="Cari nama atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#D4DDD9] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3DB891]/20 focus:border-[#3DB891] transition-all"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </form>

        <button
          onClick={openCreateModal}
          className="bg-[#208C68] hover:bg-[#1A7456] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shadow-sm"
        >
          <PlusIcon className="w-4 h-4" />
          User Baru
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#D4DDD9]/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F5F8F7] text-[#1F2421] font-bold border-b border-[#D4DDD9]/60">
              <tr>
                <th className="px-5 py-4 w-12 text-center">No</th>
                <th className="px-5 py-4">Nama Lengkap</th>
                <th className="px-5 py-4">Email</th>
                <th className="px-5 py-4">Wilayah</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="flex justify-center items-center gap-3 text-gray-500">
                      <div className="w-5 h-5 border-2 border-[#3DB891] border-t-transparent rounded-full animate-spin" />
                      Memuat data...
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                    Tidak ada data user Dinas ditemukan.
                  </td>
                </tr>
              ) : (
                users.map((u, i) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 text-center text-gray-400">
                      {(page - 1) * limit + i + 1}
                    </td>
                    <td className="px-5 py-4 text-gray-900">{u.nama_lengkap}</td>
                    <td className="px-5 py-4 text-gray-500">{u.email}</td>
                    <td className="px-5 py-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-bold">
                        <BuildingOfficeIcon className="w-3.5 h-3.5" />
                        {u.nama_kabupaten || "Tidak Terikat"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                        u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {u.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(u.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Hapus"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* ─── Modal Form (Create/Edit) ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900">
                {isEditing ? "Edit User Dinas" : "Tambah User Dinas"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formData.nama_lengkap}
                  onChange={(e) => setFormData({...formData, nama_lengkap: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3DB891] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3DB891] focus:outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Provinsi {isEditing && <span className="text-gray-400 font-normal text-[10px]">(Ubah jika perlu)</span>}
                  </label>
                  <select
                    required={!isEditing}
                    value={selectedProv}
                    onChange={(e) => handleProvChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3DB891] focus:outline-none text-sm"
                  >
                    <option value="" disabled>-- Pilih --</option>
                    {provinces.map(prov => (
                      <option key={prov.code} value={prov.code}>{prov.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Kabupaten / Kota
                  </label>
                  <select
                    required={!isEditing}
                    value={selectedRegency}
                    onChange={(e) => setSelectedRegency(e.target.value)}
                    disabled={!selectedProv || regencies.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3DB891] focus:outline-none text-sm disabled:opacity-50"
                  >
                    <option value="" disabled>-- Pilih --</option>
                    {regencies.map(reg => (
                      <option key={reg.code} value={reg.code}>{reg.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password {isEditing && <span className="text-gray-400 font-normal text-xs">(Kosongkan jika tidak ingin mengubah)</span>}
                </label>
                <input
                  type="password"
                  minLength={8}
                  required={!isEditing}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3DB891] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="w-4 h-4 text-[#3DB891] rounded border-gray-300 focus:ring-[#3DB891]"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Akun Aktif</label>
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#208C68] hover:bg-[#1A7456] text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal Konfirmasi Delete ─── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Hapus User?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Apakah Anda yakin ingin menghapus user Dinas ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
