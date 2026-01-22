'use client';

import { useDataStore } from '@/stores/dataStore';
import { useAuthStore } from '@/stores/authStore';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Banknote,
  CreditCard,
  Receipt,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

// 格式化金額
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function DashboardPage() {
  const { transactions, bankAccounts, vouchers } = useDataStore();
  const { company } = useAuthStore();

  // 計算現金和銀行總額
  const cashAccounts = bankAccounts.filter(a => a.account_type === 'cash' || a.account_type === 'petty_cash');
  const bankOnlyAccounts = bankAccounts.filter(a => a.account_type === 'bank');
  const cash = cashAccounts.reduce((sum, a) => sum + a.current_balance, 0);
  const bank = bankOnlyAccounts.reduce((sum, a) => sum + a.current_balance, 0);
  const cashBankTotal = cash + bank;

  // 計算本月收支
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyTransactions = transactions.filter(t => {
    const d = new Date(t.transaction_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const monthlyIncome = monthlyTransactions
    .filter(t => t.transaction_type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyExpense = monthlyTransactions
    .filter(t => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // 最近的交易
  const recentTransactions = transactions.slice(0, 5);

  // 待審核憑證
  const pendingVouchers = vouchers.filter(v => v.status === 'pending' || v.status === 'draft');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">總覽</h1>
          <p className="text-gray-500 mt-1">
            {company?.name} · {format(new Date(), 'yyyy年MM月dd日 EEEE', { locale: zhTW })}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 總資產 */}
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500">現金+銀行</span>
          </div>
          <div className="mt-3">
            <p className="stats-value">{formatCurrency(cashBankTotal)}</p>
            <p className="stats-label">總資金</p>
          </div>
        </div>

        {/* 現金餘額 */}
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Banknote className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xs text-gray-500">Cash</span>
          </div>
          <div className="mt-3">
            <p className="stats-value">{formatCurrency(cash)}</p>
            <p className="stats-label">現金餘額</p>
          </div>
        </div>

        {/* 銀行餘額 */}
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs text-gray-500">Bank</span>
          </div>
          <div className="mt-3">
            <p className="stats-value">{formatCurrency(bank)}</p>
            <p className="stats-label">銀行存款</p>
          </div>
        </div>

        {/* 本月淨額 */}
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              monthlyIncome - monthlyExpense >= 0 ? 'bg-emerald-100' : 'bg-red-100'
            }`}>
              {monthlyIncome - monthlyExpense >= 0 ? (
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
            </div>
            <span className="text-xs text-gray-500">本月</span>
          </div>
          <div className="mt-3">
            <p className={`stats-value ${monthlyIncome - monthlyExpense >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {monthlyIncome - monthlyExpense >= 0 ? '+' : ''}{formatCurrency(monthlyIncome - monthlyExpense)}
            </p>
            <p className="stats-label">本月淨額</p>
          </div>
        </div>
      </div>

      {/* Monthly Income/Expense */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpRight className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">本月收入</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{formatCurrency(monthlyIncome)}</p>
          <div className="mt-4 space-y-2">
            {monthlyTransactions
              .filter(t => t.transaction_type === 'income')
              .slice(0, 3)
              .map(t => (
                <div key={t.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">{t.description}</span>
                  <span className="text-green-600">+{formatCurrency(t.amount)}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowDownRight className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-gray-900">本月支出</h3>
          </div>
          <p className="text-3xl font-bold text-red-600">{formatCurrency(monthlyExpense)}</p>
          <div className="mt-4 space-y-2">
            {monthlyTransactions
              .filter(t => t.transaction_type === 'expense')
              .slice(0, 3)
              .map(t => (
                <div key={t.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">{t.description}</span>
                  <span className="text-red-600">-{formatCurrency(t.amount)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Bank Accounts & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bank Accounts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">帳戶餘額</h3>
          <div className="space-y-3">
            {bankAccounts.map(account => (
              <div key={account.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    account.account_type === 'cash' ? 'bg-green-100' :
                    account.account_type === 'bank' ? 'bg-blue-100' :
                    account.account_type === 'petty_cash' ? 'bg-yellow-100' : 'bg-purple-100'
                  }`}>
                    {account.account_type === 'cash' || account.account_type === 'petty_cash' ? (
                      <Banknote className={`w-4 h-4 ${account.account_type === 'cash' ? 'text-green-600' : 'text-yellow-600'}`} />
                    ) : (
                      <CreditCard className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{account.name}</p>
                    {account.bank_name && (
                      <p className="text-xs text-gray-500">{account.bank_name}</p>
                    )}
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(account.current_balance)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">最近交易</h3>
            <a href="/dashboard/transactions" className="text-sm text-blue-600 hover:text-blue-700">
              查看全部
            </a>
          </div>
          <div className="space-y-3">
            {recentTransactions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">尚無交易記錄</p>
            ) : (
              recentTransactions.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      t.transaction_type === 'income' ? 'bg-green-100' :
                      t.transaction_type === 'expense' ? 'bg-red-100' : 'bg-blue-100'
                    }`}>
                      {t.transaction_type === 'income' ? (
                        <ArrowUpRight className="w-5 h-5 text-green-600" />
                      ) : t.transaction_type === 'expense' ? (
                        <ArrowDownRight className="w-5 h-5 text-red-600" />
                      ) : (
                        <Receipt className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.description}</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(t.transaction_date), 'MM/dd')} · {
                          t.transaction_type === 'income' ? '收入' :
                          t.transaction_type === 'expense' ? '支出' : '轉帳'
                        }
                      </p>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold ${
                    t.transaction_type === 'income' ? 'text-green-600' :
                    t.transaction_type === 'expense' ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {t.transaction_type === 'income' ? '+' : t.transaction_type === 'expense' ? '-' : ''}
                    {formatCurrency(t.amount)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Pending Vouchers */}
      {pendingVouchers.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-800">待處理憑證</h3>
            <span className="badge badge-warning">{pendingVouchers.length}</span>
          </div>
          <div className="space-y-2">
            {pendingVouchers.slice(0, 3).map(v => (
              <div key={v.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{v.voucher_number}</p>
                  <p className="text-xs text-gray-500">{v.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(v.total_debit)}</p>
                  <span className={`badge ${v.status === 'draft' ? 'badge-gray' : 'badge-warning'}`}>
                    {v.status === 'draft' ? '草稿' : '待審核'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
