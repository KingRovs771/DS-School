import api from './api';

// ─── Retention Policy ────────────────────────────────────────────────────────

export const retentionApi = {
  // List semua kebijakan retensi
  getAll: (sekolah_id?: number) =>
    api.get('/admin/retention-policy', { params: sekolah_id ? { sekolah_id } : undefined }),

  // Buat kebijakan baru
  create: (data: {
    sekolah_id: number;
    jenis_dok: string;
    durasi_hari: number;
    aksi_setelah: 'archive' | 'delete' | 'notify_only';
    notif_hari_sebelum: number;
    is_active: boolean;
  }) => api.post('/admin/retention-policy', data),

  // Update kebijakan
  update: (id: number, data: Partial<{
    durasi_hari: number;
    aksi_setelah: 'archive' | 'delete' | 'notify_only';
    notif_hari_sebelum: number;
    is_active: boolean;
  }>) => api.put(`/admin/retention-policy/${id}`, data),

  // Hapus kebijakan (super admin)
  delete: (id: number) => api.delete(`/admin/retention-policy/${id}`),

  // Dokumen akan expired dalam N hari
  getDokumenAkanExpired: (hari = 30) =>
    api.get('/admin/dokumen/akan-expired', { params: { hari } }),

  // Set Legal Hold
  setLegalHold: (docId: number, alasan: string) =>
    api.post(`/admin/dokumen/${docId}/legal-hold`, { alasan }),

  // Release Legal Hold (super admin)
  releaseLegalHold: (docId: number) =>
    api.delete(`/admin/dokumen/${docId}/legal-hold`),
};

export default retentionApi;
