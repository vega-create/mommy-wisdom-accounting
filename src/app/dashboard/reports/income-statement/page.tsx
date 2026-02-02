'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDataStore } from '@/stores/dataStore';
import { useAuthStore } from '@/stores/authStore';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Download, Printer, DollarSign } from 'lucide-react';

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

  const updateURL = (startDate: string, endDate: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    router.replace(`/dashboard/reports/income-statement?${params.toString()}`, { scroll: false });
  };

  const { transactions, accountCategories } = useDataStore();
  const { company } = useAuthStore();
  const [startDate, setStartDate] = useState(url_start);
  const [endDate, setEndDate] = useState(url_end);

  // 快速期間選擇
  const setPeriod = (type: string) => {
    const now = new Date();
    let s = '', e = '';
    switch (type) {
      case 'thisMonth':
        s = format(startOfMonth(now), 'yyyy-MM-dd');
        e = format(endOfMonth(now), 'yyyy-MM-dd');
        break;
      case 'lastMonth':
        s = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
        e = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
        break;
      case 'last3':
        s = format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd');
        e = format(endOfMonth(now), 'yyyy-MM-dd');
        break;
      case 'last6':
        s = format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd');
        e = format(endOfMonth(now), 'yyyy-MM-dd');
        break;
      case 'thisYear':
        s = format(startOfYear(now), 'yyyy-MM-dd');
        e = format(endOfYear(now), 'yyyy-MM-dd');
        break;
    }
    setStartDate(s);
    setEndDate(e);
    updateURL(s, e);
  };

  // 計算損益表（從交易記錄）
  const incomeStatement = useMemo(() => {
    // 建立科目對照表（category_id → code/name）
    const categoryMap = new Map<string, { code: string; name: string; type: string }>();
    accountCategories
      .filter(c => c.company_id === company?.id)
      .forEach(c => categoryMap.set(c.id, { code: c.code, name: c.name, type: c.type }));

    // 篩選期間內的交易（排除轉帳）
    const filtered = transactions.filter(t => {
      if (t.company_id !== company?.id) return false;
      if (t.transaction_type === 'transfer') return false;
      const d = new Date(t.transaction_date);
      return d >= new Date(startDate) && d <= new Date(endDate);
    });

    // 累計各科目金額
    const codeAmounts = new Map<string, { name: string; amount: number }>();
    let uncategorizedIncome = 0;
    let uncategorizedExpense = 0;
    let totalFees = 0;

    filtered.forEach(t => {
      const cat = t.category_id ? categoryMap.get(t.category_id) : null;

      if (cat) {
        const cur = codeAmounts.get(cat.code) || { name: cat.name, amount: 0 };
        cur.amount += t.amount;
        codeAmounts.set(cat.code, cur);
      } else {
        if (t.transaction_type === 'income') uncategorizedIncome += t.amount;
        else if (t.transaction_type === 'expense') uncategorizedExpense += t.amount;
      }

      // 手續費另計
      if (t.has_fee && t.fee_amount > 0) {
        totalFees += t.fee_amount;
      }
    });

    // 建立損益表項目
    const items: IncomeItem[] = [];

    // ── 營業收入 (41xx) ──
    let operatingRevenue = 0;
    items.push({ code: '41', name: '營業收入', amount: 0, level: 0 });

    Array.from(codeAmounts.entries())
      .filter(([code]) => code.startsWith('41'))
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([code, { name, amount }]) => {
        items.push({ code, name, amount, level: 1 });
        operatingRevenue += amount;
      });

    if (uncategorizedIncome > 0) {
      items.push({ code: '未分類', name: '未分類收入', amount: uncategorizedIncome, level: 1 });
      operatingRevenue += uncategorizedIncome;
    }

    items.push({ code: '41-total', name: '營業收入合計', amount: operatingRevenue, level: 0, isSubtotal: true });

    // ── 營業成本 (51xx) ──
    let operatingCost = 0;
    items.push({ code: '51', name: '營業成本', amount: 0, level: 0 });

    Array.from(codeAmounts.entries())
      .filter(([code]) => code.startsWith('51'))
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([code, { name, amount }]) => {
        items.push({ code, name, amount, level: 1 });
        operatingCost += amount;
      });

    items.push({ code: '51-total', name: '營業成本合計', amount: operatingCost, level: 0, isSubtotal: true });

    // ── 營業毛利 ──
    const grossProfit = operatingRevenue - operatingCost;
    items.push({ code: 'gross', name: '營業毛利', amount: grossProfit, level: 0, isTotal: true });

    // ── 營業費用 (61xx–69xx) ──
    let operatingExpenses = 0;
    items.push({ code: '6', name: '營業費用', amount: 0, level: 0 });

    Array.from(codeAmounts.entries())
      .filter(([code]) => code.startsWith('6'))
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([code, { name, amount }]) => {
        items.push({ code, name, amount, level: 1 });
        operatingExpenses += amount;
      });

    if (totalFees > 0) {
      items.push({ code: '手續費', name: '銀行手續費', amount: totalFees, level: 1 });
      operatingExpenses += totalFees;
    }

    if (uncategorizedExpense > 0) {
      items.push({ code: '未分類', name: '未分類支出', amount: uncategorizedExpense, level: 1 });
      operatingExpenses += uncategorizedExpense;
    }

    items.push({ code: '6-total', name: '營業費用合計', amount: operatingExpenses, level: 0, isSubtotal: true });

    // ── 營業淨利 ──
    const operatingIncome = grossProfit - operatingExpenses;
    items.push({ code: 'op', name: '營業淨利', amount: operatingIncome, level: 0, isTotal: true });

    // ── 本期淨利 ──
    items.push({ code: 'net', name: '本期淨利（淨損）', amount: operatingIncome, level: 0, isTotal: true });

    return {
      items,
      totalRevenue: operatingRevenue,
      totalCost: operatingCost,
      grossProfit,
      totalExpenses: operatingExpenses,
      netIncome: operatingIncome,
      txCount: filtered.length,
    };
  }, [transactions, accountCategories, company, startDate, endDate]);

  const formatCurrency = (amount: number) => {
    const abs = Math.abs(amount);
    const formatted = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(abs);
    return amount < 0 ? `(${formatted})` : formatted;
  };

  const handlePrint = () => window.print();

  const handleExport = () => {
    const headers = ['科目代碼', '科目名稱', '金額'];
    const rows = incomeStatement.items
      .filter(item => item.level > 0 || item.isSubtotal || item.isTotal)
      .map(item => [
        item.code,
        (item.level === 1 ? '  ' : '') + item.name,
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

  const profitRate = incomeStatement.totalRevenue > 0
    ? ((incomeStatement.netIncome / incomeStatement.totalRevenue) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">損益表</h1>
          <p className="text-sm text-gray-500 mt-1">依交易記錄彙總收入與支出</p>
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

      {/* 摘要卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">總收入</span>
          </div>
          <p className="text-2xl font-bold text-green-700">${formatCurrency(incomeStatement.totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm font-medium">總成本</span>
          </div>
          <p className="text-2xl font-bold text-red-700">${formatCurrency(incomeStatement.totalCost)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 text-orange-600 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm font-medium">總費用</span>
          </div>
          <p className="text-2xl font-bold text-orange-700">${formatCurrency(incomeStatement.totalExpenses)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm font-medium">淨利（利潤率 {profitRate}%）</span>
          </div>
          <p className={`text-2xl font-bold ${incomeStatement.netIncome >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
            {incomeStatement.netIncome >= 0 ? '+' : ''}${formatCurrency(incomeStatement.netIncome)}
          </p>
        </div>
      </div>

      {/* 篩選區 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex flex-wrap gap-2">
            {[
              { label: '本月', key: 'thisMonth' },
              { label: '上月', key: 'lastMonth' },
              { label: '近3個月', key: 'last3' },
              { label: '近6個月', key: 'last6' },
              { label: '今年', key: 'thisYear' },
            ].map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">{p.label}</button>
            ))}
          </div>
          <div>
            <label className="input-label">開始日期</label>
            <input type="date" value={startDate}
              onChange={e => { setStartDate(e.target.value); updateURL(e.target.value, endDate); }}
              className="input-field" />
          </div>
          <div>
            <label className="input-label">結束日期</label>
            <input type="date" value={endDate}
              onChange={e => { setEndDate(e.target.value); updateURL(startDate, e.target.value); }}
              className="input-field" />
          </div>
        </div>
      </div>

      {/* 報表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none">
        <div className="p-6 border-b border-gray-200 text-center print:border-b-2 print:border-black">
          <h2 className="text-xl font-bold">{company?.name}</h2>
          <h3 className="text-lg font-semibold mt-1">損 益 表</h3>
          <p className="text-sm text-gray-600 mt-1">
            期間：{format(new Date(startDate), 'yyyy年MM月dd日', { locale: zhTW })} 至{' '}
            {format(new Date(endDate), 'yyyy年MM月dd日', { locale: zhTW })}
          </p>
          <p className="text-xs text-gray-500 mt-1">單位：新台幣元</p>
        </div>

        {incomeStatement.txCount === 0 ? (
          <div className="text-center py-12">
            <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">此期間無交易記錄</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-300">
                  <th className="py-3 px-6 text-left w-24">科目代碼</th>
                  <th className="py-3 px-6 text-left">科目名稱</th>
                  <th className="py-3 px-6 text-right w-36">金額</th>
                </tr>
              </thead>
              <tbody>
                {incomeStatement.items.map((item, i) => {
                  if (item.isTotal) {
                    return (
                      <tr key={i} className="bg-blue-50 font-bold border-t-2 border-b-2 border-gray-300">
                        <td className="py-3 px-6"></td>
                        <td className="py-3 px-6">{item.name}</td>
                        <td className={`py-3 px-6 text-right font-mono ${item.amount < 0 ? 'text-red-600' : ''}`}>
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    );
                  }
                  if (item.isSubtotal) {
                    return (
                      <tr key={i} className="bg-gray-100 font-semibold border-t border-gray-300">
                        <td className="py-2 px-6"></td>
                        <td className="py-2 px-6">{item.name}</td>
                        <td className="py-2 px-6 text-right font-mono">{formatCurrency(item.amount)}</td>
                      </tr>
                    );
                  }
                  if (item.level === 0 && item.amount === 0 && !item.isTotal && !item.isSubtotal) {
                    return (
                      <tr key={i} className="border-t border-gray-200">
                        <td className="pt-4 pb-1 px-6 font-semibold text-gray-700" colSpan={3}>{item.name}</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-6 font-mono text-gray-500 pl-10">{item.code}</td>
                      <td className="py-2 px-6 pl-10">{item.name}</td>
                      <td className="py-2 px-6 text-right font-mono">{formatCurrency(item.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between text-xs text-gray-500 print:bg-white">
          <span>共 {incomeStatement.txCount} 筆交易</span>
          <span>製表日期：{format(new Date(), 'yyyy/MM/dd HH:mm')}</span>
        </div>
      </div>
    </div>
  );
}
