/**
 * pages/admin/retention-policy.tsx
 * Halaman manajemen Kebijakan Retensi Dokumen & Legal Hold
 */
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminLayout from '@/components/AdminLayout';
import { useAdminAuthStore } from '@/store/adminAuthStore';
import { useRequireAdmin } from '@/hooks/useAdminAuth';
import { retentionApi } from '@/lib/retentionApi';
import toast from 'react-hot-toast';
import {
  ShieldExclamationIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  LockClosedIcon,
  LockOpenIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import { ShieldCheckIcon } from '@heroicons/react/24/solid';

// ─── Types ──────────────────────────────────────────────────────────────────
interface RetentionPolicy {
  id: number;
  sekolah_id: number;
  jenis_dok: string;
  durasi_hari: number;
  aksi_setelah: 'archive' | 'delete' | 'notify_only';
  notif_hari_sebelum: number;
  is_active: boolean;
  created_at: string;
}

interface DokumenExpired {
  id: number;
  jenis_dok: string;
  tahun_ajaran: string;
  siswa_id: number;
  siswa_nama: string;
  siswa_nisn: string;
  retention_expires_at: string;
  sisa_hari: number;
  legal_hold: boolean;
  status: string;
}

const AKSI_LABELS: Record<string, { label: string; color: string }> = {
  archive: { label: 'Arsip', color: 'bg-blue-100 text-blue-700' },
  delete: { label: 'Hapus', color: 'bg-red-100 text-red-700' },
  notify_only: { label: 'Notifikasi Saja', color: 'bg-amber-100 text-amber-700' },
};

const SISA_COLOR = (sisa: number) => {
  if (sisa <= 7) return 'text-red-600 font-bold';
  if (sisa <= 30) return 'text-amber-600 font-semibold';
  return 'text-green-600';
};

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function RetentionPolicyPage() {
  const { isAdminAuthenticated, mounted } = useRequireAdmin();
  const admin = useAdminAuthStore((s) => s.admin);
  const isSuperAdmin = admin?.role === 'super_admin';
  const isDinas = admin?.role === 'dinas_pendidikan';

  const [activeTab, setActiveTab] = useState<'policy' | 'expired'>('policy');
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [expiredDocs, setExpiredDocs] = useState<DokumenExpired[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [loadingExpired, setLoadingExpired] = useState(false);
  const [hariFilter, setHariFilter] = useState(30);

  // Sekolah list & filter state
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('');

  // Dynamic Categories from Backend
  const [categories, setCategories] = useState<any[]>([]);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    sekolah_id: 0,
    jenis_dok: 'rapor',
    durasi_hari: 1825,
    aksi_setelah: 'archive' as 'archive' | 'delete' | 'notify_only',
    notif_hari_sebelum: 30,
    is_active: true,
  });

  // Confirm delete
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── Fetch Schools ─────────────────────────────────────────────────────
  const fetchSchools = useCallback(async () => {
    if (!isAdminAuthenticated) return;
    try {
      if (isDinas) {
        const { dinasApi } = await import('@/lib/api');
        const res = await dinasApi.getSekolah();
        setSchools(res.data || []);
      } else if (isSuperAdmin) {
        const { superAdminApi } = await import('@/lib/api');
        const res = await superAdminApi.getMonitoringSekolah();
        setSchools(res.data || []);
      }
    } catch (e) {
      console.error('Gagal memuat daftar sekolah', e);
    }
  }, [isDinas, isSuperAdmin, isAdminAuthenticated]);

  // ─── Fetch Categories ──────────────────────────────────────────────────
  const fetchCategories = useCallback(async (sekolah_id?: number) => {
    if (!isAdminAuthenticated) return;
    try {
      const { categoriesApi } = await import('@/lib/api');
      const res = await categoriesApi.getAll(sekolah_id);
      setCategories(res.data || []);
    } catch (e) {
      console.error('Gagal memuat kategori dokumen', e);
    }
  }, [isAdminAuthenticated]);

  // ─── Fetch Policies ─────────────────────────────────────────────────────
  const fetchPolicies = useCallback(async () => {
    if (!isAdminAuthenticated) return;
    setLoadingPolicies(true);
    try {
      const sId = selectedSchoolFilter ? Number(selectedSchoolFilter) : undefined;
      const res = await retentionApi.getAll(sId);
      setPolicies(res.data);
    } catch {
      toast.error('Gagal memuat kebijakan retensi');
    } finally {
      setLoadingPolicies(false);
    }
  }, [selectedSchoolFilter, isAdminAuthenticated]);

  const fetchExpired = useCallback(async () => {
    if (!isAdminAuthenticated) return;
    setLoadingExpired(true);
    try {
      const res = await retentionApi.getDokumenAkanExpired(hariFilter);
      setExpiredDocs(res.data);
    } catch {
      toast.error('Gagal memuat dokumen akan kadaluarsa');
    } finally {
      setLoadingExpired(false);
    }
  }, [hariFilter, isAdminAuthenticated]);

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchSchools();
    }
  }, [fetchSchools, isAdminAuthenticated]);

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchPolicies();
    }
  }, [fetchPolicies, isAdminAuthenticated]);

  useEffect(() => {
    if (activeTab === 'expired' && isAdminAuthenticated) {
      fetchExpired();
    }
  }, [activeTab, fetchExpired, isAdminAuthenticated]);

  // Fetch categories for policy table list filter
  useEffect(() => {
    if (isAdminAuthenticated) {
      const sId = selectedSchoolFilter ? Number(selectedSchoolFilter) : undefined;
      fetchCategories(sId);
    }
  }, [selectedSchoolFilter, fetchCategories, isAdminAuthenticated]);

  // Fetch categories for form modal based on currently selected school
  useEffect(() => {
    if (showForm && formData.sekolah_id && isAdminAuthenticated) {
      fetchCategories(formData.sekolah_id);
    }
  }, [showForm, formData.sekolah_id, fetchCategories, isAdminAuthenticated]);

  // Sync jenis_dok form value with loaded categories
  useEffect(() => {
    if (categories.length > 0 && !editingId) {
      const exists = categories.some((c) => c.name === formData.jenis_dok);
      if (!exists) {
        setFormData((f) => ({ ...f, jenis_dok: categories[0].name }));
      }
    }
  }, [categories, editingId, formData.jenis_dok]);

  if (!mounted || !isAdminAuthenticated) return null;

  // ─── Handlers ──────────────────────────────────────────────────────────
  const handleOpenForm = (policy?: RetentionPolicy) => {
    if (policy) {
      setEditingId(policy.id);
      setFormData({
        sekolah_id: policy.sekolah_id,
        jenis_dok: policy.jenis_dok,
        durasi_hari: policy.durasi_hari,
        aksi_setelah: policy.aksi_setelah,
        notif_hari_sebelum: policy.notif_hari_sebelum,
        is_active: policy.is_active,
      });
    } else {
      setEditingId(null);
      const initialSchoolId = selectedSchoolFilter ? Number(selectedSchoolFilter) : (schools[0]?.id || 0);
      setFormData({
        sekolah_id: initialSchoolId,
        jenis_dok: categories[0]?.name || 'rapor',
        durasi_hari: 1825,
        aksi_setelah: 'archive',
        notif_hari_sebelum: 30,
        is_active: true,
      });
    }
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.sekolah_id) {
      toast.error('Silakan pilih sekolah target terlebih dahulu');
      return;
    }
    if (!formData.jenis_dok) {
      toast.error('Silakan pilih jenis dokumen terlebih dahulu');
      return;
    }
    try {
      if (editingId) {
        await retentionApi.update(editingId, {
          durasi_hari: formData.durasi_hari,
          aksi_setelah: formData.aksi_setelah,
          notif_hari_sebelum: formData.notif_hari_sebelum,
          is_active: formData.is_active,
        });
        toast.success('Kebijakan berhasil diperbarui');
      } else {
        await retentionApi.create(formData);
        toast.success('Kebijakan berhasil dibuat');
      }
      setShowForm(false);
      fetchPolicies();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan kebijakan');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await retentionApi.delete(deleteId);
      toast.success('Kebijakan dihapus');
      setDeleteId(null);
      fetchPolicies();
    } catch {
      toast.error('Gagal menghapus kebijakan');
    } finally {
      setDeleting(false);
    }
  };

  const getSchoolName = (id: number) => {
    const s = schools.find((sch) => sch.id === id);
    return s ? s.nama : `Sekolah ID ${id}`;
  };

  return (
    <>
      <Head>
        <title>Kebijakan Retensi & Legal Hold — DMS Sekolah</title>
      </Head>
      <AdminLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#14503C]/10 rounded-xl">
                <ShieldCheckIcon className="w-7 h-7 text-[#14503C]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Kebijakan Retensi & Legal Hold</h1>
                <p className="text-sm text-gray-500">Kelola durasi penyimpanan dokumen dan lindungi dokumen penting dengan Legal Hold</p>
              </div>
            </div>
            {!isSuperAdmin && activeTab === 'policy' && (
              <button
                onClick={() => handleOpenForm()}
                className="flex items-center gap-2 px-4 py-2 bg-[#14503C] text-white rounded-xl text-sm font-semibold hover:bg-[#0d3b2a] transition-all"
              >
                <PlusIcon className="w-4 h-4" />
                Tambah Kebijakan
              </button>
            )}
          </div>

          {/* School filter and tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              {[
                { key: 'policy', label: 'Kebijakan Retensi', icon: ShieldExclamationIcon },
                { key: 'expired', label: 'Akan Kadaluarsa', icon: CalendarDaysIcon },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === key
                      ? 'bg-white text-[#14503C] shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {key === 'expired' && expiredDocs.length > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {expiredDocs.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* School Filter Dropdown */}
            {activeTab === 'policy' && schools.length > 0 && (
              <div className="flex items-center gap-2">
                <BuildingOffice2Icon className="w-5 h-5 text-gray-400" />
                <select
                  value={selectedSchoolFilter}
                  onChange={(e) => setSelectedSchoolFilter(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-[#3DB891] focus:border-transparent outline-none bg-white font-medium"
                >
                  <option value="">Semua Sekolah Binaan</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.npsn})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ─── Tab: Kebijakan ───────────────────────────────────────── */}
          {activeTab === 'policy' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">
                  Daftar Kebijakan Retensi
                  {selectedSchoolFilter && ` - ${getSchoolName(Number(selectedSchoolFilter))}`}
                </h2>
                <button onClick={fetchPolicies} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <ArrowPathIcon className={`w-4 h-4 text-gray-400 ${loadingPolicies ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {loadingPolicies ? (
                <div className="flex justify-center items-center py-16">
                  <div className="w-8 h-8 border-4 border-[#3DB891] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : policies.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-gray-400">
                  <ShieldExclamationIcon className="w-12 h-12 mb-3 opacity-40" />
                  <p className="font-medium">Belum ada kebijakan retensi</p>
                  <p className="text-sm mt-1">Klik "Tambah Kebijakan" untuk memulai</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 text-left">Sekolah</th>
                        <th className="px-4 py-3 text-left">Jenis Dokumen</th>
                        <th className="px-4 py-3 text-left">Durasi Retensi</th>
                        <th className="px-4 py-3 text-left">Aksi Setelah Expired</th>
                        <th className="px-4 py-3 text-left">Notif Sebelum</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        {!isSuperAdmin && <th className="px-4 py-3 text-right">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {policies.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-700">
                            {getSchoolName(p.sekolah_id)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-800 capitalize">
                            {p.jenis_dok.replace(/_/g, ' ')}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            <span className="font-bold text-[#14503C]">{p.durasi_hari}</span> hari
                            <span className="text-gray-400 ml-1">({Math.round(p.durasi_hari / 365)} tahun)</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${AKSI_LABELS[p.aksi_setelah]?.color}`}>
                              {AKSI_LABELS[p.aksi_setelah]?.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{p.notif_hari_sebelum} hari</td>
                          <td className="px-4 py-3">
                            {p.is_active ? (
                              <span className="flex items-center gap-1 text-green-600 text-xs font-semibold">
                                <CheckCircleIcon className="w-3.5 h-3.5" /> Aktif
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-gray-400 text-xs font-semibold">
                                <XMarkIcon className="w-3.5 h-3.5" /> Nonaktif
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {!isSuperAdmin && (
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleOpenForm(p)}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                                  title="Edit"
                                >
                                  <PencilIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteId(p.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                                  title="Hapus"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─── Tab: Akan Kadaluarsa ─────────────────────────────────── */}
          {activeTab === 'expired' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Tampilkan dokumen akan kadaluarsa dalam:</label>
                <select
                  value={hariFilter}
                  onChange={(e) => setHariFilter(Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:ring-2 focus:ring-[#3DB891]"
                >
                  <option value={7}>7 hari</option>
                  <option value={14}>14 hari</option>
                  <option value={30}>30 hari</option>
                  <option value={60}>60 hari</option>
                  <option value={90}>90 hari</option>
                </select>
                <button onClick={fetchExpired} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <ArrowPathIcon className={`w-4 h-4 text-gray-400 ${loadingExpired ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                  <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                  <h2 className="font-semibold text-gray-800">
                    Dokumen Akan Kadaluarsa ({expiredDocs.length})
                  </h2>
                </div>
                {loadingExpired ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-[#3DB891] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : expiredDocs.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-gray-400">
                    <CheckCircleIcon className="w-12 h-12 mb-3 text-green-300" />
                    <p className="font-medium text-green-600">Tidak ada dokumen akan kadaluarsa</p>
                    <p className="text-sm mt-1">dalam {hariFilter} hari ke depan</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                        <tr>
                          <th className="px-4 py-3 text-left">Siswa</th>
                          <th className="px-4 py-3 text-left">Dokumen</th>
                          <th className="px-4 py-3 text-left">Tahun Ajaran</th>
                          <th className="px-4 py-3 text-left">Kadaluarsa</th>
                          <th className="px-4 py-3 text-left">Sisa Hari</th>
                          <th className="px-4 py-3 text-left">Status</th>
                          {!isSuperAdmin && <th className="px-4 py-3 text-right">Legal Hold</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {expiredDocs.map((doc) => (
                          <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-800">{doc.siswa_nama}</p>
                              <p className="text-xs text-gray-400">NISN: {doc.siswa_nisn}</p>
                            </td>
                            <td className="px-4 py-3 capitalize text-gray-700">
                              {doc.jenis_dok.replace(/_/g, ' ')}
                              {doc.legal_hold && (
                                <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-bold">
                                  <LockClosedIcon className="w-3 h-3" /> LEGAL HOLD
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{doc.tahun_ajaran}</td>
                            <td className="px-4 py-3 text-gray-600">
                              {new Date(doc.retention_expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className={`px-4 py-3 ${SISA_COLOR(doc.sisa_hari)}`}>
                              {doc.sisa_hari} hari
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                doc.status === 'approved' ? 'bg-green-100 text-green-700' :
                                doc.status === 'archived' ? 'bg-gray-100 text-gray-600' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {doc.status}
                              </span>
                            </td>
                            {!isSuperAdmin && (
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={async () => {
                                    try {
                                      if (doc.legal_hold) {
                                        await retentionApi.releaseLegalHold(doc.id);
                                        toast.success('Legal Hold dilepas');
                                      } else {
                                        await retentionApi.setLegalHold(doc.id, "Diatur oleh Dinas Pendidikan");
                                        toast.success('Legal Hold diaktifkan');
                                      }
                                      fetchExpired();
                                    } catch {
                                      toast.error('Gagal mengubah status Legal Hold');
                                    }
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors ${doc.legal_hold ? 'text-red-500 hover:bg-red-50' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                                  title={doc.legal_hold ? 'Lepas Legal Hold' : 'Set Legal Hold'}
                                >
                                  {doc.legal_hold ? <LockClosedIcon className="w-5 h-5" /> : <LockOpenIcon className="w-5 h-5" />}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Modal: Form Kebijakan ─────────────────────────────────── */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h3 className="font-bold text-lg text-gray-900">
                  {editingId ? 'Edit Kebijakan Retensi' : 'Buat Kebijakan Retensi Baru'}
                </h3>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* Select School */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sekolah Target</label>
                  <select
                    value={formData.sekolah_id}
                    onChange={(e) => setFormData((f) => ({ ...f, sekolah_id: Number(e.target.value) }))}
                    disabled={!!editingId || schools.length === 0}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#3DB891] disabled:bg-gray-50 font-medium"
                  >
                    <option value={0}>-- Pilih Sekolah --</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nama} ({s.npsn})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Jenis Dokumen */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Dokumen</label>
                  <select
                    value={formData.jenis_dok}
                    onChange={(e) => setFormData((f) => ({ ...f, jenis_dok: e.target.value }))}
                    disabled={!!editingId || categories.length === 0}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#3DB891] disabled:bg-gray-50 font-medium capitalize"
                  >
                    {categories.length === 0 && (
                      <option value="">-- Tidak ada kategori tersedia --</option>
                    )}
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Durasi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Durasi Retensi (hari)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.durasi_hari}
                    onChange={(e) => setFormData((f) => ({ ...f, durasi_hari: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#3DB891] font-medium"
                  />
                  <p className="text-xs text-gray-400 mt-1">≈ {Math.round(formData.durasi_hari / 365 * 10) / 10} tahun</p>
                </div>

                {/* Aksi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aksi Setelah Expired</label>
                  <select
                    value={formData.aksi_setelah}
                    onChange={(e) => setFormData((f) => ({ ...f, aksi_setelah: e.target.value as any }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#3DB891] font-medium"
                  >
                    <option value="archive">Arsipkan Otomatis</option>
                    <option value="delete">Hapus Otomatis</option>
                    <option value="notify_only">Notifikasi Saja (Tidak Otomatis)</option>
                  </select>
                </div>

                {/* Notif Sebelum */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notifikasi Sebelum (hari)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.notif_hari_sebelum}
                    onChange={(e) => setFormData((f) => ({ ...f, notif_hari_sebelum: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#3DB891] font-medium"
                  />
                </div>

                {/* Status */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData((f) => ({ ...f, is_active: e.target.checked }))}
                    className="w-4 h-4 text-[#14503C] rounded focus:ring-[#14503C]"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Kebijakan aktif</label>
                </div>
              </div>
              <div className="flex gap-3 p-6 border-t border-gray-100">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 px-4 py-2.5 bg-[#14503C] text-white rounded-xl text-sm font-semibold hover:bg-[#0d3b2a] transition-all"
                >
                  {editingId ? 'Simpan Perubahan' : 'Buat Kebijakan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Modal: Konfirmasi Hapus ───────────────────────────────── */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center gap-3 text-red-600">
                <ExclamationTriangleIcon className="w-6 h-6" />
                <h3 className="font-bold text-lg">Hapus Kebijakan?</h3>
              </div>
              <p className="text-sm text-gray-600">Kebijakan retensi ini akan dihapus permanen. Dokumen yang sudah ada tidak akan terpengaruh.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Batal
                </button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-all disabled:opacity-60">
                  {deleting ? 'Menghapus...' : 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </>
  );
}
