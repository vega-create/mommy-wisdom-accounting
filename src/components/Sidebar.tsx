'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  FileText,
  BookOpen,
  BarChart3,
  LogOut,
  Building2,
  ChevronDown,
  ListTree,
  PieChart,
  TrendingUp,
  Users,
  Settings,
  MessageSquare,
  FileCheck,
  CreditCard,
  Banknote,
  FileSpreadsheet,
  ScrollText,
  FileSignature,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: '總覽', href: '/dashboard', icon: LayoutDashboard },
  { name: '帳戶管理', href: '/dashboard/accounts', icon: Wallet },
  { name: '客戶管理', href: '/dashboard/customers', icon: Users },
  { name: '記帳', href: '/dashboard/transactions', icon: Receipt },
  { name: '憑證管理', href: '/dashboard/vouchers', icon: FileText },
  { name: '會計科目', href: '/dashboard/chart-of-accounts', icon: BookOpen },
  {
    name: '報表',
    icon: BarChart3,
    children: [
      { name: '日記帳', href: '/dashboard/reports/journal', icon: BookOpen },
      { name: '總分類帳', href: '/dashboard/reports/ledger', icon: ListTree },
      { name: '資產負債表', href: '/dashboard/reports/balance-sheet', icon: PieChart },
      { name: '損益表', href: '/dashboard/reports/income-statement', icon: TrendingUp },
      { name: '數據分析', href: '/dashboard/analytics', icon: BarChart3 },
    ],
  },
  { name: 'LINE 通知', href: '/dashboard/line', icon: MessageSquare },
  { name: '請款管理', href: '/dashboard/billing', icon: CreditCard },
  { name: '應付管理', href: '/dashboard/payables', icon: Banknote },
  { name: '電子發票', href: '/dashboard/invoices', icon: FileSpreadsheet },
  { name: '勞報系統', href: '/dashboard/labor', icon: FileCheck },
  {
    name: '報價合約',
    icon: ScrollText,
    children: [
      { name: '報價單', href: '/dashboard/quotations', icon: FileText },
      { name: '合約', href: '/dashboard/contracts', icon: FileSignature },
      { name: '專案成本', href: '/dashboard/project-quotes', icon: BarChart3 },
    ],
  },
  { name: '系統說明', href: '/dashboard/help', icon: BookOpen },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, company, userCompanies, switchCompany, logout, isAdmin } = useAuthStore();
  const { loadAll } = useDataStore();
  const [openMenus, setOpenMenus] = useState<string[]>(['報表', '報價合約']);
  const [showCompanySelector, setShowCompanySelector] = useState(false);

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]);
  };

  const handleCompanySwitch = async (companyId: string) => {
    await switchCompany(companyId);
    await loadAll();
    setShowCompanySelector(false);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  const currentRole = userCompanies.find(uc => uc.company_id === company?.id)?.role;

  return (
    <div className="w-64 bg-white flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3" onClick={handleNavClick}>
          <div className="w-10 h-10 bg-brand-gradient rounded-xl flex items-center justify-center shadow-brand">
            <span className="text-white font-bold text-lg">MW</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900">智慧媽咪</h1>
            <p className="text-xs text-gray-500">會計管理系統</p>
          </div>
        </Link>
        {/* 手機版關閉按鈕 */}
        {onClose && (
          <button onClick={onClose} className="md:hidden p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 公司選擇器 */}
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <button
            onClick={() => setShowCompanySelector(!showCompanySelector)}
            className="w-full flex items-center justify-between p-3 bg-brand-primary-50 rounded-lg hover:bg-brand-primary-100 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-brand-primary-600 flex-shrink-0" />
              <span className="text-sm font-medium text-brand-primary-700 truncate">
                {company?.name || '選擇公司'}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-brand-primary-600 transition-transform ${showCompanySelector ? 'rotate-180' : ''}`} />
          </button>
          {showCompanySelector && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
              {userCompanies.map(uc => (
                <button
                  key={uc.company_id}
                  onClick={() => handleCompanySwitch(uc.company_id)}
                  className={`w-full text-left p-3 hover:bg-gray-50 text-sm transition-colors ${company?.id === uc.company_id ? 'bg-brand-primary-100 text-brand-primary-700' : 'text-gray-700'}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{uc.company?.name}</span>
                    <span className="text-xs text-brand-primary-400">
                      {uc.role === 'admin' ? '管理員' : uc.role === 'accountant' ? '會計' : '檢視者'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 導覽選單 */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navigation.map(item => (
          <div key={item.name}>
            {item.href ? (
              <Link
                href={item.href}
                onClick={handleNavClick}
                className={`nav-item ${pathname === item.href || pathname.startsWith(item.href + '/') ? 'active' : ''}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1">{item.name}</span>
              </Link>
            ) : (
              <>
                <button onClick={() => toggleMenu(item.name)} className="nav-item w-full justify-between">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${openMenus.includes(item.name) ? 'rotate-180' : ''}`} />
                </button>
                {openMenus.includes(item.name) && item.children && (
                  <div className="ml-4 mt-1 space-y-1 animate-slide-up">
                    {item.children.map(child => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={handleNavClick}
                        className={`nav-item text-sm ${pathname === child.href ? 'active' : ''}`}
                      >
                        <child.icon className="w-4 h-4" />
                        <span>{child.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {isAdmin() && (
          <Link
            href="/dashboard/settings"
            onClick={handleNavClick}
            className={`nav-item ${pathname === '/dashboard/settings' ? 'active' : ''}`}
          >
            <Settings className="w-5 h-5" />
            <span>系統設定</span>
          </Link>
        )}
      </nav>

      {/* 使用者資訊 */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-3 p-3 mb-2">
          <div className="w-8 h-8 bg-brand-primary-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-brand-primary-700">{user?.name?.[0] || 'U'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500">
              {currentRole === 'admin' ? '管理員' : currentRole === 'accountant' ? '會計' : '檢視者'}
            </p>
          </div>
        </div>
        <button onClick={handleLogout} className="nav-item w-full text-red-600 hover:bg-red-50 hover:text-red-700">
          <LogOut className="w-5 h-5" />
          <span>登出</span>
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // 換頁時自動關閉
  const handleClose = () => setMobileOpen(false);

  return (
    <>
      {/* 電腦版側邊欄 */}
      <div className="hidden md:flex w-64 border-r border-gray-200 h-screen sticky top-0">
        <SidebarContent />
      </div>

      {/* 手機版頂部 Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 flex items-center justify-between px-4 h-14">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-gradient rounded-lg flex items-center justify-center shadow-brand">
            <span className="text-white font-bold text-sm">MW</span>
          </div>
          <span className="font-bold text-gray-900">智慧媽咪</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* 手機版遮罩 */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={handleClose}
        />
      )}

      {/* 手機版側滑抽屜 */}
      <div className={`md:hidden fixed top-0 left-0 h-full z-50 transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent onClose={handleClose} />
      </div>
    </>
  );
}