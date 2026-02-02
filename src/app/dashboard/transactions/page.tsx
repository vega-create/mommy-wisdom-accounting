
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDataStore } from '@/stores/dataStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import {
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  X,
  Check,
  Trash2,
  Edit2,
  Download,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Calendar,
} from 'lucide-react';

type TransactionType = 'income' | 'expense' | 'transfer';

const transactionTypeConfig: Record<TransactionType, { label: string; icon: typeof ArrowUpRight; color: string; bgColor: string }> = {
  income: { label: '收入', icon: ArrowUpRight, color: 'text-green-600', bgColor: 'bg-green-100' },
  expense: { label: '支出', icon: ArrowDownRight, color: 'text-red-600', bgColor: 'bg-red-100' },
  transfer: { label: '轉帳', icon: ArrowLeftRight, color: 'text-blue-600', bgColor: 'bg-blue-100' },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
  }).format(amount);
}

const ITEMS_PER_PAGE = 20;

const dateRangePresets = [
  { label: '本月', getValue: () => ({ start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(endOfMonth(new Date()), 'yyyy-MM-dd') }) },
  { label: '上月', getValue: () => ({ start: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'), end: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd') }) },
  { label: '近3個月', getValue: () => ({ start: format(startOfMonth(subMonths(new Date(), 2)), 'yyyy-MM-dd'), end: format(endOfMonth(new Date()), 'yyyy-MM-dd') }) },
  { label: '今年', getValue: () => ({ start: `${new Date().getFullYear()}-01-01`, end: format(new Date(), 'yyyy-MM-dd') }) },
  { label: '全部', getValue: () => ({ start: '', end: '' }) },
];

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    transactions,
    bankAccounts,
    accountCategories,
    customers,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useDataStore();

  const { company, canEdit } = useAuthStore();

  const urlPeriod = searchParams.get('period') || '';
  const urlType = searchParams.get('type') || 'all';
  const urlStart = searchParams.get('start') || '';
  const urlEnd = searchParams.get('end') || '';

  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | 'all'>(urlType as TransactionType | 'all');
  const [dateRange, setDateRange] = useState({ start: urlStart, end: urlEnd });
  const [activePeriod, setActivePeriod] = useState(urlPeriod);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [defaultFee, setDefaultFee] = useState(15);

  useEffect(() => {
    const loadSettings = async () => {
      if (!company) return;
      const { data } = await supabase
        .from('acct_companies')
        .select('default_transfer_fee')
        .eq('id', company.id)
        .single();
      if (data?.default_transfer_fee) {
        setDefaultFee(data.default_transfer_fee);
      }
    };
    loadSettings();
  }, [company]);

  const updateURL = (period: string, type: string, start: string, end: string) => {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    if (type && type !== 'all') params.set('type', type);
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    router.replace(`/dashboard/transactions?${params.toString()}`, { scroll: false });
  };

  const [formData, setFormData] = useState({
    transaction_date: format(new Date(), 'yyyy-MM-dd'),
    transaction_type: 'expense' as TransactionType,
    description: '',
    amount: 0,
    bank_account_id: '',
    from_account_id: '',
    to_account_id: '',
    category_id: '',
    customer_id: '',
    voucher_id: null as string | null,
    tags: null as string[] | null,
    notes: '',
    has_fee: false,
    fee_amount: 0,
    tax_id: '',
  });

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (filterType !== 'all' && t.transaction_type !== filterType) return false;
        if (dateRange.start && t.transaction_date < dateRange.start) return false;
        if (dateRange.end && t.transaction_date > dateRange.end) return false;
        return true;
      })
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
  }, [transactions, searchTerm, filterType, dateRange]);

  const totals = useMemo(() => {
    const income = filteredTransactions.filter(t => t.transaction_type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.transaction_type === 'expense').reduce((sum, t) => sum + t.amount + (t.fee_amount || 0), 0);
    const transfer = filteredTransactions.filter(t => t.transaction_type === 'transfer').reduce((sum, t) => sum + t.amount, 0);
    const totalFees = filteredTransactions.reduce((sum, t) => sum + (t.fee_amount || 0), 0);
    return { income, expense, transfer, net: income - expense, count: filteredTransactions.length, totalFees };
  }, [filteredTransactions]);

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTransactions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTransactions, currentPage]);
// 計算每筆交易後的總餘額
  const balanceMap = useMemo(() => {
    let totalBalance = bankAccounts
      .filter(a => a.company_id === company?.id)
      .reduce((sum, a) => sum + (a.initial_balance || 0), 0);

    const allSorted = [...transactions]
      .filter(t => t.company_id === company?.id)
      .sort((a, b) => {
        const diff = new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
        return diff !== 0 ? diff : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

    const txBalances = new Map<string, number>();

    allSorted.forEach(t => {
      if (t.transaction_type === 'income') {
        totalBalance += t.amount;
      } else if (t.transaction_type === 'expense') {
        totalBalance -= t.amount + (t.has_fee && t.fee_amount ? t.fee_amount : 0);
      } else if (t.transaction_type === 'transfer') {
        if (t.has_fee && t.fee_amount) {
          totalBalance -= t.fee_amount;
        }
      }
      txBalances.set(t.id, totalBalance);
    });

    return txBalances;
  }, [transactions, bankAccounts, company]);
  const handleDateRangeChange = (preset: typeof dateRangePresets[0], periodLabel: string) => {
    const newRange = preset.getValue();
    setDateRange(newRange);
    setActivePeriod(periodLabel);
    setCurrentPage(1);
    updateURL(periodLabel, filterType, newRange.start, newRange.end);
  };

  const exportToCSV = () => {
    const headers = ['日期', '類型', '描述', '帳戶', '客戶/廠商', '發票號碼', '金額', '手續費', '備註'];
    const rows = filteredTransactions.map(t => {
      const typeLabel = transactionTypeConfig[t.transaction_type].label;
      let accountName = '';
      if (t.transaction_type === 'transfer') {
        const from = bankAccounts.find(a => a.id === t.from_account_id)?.name || '';
        const to = bankAccounts.find(a => a.id === t.to_account_id)?.name || '';
        accountName = `${from} → ${to}`;
      } else {
        accountName = bankAccounts.find(a => a.id === t.bank_account_id)?.name || '';
      }
      const customer = customers.find(c => c.id === t.customer_id);
      const customerName = customer?.short_name || customer?.name || '';
      const amount = t.transaction_type === 'income' ? t.amount : t.transaction_type === 'expense' ? -t.amount : t.amount;
      return [t.transaction_date, typeLabel, t.description, accountName, customerName, t.tax_id || '', amount.toString(), (t.fee_amount || 0).toString(), t.notes || ''];
    });
    rows.push([]);
    rows.push(['=== 統計摘要 ===', '', '', '', '', '', '', '', '']);
    rows.push(['總收入', '', '', '', '', '', totals.income.toString(), '', '']);
    rows.push(['總支出', '', '', '', '', '', (-totals.expense).toString(), '', '']);
    rows.push(['總手續費', '', '', '', '', '', '', totals.totalFees.toString(), '']);
    rows.push(['淨額', '', '', '', '', '', totals.net.toString(), '', '']);
    rows.push(['筆數', '', '', '', '', '', totals.count.toString(), '', '']);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const fileName = dateRange.start && dateRange.end ? `交易記錄_${dateRange.start}_${dateRange.end}.csv` : `交易記錄_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      has_fee: formData.has_fee,
      fee_amount: formData.has_fee ? formData.fee_amount : 0,
      bank_account_id: formData.bank_account_id || null,
      from_account_id: formData.from_account_id || null,
      to_account_id: formData.to_account_id || null,
      category_id: formData.category_id || null,
      customer_id: formData.customer_id || null,
      voucher_id: formData.voucher_id || null,
      tax_id: formData.tax_id || null,
    };
    if (editingTransaction) {
      await updateTransaction(editingTransaction, submitData);
    } else {
      await addTransaction(submitData);
    }
    setShowModal(false);
    setEditingTransaction(null);
    setFormData({
      transaction_date: format(new Date(), 'yyyy-MM-dd'),
      transaction_type: 'expense',
      description: '',
      amount: 0,
      bank_account_id: '',
      from_account_id: '',
      to_account_id: '',
      category_id: '',
      customer_id: '',
      voucher_id: null,
      tags: null,
      notes: '',
      has_fee: false,
      fee_amount: 0,
      tax_id: '',
    });
  };

  const openAddModal = () => {
    setEditingTransaction(null);
    setFormData({
      transaction_date: format(new Date(), 'yyyy-MM-dd'),
      transaction_type: 'expense',
      description: '',
      amount: 0,
      bank_account_id: '',
      from_account_id: '',
      to_account_id: '',
      category_id: '',
      customer_id: '',
      voucher_id: null,
      tags: null,
      notes: '',
      has_fee: false,
      fee_amount: defaultFee,
      tax_id: '',
    });
    setShowModal(true);
  };

  const openEditModal = (transaction: typeof transactions[0]) => {
    setEditingTransaction(transaction.id);
    setFormData({
      transaction_date: transaction.transaction_date,
      transaction_type: transaction.transaction_type as TransactionType,
      description: transaction.description,
      amount: transaction.amount,
      bank_account_id: transaction.bank_account_id || '',
      from_account_id: transaction.from_account_id || '',
      to_account_id: transaction.to_account_id || '',
      category_id: transaction.category_id || '',
      customer_id: transaction.customer_id || '',
      voucher_id: transaction.voucher_id || null,
      tags: transaction.tags || null,
      notes: transaction.notes || '',
      has_fee: transaction.has_fee || false,
      fee_amount: transaction.fee_amount || defaultFee,
      tax_id: transaction.tax_id || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    await deleteTransaction(id);
    setDeleteConfirm(null);
  };

  const handleFeeToggle = (checked: boolean) => {
    setFormData({ ...formData, has_fee: checked, fee_amount: checked ? defaultFee : 0 });
  };

  const expenseCategories = accountCategories.filter(c => c.type === 'expense' && c.is_active);
  const revenueCategories = accountCategories.filter(c => c.type === 'revenue' && c.is_active);
  const totalAmount = formData.amount + (formData.has_fee ? formData.fee_amount : 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">交易記錄</h1>
          <p className="text-gray-500 mt-1">記錄所有收入、支出與轉帳</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportToCSV} className="btn-secondary flex items-center gap-2" disabled={filteredTransactions.length === 0}>
            <Download className="w-4 h-4" />匯出 CSV
          </button>
          <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />新增交易
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">快速選擇期間</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {dateRangePresets.map((preset, idx) => {
            const presetValue = preset.getValue();
            const isActive = activePeriod === preset.label || (activePeriod === "" && dateRange.start === presetValue.start && dateRange.end === presetValue.end);
            return (
              <button key={idx} onClick={() => handleDateRangeChange(preset, preset.label)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {preset.label}
              </button>
            );
          })}
          <div className="flex items-center gap-2 ml-2">
            <input type="date" value={dateRange.start} onChange={e => { setDateRange({ ...dateRange, start: e.target.value }); setCurrentPage(1); }} className="input-field text-sm py-1.5" />
            <span className="text-gray-400">至</span>
            <input type="date" value={dateRange.end} onChange={e => { setDateRange({ ...dateRange, end: e.target.value }); setCurrentPage(1); }} className="input-field text-sm py-1.5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <div className="flex items-center gap-2"><ArrowUpRight className="w-5 h-5 text-green-600" /><span className="text-sm text-green-600 font-medium">收入</span></div>
          <p className="text-2xl font-bold text-green-700 mt-2">{formatCurrency(totals.income)}</p>
          <p className="text-xs text-green-600 mt-1">{filteredTransactions.filter(t => t.transaction_type === 'income').length} 筆</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="flex items-center gap-2"><ArrowDownRight className="w-5 h-5 text-red-600" /><span className="text-sm text-red-600 font-medium">支出</span></div>
          <p className="text-2xl font-bold text-red-700 mt-2">{formatCurrency(totals.expense)}</p>
          <p className="text-xs text-red-600 mt-1">{filteredTransactions.filter(t => t.transaction_type === 'expense').length} 筆{totals.totalFees > 0 && <span className="ml-1">（含手續費 {formatCurrency(totals.totalFees)}）</span>}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-blue-600" /><span className="text-sm text-blue-600 font-medium">轉帳</span></div>
          <p className="text-2xl font-bold text-blue-700 mt-2">{formatCurrency(totals.transfer)}</p>
          <p className="text-xs text-blue-600 mt-1">{filteredTransactions.filter(t => t.transaction_type === 'transfer').length} 筆</p>
        </div>
        <div className={`${totals.net >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-orange-50 border-orange-100'} border rounded-xl p-4`}>
          <div className="flex items-center gap-2"><FileSpreadsheet className={`w-5 h-5 ${totals.net >= 0 ? 'text-emerald-600' : 'text-orange-600'}`} /><span className={`text-sm font-medium ${totals.net >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>淨額</span></div>
          <p className={`text-2xl font-bold mt-2 ${totals.net >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>{totals.net >= 0 ? '+' : ''}{formatCurrency(totals.net)}</p>
          <p className={`text-xs mt-1 ${totals.net >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>共 {totals.count} 筆交易</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
              <input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full px-4 py-2 pl-9 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" placeholder="搜尋交易描述..." />
            </div>
          </div>
          <div className="flex gap-2">
            {(['all', 'income', 'expense', 'transfer'] as const).map(type => (
              <button key={type} onClick={() => handleFilterChange(type)} className={`px-3 py-2 text-sm rounded-lg transition-colors ${filterType === type ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {type === 'all' ? '全部' : transactionTypeConfig[type].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>類型</th>
                <th>描述</th>
                <th>帳戶</th>
                <th>客戶/廠商</th>
                <th>發票號碼</th>
                <th className="text-right">金額</th>
                <th className="text-right">帳戶餘額</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-500">沒有找到符合條件的交易記錄</td></tr>
              ) : (
                paginatedTransactions.map(t => {
                  const config = transactionTypeConfig[t.transaction_type];
                  const Icon = config.icon;
                  const account = bankAccounts.find(a => a.id === t.bank_account_id || a.id === t.from_account_id || a.id === t.to_account_id);
                  const customer = customers.find(c => c.id === t.customer_id);
                  const displayAmount = t.amount + (t.fee_amount || 0);
                  return (
                    <tr key={t.id}>
                      <td><span className="text-gray-900">{format(new Date(t.transaction_date), 'yyyy/MM/dd')}</span></td>
                      <td><div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${config.bgColor}`}><Icon className={`w-3.5 h-3.5 ${config.color}`} /><span className={`text-xs font-medium ${config.color}`}>{config.label}</span></div></td>
                      <td>
                        <p className="font-medium text-gray-900">{t.description}</p>
                        {t.notes && <p className="text-xs text-gray-500 mt-0.5">{t.notes}</p>}
                        {t.fee_amount > 0 && <p className="text-xs text-orange-600 mt-0.5">含手續費 {formatCurrency(t.fee_amount)}</p>}
                      </td>
                      <td>{t.transaction_type === 'transfer' ? <span className="text-sm text-gray-600">{bankAccounts.find(a => a.id === t.from_account_id)?.name} → {bankAccounts.find(a => a.id === t.to_account_id)?.name}</span> : <span className="text-sm text-gray-600">{account?.name || '-'}</span>}</td>
                      <td><span className="text-sm text-gray-600">{customer?.short_name || customer?.name || '-'}</span></td>
                      <td><span className="text-sm text-gray-600 font-mono">{t.tax_id || '-'}</span></td>
                      <td className="text-right"><span className={`font-semibold ${config.color}`}>{t.transaction_type === 'income' ? '+' : t.transaction_type === 'expense' ? '-' : ''}{formatCurrency(displayAmount)}</span></td>
                      <td className="text-right"><span className="text-sm font-mono text-gray-600">{balanceMap.has(t.id) ? formatCurrency(balanceMap.get(t.id)!) : '-'}</span></td>
                      <td className="text-right">
                        {deleteConfirm === t.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleDelete(t.id)} className="p-1.5 text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setDeleteConfirm(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditModal(t)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="編輯"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => setDeleteConfirm(t.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="刪除"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-sm text-gray-500">顯示第 {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)} 筆，共 {filteredTransactions.length} 筆</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeft className="w-5 h-5" /></button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) page = i + 1;
                  else if (currentPage <= 3) page = i + 1;
                  else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                  else page = currentPage - 2 + i;
                  return <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>{page}</button>;
                })}
              </div>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }} onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{editingTransaction ? '編輯交易' : '新增交易'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="input-label">交易類型</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['income', 'expense', 'transfer'] as TransactionType[]).map(type => {
                    const config = transactionTypeConfig[type];
                    const Icon = config.icon;
                    return (
                      <button key={type} type="button" onClick={() => setFormData({ ...formData, transaction_type: type })} className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${formData.transaction_type === type ? `${config.bgColor} border-current ${config.color}` : 'border-gray-200 hover:border-gray-300'}`}>
                        <Icon className={`w-4 h-4 ${formData.transaction_type === type ? config.color : 'text-gray-400'}`} />
                        <span className={formData.transaction_type === type ? config.color : 'text-gray-600'}>{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="input-label">日期</label>
                <input type="date" value={formData.transaction_date} onChange={e => setFormData({ ...formData, transaction_date: e.target.value })} className="input-field" required />
              </div>
              <div>
                <label className="input-label">描述 *</label>
                <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="input-field" placeholder="例：客戶A付款" required />
              </div>
              <div>
                <label className="input-label">金額 *</label>
                <input type="number" value={formData.amount || ''} onChange={e => setFormData({ ...formData, amount: e.target.value === '' ? 0 : Number(e.target.value) })} className="input-field" placeholder="0" min="0" required />
              </div>
              {formData.transaction_type === 'transfer' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">從帳戶</label>
                    <select value={formData.from_account_id} onChange={e => setFormData({ ...formData, from_account_id: e.target.value })} className="input-field" required>
                      <option value="">選擇帳戶</option>
                      {bankAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">到帳戶</label>
                    <select value={formData.to_account_id} onChange={e => setFormData({ ...formData, to_account_id: e.target.value })} className="input-field" required>
                      <option value="">選擇帳戶</option>
                      {bankAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="input-label">帳戶</label>
                    <select value={formData.bank_account_id} onChange={e => setFormData({ ...formData, bank_account_id: e.target.value })} className="input-field" required>
                      <option value="">選擇帳戶</option>
                      {bankAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">科目分類</label>
                    <select value={formData.category_id} onChange={e => setFormData({ ...formData, category_id: e.target.value })} className="input-field">
                      <option value="">選擇科目</option>
                      {(formData.transaction_type === 'income' ? revenueCategories : expenseCategories).map(cat => <option key={cat.id} value={cat.id}>{cat.code} - {cat.name}</option>)}
                    </select>
                  </div>
                </>
              )}
              {(formData.transaction_type === 'expense' || formData.transaction_type === 'transfer') && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="has_fee" checked={formData.has_fee} onChange={e => handleFeeToggle(e.target.checked)} className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500" />
                    <label htmlFor="has_fee" className="text-sm font-medium text-orange-800">加入手續費</label>
                  </div>
                  {formData.has_fee && (
                    <div className="mt-3">
                      <label className="text-sm text-orange-700">手續費金額</label>
                      <input type="number" value={formData.fee_amount || ''} onChange={e => setFormData({ ...formData, fee_amount: e.target.value === '' ? 0 : Number(e.target.value) })} className="input-field mt-1" placeholder="15" min="0" />
                      <p className="text-xs text-orange-600 mt-2">總金額：{formatCurrency(totalAmount)}（本金 {formatCurrency(formData.amount)} + 手續費 {formatCurrency(formData.fee_amount)}）</p>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="input-label">客戶/廠商</label>
                <select value={formData.customer_id} onChange={e => setFormData({ ...formData, customer_id: e.target.value })} className="input-field">
                  <option value="">選擇客戶/廠商（選填）</option>
                  {customers.filter(c => {
                    if (formData.transaction_type === 'income') return c.customer_type === 'customer' || c.customer_type === 'both';
                    else if (formData.transaction_type === 'expense') return c.customer_type === 'vendor' || c.customer_type === 'both';
                    return true;
                  }).map(customer => <option key={customer.id} value={customer.id}>{customer.short_name || customer.name}</option>)}
                </select>
              </div>
              {formData.transaction_type !== 'transfer' && (
                <div>
                  <label className="input-label">發票號碼</label>
                  <input type="text" value={formData.tax_id} onChange={e => setFormData({ ...formData, tax_id: e.target.value })} className="input-field" placeholder="選填，例：AB12345678" maxLength={8} />
                </div>
              )}
              <div>
                <label className="input-label">備註</label>
                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="input-field" rows={2} placeholder="選填" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">取消</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2"><Check className="w-4 h-4" />{editingTransaction ? '更新交易' : '新增交易'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
