'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDataStore } from '@/stores/dataStore';
import { useAuthStore } from '@/stores/authStore';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { BookMarked, Download, Printer, ChevronDown, ChevronRight } from 'lucide-react';

interface LedgerEntry {
  date: string;
  description: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

interface AccountLedger {
  code: string;
  name: string;
  accountType: string;
  openingBalance: number;
  entries: LedgerEntry[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
}

const typeLabels: Record<string, string> = {
  revenue: '收入',
  expense: '費用',
  bank: '銀行帳戶',
};

export default function LedgerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const url_start = searchParams.get('start') || format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const url_end = searchParams.get('end') || format(endOfMonth(new Date()), 'yyyy-MM-dd');
  const url_account = searchParams.get('account') || 'all';

  const updateURL = (startDate: string, endDate: string, selectedAccount: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    if (selectedAccount) params.set('account', selectedAccount);
    router.replace(`/dashboard/reports/ledger?${params.toString()}`, { scroll: false });
  };

  const { transactions, accountCategories, bankAccounts } = useDataStore();
  const { company } = useAuthStore();
  const [startDate, setStartDate] = useState(url_start);
  const [endDate, setEndDate] = useState(url_end);
  const [selectedAccount, setSelectedAccount] = useState<string>(url_account);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  // 計算各科目的分類帳
  const accountLedgers = useMemo(() => {
    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);
    periodEnd.setHours(23, 59, 59, 999);

    // 建立科目對照表
    const categoryMap = new Map<string, { code: string; name: string; type: string }>();
    accountCategories
      .filter(c => c.company_id === company?.id)
      .forEach(c => categoryMap.set(c.id, { code: c.code, name: c.name, type: c.type }));

    // 建立帳戶對照表
    const bankMap = new Map<string, { name: string; initial: number }>();
    bankAccounts
      .filter(a => a.company_id === company?.id)
      .forEach(a => bankMap.set(a.id, { name: a.name, initial: a.initial_balance || 0 }));

    // 篩選公司交易
    const companyTx = transactions.filter(t => t.company_id === company?.id);

    const ledgers = new Map<string, AccountLedger>();

    // 確保科目存在
    const ensureLedger = (key: string, code: string, name: string, accountType: string) => {
      if (!ledgers.has(key)) {
        ledgers.set(key, {
          code, name, accountType,
          openingBalance: 0,
          entries: [],
          closingBalance: 0,
          totalDebit: 0,
          totalCredit: 0,
        });
      }
      return ledgers.get(key)!;
    };

    // 處理每筆交易，為每個相關科目記入分錄
    companyTx.forEach(t => {
      const txDate = new Date(t.transaction_date);
      const cat = t.category_id ? categoryMap.get(t.category_id) : null;
      const catKey = cat ? `cat-${cat.code}` : (t.transaction_type === 'income' ? 'cat-未分類收入' : 'cat-未分類支出');
      const catCode = cat?.code || '未分類';
      const catName = cat?.name || (t.transaction_type === 'income' ? '未分類收入' : '未分類支出');
      const catType = cat?.type || t.transaction_type;

      if (t.transaction_type === 'income') {
        // 收入科目：貸方增加
        const ledger = ensureLedger(catKey, catCode, catName, catType);
        if (txDate < periodStart) {
          ledger.openingBalance += t.amount;
        } else if (txDate <= periodEnd) {
          ledger.entries.push({
            date: t.transaction_date, description: t.description || '', type: '收款',
            debit: 0, credit: t.amount, balance: 0,
          });
          ledger.totalCredit += t.amount;
        }

        // 銀行帳戶：借方增加
        if (t.bank_account_id) {
          const bank = bankMap.get(t.bank_account_id);
          const bankLedger = ensureLedger(`bank-${t.bank_account_id}`, '1101', bank?.name || '銀行帳戶', 'bank');
          if (bankLedger.openingBalance === 0 && bank) bankLedger.openingBalance = bank.initial;
          if (txDate < periodStart) {
            bankLedger.openingBalance += t.amount;
          } else if (txDate <= periodEnd) {
            bankLedger.entries.push({
              date: t.transaction_date, description: t.description || '', type: '收款',
              debit: t.amount, credit: 0, balance: 0,
            });
            bankLedger.totalDebit += t.amount;
          }
        }
      }

      if (t.transaction_type === 'expense') {
        // 費用科目：借方增加
        const ledger = ensureLedger(catKey, catCode, catName, catType);
        if (txDate < periodStart) {
          ledger.openingBalance += t.amount;
        } else if (txDate <= periodEnd) {
          ledger.entries.push({
            date: t.transaction_date, description: t.description || '', type: '付款',
            debit: t.amount, credit: 0, balance: 0,
          });
          ledger.totalDebit += t.amount;
        }

        // 銀行帳戶：貸方增加
        if (t.bank_account_id) {
          const bank = bankMap.get(t.bank_account_id);
          const bankLedger = ensureLedger(`bank-${t.bank_account_id}`, '1101', bank?.name || '銀行帳戶', 'bank');
          if (bankLedger.openingBalance === 0 && bank) bankLedger.openingBalance = bank.initial;
          const totalOut = t.amount + (t.has_fee && t.fee_amount > 0 ? t.fee_amount : 0);
          if (txDate < periodStart) {
            bankLedger.openingBalance -= totalOut;
          } else if (txDate <= periodEnd) {
            bankLedger.entries.push({
              date: t.transaction_date, description: t.description || '', type: '付款',
              debit: 0, credit: totalOut, balance: 0,
            });
            bankLedger.totalCredit += totalOut;
          }
        }

        // 手續費科目
        if (t.has_fee && t.fee_amount > 0) {
          const feeLedger = ensureLedger('cat-手續費', '6900', '手續費', 'expense');
          if (txDate < periodStart) {
            feeLedger.openingBalance += t.fee_amount;
          } else if (txDate <= periodEnd) {
            feeLedger.entries.push({
              date: t.transaction_date, description: `${t.description || ''} 手續費`, type: '付款',
              debit: t.fee_amount, credit: 0, balance: 0,
            });
            feeLedger.totalDebit += t.fee_amount;
          }
        }
      }

      if (t.transaction_type === 'transfer') {
        // 轉出帳戶：貸方
        if (t.from_account_id) {
          const bank = bankMap.get(t.from_account_id);
          const fromLedger = ensureLedger(`bank-${t.from_account_id}`, '1101', bank?.name || '轉出帳戶', 'bank');
          if (fromLedger.openingBalance === 0 && bank) fromLedger.openingBalance = bank.initial;
          const totalOut = t.amount + (t.has_fee && t.fee_amount > 0 ? t.fee_amount : 0);
          if (txDate < periodStart) {
            fromLedger.openingBalance -= totalOut;
          } else if (txDate <= periodEnd) {
            fromLedger.entries.push({
              date: t.transaction_date, description: `轉帳至 ${bankMap.get(t.to_account_id || '')?.name || ''}`, type: '轉帳',
              debit: 0, credit: totalOut, balance: 0,
            });
            fromLedger.totalCredit += totalOut;
          }
        }
        // 轉入帳戶：借方
        if (t.to_account_id) {
          const bank = bankMap.get(t.to_account_id);
          const toLedger = ensureLedger(`bank-${t.to_account_id}`, '1101', bank?.name || '轉入帳戶', 'bank');
          if (toLedger.openingBalance === 0 && bank) toLedger.openingBalance = bank.initial;
          if (txDate < periodStart) {
            toLedger.openingBalance += t.amount;
          } else if (txDate <= periodEnd) {
            toLedger.entries.push({
              date: t.transaction_date, description: `從 ${bankMap.get(t.from_account_id || '')?.name || ''} 轉入`, type: '轉帳',
              debit: t.amount, credit: 0, balance: 0,
            });
            toLedger.totalDebit += t.amount;
          }
        }
        // 轉帳手續費
        if (t.has_fee && t.fee_amount > 0) {
          const feeLedger = ensureLedger('cat-手續費', '6900', '手續費', 'expense');
          if (txDate < periodStart) {
            feeLedger.openingBalance += t.fee_amount;
          } else if (txDate <= periodEnd) {
            feeLedger.entries.push({
              date: t.transaction_date, description: '轉帳手續費', type: '轉帳',
              debit: t.fee_amount, credit: 0, balance: 0,
            });
            feeLedger.totalDebit += t.fee_amount;
          }
        }
      }
    });

    // 計算各科目餘額
    ledgers.forEach((ledger) => {
      let running = ledger.openingBalance;
      // 排序明細
      ledger.entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      ledger.entries.forEach(entry => {
        if (ledger.accountType === 'bank') {
          // 資產類：借增貸減
          running += entry.debit - entry.credit;
        } else if (ledger.accountType === 'revenue') {
          // 收入類：貸增借減
          running += entry.credit - entry.debit;
        } else {
          // 費用類：借增貸減
          running += entry.debit - entry.credit;
        }
        entry.balance = running;
      });

      ledger.closingBalance = running;
    });

    return Array.from(ledgers.values())
      .filter(l => l.entries.length > 0 || l.openingBalance !== 0)
      .sort((a, b) => {
        // 銀行帳戶排前面
        if (a.accountType === 'bank' && b.accountType !== 'bank') return -1;
        if (a.accountType !== 'bank' && b.accountType === 'bank') return 1;
        return a.code.localeCompare(b.code);
      });
  }, [transactions, accountCategories, bankAccounts, company, startDate, endDate]);

