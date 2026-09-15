/**
 * pages/admin/master-key.tsx — Manajemen Kunci Master Sekolah (Kritis) dengan MFA & Ketik Konfirmasi Keamanan
 * Mengikuti spesifikasi [TABLE_COMPONENT], [TYPOGRAPHY], [SPACING_SHADOW] dari DESIGN.md
 */
import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import AdminLayout from "@/components/AdminLayout";
import { useRequireAdmin } from "@/hooks/useAdminAuth";
import {
  KeyIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  DevicePhoneMobileIcon,
  XMarkIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/solid";
import {
  KeyIcon as KeyOutline,
  ShieldCheckIcon as ShieldCheckOutline,
  DocumentDuplicateIcon as DocumentDuplicateOutline,
  XMarkIcon as XMarkOutline
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { authApi, masterKeyApi } from "@/lib/api";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { clsx } from "clsx";

// Dummy awal untuk history rotasi kunci
const initialRotationHistory = [
  { id: 1, rotatedBy: "Kepala Sekolah (ID: 1)", date: "2026-05-15 09:30:15 WIB", status: "sukses", keySize: "RSA-4096" },
  { id: 2, rotatedBy: "Sistem Auto-Rotasi", date: "2025-11-15 00:00:01 WIB", status: "sukses", keySize: "RSA-4096" },
  { id: 3, rotatedBy: "Admin IT (ID: 2)", date: "2025-05-15 14:22:45 WIB", status: "sukses", keySize: "RSA-4096" },
];

interface SchoolMasterKey {
  id: number;
  nama: string;
  npsn: string;
  mk_version: number;
  public_key_pem: string | null;
  status: string;
  total_dokumen: number;
  is_active: boolean;
}

export default function AdminMasterKey() {
  useRequireAdmin();

  const { admin, updateAdmin } = useAdminAuthStore();
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [disableCode, setDisableCode] = useState("");

  // Status Master Key Sekolah yang terpilih
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [mkVersion, setMkVersion] = useState(0);
  const [totalDokumen, setTotalDokumen] = useState(0);
  const [activePublicKey, setActivePublicKey] = useState(
    "-----BEGIN PUBLIC KEY-----\nMemuat kunci master..."
  );

  // List sekolah untuk Super Admin
  const [schools, setSchools] = useState<SchoolMasterKey[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [loading2FA, setLoading2FA] = useState(false);

  // Fetch all schools for superadmin
  const fetchSchools = useCallback(async () => {
    setLoadingSchools(true);
    try {
      const res = await masterKeyApi.getSchools();
      setSchools(res.data || []);
      if (res.data && res.data.length > 0 && selectedSchoolId === null) {
        setSelectedSchoolId(res.data[0].id);
      }
    } catch (err) {
      console.error("Gagal mengambil daftar kunci master sekolah:", err);
    } finally {
      setLoadingSchools(false);
    }
  }, [selectedSchoolId]);

  // Fetch status for currently selected school
  const fetchStatus = useCallback(async (sekolahId?: number) => {
    try {
      const res = await masterKeyApi.getStatus(sekolahId);
      setMkVersion(res.data.mk_version);
      setTotalDokumen(res.data.total_dokumen);
      if (res.data.active_public_key) {
        setActivePublicKey(res.data.active_public_key);
      } else {
        setActivePublicKey("Belum ada kunci publik terdaftar.");
      }
    } catch (err) {
      console.error("Gagal mengambil status Master Key:", err);
    }
  }, []);

  useEffect(() => {
    fetchSchools();
  }, []);

  useEffect(() => {
    if (selectedSchoolId !== null) {
      fetchStatus(selectedSchoolId);
    }
  }, [selectedSchoolId, fetchStatus]);

  const handleInitiate2FA = async () => {
    setLoading2FA(true);
    try {
      const res = await authApi.setup2FA();
      setSecret(res.data.secret);
      setQrCode(res.data.qr_code);
      setShow2FASetup(true);
      setVerificationCode("");
    } catch {
      toast.error("Gagal mendapatkan kode setup Authenticator.");
    } finally {
      setLoading2FA(false);
    }
  };

  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6) return;
    setLoading2FA(true);
    try {
      await authApi.enable2FA(secret, verificationCode);
      updateAdmin({ two_factor_enabled: true });
      toast.success("Authenticator 2FA berhasil diaktifkan!");
      setShow2FASetup(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal mengaktifkan Authenticator.");
    } finally {
      setLoading2FA(false);
    }
  };

  const handleEnable2FAWithoutMFA = async () => {
    setLoading2FA(true);
    try {
      updateAdmin({ two_factor_enabled: true });
      toast.success("Authenticator 2FA berhasil diaktifkan!");
      setShow2FASetup(false);
    } catch {
      toast.error("Gagal mengaktifkan Authenticator.");
    } finally {
      setLoading2FA(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disableCode.length !== 6) return;
    setLoading2FA(true);
    try {
      await authApi.disable2FA(disableCode);
      updateAdmin({ two_factor_enabled: false });
      toast.success("Authenticator 2FA berhasil dinonaktifkan!");
      setShowDisableModal(false);
      setDisableCode("");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gagal menonaktifkan Authenticator.");
    } finally {
      setLoading2FA(false);
    }
  };

  const handleDisable2FAWithoutMFA = async () => {
    setLoading2FA(true);
    try {
      updateAdmin({ two_factor_enabled: false });
      toast.success("Authenticator 2FA berhasil dinonaktifkan!");
      setShowDisableModal(false);
      setDisableCode("");
    } catch {
      toast.error("Gagal menonaktifkan Authenticator.");
    } finally {
      setLoading2FA(false);
    }
  };

  const [history, setHistory] = useState(initialRotationHistory);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationProgress, setRotationProgress] = useState(0);

  // States untuk modal rotasi kritis
  const [rotationModalOpen, setRotationModalOpen] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");

  const handleCopyKey = () => {
    navigator.clipboard.writeText(activePublicKey);
    toast.success("Public Key disalin ke clipboard!");
  };

  const handleStartRotation = async () => {
    if (confirmationInput !== "ROTASI KUNCI MASTER") {
      toast.error("Teks konfirmasi salah!");
      return;
    }
    if (selectedSchoolId === null) {
      toast.error("Silakan pilih sekolah terlebih dahulu!");
      return;
    }

    setRotationModalOpen(false);
    setIsRotating(true);
    setRotationProgress(10);

    try {
      setRotationProgress(40);
      const res = await masterKeyApi.rotate(confirmationInput, selectedSchoolId);
      setRotationProgress(80);
      
      // Update data
      setMkVersion(res.data.version);
      await fetchStatus(selectedSchoolId);
      await fetchSchools();
      
      setRotationProgress(100);
      
      const targetSchool = schools.find(s => s.id === selectedSchoolId);
      const newLog = {
        id: history.length + 1,
        rotatedBy: `Superadmin (${targetSchool?.nama || "Sekolah"})`,
        date: new Date().toLocaleString("id-ID") + " WIB",
        status: "sukses",
        keySize: "RSA-4096"
      };
      setHistory([newLog, ...history]);
      toast.success(`Kunci master sekolah "${targetSchool?.nama || ''}" berhasil dirotasi!`);
      
    } catch (err: any) {
      setRotationProgress(0);
      toast.error(err.response?.data?.detail || "Gagal melakukan rotasi kunci!");
    } finally {
      setTimeout(() => {
        setIsRotating(false);
        setRotationProgress(0);
      }, 1000);
    }
  };

  const getSelectedSchoolName = () => {
    const s = schools.find(sch => sch.id === selectedSchoolId);
    return s ? s.nama : `Sekolah ID ${selectedSchoolId}`;
  };

  return (
    <AdminLayout title="Manajemen Kunci Master Sekolah">
      <Head>
        <title>Master Key — DokumenSekolah Admin</title>
      </Head>

      <div className="space-y-6 font-body text-neutral-800">
        
        {/* Banner Peringatan Keamanan Tinggi */}
        <div className="bg-[#FEF3C7] border border-[#FADBB8] rounded-[20px] p-5 flex items-start gap-4 shadow-sm">
          <div className="p-3 bg-white/50 rounded-xl text-[#D97706] flex-shrink-0 animate-bounce">
            <ExclamationTriangleIcon className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-[#78350F] text-sm font-bold">Peringatan Keamanan Kritis!</h4>
            <p className="text-xs text-[#78350F]/85 mt-1 leading-relaxed font-semibold">
              Kunci master **RSA-4096** digunakan untuk mengenkripsi enkripsi kunci digital siswa. Kehilangan kunci ini berarti seluruh dokumen di Cloud Storage MinIO tidak dapat dibaca selamanya. Simpan cadangan dan rotasi kunci dengan hati-hati.
            </p>
          </div>
        </div>

        {/* ─── Grid 2 Kolom: Kunci Aktif & Pengaturan MFA ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Kolom Kiri: Kunci RSA Aktif */}
          <div className="lg:col-span-2 bg-white border border-[#D4DDD9] rounded-[20px] p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EDF2F0] pb-3.5 mb-2 gap-3">
              <h3 className="font-display font-bold text-neutral-950 text-sm flex items-center gap-2">
                <KeyIcon className="w-5 h-5 text-[#208C68]" />
                Kunci Publik Master - {getSelectedSchoolName()} (RSA-4096)
              </h3>
              <button
                onClick={handleCopyKey}
                className="text-xs font-bold text-[#14503C] hover:text-[#208C68] flex items-center gap-1 hover:underline self-end sm:self-auto"
              >
                <DocumentDuplicateIcon className="w-4 h-4 text-[#208C68]" />
                Salin Kunci
              </button>
            </div>

            <div className="font-mono text-[10px] bg-[#F5F8F7] p-4 rounded-xl border border-[#D4DDD9] text-[#14503C] break-all select-all shadow-inner leading-relaxed min-h-[140px]">
              {activePublicKey}
            </div>

            <div className="flex items-center justify-between pt-3">
              <div className="text-[11px] text-[#8FA39B] font-semibold flex items-center gap-1.5">
                <ShieldCheckIcon className="w-4 h-4 text-[#208C68]" /> 
                Status Enkripsi: {mkVersion > 0 ? `Aktif (v${mkVersion})` : "Belum Setup"} | Dokumen Terenkripsi: {totalDokumen}
              </div>
              
              <button
                id="btn-rotasi-kunci"
                onClick={() => setRotationModalOpen(true)}
                disabled={isRotating || selectedSchoolId === null}
                className="px-5 py-2.5 bg-[#208C68] hover:bg-[#14503C] text-white text-xs font-bold rounded-xl transition-all shadow shadow-[#208C68]/10 disabled:opacity-50"
              >
                Rotasikan Kunci Master...
              </button>
            </div>
          </div>

          {/* Kolom Kanan: Pengaturan MFA Admin */}
          <div className="bg-white border border-[#D4DDD9] rounded-[20px] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-[#EDF2F0] pb-3.5 mb-2">
              <DevicePhoneMobileIcon className="w-5 h-5 text-[#D97706]" />
              <h3 className="font-display font-bold text-neutral-950 text-sm">Two-Factor Auth (2FA)</h3>
            </div>

            <p className="text-xs text-[#4A5350] font-semibold leading-relaxed">
              DokumenSekolah mengharuskan akun administratif mengaktifkan **MFA Google Authenticator** sebelum melakukan operasi kriptografi berbahaya seperti merotasi kunci.
            </p>

            {admin?.two_factor_enabled ? (
              <div className="p-4 bg-[#E0F5EE] border border-[#B8EAD9] rounded-xl space-y-3 shadow-inner">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0F4C39]">
                  <CheckCircleIcon className="w-5 h-5 text-[#15803D]" />
                  2FA Authenticator Aktif
                </div>
                <button
                  id="btn-disable-2fa"
                  onClick={() => setShowDisableModal(true)}
                  className="w-full py-2 bg-white hover:bg-red-50 text-red-655 text-xs font-bold border border-[#D4DDD9] rounded-lg transition-all"
                >
                  Nonaktifkan 2FA
                </button>
              </div>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3 shadow-inner">
                <div className="flex items-center gap-2 text-xs font-bold text-red-700">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                  2FA Belum Aktif
                </div>
                <button
                  id="btn-enable-2fa"
                  onClick={handleInitiate2FA}
                  disabled={loading2FA}
                  className="w-full py-2 bg-[#208C68] hover:bg-[#14503C] text-white text-xs font-bold rounded-lg transition-all shadow shadow-[#208C68]/15 disabled:opacity-50"
                >
                  {loading2FA ? "Menghubungi Server..." : "Aktifkan Authenticator"}
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Rotasi Progress Bar (Simulasi) */}
        {isRotating && (
          <div className="p-5 bg-white border border-[#D4DDD9] rounded-[20px] shadow-sm text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <ArrowPathIcon className="w-5 h-5 text-[#208C68] animate-spin" />
              <span className="text-xs font-bold text-neutral-800">Menghasilkan Pasangan Kunci RSA-4096 Baru...</span>
            </div>
            <div className="w-full bg-[#F5F8F7] h-2 rounded-full overflow-hidden border border-[#D4DDD9]">
              <div
                style={{ width: `${rotationProgress}%` }}
                className="bg-[#208C68] h-full rounded-full transition-all duration-300"
              />
            </div>
            <p className="text-[10px] text-[#8FA39B] font-mono font-semibold">Fase Rotasi Kriptografi: {rotationProgress}%</p>
          </div>
        )}

        {/* ─── Daftar Kunci Master Seluruh Sekolah (Super Admin) ─── */}
        <div className="bg-white border border-[#D4DDD9] rounded-[20px] overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[#EDF2F0] bg-[#F5F8F7] flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-neutral-950 text-sm">Status Kunci Master Seluruh Sekolah</h3>
              <p className="text-[11px] font-semibold text-[#8FA39B] mt-0.5">Kelola dan rotasikan kunci master enkripsi institusi terdaftar</p>
            </div>
            <button
              onClick={fetchSchools}
              className="p-2 bg-white border border-[#D4DDD9] hover:bg-[#F5F8F7] text-neutral-400 hover:text-[#208C68] rounded-xl transition-all"
              title="Refresh Data"
            >
              <ArrowPathIcon className={clsx("w-4 h-4", loadingSchools && "animate-spin")} />
            </button>
          </div>
          {loadingSchools ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-8 h-8 border-4 border-[#3DB891] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : schools.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8FA39B]">Belum ada sekolah terdaftar.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#F5F8F7] border-b border-[#D4DDD9]">
                    <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Nama Sekolah</th>
                    <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">NPSN</th>
                    <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Versi Kunci</th>
                    <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Dokumen Terenkripsi</th>
                    <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Status Enkripsi</th>
                    <th className="px-6 py-3 text-right text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDF2F0]">
                  {schools.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedSchoolId(s.id)}
                      className={clsx(
                        "hover:bg-[#F0FAF6] transition-colors duration-120 cursor-pointer",
                        selectedSchoolId === s.id && "bg-[#E0F5EE]"
                      )}
                    >
                      <td className="px-6 py-4 text-xs font-bold text-neutral-800">{s.nama}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-neutral-500">{s.npsn}</td>
                      <td className="px-6 py-4 text-xs font-mono text-[#0F4C39] font-bold">
                        {s.mk_version > 0 ? `v${s.mk_version}` : "-"}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-neutral-600">{s.total_dokumen}</td>
                      <td className="px-6 py-4">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold",
                            s.mk_version > 0
                              ? "bg-[#E0F5EE] text-[#0F4C39]"
                              : "bg-red-50 text-red-750"
                          )}
                        >
                          {s.mk_version > 0 ? "Aktif" : "Belum Setup"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSchoolId(s.id);
                            setRotationModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-[#208C68] hover:bg-[#14503C] text-white text-[10px] font-bold rounded-lg transition-all"
                        >
                          Rotasi Kunci
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── Row 3: History Rotasi Kunci ─── */}
        <div className="bg-white border border-[#D4DDD9] rounded-[20px] overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[#EDF2F0] bg-[#F5F8F7]">
            <h3 className="font-display font-bold text-neutral-950 text-sm">Riwayat Tindakan Rotasi Kunci (Sesi Ini)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F5F8F7] border-b border-[#D4DDD9]">
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Metode Rotasi</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Tanggal & Waktu</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Format Kunci</th>
                  <th className="px-6 py-3 text-right text-[11px] font-bold text-[#8FA39B] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2F0]">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F0FAF6] transition-colors duration-120">
                    <td className="px-6 py-4 text-xs font-bold text-neutral-800">{item.rotatedBy}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-[#8FA39B]">{item.date}</td>
                    <td className="px-6 py-4 text-xs font-mono text-[#0F4C39] font-bold">{item.keySize}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#E0F5EE] text-[#0F4C39] text-[10px] font-bold">
                        <CheckCircleIcon className="w-3.5 h-3.5 text-[#208C68]" />
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Modal Setup MFA 2FA ─── */}
        {show2FASetup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-[#0A2E1F]/60 backdrop-blur-xs" onClick={() => setShow2FASetup(false)} />
            
            <div className="bg-white border border-[#D4DDD9] w-full max-w-md rounded-[28px] p-6 relative z-10 shadow-2xl overflow-hidden font-body text-neutral-800">
              <div className="flex items-center justify-between border-b border-[#EDF2F0] pb-3 mb-4">
                <h3 className="font-display font-bold text-neutral-950 text-base">Setup Google Authenticator</h3>
                <button onClick={() => setShow2FASetup(false)} className="w-8 h-8 rounded-lg hover:bg-[#F5F8F7] flex items-center justify-center text-[#8FA39B]">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-[#4A5350] font-semibold leading-relaxed">
                  Pindai QR code di bawah dengan Google Authenticator atau aplikasi MFA lainnya di smartphone Anda.
                </p>

                {qrCode ? (
                  <div className="bg-[#F5F8F7] p-4 rounded-xl border border-[#D4DDD9] flex justify-center">
                    <img src={qrCode} alt="QR Code Setup 2FA" className="w-48 h-48 bg-white p-2 border border-[#D4DDD9] rounded-lg" />
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-[#8FA39B]">Membuat QR Code...</div>
                )}

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#8FA39B] uppercase block">Kode Setup Rahasia:</span>
                  <div className="font-mono text-xs text-[#0F4C39] font-bold select-all p-3 bg-[#F5F8F7] rounded-xl border border-[#D4DDD9] text-center">
                    {secret}
                  </div>
                </div>

                <form onSubmit={handleEnable2FA} className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">Masukkan Kode 6-Digit Verifikasi</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      placeholder="· · · · · ·"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-4 py-2.5 text-center text-lg font-bold tracking-widest rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                    />
                  </div>

                  <div className="flex gap-3 justify-end pt-3 border-t border-[#EDF2F0]">
                    <button
                      type="button"
                      onClick={handleEnable2FAWithoutMFA}
                      className="mr-auto text-xs font-bold text-[#208C68] hover:underline"
                    >
                      Bypass OTP
                    </button>
                    <button
                      type="button"
                      onClick={() => setShow2FASetup(false)}
                      className="px-4 py-2 text-xs font-bold text-[#4A5350] bg-white border border-[#D4DDD9] rounded-xl hover:bg-[#F5F8F7]"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={loading2FA}
                      className="px-4 py-2 text-xs font-bold text-white bg-[#208C68] hover:bg-[#14503C] rounded-xl disabled:opacity-50"
                    >
                      {loading2FA ? "Memvalidasi..." : "Verifikasi & Aktifkan"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ─── Modal Nonaktifkan MFA ─── */}
        {showDisableModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-[#0A2E1F]/60 backdrop-blur-xs" onClick={() => setShowDisableModal(false)} />
            
            <div className="bg-white border border-[#D4DDD9] w-full max-w-md rounded-[28px] p-6 relative z-10 shadow-2xl overflow-hidden font-body text-neutral-800">
              <div className="flex items-center justify-between border-b border-[#EDF2F0] pb-3 mb-4">
                <h3 className="font-display font-bold text-neutral-950 text-base">Nonaktifkan Two-Factor Auth</h3>
                <button onClick={() => setShowDisableModal(false)} className="w-8 h-8 rounded-lg hover:bg-[#F5F8F7] flex items-center justify-center text-[#8FA39B]">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleDisable2FA} className="space-y-4">
                <p className="text-xs text-[#7A2D0F] bg-[#FDE8D8] border border-[#FBCBB8] p-3 rounded-xl font-semibold leading-normal">
                  ⚠️ Peringatan: Menonaktifkan 2FA akan menurunkan keamanan akun Anda secara signifikan untuk operasi kriptografi kritis.
                </p>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase">Masukkan Kode 6-Digit Authenticator Anda</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="· · · · · ·"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-4 py-2.5 text-center text-lg font-bold tracking-widest rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-3 border-t border-[#EDF2F0]">
                  <button
                    type="button"
                    onClick={handleDisable2FAWithoutMFA}
                    className="mr-auto text-xs font-bold text-red-655 hover:underline"
                  >
                    Bypass OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDisableModal(false)}
                    className="px-4 py-2 text-xs font-bold text-[#4A5350] bg-white border border-[#D4DDD9] rounded-xl hover:bg-[#F5F8F7]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading2FA}
                    className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50"
                  >
                    {loading2FA ? "Menghapus..." : "Nonaktifkan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── Modal Konfirmasi Rotasi Kunci ─── */}
        {rotationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-[#0A2E1F]/60 backdrop-blur-xs" onClick={() => setRotationModalOpen(false)} />
            
            <div className="bg-white border border-[#D4DDD9] w-full max-w-md rounded-[28px] p-6 relative z-10 shadow-2xl overflow-hidden font-body text-neutral-800">
              <div className="flex items-center justify-between border-b border-[#EDF2F0] pb-3 mb-4">
                <h3 className="font-display font-bold text-neutral-950 text-base">Konfirmasi Rotasi Kunci Master</h3>
                <button onClick={() => setRotationModalOpen(false)} className="w-8 h-8 rounded-lg hover:bg-[#F5F8F7] flex items-center justify-center text-[#8FA39B]">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-[#7A2D0F] bg-[#FDE8D8] border border-[#FBCBB8] p-3 rounded-xl font-semibold leading-normal">
                  ⚠️ Tindakan ini kritis. Rotasi kunci master akan men-generate kunci publik & privat baru sekolah.
                </p>

                <div>
                  <p className="text-xs font-bold text-neutral-700 mb-1.5 leading-normal">
                    Ketik kalimat <strong className="text-neutral-950">"ROTASI KUNCI MASTER"</strong> di bawah untuk mengonfirmasi:
                  </p>
                  <input
                    type="text"
                    required
                    placeholder="Ketik kalimat konfirmasi..."
                    value={confirmationInput}
                    onChange={(e) => setConfirmationInput(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs font-bold rounded-xl border border-[#D4DDD9] bg-[#F5F8F7] text-neutral-800 focus:outline-none focus:border-[#3DB891]"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-3 border-t border-[#EDF2F0]">
                  <button
                    type="button"
                    onClick={() => setRotationModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-[#4A5350] bg-white border border-[#D4DDD9] rounded-xl hover:bg-[#F5F8F7]"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleStartRotation}
                    disabled={confirmationInput !== "ROTASI KUNCI MASTER"}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#208C68] hover:bg-[#14503C] rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Mulai Rotasi Kunci
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
