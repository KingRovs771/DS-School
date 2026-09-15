import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import toast from "react-hot-toast";

export interface TahunAjaran {
  id: number;
  tahun: string;
  sekolah_id: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useTahunAjaran(sekolahId?: number) {
  return useQuery({
    queryKey: ["tahun-ajaran", sekolahId],
    queryFn: async () => {
      const params = sekolahId ? `?sekolah_id=${sekolahId}` : "";
      const res = await apiClient.get<TahunAjaran[]>(`/tahun-ajaran${params}`);
      return res.data;
    },
  });
}

export function useCreateTahunAjaran() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { tahun: string; is_default: boolean; sekolah_id?: number }) => {
      const res = await apiClient.post<TahunAjaran>("/tahun-ajaran", data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Tahun ajaran berhasil ditambahkan");
      queryClient.invalidateQueries({ queryKey: ["tahun-ajaran"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Gagal menambah tahun ajaran");
    },
  });
}

export function useSetDefaultTahunAjaran() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.put<TahunAjaran>(`/tahun-ajaran/${id}/set-default`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Tahun ajaran default berhasil diubah");
      queryClient.invalidateQueries({ queryKey: ["tahun-ajaran"] });
    },
    onError: () => {
      toast.error("Gagal mengubah tahun ajaran default");
    },
  });
}

export function useDeleteTahunAjaran() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/tahun-ajaran/${id}`);
    },
    onSuccess: () => {
      toast.success("Tahun ajaran berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["tahun-ajaran"] });
    },
    onError: () => {
      toast.error("Gagal menghapus tahun ajaran");
    },
  });
}
