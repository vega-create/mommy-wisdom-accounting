'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDataStore } from '@/stores/dataStore';
import { useAuthStore } from '@/stores/authStore';
import { format, endOfMonth } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Scale, Download, Printer } from 'lucide-react';

interface BalanceItem {
  code: string;
  name: string;
  amount: number;
  level: number;
  isTotal?: boolean;
}

export default function BalanceSheetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const url_date = searchParams.get('date') || format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const updateURL = (reportDate: string) => {
    const params = new URLSearchParams();
    if (reportDate) params.set('date', reportDate);
    router.replace(`/dashboard/reports/balance-sheet?${params.toString()}`, { scroll: false });
  };

  const { transactions, bankAccounts, accountCategories } = useDataStore();
  const { company } = useAuthStore();
  const [reportDate, setReportDate] = useState(url_date);

  // 計算資產負債表（從交易記錄 + 帳戶）
  const balanceSheet = useMemo(() => {
    const endDate = new Date(reportDate);
    endDate.setHours(23, 59, 59, 999);

    // 篩選公司的帳戶
    const companyAccounts = bankAccounts.filter(a => a.company_id === company?.id && a.is_active);

    // 篩選截止日期前的交易
    const txBeforeDate = transactions.filter(t => {
      if (t.company_id !== company?.id) return false;
      return new Date(t.transaction_date) <= endDate;
    });

    // ── 計算每個帳戶的實際餘額 ──
    const accountBalances = new Map<string, number>();

    companyAccounts.forEach(acc => {
      accountBalances.set(acc.id, acc.initial_balance || 0);
    });

    txBeforeDate.forEach(t => {
      if (t.transaction_type === 'income' && t.bank_account_id) {
        const cur = accountBalances.get(t.bank_account_id) || 0;
        accountBalances.set(t.bank_account_id, cur + t.amount);
      }
      if (t.transaction_type === 'expense' && t.bank_account_id) {
        const cur = accountBalances.get(t.bank_account_id) || 0;
        accountBalances.set(t.bank_account_id, cur - t.amount);
        // 手續費也從帳戶扣除
        if (t.has_fee && t.fee_amount > 0) {
          accountBalances.set(t.bank_account_id, (accountBalances.get(t.bank_account_id) || 0) - t.fee_amount);
        }
      }
      if (t.transaction_type === 'transfer') {
        if (t.from_account_id) {
          const cur = accountBalances.get(t.from_account_id) || 0;
          accountBalances.set(t.from_account_id, cur - t.amount);
        }
        if (t.to_account_id) {
          const cur = accountBalances.get(t.to_account_id) || 0;
          accountBalances.set(t.to_account_id, cur + t.amount);
        }
        // 轉帳手續費
        if (t.has_fee && t.fee_amount > 0 && t.from_account_id) {
          const cur = accountBalances.get(t.from_account_id) || 0;
          accountBalances.set(t.from_account_id, cur - t.fee_amount);
        }
      }
    });

    // ── 建立資產項目 ──
    const assetItems: BalanceItem[] = [];
    let totalAssets = 0;

    // 按帳戶類型分組
    const typeGroups: Record<string, { label: string; accounts: typeof companyAccounts }> = {
      cash: { label: '現金', accounts: [] },
      bank: { label: '銀行存款', accounts: [] },
      petty_cash: { label: '零用金', accounts: [] },
      credit_card: { label: '信用卡', accounts: [] },
    };

    companyAccounts.forEach(acc => {
      const type = acc.account_type || 'bank';
      if (!typeGroups[type]) typeGroups[type] = { label: type, accounts: [] };
      typeGroups[type].accounts.push(acc);
    });

    assetItems.push({ code: '1', name: '流動資產', amount: 0, level: 0 });

    Object.entries(typeGroups).forEach(([type, group]) => {
      if (group.accounts.length === 0) return;

      let typeTotal = 0;
      group.accounts.forEach(acc => {
        const balance = accountBalances.get(acc.id) || 0;
        assetItems.push({
          code: '',
          name: `${acc.name}${acc.bank_name ? ` (${acc.bank_name})` : ''}`,
          amount: balance,
          level: 2,
        });
        typeTotal += balance;
      });
      totalAssets += typeTotal;
    });

    assetItems.push({ code: '1-total', name: '資產合計', amount: totalAssets, level: 0, isTotal: true });

    // ── 計算損益（期初到報表日） ──
    const categoryMap = new Map<string, { code: string; name: string; type: string }>();
    accountCategories
      .filter(c => c.company_id === company?.id)
      .forEach(c => categoryMap.set(c.id, { code: c.code, name: c.name, type: c.type }));

    let totalIncome = 0;
    let totalExpense = 0;

    txBeforeDate.forEach(t => {
      if (t.transaction_type === 'income') totalIncome += t.amount;
      if (t.transaction_type === 'expense') {
        totalExpense += t.amount;
        if (t.has_fee && t.fee_amount > 0) totalExpense += t.fee_amount;
      }
      if (t.transaction_type === 'transfer' && t.has_fee && t.fee_amount > 0) {
        totalExpense += t.fee_amount;
      }
    });

    const netIncome = totalIncome - totalExpense;

    // ── 建立權益項目 ──
    const equityItems: BalanceItem[] = [];
    const initialCapital = companyAccounts.reduce((sum, a) => sum + (a.initial_balance || 0), 0);

    equityItems.push({ code: '3', name: '業主權益', amount: 0, level: 0 });
    equityItems.push({ code: '3100', name: '期初資本', amount: initialCapital, level: 1 });
    equityItems.push({ code: '3200', name: '累積損益', amount: netIncome, level: 1 });
    equityItems.push({ code: '3-total', name: '權益合計', amount: initialCapital + netIncome, level: 0, isTotal: true });

    // ── 差額（應為 0） ──
    const difference = totalAssets - (initialCapital + netIncome);

    return {
      assetItems,
      equityItems,
      totalAssets,
      totalEquity: initialCapital + netIncome,
      initialCapital,
      netIncome,
      totalIncome,
      totalExpense,
      difference,
    };
  }, [transactions, bankAccounts, accountCategories, company, reportDate]);

  const formatCurrency = (amount: number) => {
    const abs = Math.abs(amount);
    const formatted = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(abs);
    return amount < 0 ? `(${formatted})` : formatted;
  };

  const handlePrint = () => window.print();

  const handleExport = () => {
    const headers = ['科目', '金額'];
    const rows = [
      ...balanceSheet.assetItems
        .filter(item => item.level > 0 || item.isTotal)
        .map(item => [(item.level === 2 ? '  ' : '') + item.name, formatCurrency(item.amount)]),
      ['', ''],
      ...balanceSheet.equityItems
        .filter(item => item.level > 0 || item.isTotal)
        .map(item => [(item.level === 1 ? '  ' : '') + item.name, formatCurrency(item.amount)]),
    ];

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `資產負債表_${reportDate}.csv`;
    link.click();
  };

  const renderSection = (items: BalanceItem[]) => (
    <tbody>
      {items.map((item, i) => {
        if (item.isTotal) {
          return (
            <tr key={i} className="bg-blue-50 font-bold border-t-2 border-b border-gray-300">
              <td className="py-3 px-6">{item.name}</td>
              <td className={`py-3 px-6 text-right font-mono ${item.amount < 0 ? 'text-red-600' : ''}`}>
                {formatCurrency(item.amount)}
              </td>
            </tr>
          );
        }
        if (item.level === 0) {
          return (
            <tr key={i} className="border-t border-gray-200">
              <td className="pt-4 pb-1 px-6 font-semibold text-gray-700" colSpan={2}>{item.name}</td>
            </tr>
          );
        }
        return (
          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="py-2 px-6 pl-10">{item.name}</td>
            <td className={`py-2 px-6 text-right font-mono ${item.amount < 0 ? 'text-red-600' : ''}`}>
              {formatCurrency(item.amount)}
            </td>
          </tr>
        );
      })}
    </tbody>
  );

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">資產負債表</h1>
          <p className="text-sm text-gray-500 mt-1">依帳戶餘額與交易記錄計算</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            匯出 CSV
          </button>
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <Printer className="w-4 h-4" />
            列印
          </button>
        </div>
      </div>

      {/* 摘要 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500 mb-1">資產總額</p>
          <p className="text-2xl font-bold text-gray-900">${formatCurrency(balanceSheet.totalAssets)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500 mb-1">權益總額</p>
          <p className="text-2xl font-bold text-gray-900">${formatCurrency(balanceSheet.totalEquity)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500 mb-1">累積損益</p>
          <p className={`text-2xl font-bold ${balanceSheet.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {balanceSheet.netIncome >= 0 ? '+' : ''}${formatCurrency(balanceSheet.netIncome)}
          </p>
        </div>
      </div>

      {/* 篩選區 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex gap-4 items-end">
          <div>
            <label className="input-label">報表日期</label>
            <input type="date" value={reportDate}
              onChange={e => { setReportDate(e.target.value); updateURL(e.target.value); }}
              className="input-field" />
          </div>
          <button
            onClick={() => {
              const d = format(endOfMonth(new Date()), 'yyyy-MM-dd');
              setReportDate(d);
              updateURL(d);
            }}
            className="btn-secondary"
          >
            本月底
          </button>
        </div>
      </div>

      {/* 報表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none">
        <div className="p-6 border-b border-gray-200 text-center print:border-b-2 print:border-black">
          <h2 className="text-xl font-bold">{company?.name}</h2>
          <h3 className="text-lg font-semibold mt-1">資 產 負 債 表</h3>
          <p className="text-sm text-gray-600 mt-1">
            截至 {format(new Date(reportDate), 'yyyy年MM月dd日', { locale: zhTW })}
          </p>
          <p className="text-xs text-gray-500 mt-1">單位：新台幣元</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-300">
                <th className="py-3 px-6 text-left">科目</th>
                <th className="py-3 px-6 text-right w-36">金額</th>
              </tr>
            </thead>
            {renderSection(balanceSheet.assetItems)}
            {renderSection(balanceSheet.equityItems)}
          </table>

          {balanceSheet.difference !== 0 && (
            <div className="px-6 py-2 bg-yellow-50 text-yellow-700 text-sm border-t">
              ⚠ 資產與權益差額：{formatCurrency(balanceSheet.difference)}（可能有未入帳的交易）
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between text-xs text-gray-500 print:bg-white">
          <span>帳戶數：{bankAccounts.filter(a => a.company_id === company?.id && a.is_active).length}</span>
          <span>製表日期：{format(new Date(), 'yyyy/MM/dd HH:mm')}</span>
        </div>
      </div>
    </div>
  );
}
