'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import Sidebar from '@/components/Sidebar';
import { CompanyProvider } from '@/lib/context/CompanyContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const { loadAll } = useDataStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadAll();
    }
  }, [isAuthenticated, loadAll]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <CompanyProvider>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {/* 手機版頂部留白（固定 Header 高度）*/}
          <div className="md:hidden h-14" />
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </CompanyProvider>
  );
}