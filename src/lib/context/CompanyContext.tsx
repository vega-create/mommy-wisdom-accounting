'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface Company {
  id: string;
  name: string;
}

interface CompanyContextType {
  currentCompany: Company | null;
  setCurrentCompany: (company: Company | null) => void;
  companies: Company[];
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { company, userCompanies, switchCompany } = useAuthStore();

  // 直接使用 authStore 的 company
  const currentCompany = company ? { id: company.id, name: company.name } : null;
  const companies = userCompanies?.map(uc => ({ id: uc.company_id, name: uc.company?.name || '' })) || [];

  const setCurrentCompany = (c: Company | null) => {
    if (c) switchCompany(c.id);
  };

  return (
    <CompanyContext.Provider value={{ currentCompany, setCurrentCompany, companies }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    // 如果沒有 Provider，返回空的 context 而不是拋出錯誤
    return { currentCompany: null, setCurrentCompany: () => {}, companies: [] };
  }
  return context;
}
