/**
 * pages/404.tsx — Custom 404 Not Found Page for DS Education
 * Mengikuti spesifikasi [TYPOGRAPHY], [COLORS], [SPACING_SHADOW] dari DESIGN.md
 */
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import {
  HomeIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  FolderIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  AcademicCapIcon,
  UserGroupIcon
} from "@heroicons/react/24/solid";

export default function Custom404() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>404 — Halaman Tidak Ditemukan | DS Education</title>
        <meta
          name="description"
          content="Halaman yang Anda cari tidak dapat ditemukan. Kembali ke portal utama DS Education."
        />
      </Head>

      <div className="min-h-screen bg-[#072217] text-white flex flex-col justify-between relative overflow-hidden font-body select-none">
        
        {/* Ambient Background Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#3DB891]/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-[#208C68]/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-10 right-10 w-80 h-80 bg-[#14503C]/30 rounded-full blur-[100px] pointer-events-none" />

        {/* Top Header Branding */}
        <header className="relative z-10 p-6 lg:p-8 max-w-7xl mx-auto w-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-lg group-hover:scale-105 transition-transform duration-200">
              <Image src="/Logo DS.png" alt="DS Education" width={36} height={36} className="rounded-md" priority />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display font-extrabold text-white text-base tracking-tight">DS Education</span>
              <span className="text-[10px] font-bold text-[#7AD4B8] uppercase tracking-widest mt-0.5">DokumenSekolah System</span>
            </div>
          </Link>

          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white transition-all shadow-sm backdrop-blur-md"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Kembali
          </button>
        </header>

        {/* Main Content Area */}
        <main className="relative z-10 flex-1 flex items-center justify-center p-6 text-center">
          <div className="max-w-2xl mx-auto space-y-8">
            
            {/* 404 Large Glowing Badge */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, type: "spring" }}
              className="relative inline-block"
            >
              <div className="text-8xl lg:text-9xl font-display font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-[#B8EAD9] to-[#208C68] drop-shadow-2xl">
                404
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#14503C] border border-[#3DB891]/40 text-[#7AD4B8] text-[11px] font-bold uppercase tracking-widest shadow-lg backdrop-blur-md flex items-center gap-1.5 whitespace-nowrap">
                <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-400" />
                Halaman Tidak Ditemukan
              </div>
            </motion.div>

            {/* Title & Description */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="space-y-3"
            >
              <h1 className="text-2xl lg:text-4xl font-display font-extrabold text-white tracking-tight leading-tight">
                Waduh! Halaman Yang Anda Cari Tidak Tersedia
              </h1>
              <p className="text-sm lg:text-base font-medium text-[#B8EAD9]/80 max-w-lg mx-auto leading-relaxed">
                Halaman mungkin telah dipindahkan, dihapus, atau Anda salah memasukkan alamat URL. Silakan kembali ke portal utama.
              </p>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2"
            >
              <Link
                href="/"
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[#208C68] hover:bg-[#14503C] text-white text-xs font-bold rounded-2xl transition-all shadow-lg shadow-[#208C68]/30 border border-[#3DB891]/40 group"
              >
                <HomeIcon className="w-4 h-4 text-[#7AD4B8]" />
                Kembali ke Beranda
              </Link>
              
              <Link
                href="/dashboard"
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-bold rounded-2xl transition-all backdrop-blur-md group"
              >
                <span>Dashboard Portal Siswa</span>
                <ArrowRightIcon className="w-4 h-4 text-white/70 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>

            {/* Quick Links Navigation Box */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="pt-6 border-t border-white/10"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">Akses Cepat Portal</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                <Link
                  href="/login"
                  className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#208C68]/30 flex items-center justify-center mb-2 text-[#7AD4B8]">
                    <AcademicCapIcon className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-[#7AD4B8] transition-colors">Portal Siswa</h4>
                  <p className="text-[11px] text-white/50 mt-0.5">Login alumni & siswa aktif</p>
                </Link>

                <Link
                  href="/admin/login"
                  className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center mb-2 text-blue-400">
                    <UserGroupIcon className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">Admin Sekolah</h4>
                  <p className="text-[11px] text-white/50 mt-0.5">Kelola arsip & ijazah</p>
                </Link>

                <Link
                  href="/dokumen"
                  className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-2 text-emerald-400">
                    <FolderIcon className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">Dokumen Saya</h4>
                  <p className="text-[11px] text-white/50 mt-0.5">Lihat berkas terenkripsi</p>
                </Link>
              </div>
            </motion.div>

          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 py-6 text-center border-t border-white/5 bg-black/20">
          <p className="text-xs text-white/40 font-medium">
            © 2026 DS Education · DokumenSekolah System · All Rights Reserved
          </p>
        </footer>

      </div>
    </>
  );
}
