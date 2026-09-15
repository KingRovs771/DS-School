"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dinasApi } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { 
  BuildingOffice2Icon, 
  UsersIcon, 
  DocumentTextIcon, 
  CheckBadgeIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/solid";
import AdminLayout from "@/components/AdminLayout";
import { useRequireAdmin } from "@/hooks/useAdminAuth";
import { useAdminAuthStore } from "@/store/adminAuthStore";

export default function DinasDashboard() {
  const { isAdminAuthenticated, mounted } = useRequireAdmin();
  const { admin } = useAdminAuthStore();
  
  // Queries
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dinas-stats"],
    queryFn: async () => {
      const res = await dinasApi.getStatistik();
      return res.data;
    },
    enabled: isAdminAuthenticated,
  });

  const { data: schools, isLoading: schoolsLoading } = useQuery({
    queryKey: ["dinas-schools"],
    queryFn: async () => {
      const res = await dinasApi.getSekolah();
      return res.data;
    },
    enabled: isAdminAuthenticated,
  });

  if (!mounted || !isAdminAuthenticated) return null;

  if (admin?.role !== "dinas_pendidikan") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Akses Ditolak</h1>
          <p className="text-gray-600">Halaman ini khusus untuk Dinas Pendidikan.</p>
        </div>
      </div>
    );
  }

  const isLoading = statsLoading || schoolsLoading;

  return (
    <AdminLayout title="Dashboard Kabupaten/Kota">
      <div className="space-y-8 font-body">
        
        {/* Header Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D4DDD9]/60">
          <h1 className="text-2xl font-display font-bold text-gray-900">
            Overview Wilayah {admin.nama_lengkap}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Pantau statistik kependidikan, jumlah dokumen, dan partisipasi seluruh sekolah di wilayah Anda.
          </p>
        </div>

        {/* Stat Cards */}
        {isLoading ? (
          <div className="flex justify-center p-20">
            <div className="animate-spin w-8 h-8 border-4 border-[#3DB891] border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#F0FDF4] border border-green-100 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[13px] font-bold text-green-800 uppercase tracking-wider">Total Sekolah</span>
                <div className="w-10 h-10 rounded-xl bg-green-200 flex items-center justify-center">
                  <BuildingOffice2Icon className="w-5 h-5 text-green-700" />
                </div>
              </div>
              <p className="text-3xl font-display font-black text-gray-900">{stats?.total_sekolah || 0}</p>
            </div>
            
            <div className="bg-[#EFF6FF] border border-blue-100 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[13px] font-bold text-blue-800 uppercase tracking-wider">Total Siswa</span>
                <div className="w-10 h-10 rounded-xl bg-blue-200 flex items-center justify-center">
                  <UsersIcon className="w-5 h-5 text-blue-700" />
                </div>
              </div>
              <p className="text-3xl font-display font-black text-gray-900">{stats?.total_siswa || 0}</p>
            </div>

            <div className="bg-[#FEF2F2] border border-red-100 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[13px] font-bold text-red-800 uppercase tracking-wider">Total Dokumen</span>
                <div className="w-10 h-10 rounded-xl bg-red-200 flex items-center justify-center">
                  <DocumentTextIcon className="w-5 h-5 text-red-700" />
                </div>
              </div>
              <p className="text-3xl font-display font-black text-gray-900">{stats?.total_dokumen || 0}</p>
            </div>

            <div className="bg-[#FFFBEB] border border-amber-100 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[13px] font-bold text-amber-800 uppercase tracking-wider">Sekolah Aktif</span>
                <div className="w-10 h-10 rounded-xl bg-amber-200 flex items-center justify-center">
                  <CheckBadgeIcon className="w-5 h-5 text-amber-700" />
                </div>
              </div>
              <p className="text-3xl font-display font-black text-gray-900">{stats?.persen_sekolah_aktif || 0}%</p>
            </div>
          </div>
        )}

        {/* Charts and Tables */}
        {!isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Chart: Perbandingan Dokumen antar Sekolah */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#D4DDD9]/60 p-6">
              <h3 className="text-lg font-bold font-display text-gray-900 mb-6">Perbandingan Volume Dokumen</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={schools?.slice(0, 5) || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="nama" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="total_dokumen" fill="#3DB891" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Table: Daftar Sekolah */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#D4DDD9]/60 p-6 overflow-hidden flex flex-col">
              <h3 className="text-lg font-bold font-display text-gray-900 mb-6">Sekolah di Wilayah Anda</h3>
              <div className="flex-1 overflow-y-auto pr-2">
                <div className="space-y-4">
                  {schools?.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">Belum ada sekolah yang terdaftar.</div>
                  ) : (
                    schools?.map((school: any) => (
                      <div key={school.id} className="p-4 rounded-xl border border-gray-100 hover:border-[#3DB891]/30 hover:shadow-sm transition-all bg-gray-50/50">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-gray-900">{school.nama}</h4>
                            <p className="text-xs text-gray-500 font-mono mt-1">NPSN: {school.npsn}</p>
                          </div>
                          {school.total_dokumen > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-100 px-2 py-1 rounded">
                              Aktif <CheckBadgeIcon className="w-3 h-3" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-1 rounded">
                              Idle <ExclamationTriangleIcon className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <div className="mt-4 flex gap-4 border-t border-gray-200/60 pt-3">
                          <div className="flex items-center gap-1.5">
                            <UsersIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-xs font-medium text-gray-600">{school.total_siswa} Siswa</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <DocumentTextIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-xs font-medium text-gray-600">{school.total_dokumen} Dokumen</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </AdminLayout>
  );
}
