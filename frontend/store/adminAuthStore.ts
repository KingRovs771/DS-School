/**
 * store/adminAuthStore.ts — Zustand store untuk state otentikasi admin
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface AdminProfile {
  id: number;
  username: string;
  email: string;
  role: string;
  nama_lengkap?: string | null;
  sekolah_id?: number;
  last_login?: string;
  two_factor_enabled?: boolean;
}

interface AdminAuthState {
  isAdminAuthenticated: boolean;
  adminAccessToken: string | null;
  adminRefreshToken: string | null;
  admin: AdminProfile | null;
  adminLogin: (tokens: { access_token: string; refresh_token: string }, admin: AdminProfile) => void;
  adminLogout: () => void;
  updateAdmin: (data: Partial<AdminProfile>) => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      isAdminAuthenticated: false,
      adminAccessToken: null,
      adminRefreshToken: null,
      admin: null,

      adminLogin: (tokens, admin) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("admin_access_token", tokens.access_token);
          localStorage.setItem("admin_refresh_token", tokens.refresh_token);
        }
        set({
          isAdminAuthenticated: true,
          adminAccessToken: tokens.access_token,
          adminRefreshToken: tokens.refresh_token,
          admin,
        });
      },

      adminLogout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("admin_access_token");
          localStorage.removeItem("admin_refresh_token");
        }
        set({
          isAdminAuthenticated: false,
          adminAccessToken: null,
          adminRefreshToken: null,
          admin: null,
        });
      },

      updateAdmin: (data) =>
        set((state) => ({
          admin: state.admin ? { ...state.admin, ...data } : null,
        })),
    }),
    {
      name: "dms-admin-auth-storage",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        isAdminAuthenticated: state.isAdminAuthenticated,
        admin: state.admin,
        adminAccessToken: state.adminAccessToken,
        adminRefreshToken: state.adminRefreshToken,
      }),
    }
  )
);
