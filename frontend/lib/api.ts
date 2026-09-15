/**
 * lib/api.ts — Axios instance dengan interceptor JWT & error handling terpusat
 */
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor: tambahkan Authorization header dari localStorage sesuai rute admin/siswa
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const isAdminRoute = config.url?.includes("/admin") || config.url?.includes("/dinas") || config.url?.includes("/statistik") || config.url?.includes("/audit-log") || config.url?.includes("/sindas") || config.url?.includes("/categories") || config.url?.includes("/tahun-ajaran");
      const token = isAdminRoute
        ? (localStorage.getItem("admin_access_token") || localStorage.getItem("access_token"))
        : (localStorage.getItem("access_token") || localStorage.getItem("admin_access_token"));
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);


// Response interceptor: handle 401, refresh token logic untuk siswa dan admin
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const isAdminRoute = original.url?.includes("/admin") || original.url?.includes("/dinas") || original.url?.includes("/statistik") || original.url?.includes("/audit-log") || original.url?.includes("/sindas") || original.url?.includes("/categories") || original.url?.includes("/tahun-ajaran");
        const refreshKey = isAdminRoute ? "admin_refresh_token" : "refresh_token";
        const accessKey = isAdminRoute ? "admin_access_token" : "access_token";
        const refreshToken = localStorage.getItem(refreshKey);
        
        if (refreshToken) {
          const res = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const newToken = res.data.access_token;
          localStorage.setItem(accessKey, newToken);
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
      } catch {
        // Refresh gagal: clear storage & redirect
        if (typeof window !== "undefined") {
          const isAdminRoute = original.url?.includes("/admin") || original.url?.includes("/dinas") || original.url?.includes("/statistik") || original.url?.includes("/audit-log");
          if (isAdminRoute) {
            localStorage.removeItem("admin_access_token");
            localStorage.removeItem("admin_refresh_token");
            window.location.href = "/admin/login";
          } else {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            window.location.href = "/login";
          }
        }
      }
    }
    if (error.response?.status === 403) {
      const detail = error.response?.data?.detail;
      if (typeof detail === "string" && detail.includes("tidak aktif atau tidak ditemukan")) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("admin_access_token");
          localStorage.removeItem("admin_refresh_token");
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          
          const isUserAdminRoute = original.url?.includes("/admin") || original.url?.includes("/dinas") || original.url?.includes("/statistik") || original.url?.includes("/audit-log") || original.url?.includes("/sindas") || original.url?.includes("/categories") || original.url?.includes("/tahun-ajaran");
          if (isUserAdminRoute) {
            window.location.href = "/admin/login?error=inactive";
          } else {
            window.location.href = "/login?error=inactive";
          }
          return new Promise(() => {}); // Stop request chain
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── API Functions ────────────────────────────────────────────────────────────

export const authApi = {
  loginSiswa: (nis: string, password: string) =>
    api.post("/auth/login/siswa", { nis, password }),
  loginAdmin: (username: string, password: string, code?: string) =>
    api.post("/auth/login/admin", { username, password, code }),
  logout: () => api.post("/auth/logout"),
  resetPassword: (email: string) => api.post("/auth/reset-password", { email }),
  setup2FA: () => api.get("/auth/2fa/setup"),
  enable2FA: (secret: string, code: string) => api.post("/auth/2fa/enable", { secret, code }),
  disable2FA: (code: string) => api.post("/auth/2fa/disable", { code }),
};

export const categoriesApi = {
  getAll: (sekolah_id?: number) => api.get("/categories" + (sekolah_id ? `?sekolah_id=${sekolah_id}` : "")),
  create: (data: { name: string; description?: string; color?: string }) => api.post("/categories", data),
  delete: (id: number) => api.delete(`/categories/${id}`),
};

export const tahunAjaranApi = {
  getAll: (sekolahId?: number) => api.get("/tahun-ajaran" + (sekolahId ? `?sekolah_id=${sekolahId}` : "")),
  getDefault: (sekolahId?: number) => api.get("/tahun-ajaran/default" + (sekolahId ? `?sekolah_id=${sekolahId}` : "")),
  create: (data: { tahun: string; is_default?: boolean; sekolah_id?: number }) => api.post("/tahun-ajaran", data),
  setDefault: (id: number) => api.put(`/tahun-ajaran/${id}/set-default`),
  delete: (id: number) => api.delete(`/tahun-ajaran/${id}`),
};

export const dokumenApi = {
  getSaya: () => api.get("/dokumen/saya"),
  getPreviewBlob: (id: number) =>
    api.get(`/dokumen/${id}/preview`, { responseType: "blob" }),
  getDownloadUrl: (id: number) => `${API_URL}/dokumen/${id}/download`,
  download: (id: number) =>
    api.get(`/dokumen/${id}/download`, { responseType: "blob" }),
};

export const profilApi = {
  getSiswa: () => api.get("/auth/me"),
  updateProfil: (data: Partial<{ email: string; telepon: string }>) =>
    api.put("/auth/me", data),
  gantiPassword: (data: { old_password: string; new_password: string }) =>
    api.post("/auth/change-password", data),
  getRiwayatAkses: () => api.get("/audit-log/saya"),
};

// ─── ADMIN API FUNCTIONS ──────────────────────────────────────────────────────

export const adminSiswaApi = {
  getAll: (params?: { kelas?: string; search?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.kelas) searchParams.append("kelas", params.kelas);
    if (params?.search) searchParams.append("search", params.search);
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    const query = searchParams.toString();
    return api.get("/admin/siswa" + (query ? `?${query}` : ""));
  },
  getClasses: () => api.get("/admin/siswa/kelas"),
  getDetail: (id: number) => api.get(`/admin/siswa/${id}`),
  create: (data: any) => api.post("/admin/siswa", data),
  update: (id: number, data: any) => api.put(`/admin/siswa/${id}`, data),
  delete: (id: number) => api.delete(`/admin/siswa/${id}`),
  importExcel: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/admin/siswa/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  bulkKelulusan: (data: { angkatan: number; tahun_lulus: number | null; kelas?: string }) =>
    api.post("/admin/siswa/kelulusan-massal", data),
};

export const adminDokumenApi = {
  getAll: (siswaId?: number, jenisDok?: string) => {
    let url = "/admin/dokumen?";
    if (siswaId) url += `siswa_id=${siswaId}&`;
    if (jenisDok) url += `jenis_dok=${jenisDok}&`;
    return api.get(url);
  },
  upload: (data: {
    siswa_id: number;
    jenis_dok: string;
    tahun_ajaran: string;
    semester: string;
    metadata_json?: string;
    file: File;
  }, onUploadProgress?: (progressEvent: any) => void) => {
    const formData = new FormData();
    formData.append("siswa_id", data.siswa_id.toString());
    formData.append("jenis_dok", data.jenis_dok);
    formData.append("tahun_ajaran", data.tahun_ajaran);
    formData.append("semester", data.semester);
    if (data.metadata_json) {
      formData.append("metadata_json", data.metadata_json);
    }
    formData.append("file", data.file);
    return api.post("/admin/dokumen/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    });
  },
  bulkUpload: (data: {
    tahun_ajaran: string;
    semester: string;
    file: File;
  }, onUploadProgress?: (progressEvent: any) => void) => {
    const formData = new FormData();
    formData.append("tahun_ajaran", data.tahun_ajaran);
    formData.append("semester", data.semester);
    formData.append("file", data.file);
    return api.post("/admin/dokumen/bulk-upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    });
  },
  getPreviewBlob: (id: number) =>
    api.get(`/admin/dokumen/${id}/preview`, { responseType: "blob" }),
  download: (id: number) =>
    api.get(`/admin/dokumen/${id}/download`, { responseType: "blob" }),
  updateMetadata: (id: number, formData: FormData) => api.put(`/admin/dokumen/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }),
  delete: (id: number) => api.delete(`/admin/dokumen/${id}`),
};

export const adminAuditStatsApi = {
  getStatistik: () => api.get("/admin/statistik"),
  getAuditLog: (userType?: string, action?: string, status?: string) => {
    let url = "/admin/audit-log?";
    if (userType) url += `user_type=${userType}&`;
    if (action) url += `action=${action}&`;
    if (status) url += `status=${status}&`;
    return api.get(url);
  },
};

export const adminAnomaliApi = {
  getAlerts: () => api.get("/admin/anomali"),
};


export const masterKeyApi = {
  getStatus: (sekolahId?: number) => api.get("/admin/master-key/status" + (sekolahId ? `?sekolah_id=${sekolahId}` : "")),
  rotate: (confirm: string, sekolahId?: number) => api.post("/admin/master-key/rotate" + (sekolahId ? `?sekolah_id=${sekolahId}` : ""), { confirm }),
  getSchools: () => api.get("/admin/master-key/schools"),
};

export const dinasApi = {
  getSekolah: () => api.get("/dinas/sekolah"),
  getStatistik: () => api.get("/dinas/statistik"),
  getDetailSekolah: (id: number) => api.get(`/dinas/sekolah/${id}/detail`),
  getSekolahDokumen: (sekolahId: number) => api.get(`/dinas/sekolah/${sekolahId}/dokumen`),
  getDokumenPreviewBlob: (docId: number) => api.get(`/dinas/dokumen/${docId}/preview`, { responseType: "blob" }),
  getAuditLog: (limit: number = 50) => api.get(`/dinas/audit-log?limit=${limit}`),
  getRegistrasi: (status?: string) => api.get("/dinas/registrasi" + (status ? `?status=${status}` : "")),
  approveRegistrasi: (id: number) => api.post(`/dinas/registrasi/${id}/approve`),
  rejectRegistrasi: (id: number) => api.post(`/dinas/registrasi/${id}/reject`),
};

export const sekolahApi = {
  // Public & Registrasi
  getKabupaten: () => api.get("/sekolah/kabupaten"),
  syncKabupaten: (data: { provinsi: string; nama: string; kode_kemendagri: string }) => api.post("/sekolah/kabupaten/sync", data),
  register: (data: any) => api.post("/sekolah/register", data),
  getBiodata: () => api.get("/sekolah/biodata"),
  updateBiodata: (data: any) => api.put("/sekolah/biodata", data),
  getSindasConfig: () => api.get("/sekolah/sindas-config"),
  updateSindasConfig: (data: { sindas_api_url?: string; sindas_api_key?: string }) => api.put("/sekolah/sindas-config", data),
};

export const superAdminApi = {
  // Manajemen Dinas
  getDinasUsers: (params?: { search?: string; page?: number; size?: number; kabupaten_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.append("search", params.search);
    if (params?.page) qs.append("page", params.page.toString());
    if (params?.size) qs.append("size", params.size.toString());
    if (params?.kabupaten_id) qs.append("kabupaten_id", params.kabupaten_id);
    return api.get(`/superadmin/users/dinas?${qs.toString()}`);
  },
  createDinasUser: (data: any) => api.post("/superadmin/users/dinas", data),
  updateDinasUser: (id: string, data: any) => api.put(`/superadmin/users/dinas/${id}`, data),
  deleteDinasUser: (id: string) => api.delete(`/superadmin/users/dinas/${id}`),

  // Manajemen Admin/TU Sekolah
  getAdminSekolahUsers: (params?: { search?: string; page?: number; size?: number; sekolah_id?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.append("search", params.search);
    if (params?.page) qs.append("page", params.page.toString());
    if (params?.size) qs.append("size", params.size.toString());
    if (params?.sekolah_id) qs.append("sekolah_id", params.sekolah_id.toString());
    return api.get(`/superadmin/users/admin-sekolah?${qs.toString()}`);
  },
  createAdminSekolahUser: (data: any) => api.post("/superadmin/users/admin-sekolah", data),
  updateAdminSekolahUser: (id: number, data: any) => api.put(`/superadmin/users/admin-sekolah/${id}`, data),
  deleteAdminSekolahUser: (id: number) => api.delete(`/superadmin/users/admin-sekolah/${id}`),

  // Monitoring Sekolah
  getMonitoringSekolah: () => api.get("/superadmin/monitoring/sekolah"),
  getMonitoringDetailSekolah: (id: number) => api.get(`/superadmin/monitoring/sekolah/${id}/detail`),
  getMonitoringSekolahDokumen: (id: number) => api.get(`/superadmin/monitoring/sekolah/${id}/dokumen`),
  getMonitoringDokumenPreviewBlob: (id: number) => api.get(`/superadmin/monitoring/dokumen/${id}/preview`, { responseType: "blob" }),
  getMonitoringDokumenDownloadBlob: (id: number) => api.get(`/superadmin/monitoring/dokumen/${id}/download`, { responseType: "blob" }),
};