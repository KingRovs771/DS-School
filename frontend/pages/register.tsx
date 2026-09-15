import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { toast } from "react-hot-toast";
import { ShieldCheckIcon, ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { sekolahApi } from "@/lib/api";

export default function Register() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // Wilayah State
  const [provinces, setProvinces] = useState<{code: string, name: string}[]>([]);
  const [regencies, setRegencies] = useState<{code: string, name: string}[]>([]);
  const [selectedProv, setSelectedProv] = useState("");
  const [selectedRegency, setSelectedRegency] = useState("");

  const [formData, setFormData] = useState({
    nama_sekolah: "",
    kode_npsn: "",
    alamat: "",
    kabupaten_id: "",
    nama_pic: "",
    email_pic: "",
    telepon_pic: "",
  });

  useEffect(() => {
    fetchProvinces();
  }, []);

  const fetchProvinces = async () => {
    try {
      const res = await fetch("/api/wilayah/provinces");
      const data = await res.json();
      setProvinces(data.data);
    } catch (error) {
      toast.error("Gagal memuat daftar provinsi");
    }
  };

  const handleProvChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provCode = e.target.value;
    setSelectedProv(provCode);
    setSelectedRegency("");
    setRegencies([]);
    if (provCode) {
      try {
        const res = await fetch(`/api/wilayah/regencies/${provCode}`);
        const data = await res.json();
        setRegencies(data.data);
      } catch (error) {
        toast.error("Gagal memuat daftar kabupaten");
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomError(null);
    
    if (!selectedProv || !selectedRegency) {
      toast.error("Silakan pilih Provinsi dan Kabupaten/Kota");
      return;
    }

    setLoading(true);

    try {
      // 1. Sync Kabupaten to local DB
      const provName = provinces.find(p => p.code === selectedProv)?.name || "";
      const regencyName = regencies.find(r => r.code === selectedRegency)?.name || "";
      
      const syncRes = await sekolahApi.syncKabupaten({
        provinsi: provName,
        nama: regencyName,
        kode_kemendagri: selectedRegency
      });
      
      const kabupatenId = syncRes.data.id;

      // 2. Submit Register with Local Kabupaten ID
      const payload = {
        ...formData,
        kabupaten_id: kabupatenId
      };
      await sekolahApi.register(payload);
      
      setSuccess(true);
      toast.success("Pendaftaran berhasil diajukan!");
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Terjadi kesalahan saat mendaftar. Periksa kembali form Anda.";
      setCustomError(detail);
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Pendaftaran Sekolah — DokumenSekolah</title>
        <meta name="description" content="Portal Pendaftaran Sekolah Baru" />
      </Head>

      <div className="min-h-screen w-full bg-[#0A2E1F] relative overflow-hidden flex font-body">
        
        {/* ── BUBBLE DEKORATIF ── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute rounded-full bg-[#7AD4B8] opacity-[0.08] w-[80px] h-[80px] top-[8%] left-[60%]" />
          <div className="absolute rounded-full bg-[#3DB891] opacity-[0.12] w-[50px] h-[50px] top-[15%] left-[75%]" />
          <div className="absolute rounded-full bg-[#7AD4B8] opacity-[0.06] w-[120px] h-[120px] top-[45%] left-[5%]" />
          <div className="absolute rounded-full bg-[#3DB891] opacity-[0.10] w-[60px] h-[60px] bottom-[20%] left-[55%]" />
          <div className="absolute rounded-full bg-[#B8EAD9] opacity-[0.08] w-[90px] h-[90px] bottom-[10%] right-[5%]" />
        </div>

        {/* ── PANEL KIRI (Desktop) ── */}
        <div className="hidden md:flex md:w-1/2 relative items-center justify-center h-screen z-10">
          <div 
            className="bg-white rounded-3xl shadow-xl p-10 flex flex-col justify-between absolute left-8 top-1/2 -translate-y-1/2 w-[88%] max-w-[480px] min-h-[560px]"
            style={{
              borderRadius: "32px 60% 55% 32px / 32px 55% 60% 32px"
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#14503C] rounded-xl flex items-center justify-center shadow">
                <ShieldCheckIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-display font-bold text-[#14503C] text-sm leading-tight">DokumenSekolah</p>
                <p className="text-[10px] text-[#208C68] font-bold tracking-widest uppercase mt-0.5">Sekolah Baru</p>
              </div>
            </div>

            <div className="relative w-full h-[280px] my-6 flex items-center justify-center">
              <div className="absolute w-[240px] h-[240px] bg-[#E0F5EE] rounded-full filter blur-xl opacity-85 animate-pulse-dot" />
              
              <div className="relative z-10">
                <Image src="/Logo DS.png" alt="DokumenSekolah" width={180} height={180} priority className="rounded-3xl drop-shadow-2xl shadow-[#3DB891]/20" />
              </div>

              <div className="absolute top-4 right-2 bg-[#14503C] text-white px-3.5 py-1.5 rounded-xl font-display text-[11px] font-semibold shadow-lg border border-white/10 animate-float">
                Verifikasi Dinas ✓
              </div>

              <div className="absolute bottom-4 left-2 bg-white text-[#14503C] px-3.5 py-1.5 rounded-xl font-display text-[11px] font-semibold shadow border border-[#B8EAD9]">
                Bergabung Cepat 🚀
              </div>
            </div>

            <div className="border-t border-neutral-100 pt-5 text-left">
              <p className="text-[11px] text-[#8FA39B] font-medium">
                © 2026 DokumenSekolah · Powered by NeuralKeyGen
              </p>
            </div>
          </div>
        </div>

        {/* ── PANEL KANAN (Form Registrasi) ── */}
        <div className="w-full md:w-1/2 flex items-center justify-center p-6 sm:p-12 z-10 min-h-screen overflow-y-auto custom-scrollbar">
          <div className="w-full max-w-[420px] flex flex-col py-8 my-auto">
            
            <div className="flex md:hidden items-center gap-3 mb-8">
              <div className="w-9 h-9 bg-[#3DB891] rounded-xl flex items-center justify-center shadow">
                <ShieldCheckIcon className="w-5 h-5 text-[#0A2E1F]" />
              </div>
              <div>
                <p className="font-display font-bold text-white text-sm leading-tight">DokumenSekolah</p>
                <p className="text-[9px] text-[#3DB891] font-bold tracking-widest uppercase">Pendaftaran Baru</p>
              </div>
            </div>

            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-display font-extrabold text-white tracking-tight mb-2">
                  Daftarkan Sekolah
                </h1>
                <p className="text-white/55 text-sm">
                  Bergabunglah dengan DokumenSekolah. Data Anda akan diverifikasi oleh Dinas Pendidikan setempat.
                </p>
              </div>

              {success ? (
                <div className="bg-[#14503C]/40 border border-[#208C68]/50 rounded-2xl p-6 text-center backdrop-blur-sm">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-[#1A6B50] mb-4">
                    <CheckCircleIcon className="h-8 w-8 text-[#3DB891]" />
                  </div>
                  <h3 className="text-lg font-display font-bold text-white mb-2">Pendaftaran Terkirim</h3>
                  <p className="text-sm text-white/70 mb-6">
                    Pendaftaran sekolah Anda telah diterima dengan status <strong className="text-[#3DB891]">Pending</strong>. Silakan tunggu persetujuan dari Dinas Pendidikan. Akun Admin akan otomatis dibuat setelah disetujui.
                  </p>
                  <Link href="/" className="inline-block w-full py-3.5 border border-[#3DB891] rounded-xl shadow-sm text-sm font-bold text-[#3DB891] hover:bg-[#3DB891] hover:text-[#0A2E1F] transition-all">
                    Kembali ke Beranda
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Nama Sekolah */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-white/70 mb-1.5">
                        Nama Sekolah
                      </label>
                      <input
                        name="nama_sekolah"
                        type="text"
                        required
                        value={formData.nama_sekolah}
                        onChange={handleChange}
                        placeholder="Contoh: SMA Negeri 1 Maju"
                        className="dms-input-dark"
                      />
                    </div>

                    {/* NPSN */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-white/70 mb-1.5">
                        NPSN
                      </label>
                      <input
                        name="kode_npsn"
                        type="text"
                        required
                        value={formData.kode_npsn}
                        onChange={handleChange}
                        placeholder="8 Digit NPSN"
                        className="dms-input-dark"
                      />
                    </div>

                    {/* Provinsi */}
                    <div>
                      <label className="block text-xs font-semibold text-white/70 mb-1.5">
                        Provinsi
                      </label>
                      <select
                        required
                        value={selectedProv}
                        onChange={handleProvChange}
                        className="dms-input-dark appearance-none bg-no-repeat"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                          backgroundPosition: 'right 1rem center',
                          backgroundSize: '1.25rem'
                        }}
                      >
                        <option value="" disabled className="text-black bg-white">-- Pilih Provinsi --</option>
                        {provinces.map((prov) => (
                          <option key={prov.code} value={prov.code} className="text-black bg-white">
                            {prov.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Kabupaten */}
                    <div>
                      <label className="block text-xs font-semibold text-white/70 mb-1.5">
                        Kabupaten / Kota
                      </label>
                      <select
                        required
                        value={selectedRegency}
                        onChange={(e) => setSelectedRegency(e.target.value)}
                        disabled={!selectedProv || regencies.length === 0}
                        className="dms-input-dark appearance-none bg-no-repeat disabled:opacity-50"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                          backgroundPosition: 'right 1rem center',
                          backgroundSize: '1.25rem'
                        }}
                      >
                        <option value="" disabled className="text-black bg-white">-- Pilih Kabupaten --</option>
                        {regencies.map((reg) => (
                          <option key={reg.code} value={reg.code} className="text-black bg-white">
                            {reg.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Alamat */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-white/70 mb-1.5">
                        Alamat Lengkap
                      </label>
                      <textarea
                        name="alamat"
                        rows={2}
                        required
                        value={formData.alamat}
                        onChange={handleChange}
                        placeholder="Alamat sekolah..."
                        className="dms-input-dark py-3 min-h-[80px] resize-none"
                      />
                    </div>

                    <div className="sm:col-span-2 mt-2">
                      <hr className="border-white/10" />
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-4 mb-1">
                        Informasi Penanggung Jawab (PIC)
                      </p>
                    </div>

                    {/* PIC Name */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-white/70 mb-1.5">
                        Nama Lengkap PIC
                      </label>
                      <input
                        name="nama_pic"
                        type="text"
                        required
                        value={formData.nama_pic}
                        onChange={handleChange}
                        placeholder="Nama penanggung jawab"
                        className="dms-input-dark"
                      />
                    </div>

                    {/* PIC Email */}
                    <div>
                      <label className="block text-xs font-semibold text-white/70 mb-1.5">
                        Email Aktif
                      </label>
                      <input
                        name="email_pic"
                        type="email"
                        required
                        value={formData.email_pic}
                        onChange={handleChange}
                        placeholder="email@sekolah.sch.id"
                        className="dms-input-dark"
                      />
                    </div>

                    {/* PIC Phone */}
                    <div>
                      <label className="block text-xs font-semibold text-white/70 mb-1.5">
                        No. Telepon / WhatsApp
                      </label>
                      <input
                        name="telepon_pic"
                        type="text"
                        required
                        value={formData.telepon_pic}
                        onChange={handleChange}
                        placeholder="08123456789"
                        className="dms-input-dark"
                      />
                    </div>

                  </div>
                  
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#3DB891] hover:bg-[#349E7C] text-[#0A2E1F] font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-[#3DB891]/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-[#0A2E1F]/30 border-t-[#0A2E1F] rounded-full animate-spin" />
                      ) : (
                        "Kirim Pendaftaran"
                      )}
                    </button>
                    <p className="text-center text-xs text-white/50 mt-4">
                      Sudah mendaftar atau punya akun? <Link href="/login" className="text-[#3DB891] hover:underline font-semibold">Masuk di sini</Link>
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        .dms-input-dark {
          width: 100%;
          padding: 0.75rem 1rem;
          background-color: rgba(20, 80, 60, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          font-size: 0.875rem;
          color: white;
          outline: none;
          transition: all 0.2s;
        }
        .dms-input-dark:focus {
          border-color: #3DB891;
          box-shadow: 0 0 0 2px rgba(61, 184, 145, 0.2);
          background-color: rgba(20, 80, 60, 0.6);
        }
        .dms-input-dark::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
      `}</style>
    </>
  );
}
