'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Company {
  id: string;
  name: string;
}

interface CompanyContextType {
  currentCompany: Company | null;
  setCurrentCompany: (company: Company | null) => void;
  companies: Company[];
  setCompanies: (companies: Company[]) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('currentCompany');
    if (saved) {
      try {
        setCurrentCompany(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (currentCompany) {
      localStorage.setItem('currentCompany', JSON.stringify(currentCompany));
    }
  }, [currentCompany]);

  return (
    <CompanyContext.Provider value={{ currentCompany, setCurrentCompany, companies, setCompanies }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within CompanyProvider');
  }
  return context;
}
