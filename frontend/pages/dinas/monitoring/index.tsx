import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { dinasApi } from "@/lib/api";
import { 
  BuildingOffice2Icon, 
  DocumentTextIcon, 
  UsersIcon,
  MagnifyingGlassIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/solid";
import AdminLayout from "@/components/AdminLayout";
import { useRequireAdmin } from "@/hooks/useAdminAuth";

export default function MonitoringSekolahPage() {
  const { isAdminAuthenticated, mounted } = useRequireAdmin();
  const [search, setSearch] = useState("");

  const { data: schools, isLoading } = useQuery({
    queryKey: ["dinas-schools-monitoring"],
    queryFn: async () => {
      const res = await dinasApi.getSekolah();
      return res.data;
    },
    enabled: isAdminAuthenticated,
  });

  if (!mounted || !isAdminAuthenticated) return null;

  const filteredSchools = schools?.filter((s: any) => 
    s.nama.toLowerCase().includes(search.toLowerCase()) || 
    s.npsn.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <AdminLayout title="Monitoring Sekolah">
      <Head>
        <title>Monitoring Sekolah - Dinas Pendidikan</title>
      </Head>

      <div className="space-y-6 font-body">
        
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-[#D4DDD9]/60">
          <div>
            <h2 className="text-xl font-display font-bold text-gray-900">Daftar Sekolah</h2>
            <p className="text-sm text-gray-500 mt-1">Pilih sekolah untuk memonitor dokumen siswa.</p>
          </div>
          
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Cari NPSN atau Nama Sekolah..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3DB891]/20 focus:border-[#3DB891] transition-all"
            />
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Schools Grid */}
        {isLoading ? (
          <div className="flex justify-center p-20">
            <div className="animate-spin w-8 h-8 border-4 border-[#3DB891] border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSchools.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                <BuildingOffice2Icon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Tidak ada sekolah yang ditemukan.</p>
              </div>
            ) : (
              filteredSchools.map((school: any) => (
                <div key={school.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-12 h-12 rounded-xl bg-[#F0FAF6] flex items-center justify-center text-[#208C68] shrink-0">
                      <BuildingOffice2Icon className="w-6 h-6" />
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
                  
                  <div className="mb-4 flex-1">
                    <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1 line-clamp-2" title={school.nama}>
                      {school.nama}
                    </h3>
                    <p className="text-xs font-mono text-gray-500">NPSN: {school.npsn}</p>
                  </div>
                  
                  <div className="flex gap-4 mb-5 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <UsersIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">{school.total_siswa} <span className="text-xs font-normal text-gray-500">Siswa</span></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DocumentTextIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">{school.total_dokumen} <span className="text-xs font-normal text-gray-500">Dokumen</span></span>
                    </div>
                  </div>
                  
                  <Link 
                    href={`/dinas/monitoring/${school.id}`}
                    className="w-full block text-center bg-gray-50 hover:bg-[#3DB891] text-gray-600 hover:text-white border border-gray-200 hover:border-[#3DB891] py-2.5 rounded-xl text-sm font-bold transition-colors"
                  >
                    Lihat Dokumen
                  </Link>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
