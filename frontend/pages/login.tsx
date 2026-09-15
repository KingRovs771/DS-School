/**
 * pages/login.tsx — Halaman login portal siswa
 * Mengikuti spesifikasi [LOGIN_PAGE] dari DESIGN.md
 */
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { EyeIcon, EyeSlashIcon, ExclamationTriangleIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";

import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useRedirectIfAuth } from "@/hooks/useAuth";

const loginSchema = z.object({
  nis: z.string().min(4, "NIS minimal 4 karakter").max(20, "NIS terlalu panjang"),
  password: z.string().min(1, "Password wajib diisi"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  useRedirectIfAuth();
  const router = useRouter();
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  useEffect(() => {
    if (router.query.error === "inactive") {
      setCustomError("Akun Anda dinonaktifkan atau tidak ditemukan. Silakan hubungi administrator.");
    }
  }, [router.query.error]);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setCustomError(null);
    try {
      const res = await authApi.loginSiswa(data.nis, data.password);
      const { access_token, refresh_token, siswa } = res.data;
      login({ access_token, refresh_token }, siswa);
      toast.success(`Selamat datang, ${siswa.nama_lengkap}! 🎉`);
      router.push("/dashboard");
    } catch (err: any) {
      const message = err?.response?.data?.detail || "NIS atau password salah";
      setCustomError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail || !resetEmail.includes("@")) {
      toast.error("Masukkan alamat email yang valid");
      return;
    }
    setResetLoading(true);
    try {
      await authApi.resetPassword(resetEmail);
      toast.success("Instruksi reset password telah dikirim ke email Anda!");
      setShowResetForm(false);
      setResetEmail("");
    } catch {
      toast.error("Gagal mengirim email reset. Coba lagi.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Login Siswa — DokumenSekolah</title>
        <meta name="description" content="Portal akses dokumen akademik siswa sekolah yang aman dan terenkripsi." />
      </Head>

      <div className="min-h-screen w-full bg-[#0A2E1F] relative overflow-hidden flex font-body">
        
        {/* ── BUBBLE DEKORATIF (Di luar card, di background) ── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute rounded-full bg-[#7AD4B8] opacity-[0.08] w-[80px] h-[80px] top-[8%] left-[60%]" />
          <div className="absolute rounded-full bg-[#3DB891] opacity-[0.12] w-[50px] h-[50px] top-[15%] left-[75%]" />
          <div className="absolute rounded-full bg-[#7AD4B8] opacity-[0.06] w-[120px] h-[120px] top-[45%] left-[5%]" />
          <div className="absolute rounded-full bg-[#3DB891] opacity-[0.10] w-[60px] h-[60px] bottom-[20%] left-[55%]" />
          <div className="absolute rounded-full bg-[#B8EAD9] opacity-[0.08] w-[90px] h-[90px] bottom-[10%] right-[5%]" />
          <div className="absolute rounded-full bg-[#7AD4B8] opacity-[0.15] w-[40px] h-[40px] top-[30%] right-[2%]" />
        </div>

        {/* ── PANEL KIRI (Desktop) ── */}
        <div className="hidden md:flex md:w-1/2 relative items-center justify-center h-screen z-10">
          <div 
            className="bg-white rounded-3xl shadow-xl p-10 flex flex-col justify-between absolute left-8 top-1/2 -translate-y-1/2 w-[88%] max-w-[480px] min-h-[560px]"
            style={{
              borderRadius: "32px 60% 55% 32px / 32px 55% 60% 32px"
            }}
          >
            {/* Logo Sekolah */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#14503C] rounded-xl flex items-center justify-center shadow">
                <ShieldCheckIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-display font-bold text-[#14503C] text-sm leading-tight">DokumenSekolah</p>
                <p className="text-[10px] text-[#208C68] font-bold tracking-widest uppercase mt-0.5">Portal Akademik</p>
              </div>
            </div>

            {/* Area Ilustrasi */}
            <div className="relative w-full h-[280px] my-6 flex items-center justify-center">
              {/* Blob Background */}
              <div className="absolute w-[240px] h-[240px] bg-[#E0F5EE] rounded-full filter blur-xl opacity-85 animate-pulse-dot" />
              
              {/* Logo DS Ilustrasi */}
              <div className="relative z-10">
                <Image src="/Logo DS.png" alt="DokumenSekolah" width={180} height={180} priority className="rounded-3xl drop-shadow-2xl shadow-[#3DB891]/20" />
              </div>

              {/* Floating Element 1 */}
              <div className="absolute top-4 right-2 bg-[#14503C] text-white px-3.5 py-1.5 rounded-xl font-display text-[11px] font-semibold shadow-lg border border-white/10 animate-float">
                Dokumen Terenkripsi ✓
              </div>

              {/* Floating Element 2 */}
              <div className="absolute bottom-4 left-2 bg-white text-[#14503C] px-3.5 py-1.5 rounded-xl font-display text-[11px] font-semibold shadow border border-[#B8EAD9]">
                NeuralKeyGen 🔑
              </div>
            </div>

            {/* Footer Card */}
            <div className="border-t border-neutral-100 pt-5 text-left">
              <p className="text-[11px] text-[#8FA39B] font-medium">
                © 2026 DokumenSekolah · Powered by NeuralKeyGen
              </p>
            </div>
          </div>
        </div>

        {/* ── PANEL KANAN (Form Login) ── */}
        <div className="w-full md:w-1/2 flex items-center justify-center p-6 sm:p-12 z-10 min-h-screen">
          <div className="w-full max-w-[360px] flex flex-col h-full justify-between py-8">
            
            {/* Mobile Header */}
            <div className="flex md:hidden items-center gap-3 mb-8">
              <div className="w-9 h-9 bg-[#3DB891] rounded-xl flex items-center justify-center shadow">
                <ShieldCheckIcon className="w-5 h-5 text-[#0A2E1F]" />
              </div>
              <div>
                <p className="font-display font-bold text-white text-sm leading-tight">DokumenSekolah</p>
                <p className="text-[9px] text-[#3DB891] font-bold tracking-widest uppercase">Portal Siswa</p>
              </div>
            </div>

            {!showResetForm ? (
              <div>
                {/* Heading */}
                <div className="mb-8">
                  <h1 className="text-3xl font-display font-extrabold text-white tracking-tight mb-2">
                    Masuk ke Akun
                  </h1>
                  <p className="text-white/55 text-sm">
                    Akses dokumen akademik Anda dengan aman
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* NIS Input */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Nomor Induk Siswa (NIS)
                    </label>
                    <input
                      {...register("nis")}
                      id="nis"
                      type="text"
                      placeholder="Masukkan NIS Anda"
                      autoComplete="username"
                      className={`dms-input-dark ${errors.nis || customError ? "dms-input-error" : ""}`}
                    />
                    {errors.nis && (
                      <p className="mt-1.5 text-xs text-red-300 flex items-center gap-1.5 font-medium">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-300" />
                        {errors.nis.message}
                      </p>
                    )}
                  </div>

                  {/* Password Input */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        {...register("password")}
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Masukkan password Anda"
                        autoComplete="current-password"
                        className={`dms-input-dark pr-12 ${errors.password || customError ? "dms-input-error" : ""}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-1"
                      >
                        {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1.5 text-xs text-red-300 flex items-center gap-1.5 font-medium">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-300" />
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  {/* Info default password */}
                  <div className="flex items-start gap-2.5 px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl">
                    <ExclamationTriangleIcon className="w-4 h-4 text-[#7AD4B8] mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-[#E0F5EE] leading-normal font-medium">
                      Password default: tanggal lahir format <strong>YYYY-MM-DD</strong> (contoh: 2008-03-15)
                    </p>
                  </div>

                  {/* Error Notification */}
                  {customError && (
                    <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl flex items-start gap-2.5">
                      <ExclamationTriangleIcon className="w-4 h-4 text-red-300 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-200 font-semibold leading-normal">{customError}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    id="btn-login"
                    type="submit"
                    disabled={isLoading}
                    className="h-12 w-full bg-[#3DB891] hover:bg-[#208C68] hover:text-white hover:shadow-lg hover:shadow-[#3DB891]/20 active:translate-y-0 active:shadow-none hover:-translate-y-0.5 text-[#0A2E1F] font-display font-extrabold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Memproses...
                      </>
                    ) : "Masuk ke Portal →"}
                  </button>

                  {/* Lupa Password */}
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setShowResetForm(true)}
                      className="text-xs font-semibold text-[#7AD4B8] hover:text-[#3DB891] hover:underline transition-all duration-120"
                    >
                      Lupa password? Klik di sini
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Reset Password Form */
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="mb-8">
                  <h1 className="text-3xl font-display font-extrabold text-white tracking-tight mb-2">
                    Reset Password
                  </h1>
                  <p className="text-white/55 text-sm">
                    Masukkan email yang terdaftar untuk menerima tautan reset
                  </p>
                </div>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      placeholder="siswa@sekolah.sch.id"
                      className="h-12 w-full bg-white/8 border border-white/12 rounded-xl px-4 text-white placeholder-white/30 focus:outline-none focus:border-[#3DB891] focus:bg-white/12 transition-all duration-120 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleResetPassword}
                    disabled={resetLoading}
                    className="h-12 w-full bg-[#3DB891] text-[#0A2E1F] hover:bg-[#208C68] hover:text-white font-display font-extrabold rounded-xl transition-all disabled:opacity-60 text-sm flex items-center justify-center"
                  >
                    {resetLoading ? "Mengirim..." : "Kirim Tautan Reset"}
                  </button>
                  <button
                    onClick={() => setShowResetForm(false)}
                    className="w-full py-2.5 text-white/40 hover:text-white text-xs font-semibold transition-colors"
                  >
                    ← Kembali ke Login
                  </button>
                </div>
              </motion.div>
            )}

            {/* Footer Form */}
            <div className="mt-12 pt-6 border-t border-white/5 text-center space-y-1.5">
              <div className="text-[11px] text-white/30 flex justify-center gap-3">
                <Link href="#" className="hover:text-white/60 transition-colors">Terms of Services</Link>
                <span>·</span>
                <Link href="#" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
              </div>
              <p className="text-[11px] text-white/25">
                Ada masalah? Hubungi TU sekolah atau <a href="mailto:support@dms-sekolah.id" className="text-[#7AD4B8] font-semibold hover:underline">Support</a>
              </p>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