  // 篩選
  const filteredLedgers = useMemo(() => {
    if (selectedAccount === 'all') return accountLedgers;
    return accountLedgers.filter(l => `${l.code}-${l.name}` === selectedAccount);
  }, [accountLedgers, selectedAccount]);

  const formatCurrency = (amount: number) => {
    const abs = Math.abs(amount);
    const formatted = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(abs);
    return amount < 0 ? `(${formatted})` : formatted;
  };

  const toggleAccount = (key: string) => {
    const next = new Set(expandedAccounts);
    next.has(key) ? next.delete(key) : next.add(key);
    setExpandedAccounts(next);
  };
  const expandAll = () => setExpandedAccounts(new Set(filteredLedgers.map(l => `${l.code}-${l.name}`)));
  const collapseAll = () => setExpandedAccounts(new Set());

  const handlePrint = () => window.print();

  const handleExport = () => {
    const headers = ['科目代碼', '科目名稱', '日期', '摘要', '類型', '借方', '貸方', '餘額'];
    const rows: string[][] = [];

    filteredLedgers.forEach(ledger => {
      rows.push([ledger.code, ledger.name, '', '期初餘額', '', '', '', formatCurrency(ledger.openingBalance)]);
      ledger.entries.forEach(entry => {
        rows.push([
          '', '', format(new Date(entry.date), 'yyyy/MM/dd'), entry.description, entry.type,
          entry.debit > 0 ? formatCurrency(entry.debit) : '',
          entry.credit > 0 ? formatCurrency(entry.credit) : '',
          formatCurrency(entry.balance),
        ]);
      });
      rows.push(['', '', '', '期末餘額', '', formatCurrency(ledger.totalDebit), formatCurrency(ledger.totalCredit), formatCurrency(ledger.closingBalance)]);
      rows.push(['', '', '', '', '', '', '', '']);
    });

    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `總分類帳_${startDate}_${endDate}.csv`;
    link.click();
  };

