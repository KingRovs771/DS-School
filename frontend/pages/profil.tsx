/**
 * pages/profil.tsx — Halaman profil siswa
 * Mengikuti spesifikasi [TYPOGRAPHY], [COLORS], [SPACING_SHADOW] dari DESIGN.md
 */
import { useState, useEffect } from "react";
import Head from "next/head";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  HashtagIcon,
  CalendarIcon,
  AcademicCapIcon,
  ClockIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowDownTrayIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon
} from "@heroicons/react/24/solid";
import {
  UserIcon as UserOutline,
  LockClosedIcon as LockOutline,
  ClockIcon as ClockOutline,
  EnvelopeIcon as EnvelopeOutline,
  PhoneIcon as PhoneOutline
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import toast from "react-hot-toast";
import { clsx } from "clsx";

import Layout from "@/components/Layout";
import { ProfileSkeleton } from "@/components/Skeleton";
import { profilApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useRequireAuth } from "@/hooks/useAuth";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const updateProfilSchema = z.object({
  email: z.string().email("Format email tidak valid").optional().or(z.literal("")),
  telepon: z.string().max(15, "Nomor terlalu panjang").optional().or(z.literal("")),
});

const gantiPasswordSchema = z.object({
  old_password: z.string().min(1, "Password lama wajib diisi"),
  new_password: z.string().min(8, "Password baru minimal 8 karakter"),
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
  path: ["confirm_password"],
  message: "Konfirmasi password tidak cocok",
});

type UpdateProfilForm = z.infer<typeof updateProfilSchema>;
type GantiPasswordForm = z.infer<typeof gantiPasswordSchema>;

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      <div className="w-8 h-8 rounded-lg bg-[#E0F5EE] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-[#14503C]" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-[#8FA39B] uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-neutral-800 break-all">{value || "—"}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilPage() {
  const { isAuthenticated, mounted } = useRequireAuth();
  const { siswa, updateSiswa } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"profil" | "keamanan" | "riwayat">("profil");
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["profil-siswa"],
    queryFn: () => profilApi.getSiswa().then(r => r.data),
    enabled: isAuthenticated,
  });

  const { data: riwayatData, isLoading: riwayatLoading } = useQuery({
    queryKey: ["riwayat-akses"],
    queryFn: () => profilApi.getRiwayatAkses().then(r => r.data),
    enabled: isAuthenticated && activeTab === "riwayat",
  });

  // Form Profil
  const profilForm = useForm<UpdateProfilForm>({
    resolver: zodResolver(updateProfilSchema),
    defaultValues: {
      email: siswa?.email || "",
      telepon: siswa?.telepon || "",
    },
  });

  useEffect(() => {
    if (profileData) {
      profilForm.reset({
        email: profileData.email || "",
        telepon: profileData.telepon || "",
      });
    }
  }, [profileData]);

  // Form Password
  const passForm = useForm<GantiPasswordForm>({
    resolver: zodResolver(gantiPasswordSchema),
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (data: UpdateProfilForm) => profilApi.updateProfil(data),
    onSuccess: (res) => {
      updateSiswa(res.data);
      queryClient.invalidateQueries({ queryKey: ["profil-siswa"] });
      toast.success("Profil berhasil diperbarui!");
    },
    onError: () => toast.error("Gagal memperbarui profil"),
  });

  const passMutation = useMutation({
    mutationFn: (data: GantiPasswordForm) =>
      profilApi.gantiPassword({ old_password: data.old_password, new_password: data.new_password }),
    onSuccess: () => {
      passForm.reset();
      toast.success("Password berhasil diubah!");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || "Gagal mengubah password";
      toast.error(msg);
    },
  });

  if (!mounted || !isAuthenticated) return null;

  const profil = profileData || siswa;
  const riwayat: any[] = riwayatData?.items || [];

  const tabs = [
    { key: "profil", label: "Data Diri", icon: UserOutline },
    { key: "keamanan", label: "Keamanan", icon: LockOutline },
    { key: "riwayat", label: "Riwayat Akses", icon: ClockOutline },
  ] as const;

  return (
    <>
      <Head>
        <title>Profil Saya — DokumenSekolah</title>
        <meta name="description" content="Profil dan pengaturan akun siswa DokumenSekolah" />
      </Head>
      <Layout>
        {/* Profile Header Card */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-r from-[#14503C] to-[#0A2E1F] rounded-[20px] p-6 mb-6 text-white overflow-hidden shadow-sm"
        >
          <div className="absolute right-0 top-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center gap-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur border-2 border-white/20 flex items-center justify-center text-2xl font-display font-extrabold shadow flex-shrink-0">
              {profil?.nama_lengkap?.charAt(0) || "S"}
            </div>
            <div>
              <h2 className="text-xl font-display font-extrabold mb-0.5">{profil?.nama_lengkap || "—"}</h2>
              <p className="text-[#B8EAD9] text-xs font-semibold">NIS: {profil?.nis || "—"}</p>
              {profil?.kelas && <p className="text-white/70 text-xs font-medium">Kelas {profil.kelas} · Angkatan {profil?.angkatan}</p>}
            </div>
            <div className="ml-auto hidden sm:flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2 rounded-xl">
              <ShieldCheckIcon className="w-4 h-4 text-[#3DB891]" />
              <span className="text-xs font-bold">Akun Terverifikasi</span>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-[20px] p-1.5 border border-[#D4DDD9] shadow-sm mb-6 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex-shrink-0",
                activeTab === tab.key
                  ? "bg-[#208C68] text-white shadow-sm"
                  : "text-[#4A5350] hover:text-[#14503C] hover:bg-[#F5F8F7]"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="grid lg:grid-cols-5 gap-6">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-5"
          >
            {/* ─── DATA DIRI TAB ─── */}
            {activeTab === "profil" && (
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Informasi Read-only */}
                <div className="bg-white rounded-[20px] border border-[#D4DDD9] shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#EDF2F0] bg-[#F5F8F7]">
                    <h3 className="font-display font-bold text-neutral-950 text-sm">Informasi Akademik</h3>
                    <p className="text-[11px] font-semibold text-[#8FA39B] mt-0.5">Data akademik resmi siswa dari sistem</p>
                  </div>
                  {isLoading ? (
                    <div className="p-6"><ProfileSkeleton /></div>
                  ) : (
                    <div className="px-6 divide-y divide-[#EDF2F0]">
                      <InfoRow icon={HashtagIcon} label="NIS" value={profil?.nis || "—"} />
                      <InfoRow icon={HashtagIcon} label="NISN" value={(profil as any)?.nisn || "—"} />
                      <InfoRow icon={UserIcon} label="Nama Lengkap" value={profil?.nama_lengkap || "—"} />
                      <InfoRow 
                        icon={CalendarIcon} 
                        label="Tempat, Tanggal Lahir" 
                        value={
                          [
                            (profil as any)?.tempat_lahir,
                            (profil as any)?.tgl_lahir ? format(new Date((profil as any).tgl_lahir), "d MMMM yyyy", { locale: localeId }) : null
                          ].filter(Boolean).join(", ") || "—"
                        } 
                      />
                      <InfoRow 
                        icon={UserIcon} 
                        label="Jenis Kelamin" 
                        value={(profil as any)?.jenis_kelamin === "L" ? "Laki-laki" : (profil as any)?.jenis_kelamin === "P" ? "Perempuan" : "—"} 
                      />
                      <InfoRow icon={AcademicCapIcon} label="Agama" value={(profil as any)?.agama || "—"} />
                      <InfoRow icon={AcademicCapIcon} label="Kelas & Jurusan" value={[profil?.kelas, (profil as any)?.jurusan].filter(Boolean).join(" - ") || "—"} />
                      <InfoRow icon={CalendarIcon} label="Angkatan" value={profil?.angkatan ? `Angkatan ${profil.angkatan}` : "—"} />
                      <InfoRow icon={CalendarIcon} label="Tahun Lulus" value={(profil as any)?.tahun_lulus ? `Tahun ${ (profil as any).tahun_lulus }` : "Belum Lulus"} />
                      <InfoRow icon={UserIcon} label="Orang Tua / Wali" value={(profil as any)?.nama_ortu || "—"} />
                      <InfoRow icon={PhoneIcon} label="Telepon Orang Tua" value={(profil as any)?.telepon_ortu || "—"} />
                    </div>
                  )}
                </div>

                {/* Form Edit Profil */}
                <div className="bg-white rounded-[20px] border border-[#D4DDD9] shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#EDF2F0] bg-[#F5F8F7]">
                    <h3 className="font-display font-bold text-neutral-950 text-sm">Informasi Kontak</h3>
                    <p className="text-[11px] font-semibold text-[#8FA39B] mt-0.5">Dapat diperbarui secara mandiri oleh siswa</p>
                  </div>
                  <form
                    onSubmit={profilForm.handleSubmit(data => updateMutation.mutate(data))}
                    className="p-6 space-y-5"
                  >
                    {/* Email */}
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase flex items-center gap-1.5">
                        <EnvelopeIcon className="w-4 h-4 text-neutral-400" /> Alamat Email
                      </label>
                      <input
                        {...profilForm.register("email")}
                        type="email"
                        id="input-email"
                        placeholder="siswa@sekolah.sch.id"
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] focus:ring-2 focus:ring-[#3DB891]/25 transition-all placeholder-[#8FA39B]"
                      />
                      {profilForm.formState.errors.email && (
                        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                          <ExclamationTriangleIcon className="w-3.5 h-3.5" />{profilForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    {/* Telepon */}
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase flex items-center gap-1.5">
                        <PhoneIcon className="w-4 h-4 text-neutral-400" /> Nomor Telepon
                      </label>
                      <input
                        {...profilForm.register("telepon")}
                        type="tel"
                        id="input-telepon"
                        placeholder="08xxxxxxxxxx"
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] focus:ring-2 focus:ring-[#3DB891]/25 transition-all placeholder-[#8FA39B]"
                      />
                      {profilForm.formState.errors.telepon && (
                        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                          <ExclamationTriangleIcon className="w-3.5 h-3.5" />{profilForm.formState.errors.telepon.message}
                        </p>
                      )}
                    </div>

                    <button
                      id="btn-simpan-profil"
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#208C68] hover:bg-[#14503C] text-white text-xs font-bold rounded-xl transition-all shadow shadow-[#208C68]/10 disabled:opacity-60"
                    >
                      {updateMutation.isPending ? (
                        <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                      ) : <CheckCircleIcon className="w-4 h-4" />}
                      Simpan Perubahan
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ─── KEAMANAN TAB ─── */}
            {activeTab === "keamanan" && (
              <div className="max-w-lg">
                <div className="bg-white rounded-[20px] border border-[#D4DDD9] shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#EDF2F0] bg-[#F5F8F7]">
                    <h3 className="font-display font-bold text-neutral-950 text-sm">Ubah Password</h3>
                    <p className="text-[11px] font-semibold text-[#8FA39B] mt-0.5">Pastikan password baru minimal 8 karakter</p>
                  </div>
                  <form
                    onSubmit={passForm.handleSubmit(data => passMutation.mutate(data))}
                    className="p-6 space-y-5"
                  >
                    {/* Password Lama */}
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase">Password Lama</label>
                      <div className="relative">
                        <input
                          {...passForm.register("old_password")}
                          type={showOldPass ? "text" : "password"}
                          id="old-password"
                          className="w-full px-4 py-2.5 pr-10 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] focus:ring-2 focus:ring-[#3DB891]/25 transition-all"
                        />
                        <button type="button" onClick={() => setShowOldPass(!showOldPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                          {showOldPass ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                        </button>
                      </div>
                      {passForm.formState.errors.old_password && (
                        <p className="mt-1 text-xs text-red-500">{passForm.formState.errors.old_password.message}</p>
                      )}
                    </div>

                    {/* Password Baru */}
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase">Password Baru</label>
                      <div className="relative">
                        <input
                          {...passForm.register("new_password")}
                          type={showNewPass ? "text" : "password"}
                          id="new-password"
                          className="w-full px-4 py-2.5 pr-10 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] focus:ring-2 focus:ring-[#3DB891]/25 transition-all"
                        />
                        <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                          {showNewPass ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                        </button>
                      </div>
                      {passForm.formState.errors.new_password && (
                        <p className="mt-1 text-xs text-red-500">{passForm.formState.errors.new_password.message}</p>
                      )}
                    </div>

                    {/* Konfirmasi */}
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase">Konfirmasi Password Baru</label>
                      <div className="relative">
                        <input
                          {...passForm.register("confirm_password")}
                          type={showConfirmPass ? "text" : "password"}
                          id="confirm-password"
                          className="w-full px-4 py-2.5 pr-10 text-xs font-semibold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891] focus:ring-2 focus:ring-[#3DB891]/25 transition-all"
                        />
                        <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                          {showConfirmPass ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                        </button>
                      </div>
                      {passForm.formState.errors.confirm_password && (
                        <p className="mt-1 text-xs text-red-500">{passForm.formState.errors.confirm_password.message}</p>
                      )}
                    </div>

                    <div className="flex items-start gap-2.5 px-3.5 py-3 bg-[#FEF3C7] border border-[#FADBB8] rounded-xl">
                      <ExclamationTriangleIcon className="w-4 h-4 text-[#D97706] flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] font-semibold text-[#78350F] leading-normal">
                        Setelah mengubah password, Anda akan tetap masuk di sesi aktif ini, tetapi Anda perlu menggunakan password baru di portal masuk berikutnya.
                      </p>
                    </div>

                    <button
                      id="btn-ganti-password"
                      type="submit"
                      disabled={passMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#208C68] hover:bg-[#14503C] text-white text-xs font-bold rounded-xl transition-all shadow shadow-[#208C68]/10 disabled:opacity-60"
                    >
                      {passMutation.isPending ? (
                        <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                      ) : <LockClosedIcon className="w-4 h-4" />}
                      Ubah Password
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ─── RIWAYAT AKSES TAB ─── */}
            {activeTab === "riwayat" && (
              <div className="bg-white rounded-[20px] border border-[#D4DDD9] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#EDF2F0] bg-[#F5F8F7]">
                  <h3 className="font-display font-bold text-neutral-950 text-sm">Riwayat Akses Terakhir</h3>
                  <p className="text-[11px] font-semibold text-[#8FA39B] mt-0.5">Mencatat 10 aktivitas keamanan terakhir pada akun Anda</p>
                </div>
                <div className="divide-y divide-[#EDF2F0]">
                  {riwayatLoading ? (
                    [...Array(5)].map((_, i) => (
                      <div key={i} className="px-6 py-4 flex gap-4">
                        <div className="w-8 h-8 bg-[#EDF2F0] animate-pulse rounded-lg flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-[#EDF2F0] animate-pulse rounded w-1/3" />
                          <div className="h-3 bg-[#EDF2F0] animate-pulse rounded w-2/3" />
                        </div>
                      </div>
                    ))
                  ) : riwayat.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-[#8FA39B]">
                      <ClockOutline className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-xs font-semibold">Belum ada riwayat akses</p>
                    </div>
                  ) : (
                    riwayat.slice(0, 10).map((log: any, i: number) => {
                      const isSuccess = log.status === "success";

                      return (
                        <motion.div
                          key={log.id || i}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className="px-6 py-4 flex items-center gap-4 hover:bg-[#F0FAF6] transition-colors duration-120"
                        >
                          <div className={clsx(
                            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                            isSuccess ? "bg-[#E0F5EE] text-[#14503C]" : "bg-[#FEE2E2] text-[#DC2626]"
                          )}>
                            {isSuccess ? <CheckCircleIcon className="w-4 h-4" /> : <ExclamationTriangleIcon className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-neutral-800 capitalize">
                              {log.action?.replace(/_/g, " ") || "Aktivitas"}
                            </p>
                            <div className="flex flex-wrap gap-3 mt-1">
                              <span className="text-xs font-semibold text-[#8FA39B] flex items-center gap-1">
                                <ClockOutline className="w-3.5 h-3.5" />
                                {log.created_at ? format(new Date(log.created_at), "d MMM yyyy, HH:mm", { locale: localeId }) : "—"}
                              </span>
                              {log.ip_address && (
                                <span className="text-xs font-semibold text-[#8FA39B]">IP: {log.ip_address}</span>
                              )}
                            </div>
                          </div>
                          <ChevronRightIcon className="w-4 h-4 text-[#D4DDD9] flex-shrink-0" />
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </Layout>
    </>
  );
}
