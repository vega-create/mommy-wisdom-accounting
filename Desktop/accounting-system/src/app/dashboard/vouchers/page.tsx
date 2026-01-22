'use client';

import { useState, useMemo } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useAuthStore } from '@/stores/authStore';
import { 
  FileText, Plus, Edit, Trash2, 
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { defaultAccountCategories } from '@/data/accounts';

type VoucherType = 'receipt' | 'payment' | 'transfer' | 'journal';
type VoucherStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'voided';

const voucherTypeLabels: Record<VoucherType, string> = {
  receipt: '收款憑證',
  payment: '付款憑證',
  transfer: '轉帳憑證',
  journal: '分錄憑證',
};

const voucherStatusLabels: Record<VoucherStatus, string> = {
  draft: '草稿',
  pending: '待審核',
  approved: '已核准',
  rejected: '已駁回',
  voided: '已作廢',
};

const voucherStatusColors: Record<VoucherStatus, string> = {
  draft: 'badge-gray',
  pending: 'badge-yellow',
  approved: 'badge-green',
  rejected: 'badge-red',
  voided: 'badge-gray',
};

export default function VouchersPage() {
  const { 
    vouchers, 
    voucherItems,
    addVoucher,
    updateVoucher,
    approveVoucher,
    rejectVoucher,
    loadVoucherItems
  } = useDataStore();
  const { company, canEdit, canApprove } = useAuthStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<VoucherType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<VoucherStatus | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [expandedVoucher, setExpandedVoucher] = useState<string | null>(null);

  // 表單狀態
  const [formData, setFormData] = useState({
    voucher_type: 'payment' as VoucherType,
    voucher_date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    items: [
      { account_id: '', account_code: '', account_name: '', debit_amount: 0, credit_amount: 0, description: '' }
    ] as Array<{ account_id: string; account_code: string; account_name: string; debit_amount: number; credit_amount: number; description: string }>
  });

  const companyVouchers = vouchers.filter(v => v.company_id === company?.id);

  const filteredVouchers = useMemo(() => {
    return companyVouchers.filter(voucher => {
      const matchesSearch = voucher.voucher_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        voucher.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || voucher.voucher_type === filterType;
      const matchesStatus = filterStatus === 'all' || voucher.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [companyVouchers, searchTerm, filterType, filterStatus]);

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { account_id: '', account_code: '', account_name: '', debit_amount: 0, credit_amount: 0, description: '' }]
    }));
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== index) return item;
        if (field === 'account_id') {
          const account = defaultAccountCategories.find(a => a.code === value);
          return { 
            ...item, 
            account_id: `account-${company?.id}-${value}`,
            account_code: value as string, 
            account_name: account?.name || '' 
          };
        }
        return { ...item, [field]: value };
      })
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const totalDebit = formData.items.reduce((sum, item) => sum + item.debit_amount, 0);
    const totalCredit = formData.items.reduce((sum, item) => sum + item.credit_amount, 0);
    
    if (totalDebit !== totalCredit) {
      alert('借貸金額不平衡！');
      return;
    }

    if (formData.items.some(item => !item.account_code)) {
      alert('請選擇所有會計科目！');
      return;
    }

    const voucherData = {
      voucher_date: formData.voucher_date,
      voucher_type: formData.voucher_type,
      description: formData.description,
      total_debit: totalDebit,
      total_credit: totalCredit,
      status: 'draft' as VoucherStatus,
      attachments: null,
      approved_by: null,
      approved_at: null,
    };

    const itemsData = formData.items.map((item, index) => ({
      account_id: item.account_id,
      debit_amount: item.debit_amount,
      credit_amount: item.credit_amount,
      description: item.description,
      sort_order: index + 1,
    }));

    await addVoucher(voucherData, itemsData);

    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      voucher_type: 'payment',
      voucher_date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      items: [{ account_id: '', account_code: '', account_name: '', debit_amount: 0, credit_amount: 0, description: '' }]
    });
  };

  const handleApprove = (id: string) => {
    approveVoucher(id);
  };

  const handleReject = (id: string) => {
    rejectVoucher(id);
  };

  const handleSubmitForApproval = (id: string) => {
    updateVoucher(id, { status: 'pending' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // 統計資料
  const stats = useMemo(() => {
    const draft = companyVouchers.filter(v => v.status === 'draft').length;
    const pending = companyVouchers.filter(v => v.status === 'pending').length;
    const approved = companyVouchers.filter(v => v.status === 'approved').length;
    const rejected = companyVouchers.filter(v => v.status === 'rejected').length;
    return { draft, pending, approved, rejected, total: companyVouchers.length };
  }, [companyVouchers]);

  // 取得科目名稱
  const getAccountName = (accountId: string) => {
    const parts = accountId.split('-');
    const accountIndex = parseInt(parts[parts.length - 1]);
    if (!isNaN(accountIndex) && defaultAccountCategories[accountIndex]) {
      return `${defaultAccountCategories[accountIndex].code} ${defaultAccountCategories[accountIndex].name}`;
    }
    return accountId;
  };

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">憑證管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理會計憑證，記錄所有財務交易的原始依據</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新增憑證
        </button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">全部憑證</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">草稿</p>
              <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
            </div>
            <Edit className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">待審核</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">已核准</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">已駁回</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* 篩選區 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜尋憑證編號或說明..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex gap-4">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as VoucherType | 'all')}
              className="input-field w-40"
            >
              <option value="all">所有類型</option>
              {Object.entries(voucherTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as VoucherStatus | 'all')}
              className="input-field w-40"
            >
              <option value="all">所有狀態</option>
              {Object.entries(voucherStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 憑證列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredVouchers.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">尚無憑證記錄</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredVouchers.map((voucher) => {
              const items = voucherItems.filter(item => item.voucher_id === voucher.id);
              const isExpanded = expandedVoucher === voucher.id;

              return (
                <div key={voucher.id} className="hover:bg-gray-50 transition-colors">
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedVoucher(isExpanded ? null : voucher.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="font-mono text-sm font-medium text-blue-600">
                            {voucher.voucher_number}
                          </span>
                        </div>
                        <span className={`badge ${voucherStatusColors[voucher.status]}`}>
                          {voucherStatusLabels[voucher.status]}
                        </span>
                        <span className="text-sm text-gray-500">
                          {voucherTypeLabels[voucher.voucher_type]}
                        </span>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">金額</p>
                          <p className="font-semibold">{formatCurrency(voucher.total_debit)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">日期</p>
                          <p className="text-sm">
                            {format(new Date(voucher.voucher_date), 'yyyy/MM/dd', { locale: zhTW })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          {voucher.status === 'draft' && (
                            <button
                              onClick={() => handleSubmitForApproval(voucher.id)}
                              className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                              title="送審"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                          )}
                          {voucher.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(voucher.id)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                title="核准"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleReject(voucher.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                title="駁回"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2 ml-6">{voucher.description}</p>
                  </div>

                  {/* 展開的明細 */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-3">科目</th>
                            <th className="text-left py-2 px-3">摘要</th>
                            <th className="text-right py-2 px-3">借方</th>
                            <th className="text-right py-2 px-3">貸方</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => (
                            <tr key={item.id} className="border-b border-gray-100">
                              <td className="py-2 px-3">{getAccountName(item.account_id)}</td>
                              <td className="py-2 px-3 text-gray-600">{item.description || '-'}</td>
                              <td className="py-2 px-3 text-right">
                                {item.debit_amount > 0 ? formatCurrency(item.debit_amount) : '-'}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {item.credit_amount > 0 ? formatCurrency(item.credit_amount) : '-'}
                              </td>
                            </tr>
                          ))}
                          <tr className="font-semibold bg-gray-100">
                            <td colSpan={2} className="py-2 px-3 text-right">合計</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(voucher.total_debit)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(voucher.total_credit)}</td>
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
      </div>

      {/* 新增憑證 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold">新增憑證</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="input-label">憑證類型</label>
                  <select
                    value={formData.voucher_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, voucher_type: e.target.value as VoucherType }))}
                    className="input-field"
                  >
                    {Object.entries(voucherTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">憑證日期</label>
                  <input
                    type="date"
                    value={formData.voucher_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, voucher_date: e.target.value }))}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="input-label">摘要說明</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="input-field"
                    placeholder="輸入憑證說明"
                    required
                  />
                </div>
              </div>

              {/* 分錄明細 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="input-label mb-0">分錄明細</label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="btn-secondary text-sm py-1 px-3"
                  >
                    <Plus className="w-4 h-4 inline mr-1" />
                    新增分錄
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left py-2 px-3 w-48">會計科目</th>
                        <th className="text-left py-2 px-3">摘要</th>
                        <th className="text-right py-2 px-3 w-32">借方金額</th>
                        <th className="text-right py-2 px-3 w-32">貸方金額</th>
                        <th className="py-2 px-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="py-2 px-3">
                            <select
                              value={item.account_code}
                              onChange={(e) => handleItemChange(index, 'account_id', e.target.value)}
                              className="input-field text-sm py-1"
                              required
                            >
                              <option value="">選擇科目</option>
                              {defaultAccountCategories.map((account) => (
                                <option key={account.code} value={account.code}>
                                  {account.code} {account.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                              className="input-field text-sm py-1"
                              placeholder="摘要"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              value={item.debit_amount || ''}
                              onChange={(e) => handleItemChange(index, 'debit_amount', Number(e.target.value))}
                              className="input-field text-sm py-1 text-right"
                              placeholder="0"
                              min="0"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              value={item.credit_amount || ''}
                              onChange={(e) => handleItemChange(index, 'credit_amount', Number(e.target.value))}
                              className="input-field text-sm py-1 text-right"
                              placeholder="0"
                              min="0"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                              disabled={formData.items.length === 1}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-semibold">
                        <td colSpan={2} className="py-2 px-3 text-right">合計</td>
                        <td className="py-2 px-3 text-right">
                          {formatCurrency(formData.items.reduce((sum, item) => sum + item.debit_amount, 0))}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {formatCurrency(formData.items.reduce((sum, item) => sum + item.credit_amount, 0))}
                        </td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan={5} className="py-2 px-3">
                          {formData.items.reduce((sum, item) => sum + item.debit_amount, 0) !== 
                           formData.items.reduce((sum, item) => sum + item.credit_amount, 0) && (
                            <p className="text-red-500 text-sm">
                              ⚠️ 借貸金額不平衡，差額：
                              {formatCurrency(Math.abs(
                                formData.items.reduce((sum, item) => sum + item.debit_amount, 0) -
                                formData.items.reduce((sum, item) => sum + item.credit_amount, 0)
                              ))}
                            </p>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button type="submit" className="btn-primary">
                  儲存憑證
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
