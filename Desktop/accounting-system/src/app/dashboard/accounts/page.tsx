'use client';

import { useState } from 'react';
import { useDataStore, BankAccount } from '@/stores/dataStore';
import { useAuthStore } from '@/stores/authStore';
import {
  Plus,
  Wallet,
  Banknote,
  CreditCard,
  Building2,
  Edit2,
  Trash2,
  X,
  Check,
} from 'lucide-react';

type BankAccountType = 'cash' | 'bank' | 'petty_cash' | 'credit_card';

const accountTypeLabels: Record<BankAccountType, { label: string; icon: typeof Wallet; color: string }> = {
  cash: { label: '現金', icon: Banknote, color: 'bg-green-100 text-green-600' },
  bank: { label: '銀行戶頭', icon: CreditCard, color: 'bg-blue-100 text-blue-600' },
  petty_cash: { label: '零用金', icon: Wallet, color: 'bg-yellow-100 text-yellow-600' },
  credit_card: { label: '信用卡', icon: CreditCard, color: 'bg-purple-100 text-purple-600' },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function AccountsPage() {
  const { bankAccounts, addBankAccount, updateBankAccount } = useDataStore();
  const { canEdit } = useAuthStore();
  
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    account_number: '',
    bank_name: '',
    bank_branch: '',
    account_type: 'bank' as BankAccountType,
    initial_balance: 0,
  });

  const totalBalance = bankAccounts.reduce((sum, acc) => sum + acc.current_balance, 0);

  const handleOpenModal = (account?: BankAccount) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        name: account.name,
        account_number: account.account_number || '',
        bank_name: account.bank_name || '',
        bank_branch: account.bank_branch || '',
        account_type: account.account_type,
        initial_balance: account.initial_balance,
      });
    } else {
      setEditingAccount(null);
      setFormData({
        name: '',
        account_number: '',
        bank_name: '',
        bank_branch: '',
        account_type: 'bank',
        initial_balance: 0,
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingAccount) {
      // 計算餘額差異並更新 current_balance
      const balanceDiff = formData.initial_balance - editingAccount.initial_balance;
      await updateBankAccount(editingAccount.id, {
        ...formData,
        current_balance: editingAccount.current_balance + balanceDiff
      });
    } else {
      await addBankAccount({
        ...formData,
        currency: 'TWD',
        current_balance: formData.initial_balance,
        is_active: true,
      });
    }
    
    setShowModal(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">帳戶管理</h1>
          <p className="text-gray-500 mt-1">管理您的現金、銀行及其他帳戶</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          新增帳戶
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
        <p className="text-blue-100 text-sm">總資金餘額</p>
        <p className="text-4xl font-bold mt-2">{formatCurrency(totalBalance)}</p>
        <div className="grid grid-cols-4 gap-4 mt-6">
          {(['cash', 'bank', 'petty_cash', 'credit_card'] as BankAccountType[]).map(type => {
            const typeAccounts = bankAccounts.filter(a => a.account_type === type);
            const typeTotal = typeAccounts.reduce((sum, a) => sum + a.current_balance, 0);
            const config = accountTypeLabels[type];
            return (
              <div key={type} className="bg-white/10 rounded-xl p-4">
                <p className="text-blue-100 text-xs">{config.label}</p>
                <p className="text-lg font-semibold mt-1">{formatCurrency(typeTotal)}</p>
                <p className="text-blue-200 text-xs mt-1">{typeAccounts.length} 個帳戶</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Accounts List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">所有帳戶</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {bankAccounts.length === 0 ? (
            <div className="p-8 text-center">
              <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">尚未建立任何帳戶</p>
              <button onClick={() => handleOpenModal()} className="btn-primary mt-4">
                建立第一個帳戶
              </button>
            </div>
          ) : (
            bankAccounts.map(account => {
              const config = accountTypeLabels[account.account_type];
              const Icon = config.icon;
              return (
                <div key={account.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{account.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{config.label}</span>
                        {account.bank_name && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="text-xs text-gray-500">{account.bank_name}</span>
                          </>
                        )}
                        {account.account_number && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="text-xs text-gray-400">{account.account_number}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(account.current_balance)}</p>
                      {account.initial_balance !== account.current_balance && (
                        <p className="text-xs text-gray-400">
                          初始: {formatCurrency(account.initial_balance)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleOpenModal(account)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {editingAccount ? '編輯帳戶' : '新增帳戶'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Account Type */}
              <div>
                <label className="input-label">帳戶類型</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['cash', 'bank', 'petty_cash', 'credit_card'] as BankAccountType[]).map(type => {
                    const config = accountTypeLabels[type];
                    const Icon = config.icon;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, account_type: type })}
                        className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                          formData.account_type === type
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${formData.account_type === type ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className={formData.account_type === type ? 'text-blue-600' : 'text-gray-600'}>
                          {config.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Account Name */}
              <div>
                <label className="input-label">帳戶名稱 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="例：台新銀行-活存"
                  required
                />
              </div>

              {/* Bank Info (for bank bankAccounts) */}
              {formData.account_type === 'bank' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">銀行名稱</label>
                      <input
                        type="text"
                        value={formData.bank_name}
                        onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                        className="input-field"
                        placeholder="例：台新國際商業銀行"
                      />
                    </div>
                    <div>
                      <label className="input-label">分行</label>
                      <input
                        type="text"
                        value={formData.bank_branch}
                        onChange={e => setFormData({ ...formData, bank_branch: e.target.value })}
                        className="input-field"
                        placeholder="例：台中分行"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="input-label">帳號</label>
                    <input
                      type="text"
                      value={formData.account_number}
                      onChange={e => setFormData({ ...formData, account_number: e.target.value })}
                      className="input-field"
                      placeholder="例：2048-01-0012345-6"
                    />
                  </div>
                </>
              )}

              {/* Initial Balance */}
              <div>
                <label className="input-label">初始餘額</label>
                <input
                  type="number"
                  value={formData.initial_balance || ''}
                  onChange={e => setFormData({ ...formData, initial_balance: e.target.value === '' ? 0 : Number(e.target.value) })}
                  className="input-field"
                  placeholder="0"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  取消
                </button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  {editingAccount ? '儲存' : '新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
