import { useState, useEffect, Fragment } from "react";
import Head from "next/head";
import { toast } from "react-hot-toast";
import { Dialog, Transition } from "@headlessui/react";
import { dinasApi } from "@/lib/api";
import AdminLayout from "@/components/AdminLayout";
import { useRequireAdmin } from "@/hooks/useAdminAuth";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  BuildingOffice2Icon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  IdentificationIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  KeyIcon,
  XMarkIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

type StatusFilter = "pending" | "approved" | "rejected" | "";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Menunggu", cls: "bg-yellow-100 text-yellow-800 border border-yellow-300" },
  approved: { label: "Disetujui", cls: "bg-green-100 text-green-800 border border-green-300" },
  rejected: { label: "Ditolak", cls: "bg-red-100 text-red-800 border border-red-300" },
};

export default function PendaftaranSekolah() {
  const { isAdminAuthenticated, mounted } = useRequireAdmin();
  const [registrasi, setRegistrasi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");

  // Modal states
  const [activeReg, setActiveReg] = useState<any>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [credentials, setCredentials] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRegistrasi = async (filter: StatusFilter) => {
    if (!isAdminAuthenticated) return;
    try {
      setLoading(true);
      const res = await dinasApi.getRegistrasi(filter);
      setRegistrasi(res.data);
    } catch (error: any) {
      const msg = error.response?.data?.detail || "Gagal memuat data pendaftaran";
      toast.error(msg);
      setRegistrasi([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchRegistrasi(statusFilter);
    }
  }, [statusFilter, isAdminAuthenticated]);

  const handleApproveConfirm = async () => {
    if (!activeReg) return;
    try {
      setActionLoading(true);
      const res = await dinasApi.approveRegistrasi(activeReg.id);
      setCredentials(res.data.admin_credential);
      setShowApproveModal(false);
      setShowSuccessModal(true);
      toast.success("Pendaftaran disetujui!");
      fetchRegistrasi(statusFilter);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Gagal menyetujui pendaftaran");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!activeReg) return;
    try {
      setActionLoading(true);
      await dinasApi.rejectRegistrasi(activeReg.id);
      setShowRejectModal(false);
      toast.success("Pendaftaran ditolak");
      fetchRegistrasi(statusFilter);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Gagal menolak pendaftaran");
    } finally {
      setActionLoading(false);
    }
  };

  const copyCredentials = () => {
    if (!credentials) return;
    const text = `Detail Akun Sekolah Baru:\nNama Sekolah: ${activeReg?.nama_sekolah}\nUsername: ${credentials.username}\nPassword: ${credentials.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Kredensial berhasil disalin!");
    setTimeout(() => setCopied(false), 2000);
  };

  const tabFilters: { label: string; value: StatusFilter; icon: any }[] = [
    { label: "Menunggu", value: "pending", icon: ClockIcon },
    { label: "Disetujui", value: "approved", icon: CheckCircleIcon },
    { label: "Ditolak", value: "rejected", icon: XCircleIcon },
    { label: "Semua", value: "", icon: BuildingOffice2Icon },
  ];

  if (!mounted || !isAdminAuthenticated) return null;

  return (
    <AdminLayout>
      <Head>
        <title>Pendaftaran Sekolah - DMS Education</title>
        <meta
          name="description"
          content="Kelola pendaftaran sekolah baru di wilayah Dinas Pendidikan."
        />
      </Head>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pendaftaran Sekolah</h1>
            <p className="mt-1 text-sm text-gray-500">
              Daftar permohonan sekolah di wilayah Anda yang meminta akses ke sistem DMS.
            </p>
          </div>
          <button
            onClick={() => fetchRegistrasi(statusFilter)}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Filter */}
      <div className="flex space-x-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {tabFilters.map((tab) => {
          const Icon = tab.icon;
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                isActive
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Memuat data pendaftaran...</p>
          </div>
        ) : registrasi.length === 0 ? (
          <div className="p-12 text-center">
            <BuildingOffice2Icon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {statusFilter === "pending"
                ? "Tidak ada pendaftaran sekolah yang menunggu persetujuan."
                : statusFilter === "approved"
                ? "Belum ada pendaftaran yang disetujui."
                : statusFilter === "rejected"
                ? "Belum ada pendaftaran yang ditolak."
                : "Belum ada data pendaftaran sekolah."}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Sekolah dapat mendaftar melalui halaman publik <strong>/register</strong>.
            </p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-gray-100">
            {registrasi.map((reg) => {
              const badge = STATUS_BADGE[reg.status] ?? { label: reg.status, cls: "bg-gray-100 text-gray-700" };
              return (
                <li key={reg.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    {/* School Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <BuildingOffice2Icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <h3 className="text-base font-semibold text-gray-900 truncate">
                          {reg.nama_sekolah}
                        </h3>
                        <span className={`inline-flex text-xs font-medium px-2.5 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className="ml-8 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <IdentificationIcon className="w-4 h-4 text-gray-400" />
                          <span>NPSN: <strong>{reg.kode_npsn}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPinIcon className="w-4 h-4 text-gray-400" />
                          <span className="truncate">{reg.alamat}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400 text-xs font-medium">PIC:</span>
                          <span>{reg.nama_pic}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <PhoneIcon className="w-4 h-4 text-gray-400" />
                          <span>{reg.telepon_pic}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                          <a
                            href={`mailto:${reg.email_pic}`}
                            className="text-blue-600 hover:underline"
                          >
                            {reg.email_pic}
                          </a>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ClockIcon className="w-4 h-4 text-gray-400" />
                          <span>
                            Daftar:{" "}
                            {new Date(reg.tanggal_daftar).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        {reg.tanggal_diproses && (
                          <div className="flex items-center gap-1.5">
                            <CheckCircleIcon className="w-4 h-4 text-gray-400" />
                            <span>
                              Diproses:{" "}
                              {new Date(reg.tanggal_diproses).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions (only for pending) */}
                    {reg.status === "pending" && (
                      <div className="flex flex-col gap-2 flex-shrink-0 pt-1">
                        <button
                          id={`btn-approve-${reg.id}`}
                          onClick={() => {
                            setActiveReg(reg);
                            setShowApproveModal(true);
                          }}
                          className="inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 active:bg-green-800 transition-colors"
                        >
                          <CheckCircleIcon className="w-4 h-4 mr-1.5" />
                          Terima
                        </button>
                        <button
                          id={`btn-reject-${reg.id}`}
                          onClick={() => {
                            setActiveReg(reg);
                            setShowRejectModal(true);
                          }}
                          className="inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 active:bg-red-800 transition-colors"
                        >
                          <XCircleIcon className="w-4 h-4 mr-1.5" />
                          Tolak
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Info footer */}
      <p className="mt-4 text-xs text-gray-400">
        Menampilkan {registrasi.length} pendaftaran
        {statusFilter ? ` dengan status "${STATUS_BADGE[statusFilter]?.label ?? statusFilter}"` : " (semua status)"}.
        Data sekolah yang disetujui akan otomatis muncul di daftar sekolah binaan Anda.
      </p>

      {/* MODAL 1: CONFIRM APPROVE */}
      <Transition show={showApproveModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowApproveModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-start gap-4">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 sm:mx-0 sm:h-10 sm:w-10">
                      <ExclamationTriangleIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                        Setujui Pendaftaran
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Apakah Anda yakin ingin menyetujui pendaftaran dari{" "}
                          <strong className="text-gray-950">{activeReg?.nama_sekolah}</strong>?
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          Akun Administrator (TU) sekolah default akan otomatis dibuat oleh sistem. Tindakan ini tidak dapat dibatalkan.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                      onClick={() => setShowApproveModal(false)}
                      disabled={actionLoading}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none disabled:opacity-50"
                      onClick={handleApproveConfirm}
                      disabled={actionLoading}
                    >
                      {actionLoading ? "Memproses..." : "Ya, Setujui"}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
      
      {/* MODAL 2: CONFIRM REJECT */}
      <Transition show={showRejectModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowRejectModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-start gap-4">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-50 sm:mx-0 sm:h-10 sm:w-10">
                      <ExclamationTriangleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                        Tolak Pendaftaran
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Apakah Anda yakin ingin menolak pendaftaran dari{" "}
                          <strong className="text-gray-950">{activeReg?.nama_sekolah}</strong>?
                        </p>
                        <p className="text-xs text-red-500 mt-2">
                          Permohonan ini akan ditandai ditolak dan sekolah tidak akan dimasukkan ke dalam sistem.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                      onClick={() => setShowRejectModal(false)}
                      disabled={actionLoading}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none disabled:opacity-50"
                      onClick={handleRejectConfirm}
                      disabled={actionLoading}
                    >
                      {actionLoading ? "Memproses..." : "Ya, Tolak"}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* MODAL 3: CREDENTIALS SUCCESS DISPLAY */}
      <Transition show={showSuccessModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {}}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-2xl transition-all">
                  <div className="text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                      <KeyIcon className="h-8 w-8 text-green-600" aria-hidden="true" />
                    </div>
                    <Dialog.Title as="h3" className="mt-4 text-xl font-bold leading-6 text-gray-900">
                      Sekolah Berhasil Disetujui!
                    </Dialog.Title>
                    <p className="text-sm text-gray-500 mt-2">
                      Akun administrator default untuk <strong className="text-gray-900">{activeReg?.nama_sekolah}</strong> telah siap digunakan.
                    </p>
                  </div>

                  {/* Credentials Display Box */}
                  <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-bl-lg">
                      Admin Credential
                    </div>
                    <div className="space-y-3 font-mono text-sm">
                      <div className="flex items-center justify-between py-1.5 border-b border-dashed border-slate-200">
                        <span className="text-gray-400">Username:</span>
                        <span className="text-gray-950 font-bold select-all">{credentials?.username}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-gray-400">Password:</span>
                        <span className="text-gray-950 font-bold select-all">{credentials?.password}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 bg-yellow-50 border border-yellow-100 rounded-lg p-3 flex gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-800 leading-relaxed">
                      <strong>PENTING:</strong> Catat atau salin kredensial ini sekarang. Demi alasan keamanan, password ini didekripsi sekali dan tidak dapat ditampilkan kembali setelah dialog ini ditutup.
                    </p>
                  </div>

                  {/* Footer Action Buttons */}
                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={copyCredentials}
                      className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors focus:outline-none"
                    >
                      {copied ? (
                        <>
                          <CheckIcon className="w-4 h-4 text-green-600" />
                          Tersalin!
                        </>
                      ) : (
                        <>
                          <ClipboardDocumentIcon className="w-4 h-4 text-slate-500" />
                          Salin Kredensial
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="flex-1 inline-flex justify-center items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors focus:outline-none"
                      onClick={() => {
                        setShowSuccessModal(false);
                        setCredentials(null);
                        setActiveReg(null);
                      }}
                    >
                      Selesai
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </AdminLayout>
  );
}
