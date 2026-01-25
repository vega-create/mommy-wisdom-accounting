'use client';

import { useState, useMemo } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useAuthStore } from '@/stores/authStore';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { BookOpen, Calendar, Download, Printer, Search, Filter } from 'lucide-react';

type VoucherType = 'receipt' | 'payment' | 'transfer' | 'journal';
type VoucherStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'voided';

const voucherTypeLabels: Record<VoucherType, string> = {
  receipt: '收',
  payment: '付',
  transfer: '轉',
  journal: '記',
};

const voucherStatusLabels: Record<VoucherStatus, string> = {
  draft: '草稿',
  pending: '待審',
  approved: '核准',
  rejected: '駁回',
  voided: '作廢',
};

export default function JournalPage() {
  const { vouchers, voucherItems } = useDataStore();
  const { company } = useAuthStore();
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [filterStatus, setFilterStatus] = useState<VoucherStatus | 'all'>('approved');

  // 取得公司憑證並按日期排序
  const journalEntries = useMemo(() => {
    return vouchers
      .filter(v => {
        if (v.company_id !== company?.id) return false;
        if (filterStatus !== 'all' && v.status !== filterStatus) return false;
        const voucherDate = new Date(v.voucher_date);
        return voucherDate >= new Date(startDate) && voucherDate <= new Date(endDate);
      })
      .sort((a, b) => new Date(a.voucher_date).getTime() - new Date(b.voucher_date).getTime())
      .map(voucher => ({
        ...voucher,
        items: voucherItems
          .filter(item => item.voucher_id === voucher.id)
          .sort((a, b) => a.sort_order - b.sort_order),
      }));
  }, [vouchers, voucherItems, company, startDate, endDate, filterStatus]);

  // 計算合計
  const totals = useMemo(() => {
    return journalEntries.reduce(
      (acc, entry) => {
        entry.items.forEach(item => {
          acc.debit += item.debit_amount;
          acc.credit += item.credit_amount;
        });
        return acc;
      },
      { debit: 0, credit: 0 }
    );
  }, [journalEntries]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // 建立 CSV 內容
    const headers = ['日期', '憑證號碼', '類型', '科目代碼', '科目名稱', '摘要', '借方', '貸方'];
    const rows = journalEntries.flatMap(entry =>
      entry.items.map((item, index) => [
        index === 0 ? format(new Date(entry.voucher_date), 'yyyy/MM/dd') : '',
        index === 0 ? entry.voucher_number : '',
        index === 0 ? voucherTypeLabels[entry.voucher_type] : '',
        item.account_id,
        item.description,
        item.description || entry.description,
        item.debit_amount > 0 ? formatCurrency(item.debit_amount) : '',
        item.credit_amount > 0 ? formatCurrency(item.credit_amount) : '',
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
          <p className="text-sm text-gray-500 mt-1">按時間順序記錄所有會計分錄</p>
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
          <div>
            <label className="input-label">憑證狀態</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as VoucherStatus | 'all')}
              className="input-field"
            >
              <option value="all">全部</option>
              <option value="approved">已核准</option>
              <option value="pending">待審核</option>
              <option value="draft">草稿</option>
            </select>
          </div>
          <button
            onClick={() => {
              setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
              setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
            }}
            className="btn-secondary"
          >
            本月
          </button>
        </div>
      </div>

      {/* 報表標題 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none">
        <div className="p-6 border-b border-gray-200 text-center print:border-b-2 print:border-black">
          <h2 className="text-xl font-bold">{company?.name}</h2>
          <h3 className="text-lg font-semibold mt-1">日 記 帳</h3>
          <p className="text-sm text-gray-600 mt-1">
            期間：{format(new Date(startDate), 'yyyy年MM月dd日', { locale: zhTW })} 至 {format(new Date(endDate), 'yyyy年MM月dd日', { locale: zhTW })}
          </p>
          <p className="text-xs text-gray-500 mt-1">單位：新台幣元</p>
        </div>

        {/* 日記帳表格 */}
        {journalEntries.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">此期間無憑證記錄</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-300">
                  <th className="py-3 px-4 text-left w-24">日期</th>
                  <th className="py-3 px-4 text-left w-28">憑證號碼</th>
                  <th className="py-3 px-4 text-center w-12">類</th>
                  <th className="py-3 px-4 text-left w-20">科目代碼</th>
                  <th className="py-3 px-4 text-left">科目名稱</th>
                  <th className="py-3 px-4 text-left">摘要</th>
                  <th className="py-3 px-4 text-right w-28">借方金額</th>
                  <th className="py-3 px-4 text-right w-28">貸方金額</th>
                </tr>
              </thead>
              <tbody>
                {journalEntries.map((entry) => (
                  entry.items.map((item, itemIndex) => (
                    <tr 
                      key={`${entry.id}-${item.id}`} 
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        itemIndex === entry.items.length - 1 ? 'border-b-2 border-gray-200' : ''
                      }`}
                    >
                      <td className="py-2 px-4">
                        {itemIndex === 0 ? format(new Date(entry.voucher_date), 'MM/dd') : ''}
                      </td>
                      <td className="py-2 px-4 font-mono text-blue-600">
                        {itemIndex === 0 ? entry.voucher_number : ''}
                      </td>
                      <td className="py-2 px-4 text-center">
                        {itemIndex === 0 ? (
                          <span className="inline-block w-6 h-6 leading-6 text-xs font-medium rounded bg-gray-100">
                            {voucherTypeLabels[entry.voucher_type]}
                          </span>
                        ) : ''}
                      </td>
                      <td className="py-2 px-4 font-mono text-gray-600">{item.account_id}</td>
                      <td className="py-2 px-4">
                        <span className={item.credit_amount > 0 ? 'pl-4' : ''}>
                          {item.description}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-gray-600">
                        {item.description || (itemIndex === 0 ? entry.description : '')}
                      </td>
                      <td className="py-2 px-4 text-right font-mono">
                        {item.debit_amount > 0 ? formatCurrency(item.debit_amount) : ''}
                      </td>
                      <td className="py-2 px-4 text-right font-mono">
                        {item.credit_amount > 0 ? formatCurrency(item.credit_amount) : ''}
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                  <td colSpan={6} className="py-3 px-4 text-right">本期合計</td>
                  <td className="py-3 px-4 text-right font-mono">{formatCurrency(totals.debit)}</td>
                  <td className="py-3 px-4 text-right font-mono">{formatCurrency(totals.credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 報表資訊 */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between text-xs text-gray-500 print:bg-white">
          <span>共 {journalEntries.length} 筆憑證</span>
          <span>製表日期：{format(new Date(), 'yyyy/MM/dd HH:mm')}</span>
        </div>
      </div>
    </div>
  );
}