  const accountsWithData = useMemo(() => {
    return accountLedgers.map(l => ({ key: `${l.code}-${l.name}`, label: `${l.code} ${l.name}` }));
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
            <input type="date" value={startDate}
              onChange={e => { setStartDate(e.target.value); updateURL(e.target.value, endDate, selectedAccount); }}
              className="input-field" />
          </div>
          <div>
            <label className="input-label">結束日期</label>
            <input type="date" value={endDate}
              onChange={e => { setEndDate(e.target.value); updateURL(startDate, e.target.value, selectedAccount); }}
              className="input-field" />
          </div>
          <div className="flex-1">
            <label className="input-label">會計科目</label>
            <select value={selectedAccount}
              onChange={e => { setSelectedAccount(e.target.value); updateURL(startDate, endDate, e.target.value); }}
              className="input-field">
              <option value="all">全部科目</option>
              {accountsWithData.map(a => (
                <option key={a.key} value={a.key}>{a.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={expandAll} className="btn-secondary text-sm">全部展開</button>
            <button onClick={collapseAll} className="btn-secondary text-sm">全部收合</button>
          </div>
        </div>
      </div>

      {/* 報表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none">
        <div className="p-6 border-b border-gray-200 text-center print:border-b-2 print:border-black">
          <h2 className="text-xl font-bold">{company?.name}</h2>
          <h3 className="text-lg font-semibold mt-1">總 分 類 帳</h3>
          <p className="text-sm text-gray-600 mt-1">
            期間：{format(new Date(startDate), 'yyyy年MM月dd日', { locale: zhTW })} 至{' '}
            {format(new Date(endDate), 'yyyy年MM月dd日', { locale: zhTW })}
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
            {filteredLedgers.map(ledger => {
              const key = `${ledger.code}-${ledger.name}`;
              const isExpanded = expandedAccounts.has(key);

              return (
                <div key={key}>
                  <button
                    onClick={() => toggleAccount(key)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded
                        ? <ChevronDown className="w-5 h-5 text-gray-400" />
                        : <ChevronRight className="w-5 h-5 text-gray-400" />}
                      <span className="font-mono text-blue-600 font-medium">{ledger.code}</span>
                      <span className="font-semibold">{ledger.name}</span>
                      <span className="text-xs px-2 py-1 bg-gray-200 rounded">
                        {typeLabels[ledger.accountType] || ledger.accountType}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-gray-500">{ledger.entries.length} 筆</span>
                      <span className={`font-mono font-medium ${ledger.closingBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        餘額：{formatCurrency(ledger.closingBalance)}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100 border-b border-gray-200">
                            <th className="py-2 px-4 text-left w-24">日期</th>
                            <th className="py-2 px-4 text-left">摘要</th>
                            <th className="py-2 px-4 text-center w-16">類型</th>
                            <th className="py-2 px-4 text-right w-28">借方</th>
                            <th className="py-2 px-4 text-right w-28">貸方</th>
                            <th className="py-2 px-4 text-right w-28">餘額</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-100 bg-blue-50">
                            <td colSpan={5} className="py-2 px-4 text-right font-medium">期初餘額</td>
                            <td className="py-2 px-4 text-right font-mono">{formatCurrency(ledger.openingBalance)}</td>
                          </tr>
                          {ledger.entries.map((entry, i) => (
                            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-4">{format(new Date(entry.date), 'MM/dd')}</td>
                              <td className="py-2 px-4 text-gray-600">{entry.description}</td>
                              <td className="py-2 px-4 text-center text-xs text-gray-500">{entry.type}</td>
                              <td className="py-2 px-4 text-right font-mono">
                                {entry.debit > 0 ? formatCurrency(entry.debit) : ''}
                              </td>
                              <td className="py-2 px-4 text-right font-mono">
                                {entry.credit > 0 ? formatCurrency(entry.credit) : ''}
                              </td>
                              <td className="py-2 px-4 text-right font-mono">{formatCurrency(entry.balance)}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-100 font-semibold">
                            <td colSpan={3} className="py-2 px-4 text-right">本期合計 / 期末餘額</td>
                            <td className="py-2 px-4 text-right font-mono">{formatCurrency(ledger.totalDebit)}</td>
                            <td className="py-2 px-4 text-right font-mono">{formatCurrency(ledger.totalCredit)}</td>
                            <td className="py-2 px-4 text-right font-mono">{formatCurrency(ledger.closingBalance)}</td>
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

        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between text-xs text-gray-500 print:bg-white">
          <span>共 {filteredLedgers.length} 個科目</span>
          <span>製表日期：{format(new Date(), 'yyyy/MM/dd HH:mm')}</span>
        </div>
      </div>
    </div>
  );
}
