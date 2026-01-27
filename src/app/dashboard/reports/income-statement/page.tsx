'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDataStore } from '@/stores/dataStore';
import { useAuthStore } from '@/stores/authStore';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Download, Printer } from 'lucide-react';
import { defaultAccountCategories } from '@/data/accounts';

interface IncomeItem {
  code: string;
  name: string;
  amount: number;
  level: number;
  isTotal?: boolean;
  isSubtotal?: boolean;
}

export default function IncomeStatementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const url_start = searchParams.get('start') || format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const url_end = searchParams.get('end') || format(endOfMonth(new Date()), 'yyyy-MM-dd');

  // 更新 URL 參數
  const updateURL = (startDate: string, endDate: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    router.replace(`/dashboard/reports/income-statement?${params.toString()}`, { scroll: false });
  };

  const { vouchers, voucherItems } = useDataStore();
  const { company } = useAuthStore();
  const [startDate, setStartDate] = useState(url_start);
  const [endDate, setEndDate] = useState(url_end);

  // 計算損益表
  const incomeStatement = useMemo(() => {
    // 計算各科目金額
    const accountAmounts: Map<string, number> = new Map();

    // 取得期間內已核准的憑證
    const approvedVouchers = vouchers.filter(
      v => v.company_id === company?.id && 
           v.status === 'approved' && 
           new Date(v.voucher_date) >= new Date(startDate) &&
           new Date(v.voucher_date) <= new Date(endDate)
    );

    // 累計各科目金額
    approvedVouchers.forEach(voucher => {
      const items = voucherItems.filter(item => item.voucher_id === voucher.id);
      items.forEach(item => {
        const accountId = item.account_id;
        if (!accountId) return;
        const account = defaultAccountCategories.find(a => a.code === accountId);
        if (!account) return;

        // 只處理收入、成本、費用類科目
        if (!['revenue', 'cost', 'expense'].includes(account.type)) return;

        const currentAmount = accountAmounts.get(accountId) || 0;
        
        // 收入類：貸方增加
        // 成本/費用類：借方增加
        if (account.type === 'revenue') {
          accountAmounts.set(accountId, currentAmount + item.credit_amount - item.debit_amount);
        } else {
          accountAmounts.set(accountId, currentAmount + item.debit_amount - item.credit_amount);
        }
      });
    });

    // 建立損益表項目
    const items: IncomeItem[] = [];

    // 營業收入 (41xx)
    let operatingRevenue = 0;
    items.push({ code: '41', name: '營業收入', amount: 0, level: 0 });
    defaultAccountCategories
      .filter(a => a.code.startsWith('41') && a.code.length === 4)
      .forEach(account => {
        const amount = accountAmounts.get(account.code) || 0;
        if (amount !== 0) {
          items.push({ code: account.code, name: account.name, amount, level: 1 });
          operatingRevenue += amount;
        }
      });
    items.push({ code: '41-total', name: '營業收入合計', amount: operatingRevenue, level: 0, isSubtotal: true });

    // 營業成本 (51xx)
    let operatingCost = 0;
    items.push({ code: '51', name: '營業成本', amount: 0, level: 0 });
    defaultAccountCategories
      .filter(a => a.code.startsWith('51') && a.code.length === 4)
      .forEach(account => {
        const amount = accountAmounts.get(account.code) || 0;
        if (amount !== 0) {
          items.push({ code: account.code, name: account.name, amount, level: 1 });
          operatingCost += amount;
        }
      });
    items.push({ code: '51-total', name: '營業成本合計', amount: operatingCost, level: 0, isSubtotal: true });

    // 營業毛利
    const grossProfit = operatingRevenue - operatingCost;
    items.push({ code: 'gross-profit', name: '營業毛利', amount: grossProfit, level: 0, isTotal: true });

    // 營業費用 (61xx, 62xx)
    let operatingExpenses = 0;
    items.push({ code: '6', name: '營業費用', amount: 0, level: 0 });
    
    // 推銷費用
    let sellingExpenses = 0;
    defaultAccountCategories
      .filter(a => a.code.startsWith('61') && a.code.length === 4)
      .forEach(account => {
        const amount = accountAmounts.get(account.code) || 0;
        if (amount !== 0) {
          items.push({ code: account.code, name: account.name, amount, level: 1 });
          sellingExpenses += amount;
        }
      });
    if (sellingExpenses > 0) {
      items.push({ code: '61-total', name: '推銷費用小計', amount: sellingExpenses, level: 1, isSubtotal: true });
    }
    operatingExpenses += sellingExpenses;

    // 管理費用
    let adminExpenses = 0;
    defaultAccountCategories
      .filter(a => a.code.startsWith('62') && a.code.length === 4)
      .forEach(account => {
        const amount = accountAmounts.get(account.code) || 0;
        if (amount !== 0) {
          items.push({ code: account.code, name: account.name, amount, level: 1 });
          adminExpenses += amount;
        }
      });
    if (adminExpenses > 0) {
      items.push({ code: '62-total', name: '管理費用小計', amount: adminExpenses, level: 1, isSubtotal: true });
    }
    operatingExpenses += adminExpenses;

    items.push({ code: '6-total', name: '營業費用合計', amount: operatingExpenses, level: 0, isSubtotal: true });

    // 營業淨利
    const operatingIncome = grossProfit - operatingExpenses;
    items.push({ code: 'operating-income', name: '營業淨利', amount: operatingIncome, level: 0, isTotal: true });

    // 營業外收入 (42xx)
    let nonOperatingRevenue = 0;
    items.push({ code: '42', name: '營業外收入', amount: 0, level: 0 });
    defaultAccountCategories
      .filter(a => a.code.startsWith('42') && a.code.length === 4)
      .forEach(account => {
        const amount = accountAmounts.get(account.code) || 0;
        if (amount !== 0) {
          items.push({ code: account.code, name: account.name, amount, level: 1 });
          nonOperatingRevenue += amount;
        }
      });
    items.push({ code: '42-total', name: '營業外收入合計', amount: nonOperatingRevenue, level: 0, isSubtotal: true });

    // 營業外費用 (71xx)
    let nonOperatingExpenses = 0;
    items.push({ code: '71', name: '營業外費用', amount: 0, level: 0 });
    defaultAccountCategories
      .filter(a => a.code.startsWith('71') && a.code.length === 4)
      .forEach(account => {
        const amount = accountAmounts.get(account.code) || 0;
        if (amount !== 0) {
          items.push({ code: account.code, name: account.name, amount, level: 1 });
          nonOperatingExpenses += amount;
        }
      });
    items.push({ code: '71-total', name: '營業外費用合計', amount: nonOperatingExpenses, level: 0, isSubtotal: true });

    // 稅前淨利
    const incomeBeforeTax = operatingIncome + nonOperatingRevenue - nonOperatingExpenses;
    items.push({ code: 'income-before-tax', name: '稅前淨利', amount: incomeBeforeTax, level: 0, isTotal: true });

    // 所得稅費用 (72xx)
    let incomeTax = 0;
    defaultAccountCategories
      .filter(a => a.code.startsWith('72') && a.code.length === 4)
      .forEach(account => {
        const amount = accountAmounts.get(account.code) || 0;
        incomeTax += amount;
      });
    if (incomeTax !== 0) {
      items.push({ code: '72', name: '所得稅費用', amount: incomeTax, level: 0 });
    }

    // 本期淨利
    const netIncome = incomeBeforeTax - incomeTax;
    items.push({ code: 'net-income', name: '本期淨利', amount: netIncome, level: 0, isTotal: true });

    return {
      items: items.filter(item => item.amount !== 0 || item.isTotal || item.isSubtotal || item.level === 0),
      operatingRevenue,
      operatingCost,
      grossProfit,
      operatingExpenses,
      operatingIncome,
      nonOperatingRevenue,
      nonOperatingExpenses,
      incomeBeforeTax,
      incomeTax,
      netIncome,
    };
  }, [vouchers, voucherItems, company, startDate, endDate]);

  const formatCurrency = (amount: number) => {
    const absAmount = Math.abs(amount);
    const formatted = new Intl.NumberFormat('zh-TW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(absAmount);
    return amount < 0 ? `(${formatted})` : formatted;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const headers = ['項目', '金額'];
    const rows = incomeStatement.items.map(item => [
      item.name,
      formatCurrency(item.amount),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `損益表_${startDate}_${endDate}.csv`;
    link.click();
  };

  const setDateRange = (type: 'month' | 'quarter' | 'year') => {
    const now = new Date();
    switch (type) {
      case 'month':
        { const s1 = format(startOfMonth(now), 'yyyy-MM-dd'); const e1 = format(endOfMonth(now), 'yyyy-MM-dd'); setStartDate(s1); setEndDate(e1); updateURL(s1, e1); }
        break;
      case 'quarter':
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        const quarterStart = new Date(now.getFullYear(), quarterMonth, 1);
        const quarterEnd = new Date(now.getFullYear(), quarterMonth + 3, 0);
        { const s2 = format(quarterStart, 'yyyy-MM-dd'); const e2 = format(quarterEnd, 'yyyy-MM-dd'); setStartDate(s2); setEndDate(e2); updateURL(s2, e2); }
        break;
      case 'year':
        { const s3 = format(startOfYear(now), 'yyyy-MM-dd'); const e3 = format(endOfYear(now), 'yyyy-MM-dd'); setStartDate(s3); setEndDate(e3); updateURL(s3, e3); }
        break;
    }
  };

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">損益表</h1>
          <p className="text-sm text-gray-500 mt-1">顯示公司在特定期間的經營成果</p>
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

      {/* 篩選區 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div>
            <label className="input-label">開始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); updateURL(e.target.value, endDate); }}
              className="input-field"
            />
          </div>
          <div>
            <label className="input-label">結束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); updateURL(startDate, e.target.value); }}
              className="input-field"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setDateRange('month')} className="btn-secondary text-sm">
              本月
            </button>
            <button onClick={() => setDateRange('quarter')} className="btn-secondary text-sm">
              本季
            </button>
            <button onClick={() => setDateRange('year')} className="btn-secondary text-sm">
              本年度
            </button>
          </div>
        </div>
      </div>

      {/* 摘要卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">營業收入</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(incomeStatement.operatingRevenue)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">營業成本</p>
              <p className="text-xl font-bold text-orange-600">
                {formatCurrency(incomeStatement.operatingCost)}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-orange-400" />
          </div>
        </div>
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">營業費用</p>
              <p className="text-xl font-bold text-red-600">
                {formatCurrency(incomeStatement.operatingExpenses)}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-400" />
          </div>
        </div>
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">本期淨利</p>
              <p className={`text-xl font-bold ${incomeStatement.netIncome >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(incomeStatement.netIncome)}
              </p>
            </div>
            {incomeStatement.netIncome >= 0 ? (
              <TrendingUp className="w-8 h-8 text-blue-400" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-400" />
            )}
          </div>
        </div>
      </div>

      {/* 報表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none">
        <div className="p-6 border-b border-gray-200 text-center print:border-b-2 print:border-black">
          <h2 className="text-xl font-bold">{company?.name}</h2>
          <h3 className="text-lg font-semibold mt-1">損 益 表</h3>
          <p className="text-sm text-gray-600 mt-1">
            期間：{format(new Date(startDate), 'yyyy年MM月dd日', { locale: zhTW })} 至 {format(new Date(endDate), 'yyyy年MM月dd日', { locale: zhTW })}
          </p>
          <p className="text-xs text-gray-500 mt-1">單位：新台幣元</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-300">
                <th className="py-3 px-4 text-left">項目</th>
                <th className="py-3 px-4 text-right w-40">金額</th>
              </tr>
            </thead>
            <tbody>
              {incomeStatement.items.map((item, index) => (
                <tr 
                  key={item.code}
                  className={`
                    border-b border-gray-100
                    ${item.isTotal ? 'font-bold bg-blue-50 text-blue-900' : ''}
                    ${item.isSubtotal ? 'font-semibold bg-gray-50' : ''}
                    ${item.level === 0 && !item.isTotal && !item.isSubtotal ? 'font-medium bg-gray-50' : ''}
                    ${item.code === 'net-income' ? 'text-lg bg-green-100 text-green-900' : ''}
                  `}
                >
                  <td className={`py-2 px-4 ${item.level === 1 ? 'pl-8' : ''}`}>
                    {item.name}
                  </td>
                  <td className={`py-2 px-4 text-right font-mono ${
                    item.amount < 0 ? 'text-red-600' : ''
                  }`}>
                    {item.amount !== 0 || item.isTotal || item.isSubtotal ? formatCurrency(item.amount) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 毛利率與淨利率 */}
        {incomeStatement.operatingRevenue > 0 && (
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">毛利率：</span>
                <span className="font-semibold">
                  {((incomeStatement.grossProfit / incomeStatement.operatingRevenue) * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-gray-500">營業利益率：</span>
                <span className="font-semibold">
                  {((incomeStatement.operatingIncome / incomeStatement.operatingRevenue) * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-gray-500">稅前淨利率：</span>
                <span className="font-semibold">
                  {((incomeStatement.incomeBeforeTax / incomeStatement.operatingRevenue) * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-gray-500">淨利率：</span>
                <span className="font-semibold">
                  {((incomeStatement.netIncome / incomeStatement.operatingRevenue) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 報表資訊 */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between text-xs text-gray-500 print:bg-white">
          <span>
            {incomeStatement.netIncome >= 0 ? (
              <span className="text-green-600">本期獲利 {formatCurrency(incomeStatement.netIncome)}</span>
            ) : (
              <span className="text-red-600">本期虧損 {formatCurrency(Math.abs(incomeStatement.netIncome))}</span>
            )}
          </span>
          <span>製表日期：{format(new Date(), 'yyyy/MM/dd HH:mm')}</span>
        </div>
      </div>
    </div>
  );
}
