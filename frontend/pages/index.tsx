/**
 * pages/index.tsx - Halaman Utama DokumenSekolah
 */
import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ShieldCheckIcon,
  ArrowUpTrayIcon,
  UsersIcon,
  ChartBarIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  QrCodeIcon,
  LockClosedIcon,
} from "@heroicons/react/24/solid";
import { DocumentTextIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";

const fitur = [
  {
    icon: ShieldCheckIcon,
    title: "Enkripsi Berlapis",
    desc: "Setiap berkas diamankan dengan kunci unik berbasis NeuralKeyGen + AES-256-GCM. Tidak ada satu pun kunci tersimpan di database.",
    bg: "bg-[#EDF7F3]",
    border: "border-[#C0E4D4]",
    iconBg: "bg-[#208C68]",
  },
  {
    icon: ArrowUpTrayIcon,
    title: "Upload & Kelola",
    desc: "Admin sekolah dapat mengunggah ijazah, rapor, transkrip, dan SKNR langsung dari dashboard - per siswa maupun massal via Excel.",
    bg: "bg-[#EEF3FF]",
    border: "border-[#C5D3F5]",
    iconBg: "bg-[#4361EE]",
  },
  {
    icon: DocumentArrowDownIcon,
    title: "Unduh dengan Watermark",
    desc: "Setiap unduhan otomatis menyematkan nama, NIS, dan tanggal pengambilan sebagai watermark di PDF - aman dan bisa dilacak.",
    bg: "bg-[#FFF8EC]",
    border: "border-[#F5DAAB]",
    iconBg: "bg-[#D97706]",
  },
  {
    icon: QrCodeIcon,
    title: "Verifikasi QR Code",
    desc: "Pihak ketiga seperti HRD atau instansi bisa memindai QR pada dokumen untuk memverifikasi keaslian tanpa perlu login.",
    bg: "bg-[#F3EEFF]",
    border: "border-[#D4BBFA]",
    iconBg: "bg-[#7C3AED]",
  },
  {
    icon: UsersIcon,
    title: "Manajemen Siswa",
    desc: "Data siswa tersinkron dengan SINDAS. Admin dapat menambah, mengubah, dan mengelola profil siswa sesuai kebutuhan sekolah.",
    bg: "bg-[#FFF0F0]",
    border: "border-[#F5C5C5]",
    iconBg: "bg-[#DC2626]",
  },
  {
    icon: ChartBarIcon,
    title: "Audit Trail Lengkap",
    desc: "Setiap aktivitas tercatat otomatis - siapa yang mengunduh, kapan, dari IP mana. Transparansi penuh tanpa celah.",
    bg: "bg-[#EDFAF5]",
    border: "border-[#B5E8D5]",
    iconBg: "bg-[#059669]",
  },
];

const langkah = [
  { no: "01", label: "Admin unggah dokumen ke portal", sub: "PDF dienkripsi otomatis sebelum tersimpan di server" },
  { no: "02", label: "Siswa login & akses dokumen", sub: "Masuk pakai NIS - tidak perlu datang ke sekolah" },
  { no: "03", label: "Unduh dengan watermark resmi", sub: "Berkas siap diserahkan ke perusahaan atau instansi" },
  { no: "04", label: "Pihak ketiga verifikasi via QR", sub: "Scan QR - validasi keaslian dokumen dalam hitungan detik" },
];

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>DokumenSekolah - Arsip Digital Akademik yang Aman</title>
        <meta
          name="description"
          content="Platform arsip digital untuk sekolah: simpan, kelola, dan akses ijazah, rapor, transkrip nilai secara terenkripsi. Alumni bisa unduh kapan saja tanpa harus ke sekolah."
        />


      </Head>

      <div className="min-h-screen bg-white text-[#1F2421] font-body antialiased">

        {/* Navbar */}
        <nav className="fixed top-0 z-50 w-full border-b border-[#E8EEEB] bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/Logo DS.png" alt="DokumenSekolah" width={36} height={36} className="rounded-lg" priority />
              <div className="flex flex-col leading-none">
                <span className="text-[13px] font-extrabold text-[#0D3B2A] tracking-tight">DokumenSekolah</span>
                <span className="text-[9px] text-[#208C68] font-bold uppercase tracking-widest">Arsip Digital</span>
              </div>
            </Link>
            <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-[#4A5350]">
              <a href="#fitur" className="hover:text-[#14503C] transition-colors">Fitur</a>
              <a href="#cara-kerja" className="hover:text-[#14503C] transition-colors">Cara Kerja</a>
              <a href="#keamanan" className="hover:text-[#14503C] transition-colors">Keamanan</a>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/register" className="hidden sm:block text-xs font-semibold text-[#4A5350] hover:text-[#14503C] px-3 py-2 rounded-lg hover:bg-[#F0FAF6] transition-all">
                Daftar Sekolah
              </Link>
              <Link href="/login" className="hidden sm:block text-xs font-semibold text-[#4A5350] hover:text-[#14503C] px-3 py-2 rounded-lg hover:bg-[#F0FAF6] transition-all">
                Portal Siswa
              </Link>
              <Link href="/admin/login" className="text-xs font-bold text-white bg-[#14503C] hover:bg-[#0F3D29] px-4 py-2 rounded-xl transition-all shadow-sm">
                Masuk Admin
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative pt-28 pb-20 px-6 overflow-hidden">
          {/* Latar belakang disederhanakan tanpa blur-[80px] berat untuk performa scroll */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-[#F5F8F7] to-[#EEF3FF]/30" />
          <div className="relative mx-auto max-w-5xl">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-[#EDF7F3] border border-[#C0E4D4] text-[#0F4C39] text-xs font-bold">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3DB891] animate-pulse" />
                  Sistem aktif - tersedia untuk sekolah di Indonesia
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#0D0F0E] leading-[1.12] mb-5">
                  Arsip Akademik Siswa
                  <span className="block mt-1 bg-gradient-to-r from-[#14503C] to-[#208C68] bg-clip-text text-transparent">
                    Aman, Digital, Mudah Diakses
                  </span>
                </h1>
                <p className="text-[#4A5350] text-base font-medium leading-relaxed mb-7 max-w-lg">
                  Alumni tidak perlu lagi datang ke sekolah untuk mengambil ijazah atau transkrip.
                  Semua dokumen tersimpan terenkripsi dan bisa diunduh kapan saja, dari mana saja.
                </p>
                <div className="flex flex-wrap gap-2 mb-8 justify-center lg:justify-start">
                  {["Enkripsi AES-256-GCM", "Watermark Otomatis", "Verifikasi QR Code", "Terintegrasi SINDAS"].map((t) => (
                    <span key={t} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F8F7] border border-[#D4DDD9] text-xs font-semibold text-[#4A5350]">
                      <CheckCircleIcon className="h-3.5 w-3.5 text-[#208C68]" />
                      {t}
                    </span>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
                  <Link href="/register"
                    className="flex items-center gap-2 px-7 py-3.5 rounded-xl border-2 border-[#14503C] text-[#14503C] hover:bg-[#14503C] hover:text-white font-bold text-sm transition-all hover:-translate-y-[1px]">
                    Daftar Sekolah <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                  <Link href="/login"
                    className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#14503C] hover:bg-[#0F3D29] text-white font-bold text-sm shadow-lg shadow-[#14503C]/20 transition-all hover:-translate-y-[1px]">
                    Portal Siswa / Alumni
                  </Link>
                  <Link href="/admin/login"
                    className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-[#D4DDD9] bg-white hover:border-[#208C68] hover:bg-[#F0FAF6] text-[#1F2421] font-bold text-sm transition-all hover:-translate-y-[1px] shadow-sm">
                    Masuk Admin
                  </Link>
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="relative w-56 h-56 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-[#EDF7F3] to-[#D4EFEA] border-2 border-[#B8E0D2] shadow-2xl shadow-[#208C68]/15" />
                  <Image src="/Logo DS.png" alt="DokumenSekolah" width={130} height={130} className="relative z-10" />
                </div>
                <div className="mt-4 text-center">
                  <span className="px-4 py-1.5 rounded-full bg-[#0D3B2A] text-white text-[10px] font-bold tracking-widest uppercase">DokumenSekolah v1.0</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="bg-[#0D3B2A] py-10 px-6">
          <div className="mx-auto max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { angka: "100%", label: "Dokumen Terenkripsi" },
              { angka: "< 5 mnt", label: "Waktu Dapatkan Dokumen" },
              { angka: "0", label: "Kunci Tersimpan di DB" },
              { angka: "7 Thn", label: "Retensi Arsip" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-extrabold text-white mb-1">{s.angka}</div>
                <div className="text-xs text-[#8FD3B8] font-semibold">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Fitur */}
        <section id="fitur" className="py-24 px-6 bg-[#F9FBFA]">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-extrabold text-[#0D0F0E] mb-3">Apa yang bisa dilakukan?</h2>
              <p className="text-[#4A5350] text-base font-medium max-w-xl mx-auto">
                Satu platform untuk mengelola semua dokumen akademik sekolah - dari upload hingga verifikasi.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {fitur.map((f, i) => (
                <motion.div key={f.title}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -4 }}
                  className={"rounded-2xl border p-6 hover:shadow-md transition-shadow duration-300 " + f.bg + " " + f.border}>
                  <div className={"inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4 " + f.iconBg}>
                    <f.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-[#0D0F0E] mb-2">{f.title}</h3>
                  <p className="text-xs text-[#4A5350] leading-relaxed font-medium">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Cara Kerja */}
        <section id="cara-kerja" className="py-24 px-6 bg-white">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-extrabold text-[#0D0F0E] mb-3">Cara kerjanya sederhana</h2>
              <p className="text-[#4A5350] font-medium">Empat langkah - dari upload hingga verifikasi dokumen.</p>
            </div>
            <div className="space-y-5">
              {langkah.map((l, i) => (
                <motion.div key={l.no}
                  initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-5 p-5 rounded-2xl bg-[#F9FBFA] border border-[#E8EEEB] hover:border-[#C0E4D4] hover:bg-[#F0FAF6] transition-colors duration-300">
                  <div className="flex-shrink-0 h-12 w-12 rounded-2xl bg-[#14503C] text-white flex items-center justify-center font-extrabold text-sm shadow-md">
                    {l.no}
                  </div>
                  <div>
                    <div className="font-bold text-[#0D0F0E] text-sm mb-0.5">{l.label}</div>
                    <div className="text-xs text-[#6B7A75] font-medium">{l.sub}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Keamanan */}
        <section id="keamanan" className="py-24 px-6 bg-[#F9FBFA] border-t border-[#E8EEEB]">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex-shrink-0">
                <div className="w-36 h-36 rounded-3xl bg-[#EDF7F3] border-2 border-[#C0E4D4] flex items-center justify-center shadow-xl shadow-[#208C68]/10">
                  <LockClosedIcon className="h-16 w-16 text-[#14503C]" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-extrabold text-[#0D0F0E] mb-4">Keamanan bukan tambahan - ini intinya</h2>
                <p className="text-[#4A5350] font-medium leading-relaxed mb-6">
                  Dibangun di atas prinsip zero-knowledge storage - server tidak pernah mengetahui isi dokumen Anda.
                  Kunci enkripsi bersifat unik per-siswa, digenerate oleh model NeuralKeyGen dan tidak tersimpan di mana pun.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {["AES-256-GCM untuk enkripsi file", "HKDF-SHA256 untuk derivasi kunci",
                    "RSA-4096 Master Key per sekolah", "Argon2id untuk hash password",
                    "HMAC-SHA256 untuk QR Code signing", "Audit log immutable, tidak bisa dihapus"].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-xs font-semibold text-[#2D5C4A]">
                        <CheckCircleIcon className="h-4 w-4 text-[#208C68] flex-shrink-0" />
                        {item}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-6 bg-[#0D3B2A]">
          <div className="mx-auto max-w-2xl text-center">
            <Image src="/Logo DS.png" alt="DokumenSekolah" width={56} height={56} className="mx-auto mb-5 rounded-2xl opacity-90" />
            <h2 className="text-3xl font-extrabold text-white mb-4">Siap digitalkan arsip sekolah Anda?</h2>
            <p className="text-[#8FD3B8] font-medium mb-8">
              Masuk ke panel admin untuk mulai mengunggah dokumen, atau akses portal siswa untuk mengambil berkas Anda.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Link href="/register"
                className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white hover:bg-[#F0FAF6] text-[#14503C] font-bold text-sm transition-all shadow-md hover:-translate-y-[1px]">
                Daftar Sekolah Baru <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link href="/admin/login"
                className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-[#3DB891]/40 text-[#8FD3B8] hover:border-[#3DB891] hover:text-white font-bold text-sm transition-all">
                Masuk Admin
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#E8EEEB] py-10 bg-white">
          <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/Logo DS.png" alt="DokumenSekolah" width={28} height={28} className="rounded-md" />
              <span className="font-extrabold text-[#0D3B2A] text-sm">DokumenSekolah</span>
            </Link>
            <p className="text-[#8FA39B] text-xs font-medium text-center">
              2026 DokumenSekolah - Arsip Akademik Digital - Enkripsi NeuralKeyGen AES-256-GCM
            </p>
            <div className="flex gap-5 text-xs font-semibold text-[#6B7A75]">
              <Link href="/register" className="hover:text-[#14503C] transition-colors">Daftar</Link>
              <Link href="/login" className="hover:text-[#14503C] transition-colors">Siswa</Link>
              <Link href="/admin/login" className="hover:text-[#14503C] transition-colors">Admin</Link>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
};

export default Home;