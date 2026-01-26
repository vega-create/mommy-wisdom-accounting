'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import {
  Banknote, Plus, Check, Clock, AlertCircle,
  Edit2, Trash2, RefreshCw, Calendar, User,
  Building, X, CheckCircle, FileText
} from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  customer_type: string;
  vendor_type?: string;
}

interface PayableRequest {
  id: string;
  payable_number: string;
  vendor_id?: string;
  vendor_name: string;
  vendor_type: 'company' | 'individual';
  title: string;
  description?: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  paid_at?: string;
  paid_amount?: number;
  billing_request_id?: string;
  labor_report_id?: string;
  invoice_number?: string;
  notes?: string;
  created_at: string;
}

export default function PayablesPage() {
  const { company } = useAuthStore();
  const [payables, setPayables] = useState<PayableRequest[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const filterFromUrl = searchParams.get('filter') || 'pending';
  const [statusFilter, setStatusFilter] = useState<string>(filterFromUrl);

  const handleFilterChange = (filter: string) => {
    handleFilterChange(filter);
    router.replace(`/dashboard/payables?filter=${filter}`, { scroll: false });
  };
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingPayable, setEditingPayable] = useState<PayableRequest | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [confirmingPayable, setConfirmingPayable] = useState<PayableRequest | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Form state
  const [form, setForm] = useState({
    vendor_id: '',
    vendor_name: '',
    vendor_type: 'company' as 'company' | 'individual',
    title: '',
    description: '',
    amount: '',
    due_date: '',
    invoice_number: '',
    notes: ''
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    paid_amount: '',
    payment_note: '',
    send_notification: true
  });

  // 載入應付款項
  useEffect(() => {
    if (company?.id) {
      loadPayables();
      loadVendors();
    }
  }, [company?.id, statusFilter]);

  const loadPayables = async () => {
    if (!company?.id) return;
    setIsLoading(true);
    try {
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const response = await fetch(`/api/payables?company_id=${company.id}${statusParam}`);
      const result = await response.json();
      if (result.data) {
        setPayables(result.data);
      }
    } catch (error) {
      console.error('Error loading payables:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadVendors = async () => {
    if (!company?.id) return;
    try {
      const response = await fetch(`/api/customers?company_id=${company.id}`);
      const result = await response.json();
      if (result.data) {
        setVendors(result.data.filter((c: Vendor) =>
          c.customer_type === 'vendor' || c.customer_type === 'both'
        ));
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  // 選擇廠商時自動帶入資料
  const handleVendorSelect = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    if (vendor) {
      setForm({
        ...form,
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        vendor_type: (vendor as any).vendor_type || 'company'
      });
    }
  };

  // 開啟新增 Modal
  const openAddModal = () => {
    setEditingPayable(null);
    setForm({
      vendor_id: '',
      vendor_name: '',
      vendor_type: 'company',
      title: '',
      description: '',
      amount: '',
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      invoice_number: '',
      notes: ''
    });
    setShowModal(true);
  };

  // 開啟編輯 Modal
  const openEditModal = (payable: PayableRequest) => {
    setEditingPayable(payable);
    setForm({
      vendor_id: payable.vendor_id || '',
      vendor_name: payable.vendor_name,
      vendor_type: payable.vendor_type,
      title: payable.title,
      description: payable.description || '',
      amount: payable.amount.toString(),
      due_date: payable.due_date,
      invoice_number: payable.invoice_number || '',
      notes: payable.notes || ''
    });
    setShowModal(true);
  };

  // 儲存應付款項
  const handleSave = async () => {
    if (!company?.id) return;
    if (!form.vendor_name || !form.amount || !form.due_date || !form.title) {
      alert('請填寫必要欄位');
      return;
    }

    setIsSaving(true);
    try {
      const url = '/api/payables';
      const method = editingPayable ? 'PUT' : 'POST';
      const body = editingPayable
        ? { id: editingPayable.id, ...form }
        : { company_id: company.id, ...form };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();

      if (result.success || result.data) {
        setShowModal(false);
        loadPayables();
        alert(editingPayable ? '應付款項已更新！' : '應付款項已建立！');
      } else {
        alert(result.error || '儲存失敗');
      }
    } catch (error) {
      console.error('Error saving payable:', error);
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  // 開啟確認付款 Modal
  const openPaymentModal = (payable: PayableRequest) => {
    setConfirmingPayable(payable);
    setPaymentForm({
      paid_amount: payable.amount.toString(),
      payment_note: '',
      send_notification: payable.vendor_type === 'company' // 公司類型預設通知
    });
    setShowPaymentModal(true);
  };

  // 確認付款
  const handleConfirmPayment = async () => {
    if (!confirmingPayable) return;

    setIsConfirming(true);
    try {
      const response = await fetch('/api/payables/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payable_id: confirmingPayable.id,
          paid_amount: parseFloat(paymentForm.paid_amount),
          payment_note: paymentForm.payment_note,
          send_notification: paymentForm.send_notification
        })
      });
      const result = await response.json();

      if (result.success) {
        let message = '✅ 付款已確認！\n\n';
        message += '📝 已自動建立支出記錄\n';
        if (result.notification_sent) {
          message += '📱 已通知廠商開立發票\n';
        }
        alert(message);
        setShowPaymentModal(false);
        setConfirmingPayable(null);
        loadPayables();
      } else {
        alert(result.error || '確認失敗');
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert('確認失敗');
    } finally {
      setIsConfirming(false);
    }
  };

  // 刪除應付款項
  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此應付款項？')) return;

    try {
      const response = await fetch(`/api/payables?id=${id}`, {
        method: 'DELETE'
      });
      const result = await response.json();

      if (result.success) {
        loadPayables();
      } else {
        alert(result.error || '刪除失敗');
      }
    } catch (error) {
      console.error('Error deleting payable:', error);
      alert('刪除失敗');
    }
  };

  // 統計
  const stats = {
    pending: payables.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0),
    pendingCount: payables.filter(p => p.status === 'pending').length,
    overdue: payables.filter(p => p.status === 'overdue').length,
    paidThisMonth: payables.filter(p => {
      if (p.status !== 'paid' || !p.paid_at) return false;
      const paidDate = new Date(p.paid_at);
      const now = new Date();
      return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear();
    }).reduce((sum, p) => sum + (p.paid_amount || p.amount), 0)
  };

  const statusConfig = {
    pending: { label: '待付款', color: 'text-orange-600', bg: 'bg-orange-100' },
    paid: { label: '已付款', color: 'text-green-600', bg: 'bg-green-100' },
    overdue: { label: '逾期', color: 'text-red-600', bg: 'bg-red-100' }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">應付管理</h1>
          <p className="text-gray-500 mt-1">追蹤外包成本、到期提醒、確認付款</p>
        </div>
        <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          新增應付
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">NT$ {stats.pending.toLocaleString()}</p>
              <p className="text-sm text-gray-500">{stats.pendingCount} 筆待付</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">NT$ {stats.paidThisMonth.toLocaleString()}</p>
              <p className="text-sm text-gray-500">本月已付</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
              <p className="text-sm text-gray-500">逾期未付</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Banknote className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{payables.length}</p>
              <p className="text-sm text-gray-500">總筆數</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          {['all', 'pending', 'paid', 'overdue'].map(status => (
            <button
              key={status}
              onClick={() => handleFilterChange(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === status
                ? 'bg-brand-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {status === 'all' ? '全部' : statusConfig[status as keyof typeof statusConfig].label}
            </button>
          ))}
          <div className="ml-auto">
            <button onClick={loadPayables} className="p-2 hover:bg-gray-100 rounded-lg">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Payables List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">應付單號</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">廠商</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">項目</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">金額</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">到期日</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600">狀態</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  載入中...
                </td>
              </tr>
            ) : payables.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  尚無應付款項
                </td>
              </tr>
            ) : (
              payables.map(payable => {
                const config = statusConfig[payable.status];
                const isOverdue = new Date(payable.due_date) < new Date() && payable.status === 'pending';

                return (
                  <tr key={payable.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm">{payable.payable_number}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(payable.created_at).toLocaleDateString('zh-TW')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {payable.vendor_type === 'company' ? (
                          <Building className="w-4 h-4 text-gray-400" />
                        ) : (
                          <User className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="font-medium">{payable.vendor_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{payable.title}</div>
                      {payable.invoice_number && (
                        <div className="text-xs text-gray-400">發票：{payable.invoice_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-red-600">
                        NT$ {payable.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                        {new Date(payable.due_date).toLocaleDateString('zh-TW')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                        {isOverdue && payable.status === 'pending' ? '逾期' : config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {payable.status === 'pending' && (
                          <>
                            <button
                              onClick={() => openEditModal(payable)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="編輯"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openPaymentModal(payable)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="確認付款"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(payable.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="刪除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {editingPayable ? '編輯應付款項' : '新增應付款項'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* 廠商選擇 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">廠商 *</label>
                <select
                  value={form.vendor_id}
                  onChange={(e) => handleVendorSelect(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                >
                  <option value="">選擇廠商...</option>
                  {vendors.map(vendor => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={form.vendor_name}
                  onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
                  placeholder="或直接輸入廠商名稱"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 mt-2"
                />
              </div>

              {/* 廠商類型 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">廠商類型</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.vendor_type === 'company'}
                      onChange={() => setForm({ ...form, vendor_type: 'company' })}
                      className="text-brand-primary-600"
                    />
                    <Building className="w-4 h-4" />
                    <span>公司</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.vendor_type === 'individual'}
                      onChange={() => setForm({ ...form, vendor_type: 'individual' })}
                      className="text-brand-primary-600"
                    />
                    <User className="w-4 h-4" />
                    <span>個人（勞報）</span>
                  </label>
                </div>
              </div>

              {/* 項目 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">項目 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="例：1月份 SEO 外包費用"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>

              {/* 金額 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">金額 *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>

              {/* 到期日 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">付款期限 *</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>

              {/* 發票號碼 */}
              {form.vendor_type === 'company' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">發票號碼</label>
                  <input
                    type="text"
                    value={form.invoice_number}
                    onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                    placeholder="選填"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                  />
                </div>
              )}

              {/* 備註 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="選填"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-2 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isSaving ? '儲存中...' : editingPayable ? '更新' : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {showPaymentModal && confirmingPayable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">確認付款</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="text-sm text-gray-500">廠商</div>
              <div className="font-medium">{confirmingPayable.vendor_name}</div>
              <div className="text-sm text-gray-500 mt-2">項目</div>
              <div>{confirmingPayable.title}</div>
              <div className="text-sm text-gray-500 mt-2">應付金額</div>
              <div className="text-xl font-bold text-red-600">
                NT$ {confirmingPayable.amount.toLocaleString()}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">實付金額 *</label>
                <input
                  type="number"
                  value={paymentForm.paid_amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paid_amount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
                <input
                  type="text"
                  value={paymentForm.payment_note}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_note: e.target.value })}
                  placeholder="選填"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>

              {confirmingPayable.vendor_type === 'company' && (
                <label className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paymentForm.send_notification}
                    onChange={(e) => setPaymentForm({ ...paymentForm, send_notification: e.target.checked })}
                    className="rounded text-brand-primary-600"
                  />
                  <span className="text-sm">通知廠商開立發票</span>
                </label>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                disabled={isConfirming}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={isConfirming}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isConfirming && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isConfirming ? '處理中...' : '確認付款'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
