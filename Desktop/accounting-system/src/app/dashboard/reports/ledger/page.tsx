'use client';

import { useState, useMemo } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useAuthStore } from '@/stores/authStore';
import { format, startOfMonth, endOfMonth, startOfYear } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { BookMarked, Download, Printer, ChevronDown, ChevronRight } from 'lucide-react';
import { defaultAccountCategories } from '@/data/accounts';

type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'cost' | 'expense';

interface LedgerEntry {
  date: string;
  voucherNumber: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface AccountLedger {
  code: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  entries: LedgerEntry[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
}

const accountTypeLabels: Record<AccountType, string> = {
  asset: '資產',
  liability: '負債',
  equity: '權益',
  revenue: '收入',
  cost: '成本',
  expense: '費用',
};

export default function LedgerPage() {
  const { vouchers, voucherItems } = useDataStore();
  const { company } = useAuthStore();
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  // 計算各科目的分類帳
  const accountLedgers = useMemo(() => {
    const ledgers: Map<string, AccountLedger> = new Map();
    
    // 取得已核准的憑證
    const approvedVouchers = vouchers
      .filter(v => v.company_id === company?.id && v.status === 'approved')
      .sort((a, b) => new Date(a.voucher_date).getTime() - new Date(b.voucher_date).getTime());

    // 為每個科目建立分類帳
    voucherItems.forEach(item => {
      const voucher = approvedVouchers.find(v => v.id === item.voucher_id);
      if (!voucher) return;

      const account = defaultAccountCategories.find(a => a.code === item.account_id);
      if (!account) return;

      if (!ledgers.has(item.account_id || '')) {
        ledgers.set(item.account_id || '', {
          code: item.account_id || '',
          name: item.description || '',
          type: account.type as AccountType,
          openingBalance: 0,
          entries: [],
          closingBalance: 0,
          totalDebit: 0,
          totalCredit: 0,
        });
      }

      const ledger = ledgers.get(item.account_id)!;
      const voucherDate = new Date(voucher.voucher_date);
      const periodStart = new Date(startDate);
      const periodEnd = new Date(endDate);

      // 期初餘額（期間開始前的交易）
      if (voucherDate < periodStart) {
        // 根據科目性質計算期初餘額
        if (['asset', 'cost', 'expense'].includes(account.type)) {
          ledger.openingBalance += item.debit_amount - item.credit_amount;
        } else {
          ledger.openingBalance += item.credit_amount - item.debit_amount;
        }
      }
      // 期間內的交易
      else if (voucherDate >= periodStart && voucherDate <= periodEnd) {
        ledger.entries.push({
          date: voucher.voucher_date,
          voucherNumber: voucher.voucher_number,
          description: item.description || voucher.description,
          debit: item.debit_amount,
          credit: item.credit_amount,
          balance: 0, // 稍後計算
        });
        ledger.total_debit += item.debit_amount;
        ledger.total_credit += item.credit_amount;
      }
    });

    // 計算每個科目的餘額
    ledgers.forEach((ledger, code) => {
      const account = defaultAccountCategories.find(a => a.code === code);
      let runningBalance = ledger.openingBalance;

      ledger.entries.forEach(entry => {
        if (account && ['asset', 'cost', 'expense'].includes(account.type)) {
          runningBalance += entry.debit - entry.credit;
        } else {
          runningBalance += entry.credit - entry.debit;
        }
        entry.balance = runningBalance;
      });

      ledger.closingBalance = runningBalance;
    });

    // 轉換為陣列並排序
    return Array.from(ledgers.values())
      .filter(l => l.entries.length > 0 || l.openingBalance !== 0)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [vouchers, voucherItems, currentCompany, startDate, endDate]);

  // 篩選後的科目
  const filteredLedgers = useMemo(() => {
    if (selectedAccount === 'all') return accountLedgers;
    return accountLedgers.filter(l => l.code === selectedAccount);
  }, [accountLedgers, selectedAccount]);

  const formatCurrency = (amount: number) => {
    const absAmount = Math.abs(amount);
    const formatted = new Intl.NumberFormat('zh-TW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(absAmount);
    return amount < 0 ? `(${formatted})` : formatted;
  };

  const toggleAccount = (code: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedAccounts(newExpanded);
  };

  const expandAll = () => {
    setExpandedAccounts(new Set(filteredLedgers.map(l => l.code)));
  };

  const collapseAll = () => {
    setExpandedAccounts(new Set());
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const headers = ['科目代碼', '科目名稱', '日期', '憑證號碼', '摘要', '借方', '貸方', '餘額'];
    const rows: string[][] = [];

    filteredLedgers.forEach(ledger => {
      // 期初餘額
      rows.push([
        ledger.code,
        ledger.name,
        '',
        '',
        '期初餘額',
        '',
        '',
        formatCurrency(ledger.openingBalance),
      ]);
      // 明細
      ledger.entries.forEach(entry => {
        rows.push([
          '',
          '',
          format(new Date(entry.date), 'yyyy/MM/dd'),
          entry.voucher_number,
          entry.description,
          entry.debit > 0 ? formatCurrency(entry.debit) : '',
          entry.credit > 0 ? formatCurrency(entry.credit) : '',
          formatCurrency(entry.balance),
        ]);
      });
      // 期末餘額
      rows.push([
        '',
        '',
        '',
        '',
        '期末餘額',
        formatCurrency(ledger.total_debit),
        formatCurrency(ledger.total_credit),
        formatCurrency(ledger.closingBalance),
      ]);
      // 空行
      rows.push(['', '', '', '', '', '', '', '']);
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `總分類帳_${startDate}_${endDate}.csv`;
    link.click();
  };

  // 取得有資料的科目清單
  const accountsWithData = useMemo(() => {
    return accountLedgers.map(l => ({ code: l.code, name: l.name }));
  }, [accountLedgers]);

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">總分類帳</h1>
          <p className="text-sm text-gray-500 mt-1">按會計科目分類的帳簿記錄</p>
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
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="input-label">結束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex-1">
            <label className="input-label">會計科目</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="input-field"
            >
              <option value="all">全部科目</option>
              {accountsWithData.map(account => (
                <option key={account.code} value={account.code}>
                  {account.code} {account.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={expandAll} className="btn-secondary text-sm">
              全部展開
            </button>
            <button onClick={collapseAll} className="btn-secondary text-sm">
              全部收合
            </button>
          </div>
        </div>
      </div>

      {/* 報表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none">
        <div className="p-6 border-b border-gray-200 text-center print:border-b-2 print:border-black">
          <h2 className="text-xl font-bold">{currentCompany?.name}</h2>
          <h3 className="text-lg font-semibold mt-1">總 分 類 帳</h3>
          <p className="text-sm text-gray-600 mt-1">
            期間：{format(new Date(startDate), 'yyyy年MM月dd日', { locale: zhTW })} 至 {format(new Date(endDate), 'yyyy年MM月dd日', { locale: zhTW })}
          </p>
          <p className="text-xs text-gray-500 mt-1">單位：新台幣元</p>
        </div>

        {filteredLedgers.length === 0 ? (
          <div className="text-center py-12">
            <BookMarked className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">此期間無帳務記錄</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredLedgers.map((ledger) => {
              const isExpanded = expandedAccounts.has(ledger.code);

              return (
                <div key={ledger.code}>
                  {/* 科目標題 */}
                  <button
                    onClick={() => toggleAccount(ledger.code)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                      <span className="font-mono text-blue-600 font-medium">{ledger.code}</span>
                      <span className="font-semibold">{ledger.name}</span>
                      <span className="text-xs px-2 py-1 bg-gray-200 rounded">
                        {accountTypeLabels[ledger.type]}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-gray-500">
                        {ledger.entries.length} 筆
                      </span>
                      <span className={`font-mono font-medium ${
                        ledger.closingBalance >= 0 ? 'text-gray-900' : 'text-red-600'
                      }`}>
                        餘額：{formatCurrency(ledger.closingBalance)}
                      </span>
                    </div>
                  </button>

                  {/* 展開的明細 */}
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100 border-b border-gray-200">
                            <th className="py-2 px-4 text-left w-24">日期</th>
                            <th className="py-2 px-4 text-left w-28">憑證號碼</th>
                            <th className="py-2 px-4 text-left">摘要</th>
                            <th className="py-2 px-4 text-right w-28">借方</th>
                            <th className="py-2 px-4 text-right w-28">貸方</th>
                            <th className="py-2 px-4 text-right w-28">餘額</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* 期初餘額 */}
                          <tr className="border-b border-gray-100 bg-blue-50">
                            <td colSpan={5} className="py-2 px-4 text-right font-medium">
                              期初餘額
                            </td>
                            <td className="py-2 px-4 text-right font-mono">
                              {formatCurrency(ledger.openingBalance)}
                            </td>
                          </tr>
                          {/* 明細 */}
                          {ledger.entries.map((entry, index) => (
                            <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-4">
                                {format(new Date(entry.date), 'MM/dd')}
                              </td>
                              <td className="py-2 px-4 font-mono text-blue-600">
                                {entry.voucher_number}
                              </td>
                              <td className="py-2 px-4 text-gray-600">{entry.description}</td>
                              <td className="py-2 px-4 text-right font-mono">
                                {entry.debit > 0 ? formatCurrency(entry.debit) : ''}
                              </td>
                              <td className="py-2 px-4 text-right font-mono">
                                {entry.credit > 0 ? formatCurrency(entry.credit) : ''}
                              </td>
                              <td className="py-2 px-4 text-right font-mono">
                                {formatCurrency(entry.balance)}
                              </td>
                            </tr>
                          ))}
                          {/* 期末餘額 */}
                          <tr className="bg-gray-100 font-semibold">
                            <td colSpan={3} className="py-2 px-4 text-right">
                              本期合計 / 期末餘額
                            </td>
                            <td className="py-2 px-4 text-right font-mono">
                              {formatCurrency(ledger.total_debit)}
                            </td>
                            <td className="py-2 px-4 text-right font-mono">
                              {formatCurrency(ledger.total_credit)}
                            </td>
                            <td className="py-2 px-4 text-right font-mono">
                              {formatCurrency(ledger.closingBalance)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 報表資訊 */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between text-xs text-gray-500 print:bg-white">
          <span>共 {filteredLedgers.length} 個科目</span>
          <span>製表日期：{format(new Date(), 'yyyy/MM/dd HH:mm')}</span>
        </div>
      </div>
    </div>
  );
}
