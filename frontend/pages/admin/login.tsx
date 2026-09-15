import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { 
  EyeIcon, 
  EyeSlashIcon, 
  ExclamationTriangleIcon, 
  ShieldCheckIcon, 
  DevicePhoneMobileIcon, 
  BuildingLibraryIcon,
  KeyIcon,
  AcademicCapIcon
} from "@heroicons/react/24/outline";
import { authApi } from "@/lib/api";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { useRedirectIfAdmin } from "@/hooks/useAdminAuth";
import toast from "react-hot-toast";

type RoleTab = "sekolah" | "dinas" | "superadmin";

export default function AdminLogin() {
  useRedirectIfAdmin();
  const router = useRouter();
  const adminLogin = useAdminAuthStore((state) => state.adminLogin);

  const [activeTab, setActiveTab] = useState<RoleTab>("sekolah");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const [requires2FA, setRequires2FA] = useState(false);

  useEffect(() => {
    if (router.query.error === "inactive") {
      setCustomError("Akun Anda dinonaktifkan atau tidak ditemukan. Silakan hubungi administrator.");
    }
  }, [router.query.error]);

  // --- Dynamic Content Config based on Active Tab ---
  const config = {
    sekolah: {
      leftLogo: <ShieldCheckIcon className="w-5 h-5 text-white" />,
      leftTitle: "DokumenSekolah",
      leftSubtitle: "Admin Portal",
      leftBadge1: "Dokumen Terenkripsi ✓",
      leftBadge2: "NeuralKeyGen 🔑",
      bgLeftIcon: "bg-[#14503C]",
      rightHeading: "Masuk ke Akun",
      rightSubheading: "Portal Otentikasi Admin & Operator DokumenSekolah",
      usernameLabel: "Username / NPSN",
      usernamePlaceholder: "Masukkan username Anda",
    },
    dinas: {
      leftLogo: <BuildingLibraryIcon className="w-5 h-5 text-white" />,
      leftTitle: "DMS Pendidikan",
      leftSubtitle: "Portal Dinas",
      leftBadge1: "Monitoring Sekolah 📈",
      leftBadge2: "Verifikasi 1-Klik ✓",
      bgLeftIcon: "bg-[#1A6B50]",
      rightHeading: "Login Dinas",
      rightSubheading: "Masuk untuk mengelola data sekolah di wilayah Anda",
      usernameLabel: "Email Resmi Dinas",
      usernamePlaceholder: "admin@dinas.id",
    },
    superadmin: {
      leftLogo: <KeyIcon className="w-5 h-5 text-white" />,
      leftTitle: "DMS Core",
      leftSubtitle: "Super Admin",
      leftBadge1: "Akses Root ⚡",
      leftBadge2: "Sistem Utama ⚙️",
      bgLeftIcon: "bg-neutral-800",
      rightHeading: "Sistem Utama",
      rightSubheading: "Portal Root untuk Manajemen Sistem & Master Key",
      usernameLabel: "Username Admin Utama",
      usernamePlaceholder: "superadmin",
    }
  };

  const currentConfig = config[activeTab];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomError(null);
    if (!username || !password) {
      toast.error("Kolom identitas dan password wajib diisi!");
      return;
    }
    if (requires2FA && !otp) {
      toast.error("Kode Authenticator wajib diisi!");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.loginAdmin(username, password, requires2FA ? otp : undefined);
      const { access_token, refresh_token, admin } = res.data;
      
      // Auto-resolve role based on backend response, tab selection is just UX
      adminLogin({ access_token, refresh_token }, admin);
      toast.success(`Selamat datang, ${admin.nama_lengkap || admin.username}!`);
      
      if (admin.role === "dinas_pendidikan") {
        router.push("/dinas/dashboard");
      } else {
        router.push("/admin/dashboard");
      }
    } catch (err: any) {
      const detail: string = err.response?.data?.detail || "";

      if (detail.toLowerCase().includes("authenticator") || detail.toLowerCase().includes("2fa")) {
        setRequires2FA(true);
        toast.error("Masukkan kode Authenticator dari aplikasi Anda.");
      } else {
        setCustomError(detail || "Login gagal. Periksa kembali kredensial Anda.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Login Portal — DokumenSekolah</title>
        <meta name="description" content="Portal Otentikasi Terpadu DMS" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen w-full bg-[#0A2E1F] relative overflow-hidden flex font-body">
        
        {/* ── BUBBLE DEKORATIF ── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute rounded-full bg-[#7AD4B8] opacity-[0.08] w-[80px] h-[80px] top-[8%] left-[60%]" />
          <div className="absolute rounded-full bg-[#3DB891] opacity-[0.12] w-[50px] h-[50px] top-[15%] left-[75%]" />
          <div className="absolute rounded-full bg-[#7AD4B8] opacity-[0.06] w-[120px] h-[120px] top-[45%] left-[5%]" />
          <div className="absolute rounded-full bg-[#3DB891] opacity-[0.10] w-[60px] h-[60px] bottom-[20%] left-[55%]" />
          <div className="absolute rounded-full bg-[#B8EAD9] opacity-[0.08] w-[90px] h-[90px] bottom-[10%] right-[5%]" />
          <div className="absolute rounded-full bg-[#7AD4B8] opacity-[0.15] w-[40px] h-[40px] top-[30%] right-[2%]" />
        </div>

        {/* ── PANEL KIRI (Desktop) ── */}
        <div className="hidden md:flex md:w-1/2 relative items-center justify-center h-screen z-10 transition-colors duration-500">
          <div 
            className="bg-white rounded-3xl shadow-xl p-10 flex flex-col justify-between absolute left-8 top-1/2 -translate-y-1/2 w-[88%] max-w-[480px] min-h-[560px] transition-all duration-300"
            style={{
              borderRadius: "32px 60% 55% 32px / 32px 55% 60% 32px"
            }}
          >
            {/* Logo Dinamis */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${currentConfig.bgLeftIcon} rounded-xl flex items-center justify-center shadow transition-colors duration-300`}>
                {currentConfig.leftLogo}
              </div>
              <div>
                <p className="font-display font-bold text-[#14503C] text-sm leading-tight transition-all duration-300">
                  {currentConfig.leftTitle}
                </p>
                <p className="text-[10px] text-[#208C68] font-bold tracking-widest uppercase mt-0.5 transition-all duration-300">
                  {currentConfig.leftSubtitle}
                </p>
              </div>
            </div>

            {/* Area Ilustrasi */}
            <div className="relative w-full h-[280px] my-6 flex items-center justify-center">
              <div className="absolute w-[240px] h-[240px] bg-[#E0F5EE] rounded-full filter blur-xl opacity-85 animate-pulse-dot" />
              
              <div className="relative z-10">
                <Image src="/Logo DS.png" alt="DokumenSekolah" width={180} height={180} priority className="rounded-3xl drop-shadow-2xl shadow-[#3DB891]/20" />
              </div>

              {/* Floating Element 1 */}
              <div className={`absolute top-4 right-2 ${currentConfig.bgLeftIcon} text-white px-3.5 py-1.5 rounded-xl font-display text-[11px] font-semibold shadow-lg border border-white/10 animate-float transition-colors duration-300`}>
                {currentConfig.leftBadge1}
              </div>

              {/* Floating Element 2 */}
              <div className="absolute bottom-4 left-2 bg-white text-[#14503C] px-3.5 py-1.5 rounded-xl font-display text-[11px] font-semibold shadow border border-[#B8EAD9] transition-all duration-300">
                {currentConfig.leftBadge2}
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
          <div className="w-full max-w-[380px] flex flex-col h-full justify-between py-8">
            
            {/* Mobile Header */}
            <div className="flex md:hidden items-center gap-3 mb-8">
              <div className="w-9 h-9 bg-[#3DB891] rounded-xl flex items-center justify-center shadow">
                {currentConfig.leftLogo}
              </div>
              <div>
                <p className="font-display font-bold text-white text-sm leading-tight">{currentConfig.leftTitle}</p>
                <p className="text-[9px] text-[#3DB891] font-bold tracking-widest uppercase">{currentConfig.leftSubtitle}</p>
              </div>
            </div>

            <div>
              {/* Heading */}
              <div className="mb-6 h-20">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h1 className="text-3xl font-display font-extrabold text-white tracking-tight mb-2">
                      {requires2FA ? "Verifikasi 2FA" : currentConfig.rightHeading}
                    </h1>
                    <p className="text-white/55 text-sm">
                      {requires2FA
                        ? "Masukkan kode 6-digit dari aplikasi Authenticator Anda"
                        : currentConfig.rightSubheading}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* ── Tabs Pilihan Role ── */}
                {!requires2FA && (
                  <div className="bg-white/5 p-1 rounded-xl flex gap-1 mb-6 border border-white/10">
                    <button
                      type="button"
                      onClick={() => { setActiveTab("sekolah"); setUsername(""); setPassword(""); setCustomError(null); }}
                      className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                        activeTab === "sekolah" ? "bg-[#3DB891] text-[#0A2E1F] shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <AcademicCapIcon className="w-4 h-4 mb-1" />
                      SEKOLAH
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActiveTab("dinas"); setUsername(""); setPassword(""); setCustomError(null); }}
                      className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                        activeTab === "dinas" ? "bg-[#3DB891] text-[#0A2E1F] shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <BuildingLibraryIcon className="w-4 h-4 mb-1" />
                      DINAS
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActiveTab("superadmin"); setUsername(""); setPassword(""); setCustomError(null); }}
                      className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                        activeTab === "superadmin" ? "bg-[#3DB891] text-[#0A2E1F] shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <KeyIcon className="w-4 h-4 mb-1" />
                      ROOT
                    </button>
                  </div>
                )}

                {/* Username Input */}
                <AnimatePresence>
                  {!requires2FA && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <label className="block text-sm font-medium text-white/70 mb-1.5 transition-all">
                        {currentConfig.usernameLabel}
                      </label>
                      <input
                        id="auth-username"
                        type={activeTab === "dinas" ? "email" : "text"}
                        placeholder={currentConfig.usernamePlaceholder}
                        autoComplete="username"
                        required={!requires2FA}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`dms-input-dark ${customError ? "dms-input-error" : ""}`}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Password Input */}
                <AnimatePresence>
                  {!requires2FA && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="mt-4"
                    >
                      <label className="block text-sm font-medium text-white/70 mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="auth-password"
                          type={showPass ? "text" : "password"}
                          placeholder="Masukkan password Anda"
                          autoComplete="current-password"
                          required={!requires2FA}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={`dms-input-dark pr-12 ${customError ? "dms-input-error" : ""}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-1"
                        >
                          {showPass ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 2FA OTP Input */}
                <AnimatePresence>
                  {requires2FA && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <label className="block text-sm font-medium text-white/70 mb-1.5 flex items-center gap-2">
                        <DevicePhoneMobileIcon className="w-4 h-4 text-[#3DB891]" />
                        Kode Authenticator
                      </label>
                      <input
                        id="auth-otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        autoFocus
                        required={requires2FA}
                        placeholder="· · · · · ·"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        className="dms-input-dark py-4 text-2xl tracking-[0.6em] text-center font-bold"
                      />
                      <p className="text-xs text-white/40 text-center mt-2.5">
                        Buka aplikasi Authenticator Anda dan masukkan kode 6-digit
                      </p>

                      <button
                        type="button"
                        onClick={() => { setRequires2FA(false); setOtp(""); }}
                        className="mt-4 w-full text-xs font-semibold text-[#7AD4B8] hover:text-[#3DB891] hover:underline text-center transition-all"
                      >
                        ← Kembali ke Login
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error Notification */}
                {customError && (
                  <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl flex items-start gap-2.5">
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-300 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-200 font-semibold leading-normal">{customError}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  id="auth-login-btn"
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full bg-[#3DB891] hover:bg-[#208C68] hover:text-white hover:shadow-lg hover:shadow-[#3DB891]/20 active:translate-y-0 active:shadow-none hover:-translate-y-0.5 text-[#0A2E1F] font-display font-extrabold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {requires2FA ? "Verifikasi OTP" : "Masuk ke Portal →"}
                    </>
                  )}
                </button>
                
              </form>
            </div>

            {/* Footer Form */}
            <div className="mt-8 pt-6 border-t border-white/5 text-center space-y-1.5">
              <div className="text-[11px] text-white/30 flex justify-center gap-3">
                <Link href="#" className="hover:text-white/60 transition-colors">Terms of Services</Link>
                <span>·</span>
                <Link href="#" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
              </div>
              <p className="text-[11px] text-white/25">
                Ada masalah? Hubungi <a href="mailto:support@dms-sekolah.id" className="text-[#7AD4B8] font-semibold hover:underline">Support</a>
              </p>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
