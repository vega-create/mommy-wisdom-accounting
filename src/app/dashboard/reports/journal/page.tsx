'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDataStore } from '@/stores/dataStore';
import { useAuthStore } from '@/stores/authStore';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { BookOpen, Download, Printer } from 'lucide-react';

const typeLabels: Record<string, string> = {
  income: '收',
  expense: '付',
  transfer: '轉',
};

const typeBgColors: Record<string, string> = {
  income: 'bg-green-100 text-green-700',
  expense: 'bg-red-100 text-red-700',
  transfer: 'bg-blue-100 text-blue-700',
};

interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: string;
  date: string;
  type: string;
  description: string;
  lines: JournalLine[];
}

export default function JournalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const url_start = searchParams.get('start') || format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const url_end = searchParams.get('end') || format(endOfMonth(new Date()), 'yyyy-MM-dd');
  const url_type = searchParams.get('type') || 'all';

  const updateURL = (startDate: string, endDate: string, filterType: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    if (filterType) params.set('type', filterType);
    router.replace(`/dashboard/reports/journal?${params.toString()}`, { scroll: false });
  };

  const { transactions, accountCategories, bankAccounts } = useDataStore();
  const { company } = useAuthStore();
  const [startDate, setStartDate] = useState(url_start);
  const [endDate, setEndDate] = useState(url_end);
  const [filterType, setFilterType] = useState(url_type);

  // 建立科目與帳戶對照
  const categoryMap = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    accountCategories
      .filter(c => c.company_id === company?.id)
      .forEach(c => map.set(c.id, { code: c.code, name: c.name }));
    return map;
  }, [accountCategories, company]);

  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    bankAccounts
      .filter(a => a.company_id === company?.id)
      .forEach(a => map.set(a.id, a.name));
    return map;
  }, [bankAccounts, company]);

  // 將交易轉為日記帳分錄
  const journalEntries = useMemo(() => {
    return transactions
      .filter(t => {
        if (t.company_id !== company?.id) return false;
        if (filterType !== 'all' && t.transaction_type !== filterType) return false;
        const d = new Date(t.transaction_date);
        return d >= new Date(startDate) && d <= new Date(endDate);
      })
      .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime())
      .map(t => {
        const cat = t.category_id ? categoryMap.get(t.category_id) : null;
        const bankName = t.bank_account_id ? (accountMap.get(t.bank_account_id) || '銀行帳戶') : '銀行帳戶';
        const fromName = t.from_account_id ? (accountMap.get(t.from_account_id) || '轉出帳戶') : '';
        const toName = t.to_account_id ? (accountMap.get(t.to_account_id) || '轉入帳戶') : '';
        const catCode = cat?.code || '';
        const catName = cat?.name || (t.transaction_type === 'income' ? '未分類收入' : '未分類支出');

        const lines: JournalLine[] = [];

        if (t.transaction_type === 'income') {
          // 借：銀行  貸：收入科目
          lines.push({ accountCode: '1101', accountName: bankName, debit: t.amount, credit: 0 });
          lines.push({ accountCode: catCode, accountName: catName, debit: 0, credit: t.amount });
        } else if (t.transaction_type === 'expense') {
          // 借：費用科目  貸：銀行
          lines.push({ accountCode: catCode, accountName: catName, debit: t.amount, credit: 0 });
          lines.push({ accountCode: '1101', accountName: bankName, debit: 0, credit: t.amount });
          // 手續費
          if (t.has_fee && t.fee_amount > 0) {
            lines.push({ accountCode: '6900', accountName: '手續費', debit: t.fee_amount, credit: 0 });
            // 調整銀行貸方
            lines[1].credit += t.fee_amount;
          }
        } else if (t.transaction_type === 'transfer') {
          // 借：轉入帳戶  貸：轉出帳戶
          lines.push({ accountCode: '', accountName: toName, debit: t.amount, credit: 0 });
          lines.push({ accountCode: '', accountName: fromName, debit: 0, credit: t.amount });
          if (t.has_fee && t.fee_amount > 0) {
            lines.push({ accountCode: '6900', accountName: '手續費', debit: t.fee_amount, credit: 0 });
            lines[1].credit += t.fee_amount;
          }
        }

        return {
          id: t.id,
          date: t.transaction_date,
          type: t.transaction_type,
          description: t.description || '',
          lines,
        } as JournalEntry;
      });
  }, [transactions, company, startDate, endDate, filterType, categoryMap, accountMap]);

  // 計算合計
  const totals = useMemo(() => {
    return journalEntries.reduce(
      (acc, entry) => {
        entry.lines.forEach(line => {
          acc.debit += line.debit;
          acc.credit += line.credit;
        });
        return acc;
      },
      { debit: 0, credit: 0 }
    );
  }, [journalEntries]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  const handlePrint = () => window.print();

  const handleExport = () => {
    const headers = ['日期', '類型', '科目代碼', '科目名稱', '摘要', '借方', '貸方'];
    const rows = journalEntries.flatMap(entry =>
      entry.lines.map((line, i) => [
        i === 0 ? format(new Date(entry.date), 'yyyy/MM/dd') : '',
        i === 0 ? typeLabels[entry.type] || '' : '',
        line.accountCode,
        line.accountName,
        i === 0 ? entry.description : '',
        line.debit > 0 ? formatCurrency(line.debit) : '',
        line.credit > 0 ? formatCurrency(line.credit) : '',
      ])
    );

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `日記帳_${startDate}_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">日記帳</h1>
          <p className="text-sm text-gray-500 mt-1">按時間順序記錄所有交易分錄</p>
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
              onChange={e => { setStartDate(e.target.value); updateURL(e.target.value, endDate, filterType); }}
              className="input-field" />
          </div>
          <div>
            <label className="input-label">結束日期</label>
            <input type="date" value={endDate}
              onChange={e => { setEndDate(e.target.value); updateURL(startDate, e.target.value, filterType); }}
              className="input-field" />
          </div>
          <div>
            <label className="input-label">交易類型</label>
            <select value={filterType}
              onChange={e => { setFilterType(e.target.value); updateURL(startDate, endDate, e.target.value); }}
              className="input-field">
              <option value="all">全部</option>
              <option value="income">收款</option>
              <option value="expense">付款</option>
              <option value="transfer">轉帳</option>
            </select>
          </div>
          <button
            onClick={() => {
              const s = format(startOfMonth(new Date()), 'yyyy-MM-dd');
              const e = format(endOfMonth(new Date()), 'yyyy-MM-dd');
              setStartDate(s);
              setEndDate(e);
              updateURL(s, e, filterType);
            }}
            className="btn-secondary"
          >
            本月
          </button>
        </div>
      </div>

      {/* 報表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none">
        <div className="p-6 border-b border-gray-200 text-center print:border-b-2 print:border-black">
          <h2 className="text-xl font-bold">{company?.name}</h2>
          <h3 className="text-lg font-semibold mt-1">日 記 帳</h3>
          <p className="text-sm text-gray-600 mt-1">
            期間：{format(new Date(startDate), 'yyyy年MM月dd日', { locale: zhTW })} 至{' '}
            {format(new Date(endDate), 'yyyy年MM月dd日', { locale: zhTW })}
          </p>
          <p className="text-xs text-gray-500 mt-1">單位：新台幣元</p>
        </div>

        {journalEntries.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">此期間無交易記錄</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-300">
                  <th className="py-3 px-4 text-left w-24">日期</th>
                  <th className="py-3 px-4 text-center w-12">類</th>
                  <th className="py-3 px-4 text-left w-20">科目代碼</th>
                  <th className="py-3 px-4 text-left">科目名稱</th>
                  <th className="py-3 px-4 text-left">摘要</th>
                  <th className="py-3 px-4 text-right w-28">借方金額</th>
                  <th className="py-3 px-4 text-right w-28">貸方金額</th>
                </tr>
              </thead>
              <tbody>
                {journalEntries.map(entry =>
                  entry.lines.map((line, lineIdx) => (
                    <tr
                      key={`${entry.id}-${lineIdx}`}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        lineIdx === entry.lines.length - 1 ? 'border-b-2 border-gray-200' : ''
                      }`}
                    >
                      <td className="py-2 px-4">
                        {lineIdx === 0 ? format(new Date(entry.date), 'MM/dd') : ''}
                      </td>
                      <td className="py-2 px-4 text-center">
                        {lineIdx === 0 ? (
                          <span className={`inline-block w-6 h-6 leading-6 text-xs font-medium rounded ${typeBgColors[entry.type] || 'bg-gray-100'}`}>
                            {typeLabels[entry.type] || '?'}
                          </span>
                        ) : ''}
                      </td>
                      <td className="py-2 px-4 font-mono text-gray-600">{line.accountCode}</td>
                      <td className="py-2 px-4">
                        <span className={line.credit > 0 ? 'pl-4' : ''}>{line.accountName}</span>
                      </td>
                      <td className="py-2 px-4 text-gray-600">
                        {lineIdx === 0 ? entry.description : ''}
                      </td>
                      <td className="py-2 px-4 text-right font-mono">
                        {line.debit > 0 ? formatCurrency(line.debit) : ''}
                      </td>
                      <td className="py-2 px-4 text-right font-mono">
                        {line.credit > 0 ? formatCurrency(line.credit) : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                  <td colSpan={5} className="py-3 px-4 text-right">本期合計</td>
                  <td className="py-3 px-4 text-right font-mono">{formatCurrency(totals.debit)}</td>
                  <td className="py-3 px-4 text-right font-mono">{formatCurrency(totals.credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between text-xs text-gray-500 print:bg-white">
          <span>共 {journalEntries.length} 筆交易</span>
          <span>製表日期：{format(new Date(), 'yyyy/MM/dd HH:mm')}</span>
        </div>
      </div>
    </div>
  );
}
