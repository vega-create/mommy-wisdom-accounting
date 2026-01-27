'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDataStore } from '@/stores/dataStore';
import { useAuthStore } from '@/stores/authStore';
import { format, endOfMonth } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Scale, Download, Printer } from 'lucide-react';
import { defaultAccountCategories } from '@/data/accounts';

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

  // 更新 URL 參數
  const updateURL = (reportDate: string) => {
    const params = new URLSearchParams();
    if (reportDate) params.set('date', reportDate);
    router.replace(`/dashboard/reports/balance-sheet?${params.toString()}`, { scroll: false });
  };

  const { vouchers, voucherItems } = useDataStore();
  const { company } = useAuthStore();
  const [reportDate, setReportDate] = useState(url_date);

  // 計算資產負債表
  const balanceSheet = useMemo(() => {
    // 計算各科目餘額
    const accountBalances: Map<string, number> = new Map();

    // 取得已核准且日期在報表日期之前的憑證
    const approvedVouchers = vouchers.filter(
      v => v.company_id === company?.id && 
           v.status === 'approved' && 
           new Date(v.voucher_date) <= new Date(reportDate)
    );

    // 累計各科目金額
    approvedVouchers.forEach(voucher => {
      const items = voucherItems.filter(item => item.voucher_id === voucher.id);
      items.forEach(item => {
        const accountId = item.account_id;
        if (!accountId) return;
        const account = defaultAccountCategories.find(a => a.code === accountId);
        if (!account) return;

        const currentBalance = accountBalances.get(accountId) || 0;
        
        // 根據科目性質計算餘額
        if (['asset', 'cost', 'expense'].includes(account.type)) {
          accountBalances.set(accountId, currentBalance + item.debit_amount - item.credit_amount);
        } else {
          accountBalances.set(accountId, currentBalance + item.credit_amount - item.debit_amount);
        }
      });
    });

    // 建立資產項目
    const buildAssets = (): BalanceItem[] => {
      const items: BalanceItem[] = [];
      let totalCurrentAssets = 0;
      let totalNonCurrentAssets = 0;

      // 流動資產 (11xx)
      items.push({ code: '11', name: '流動資產', amount: 0, level: 1 });
      defaultAccountCategories
        .filter(a => a.code.startsWith('11') && a.code.length === 4)
        .forEach(account => {
          const balance = accountBalances.get(account.code) || 0;
          if (balance !== 0) {
            items.push({ code: account.code, name: account.name, amount: balance, level: 2 });
            totalCurrentAssets += balance;
          }
        });
      items.push({ code: '11-total', name: '流動資產合計', amount: totalCurrentAssets, level: 1, isTotal: true });

      // 非流動資產 (12xx-19xx)
      items.push({ code: '12', name: '非流動資產', amount: 0, level: 1 });
      defaultAccountCategories
        .filter(a => a.type === 'asset' && !a.code.startsWith('11') && a.code.length === 4)
        .forEach(account => {
          const balance = accountBalances.get(account.code) || 0;
          if (balance !== 0) {
            items.push({ code: account.code, name: account.name, amount: balance, level: 2 });
            totalNonCurrentAssets += balance;
          }
        });
      items.push({ code: '12-total', name: '非流動資產合計', amount: totalNonCurrentAssets, level: 1, isTotal: true });

      items.push({ code: '1-total', name: '資產總計', amount: totalCurrentAssets + totalNonCurrentAssets, level: 0, isTotal: true });

      return items;
    };

    // 建立負債項目
    const buildLiabilities = (): BalanceItem[] => {
      const items: BalanceItem[] = [];
      let totalCurrentLiabilities = 0;
      let totalNonCurrentLiabilities = 0;

      // 流動負債 (21xx)
      items.push({ code: '21', name: '流動負債', amount: 0, level: 1 });
      defaultAccountCategories
        .filter(a => a.code.startsWith('21') && a.code.length === 4)
        .forEach(account => {
          const balance = accountBalances.get(account.code) || 0;
          if (balance !== 0) {
            items.push({ code: account.code, name: account.name, amount: balance, level: 2 });
            totalCurrentLiabilities += balance;
          }
        });
      items.push({ code: '21-total', name: '流動負債合計', amount: totalCurrentLiabilities, level: 1, isTotal: true });

      // 非流動負債 (22xx-29xx)
      items.push({ code: '22', name: '非流動負債', amount: 0, level: 1 });
      defaultAccountCategories
        .filter(a => a.type === 'liability' && !a.code.startsWith('21') && a.code.length === 4)
        .forEach(account => {
          const balance = accountBalances.get(account.code) || 0;
          if (balance !== 0) {
            items.push({ code: account.code, name: account.name, amount: balance, level: 2 });
            totalNonCurrentLiabilities += balance;
          }
        });
      items.push({ code: '22-total', name: '非流動負債合計', amount: totalNonCurrentLiabilities, level: 1, isTotal: true });

      items.push({ code: '2-total', name: '負債總計', amount: totalCurrentLiabilities + totalNonCurrentLiabilities, level: 0, isTotal: true });

      return items;
    };

    // 建立權益項目
    const buildEquity = (): BalanceItem[] => {
      const items: BalanceItem[] = [];
      let totalEquity = 0;

      items.push({ code: '31', name: '股東權益', amount: 0, level: 1 });
      defaultAccountCategories
        .filter(a => a.type === 'equity' && a.code.length === 4)
        .forEach(account => {
          const balance = accountBalances.get(account.code) || 0;
          if (balance !== 0) {
            items.push({ code: account.code, name: account.name, amount: balance, level: 2 });
            totalEquity += balance;
          }
        });

      // 計算本期損益（收入 - 成本 - 費用）
      let netIncome = 0;
      defaultAccountCategories
        .filter(a => ['revenue', 'cost', 'expense'].includes(a.type) && a.code.length === 4)
        .forEach(account => {
          const balance = accountBalances.get(account.code) || 0;
          if (account.type === 'revenue') {
            netIncome += balance;
          } else {
            netIncome -= balance;
          }
        });
      
      if (netIncome !== 0) {
        items.push({ code: 'net-income', name: '本期損益', amount: netIncome, level: 2 });
        totalEquity += netIncome;
      }

      items.push({ code: '3-total', name: '權益總計', amount: totalEquity, level: 0, isTotal: true });

      return items;
    };

    const assets = buildAssets();
    const liabilities = buildLiabilities();
    const equity = buildEquity();

    const totalAssets = assets.find(a => a.code === '1-total')?.amount || 0;
    const totalLiabilities = liabilities.find(l => l.code === '2-total')?.amount || 0;
    const totalEquity = equity.find(e => e.code === '3-total')?.amount || 0;

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
    };
  }, [vouchers, voucherItems, company, reportDate]);

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
    const rows: string[][] = [];
    
    rows.push(['資產', '', '負債及權益', '']);
    
    const maxRows = Math.max(
      balanceSheet.assets.length,
      balanceSheet.liabilities.length + balanceSheet.equity.length
    );

    const liabilityAndEquity = [...balanceSheet.liabilities, ...balanceSheet.equity];

    for (let i = 0; i < maxRows; i++) {
      const asset = balanceSheet.assets[i];
      const le = liabilityAndEquity[i];
      rows.push([
        asset ? asset.name : '',
        asset ? formatCurrency(asset.amount) : '',
        le ? le.name : '',
        le ? formatCurrency(le.amount) : '',
      ]);
    }

    const csvContent = rows
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `資產負債表_${reportDate}.csv`;
    link.click();
  };

  const renderItems = (items: BalanceItem[]) => {
    return items.map((item, index) => (
      <tr 
        key={item.code}
        className={`
          ${item.isTotal ? 'font-semibold bg-gray-100' : ''}
          ${item.level === 0 ? 'text-lg font-bold bg-blue-100' : ''}
          ${item.level === 1 && !item.isTotal ? 'font-medium text-gray-700' : ''}
          border-b border-gray-100
        `}
      >
        <td className={`py-2 px-4 ${item.level === 2 ? 'pl-8' : ''}`}>
          {item.name}
        </td>
        <td className="py-2 px-4 text-right font-mono">
          {item.amount !== 0 || item.isTotal ? formatCurrency(item.amount) : ''}
        </td>
      </tr>
    ));
  };

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">資產負債表</h1>
          <p className="text-sm text-gray-500 mt-1">顯示公司在特定日期的財務狀況</p>
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
        <div className="flex items-end gap-4">
          <div>
            <label className="input-label">報表日期</label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="input-field"
            />
          </div>
          <button
            onClick={() => setReportDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'))}
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
            {format(new Date(reportDate), 'yyyy年MM月dd日', { locale: zhTW })}
          </p>
          <p className="text-xs text-gray-500 mt-1">單位：新台幣元</p>
        </div>

        {/* 平衡檢查 */}
        {!balanceSheet.isBalanced && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <p className="text-red-700 text-sm font-medium">
              ⚠️ 警告：資產負債表不平衡！差額：
              {formatCurrency(balanceSheet.totalAssets - (balanceSheet.totalLiabilities + balanceSheet.totalEquity))}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
          {/* 資產 */}
          <div>
            <div className="bg-blue-50 px-4 py-2 font-semibold text-blue-800 border-b border-gray-200">
              資 產
            </div>
            <table className="w-full text-sm">
              <tbody>
                {renderItems(balanceSheet.assets)}
              </tbody>
            </table>
          </div>

          {/* 負債及權益 */}
          <div>
            <div className="bg-green-50 px-4 py-2 font-semibold text-green-800 border-b border-gray-200">
              負債及權益
            </div>
            <table className="w-full text-sm">
              <tbody>
                {renderItems(balanceSheet.liabilities)}
                <tr className="h-4"><td colSpan={2}></td></tr>
                {renderItems(balanceSheet.equity)}
                {/* 負債及權益總計 */}
                <tr className="font-bold text-lg bg-green-100 border-t-2 border-gray-300">
                  <td className="py-2 px-4">負債及權益總計</td>
                  <td className="py-2 px-4 text-right font-mono">
                    {formatCurrency(balanceSheet.totalLiabilities + balanceSheet.totalEquity)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 報表資訊 */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between text-xs text-gray-500 print:bg-white">
          <span>
            {balanceSheet.isBalanced ? (
              <span className="text-green-600">✓ 資產負債表已平衡</span>
            ) : (
              <span className="text-red-600">✗ 資產負債表不平衡</span>
            )}
          </span>
          <span>製表日期：{format(new Date(), 'yyyy/MM/dd HH:mm')}</span>
        </div>
      </div>
    </div>
  );
}
