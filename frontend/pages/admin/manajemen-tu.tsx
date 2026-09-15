import { useState, useEffect } from "react";
import Head from "next/head";
import AdminLayout from "@/components/AdminLayout";
import { superAdminApi } from "@/lib/api";
import { useRequireAdmin } from "@/hooks/useAdminAuth";
import toast from "react-hot-toast";
import { BuildingOffice2Icon, PlusIcon, PencilSquareIcon, EnvelopeIcon, TrashIcon, XMarkIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";

interface AdminUser {
  id: number;
  username: string;
  nama_lengkap: string;
  email: string;
  role: string;
  is_active: boolean;
  sekolah_id: number | null;
  last_login: string | null;
}

export default function ManajemenTUPage() {
  const { isAdminAuthenticated, mounted } = useRequireAdmin();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sekolahList, setSekolahList] = useState<{id: number, nama: string}[]>([]);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const limit = 15;

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    username: "",
    nama_lengkap: "",
    email: "",
    password: "",
    role: "admin",
    sekolah_id: 0,
    is_active: true
  });
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchUsers();
      fetchSekolah();
    }
  }, [page, appliedSearch, isAdminAuthenticated]);

  const fetchUsers = async () => {
    if (!isAdminAuthenticated) return;
    try {
      setLoading(true);
      const res = await superAdminApi.getAdminSekolahUsers({ page, size: limit, search: appliedSearch });
      setUsers(res.data.items);
      setTotal(res.data.total);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal mengambil data user Sekolah");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !isAdminAuthenticated) return null;

  const fetchSekolah = async () => {
    if (!isAdminAuthenticated) return;
    try {
      const res = await superAdminApi.getMonitoringSekolah();
      setSekolahList(res.data);
    } catch (err) {
      console.error("Gagal mengambil data sekolah", err);
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
      username: "",
      nama_lengkap: "",
      email: "",
      password: "",
      role: "admin",
      sekolah_id: sekolahList.length > 0 ? sekolahList[0].id : 0,
      is_active: true
    });
    setShowModal(true);
  };

  const openEditModal = (user: AdminUser) => {
    setIsEditing(true);
    setEditId(user.id);
    setFormData({
      username: user.username,
      nama_lengkap: user.nama_lengkap,
      email: user.email,
      password: "", // Leave blank unless changing
      role: user.role,
      sekolah_id: user.sekolah_id || (sekolahList.length > 0 ? sekolahList[0].id : 0),
      is_active: user.is_active
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        username: formData.username,
        nama_lengkap: formData.nama_lengkap,
        email: formData.email,
        role: formData.role,
        sekolah_id: Number(formData.sekolah_id),
        is_active: formData.is_active
      };
      
      if (!isEditing) {
        if (!formData.password) {
          toast.error("Password wajib diisi untuk user baru");
          setSaving(false);
          return;
        }
        payload.password = formData.password;
        await superAdminApi.createAdminSekolahUser(payload);
        toast.success("User Sekolah berhasil dibuat!");
      } else {
        if (formData.password) {
          payload.password = formData.password;
        }
        await superAdminApi.updateAdminSekolahUser(editId!, payload);
        toast.success("User Sekolah berhasil diperbarui!");
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
      await superAdminApi.deleteAdminSekolahUser(deleteId);
      toast.success("User Sekolah berhasil dihapus!");
      setDeleteId(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal menghapus data user");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout title="Manajemen TU & Admin">
      <Head>
        <title>Manajemen TU - Admin DokumenSekolah</title>
      </Head>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <form onSubmit={handleSearch} className="w-full md:w-96 relative">
          <input
            type="text"
            placeholder="Cari username, nama atau email..."
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

      <div className="bg-white rounded-2xl shadow-sm border border-[#D4DDD9]/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F5F8F7] text-[#1F2421] font-bold border-b border-[#D4DDD9]/60">
              <tr>
                <th className="px-5 py-4 w-12 text-center">No</th>
                <th className="px-5 py-4">Nama Lengkap & Akun</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Sekolah ID</th>
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
                    Tidak ada data ditemukan.
                  </td>
                </tr>
              ) : (
                users.map((u, i) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 text-center text-gray-400">
                      {(page - 1) * limit + i + 1}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="text-gray-900 font-bold">{u.nama_lengkap}</span>
                        <div className="flex items-center gap-2 text-[11px] mt-0.5">
                           <span className="text-gray-500">@{u.username}</span>
                           <span className="text-gray-300">•</span>
                           <span className="text-gray-500 flex items-center gap-1"><EnvelopeIcon className="w-3 h-3"/> {u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-bold uppercase">
                        {u.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {u.sekolah_id ? (
                        <div className="flex items-center gap-1">
                          <BuildingOffice2Icon className="w-4 h-4 text-[#3DB891]" />
                          <span>{sekolahList.find(s => s.id === u.sekolah_id)?.nama || `ID: ${u.sekolah_id}`}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Tanpa Sekolah</span>
                      )}
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
                {isEditing ? "Edit User Sekolah" : "Tambah User Sekolah"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3DB891] focus:outline-none"
                />
              </div>
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
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3DB891] focus:outline-none"
                  >
                    <option value="admin">Admin Sekolah</option>
                    <option value="tu_sekolah">TU Sekolah</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Asal Sekolah</label>
                  <select
                    required
                    value={formData.sekolah_id}
                    onChange={(e) => setFormData({...formData, sekolah_id: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3DB891] focus:outline-none"
                  >
                    <option value={0} disabled>Pilih Sekolah</option>
                    {sekolahList.map(s => (
                      <option key={s.id} value={s.id}>{s.nama}</option>
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
              Apakah Anda yakin ingin menghapus user Sekolah ini? Tindakan ini tidak dapat dibatalkan.
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
