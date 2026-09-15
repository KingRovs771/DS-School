import { useState, useEffect } from "react";
import Head from "next/head";
import AdminLayout from "@/components/AdminLayout";
import { useRequireAdmin } from "@/hooks/useAdminAuth";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import {
  CalendarDaysIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  BuildingOfficeIcon
} from "@heroicons/react/24/solid";
import { FolderOpenIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import {
  useTahunAjaran,
  useCreateTahunAjaran,
  useSetDefaultTahunAjaran,
  useDeleteTahunAjaran,
  TahunAjaran
} from "@/hooks/useTahunAjaran";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

export default function AdminTahunAjaran() {
  useRequireAdmin();
  const { admin } = useAdminAuthStore();
  const isSuperAdmin = admin?.role === "super_admin";

  const [newTahun, setNewTahun] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [selectedSekolahId, setSelectedSekolahId] = useState<number | undefined>(undefined);

  // Untuk super_admin: load daftar sekolah untuk selector
  const { data: sekolahList = [] } = useQuery({
    queryKey: ["sekolah-list-for-tahun-ajaran"],
    queryFn: async () => {
      // Gunakan endpoint monitoring sekolah (super_admin) atau fallback ke admin/master-key/schools
      try {
        const res = await apiClient.get("/superadmin/monitoring/sekolah");
        return res.data as Array<{ id: number; nama: string; npsn: string }>;
      } catch {
        const res2 = await apiClient.get("/admin/master-key/schools");
        return (res2.data as Array<any>).map((s: any) => ({ id: s.id, nama: s.nama, npsn: s.npsn }));
      }
    },
    enabled: isSuperAdmin,
  });

  // Auto-select sekolah pertama untuk super_admin
  useEffect(() => {
    if (isSuperAdmin && sekolahList.length > 0 && selectedSekolahId === undefined) {
      setSelectedSekolahId(sekolahList[0].id);
    }
  }, [isSuperAdmin, sekolahList, selectedSekolahId]);

  const { data: tahunAjaranList = [], isLoading, refetch } = useTahunAjaran(
    isSuperAdmin ? selectedSekolahId : undefined
  );
  const createMutation = useCreateTahunAjaran();
  const setDefaultMutation = useSetDefaultTahunAjaran();
  const deleteMutation = useDeleteTahunAjaran();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTahun.trim()) {
      toast.error("Format Tahun Ajaran wajib diisi.");
      return;
    }
    
    if (!/^\d{4}\/\d{4}$/.test(newTahun)) {
      toast.error("Format harus YYYY/YYYY (contoh: 2024/2025)");
      return;
    }

    if (isSuperAdmin && !selectedSekolahId) {
      toast.error("Pilih sekolah terlebih dahulu (Super Admin).");
      return;
    }

    createMutation.mutate({
      tahun: newTahun.trim(),
      is_default: isDefault,
      ...(isSuperAdmin && selectedSekolahId ? { sekolah_id: selectedSekolahId } : {}),
    }, {
      onSuccess: () => {
        setNewTahun("");
        setIsDefault(false);
      }
    });
  };

  const selectedSekolahName = isSuperAdmin
    ? sekolahList.find((s: any) => s.id === selectedSekolahId)?.nama
    : null;

  return (
    <AdminLayout title="Manajemen Tahun Ajaran">
      <Head>
        <title>Tahun Ajaran — DokumenSekolah Admin</title>
      </Head>

      {/* Info per-sekolah */}
      <div className="mb-4 bg-[#E0F5EE] border border-[#B8EAD9] rounded-xl px-4 py-3 flex items-start gap-3">
        <BuildingOfficeIcon className="w-5 h-5 text-[#208C68] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-[#14503C]">Isolasi Per Sekolah</p>
          <p className="text-[11px] text-[#4A5350] mt-0.5 leading-relaxed">
            Tahun ajaran kini dikelola <span className="font-bold">per sekolah</span>. Setiap sekolah memiliki daftar tahun ajaran sendiri.
            {isSuperAdmin ? " Sebagai Super Admin, pilih sekolah untuk mengelola tahun ajarannya." : " Data di bawah adalah khusus untuk sekolah Anda."}
          </p>
        </div>
      </div>

      {/* Selector sekolah untuk super_admin */}
      {isSuperAdmin && (
        <div className="mb-4 bg-white border border-[#D4DDD9] rounded-xl p-4 flex items-center gap-3">
          <label className="text-xs font-bold text-neutral-700">Pilih Sekolah:</label>
          <select
            value={selectedSekolahId ?? ""}
            onChange={(e) => setSelectedSekolahId(Number(e.target.value))}
            className="flex-1 max-w-md px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
          >
            {sekolahList.map((s: any) => (
              <option key={s.id} value={s.id}>{s.nama} — {s.npsn}</option>
            ))}
          </select>
          {selectedSekolahName && (
            <span className="text-xs font-bold text-[#208C68] bg-[#E0F5EE] px-3 py-1.5 rounded-lg">
              {selectedSekolahName}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-body text-neutral-800">
        
        {/* Kolom Kiri: Daftar Tahun Ajaran */}
        <div className="lg:col-span-2 bg-white border border-[#D4DDD9] rounded-[20px] shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-[#EDF2F0] bg-[#F5F8F7] flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-neutral-950 text-sm">
                Daftar Tahun Ajaran {isSuperAdmin && selectedSekolahName ? `— ${selectedSekolahName}` : ""}
              </h3>
              <p className="text-[11px] font-semibold text-[#8FA39B] mt-0.5">
                {isSuperAdmin ? "Kelola tahun ajaran per sekolah (pilih sekolah di atas)" : "Kelola tahun ajaran akademik untuk sekolah Anda"}
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="p-2 bg-white border border-[#D4DDD9] hover:bg-[#F5F8F7] text-neutral-400 hover:text-neutral-750 rounded-xl transition-all"
              title="Refresh Data"
            >
              <ArrowPathIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F5F8F7] border-b border-[#D4DDD9]">
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Tahun Ajaran</th>
                  <th className="px-6 py-3 text-center text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2F0]">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="text-center py-12 text-[#8FA39B]">
                      <div className="w-6 h-6 border-2 border-[#208C68] border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : tahunAjaranList.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-16 text-center text-[#8FA39B]">
                      <FolderOpenIcon className="w-10 h-10 mx-auto mb-2 opacity-35" />
                      <p className="text-xs font-semibold">Belum ada data tahun ajaran{isSuperAdmin && selectedSekolahName ? ` untuk ${selectedSekolahName}` : " untuk sekolah ini"}</p>
                      <p className="text-[10px] mt-1">Silakan tambahkan tahun ajaran baru di form sebelah kanan</p>
                    </td>
                  </tr>
                ) : (
                  tahunAjaranList.map((ta: TahunAjaran) => (
                    <tr key={ta.id} className="hover:bg-[#F0FAF6] transition-colors duration-120">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-[#0F4C39] bg-[#E0F5EE] px-2.5 py-1 rounded-lg">
                          {ta.tahun}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {ta.is_default ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#3DB891]/15 text-[#208C68]">
                            <CheckCircleIcon className="w-3.5 h-3.5" /> Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-500">
                            Non-Aktif
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                        {!ta.is_default && (
                          <button
                            onClick={() => setDefaultMutation.mutate(ta.id)}
                            disabled={setDefaultMutation.isPending}
                            className="px-3 py-1.5 bg-[#E0F5EE] hover:bg-[#C2EBE0] text-[#0F4C39] text-xs font-bold rounded-lg transition-colors shadow-sm inline-flex items-center disabled:opacity-50"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm(`Hapus tahun ajaran "${ta.tahun}"?`)) {
                              deleteMutation.mutate(ta.id);
                            }
                          }}
                          className="w-[28px] h-[28px] bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center text-red-655 transition-colors shadow-sm inline-flex"
                          title="Hapus Tahun Ajaran"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kolom Kanan: Tambah Baru Form */}
        <div className="bg-white border border-[#D4DDD9] rounded-[20px] p-6 shadow-sm h-fit space-y-4">
          <div className="border-b border-[#EDF2F0] pb-3 mb-2 flex items-center gap-2">
            <CalendarDaysIcon className="w-5 h-5 text-[#208C68]" />
            <h3 className="font-display font-bold text-neutral-950 text-sm">Tambah Tahun Ajaran</h3>
          </div>

          {isSuperAdmin && !selectedSekolahId && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Pilih sekolah terlebih dahulu untuk menambah tahun ajaran.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">Tahun Ajaran *</label>
              <input
                type="text"
                required
                value={newTahun}
                onChange={(e) => setNewTahun(e.target.value)}
                placeholder="e.g. 2024/2025"
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] focus:ring-2 focus:ring-[#3DB891]/25 transition-all"
              />
              <p className="text-[9px] text-[#8FA39B] font-semibold mt-1">Format wajib: YYYY/YYYY.</p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer mt-4">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 text-[#208C68] border-[#D4DDD9] rounded focus:ring-[#3DB891] cursor-pointer"
              />
              <span className="text-xs font-bold text-neutral-700">Set sebagai tahun ajaran aktif/default</span>
            </label>

            <button
              type="submit"
              disabled={createMutation.isPending || (isSuperAdmin && !selectedSekolahId)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#208C68] hover:bg-[#14503C] text-white text-xs font-bold rounded-xl transition-all shadow shadow-[#208C68]/15 disabled:opacity-50 mt-4"
            >
              {createMutation.isPending ? (
                <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
              ) : <PlusIcon className="w-4 h-4" />}
              Tambah Tahun Ajaran{isSuperAdmin && selectedSekolahName ? ` — ${selectedSekolahName}` : ""}
            </button>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
