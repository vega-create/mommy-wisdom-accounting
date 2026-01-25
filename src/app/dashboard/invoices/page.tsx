'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Settings,
  Send,
  Ban,
  Trash2,
  RefreshCw,
  Building2,
  User,
  Receipt,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
} from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  buyer_name: string;
  buyer_tax_id: string | null;
  invoice_type: 'B2B' | 'B2C';
  tax_type: string;
  sales_amount: number;
  tax_amount: number;
  total_amount: number;
  status: 'draft' | 'issued' | 'void' | 'cancelled';
  billing_request_id: string | null;
  ezpay_random_num: string | null;
  void_reason: string | null;
  created_at: string;
  items?: InvoiceItem[];
}

interface InvoiceItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
}

interface Customer {
  id: string;
  name: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface BillingRequest {
  id: string;
  billing_number: string;
  customer_name: string;
  total_amount: number;
}

export default function InvoicesPage() {
  const { company } = useAuthStore();
  const searchParams = useSearchParams();
  const billingIdFromUrl = searchParams.get('billing_id');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  // 開票表單
  const [form, setForm] = useState({
    invoice_type: 'B2B' as 'B2B' | 'B2C',
    tax_type: 'taxable',
    customer_id: '',
    buyer_name: '',
    buyer_tax_id: '',
    buyer_email: '',
    buyer_phone: '',
    buyer_address: '',
    carrier_type: '' as '' | '0' | '1' | '2',
    carrier_num: '',
    love_code: '',
    items: [{ name: '', quantity: 1, unit: '式', price: 0 }] as Array<{
      name: string;
      quantity: number;
      unit: string;
      price: number;
    }>,
    comment: '',
    billing_request_id: '',
    issue_to_ezpay: true,
  });

  // 設定表單
  const [settingsForm, setSettingsForm] = useState({
    merchant_id: '',
    hash_key: '',
    hash_iv: '',
    is_production: true,
    default_tax_type: 'taxable',
    auto_issue_on_payment: false,
    auto_notify_customer: true,
  });
  const [hasConfig, setHasConfig] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // 作廢表單
  const [voidReason, setVoidReason] = useState('');

  // 載入資料
  useEffect(() => {
    if (company?.id) {
      loadInvoices();
      loadCustomers();
      loadSettings();

      // 如果有 billing_id，自動開啟開票 Modal
      if (billingIdFromUrl) {
        loadBillingAndOpenModal(billingIdFromUrl);
      }
    }
  }, [company?.id, billingIdFromUrl]);

  const loadInvoices = async () => {
    if (!company?.id) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ company_id: company.id });
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/invoices?${params}`);
      const result = await response.json();
      if (result.data) {
        setInvoices(result.data);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomers = async () => {
    if (!company?.id) return;
    try {
      const response = await fetch(`/api/customers?company_id=${company.id}`);
      const result = await response.json();
      if (result.data) {
        setCustomers(result.data);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadSettings = async () => {
    if (!company?.id) return;
    try {
      const response = await fetch(`/api/invoices/settings?company_id=${company.id}`);
      const result = await response.json();
      if (result.data) {
        setSettingsForm({
          merchant_id: result.data.merchant_id || '',
          hash_key: '', // 不顯示完整金鑰
          hash_iv: '',
          is_production: result.data.is_production ?? true,
          default_tax_type: result.data.default_tax_type || 'taxable',
          auto_issue_on_payment: result.data.auto_issue_on_payment ?? false,
          auto_notify_customer: result.data.auto_notify_customer ?? true,
        });
        setHasConfig(result.data.has_config);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadBillingAndOpenModal = async (billingId: string) => {
    try {
      const response = await fetch(`/api/billing?company_id=${company?.id}&id=${billingId}`);
      const result = await response.json();
      if (result.data && result.data.length > 0) {
        const billing = result.data[0];
        // 從客戶資料填入
        const customer = customers.find(c => c.id === billing.customer_id);
        
        setForm(prev => ({
          ...prev,
          billing_request_id: billingId,
          buyer_name: billing.customer_name,
          buyer_tax_id: customer?.tax_id || '',
          buyer_email: billing.customer_email || customer?.email || '',
          buyer_phone: customer?.phone || '',
          buyer_address: customer?.address || '',
          invoice_type: customer?.tax_id ? 'B2B' : 'B2C',
          items: [{
            name: billing.title || '服務費',
            quantity: 1,
            unit: '式',
            price: billing.total_amount,
          }],
        }));
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error loading billing:', error);
    }
  };

  // 選擇客戶
  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setForm(prev => ({
        ...prev,
        customer_id: customerId,
        buyer_name: customer.name,
        buyer_tax_id: customer.tax_id || '',
        buyer_email: customer.email || '',
        buyer_phone: customer.phone || '',
        buyer_address: customer.address || '',
        invoice_type: customer.tax_id ? 'B2B' : 'B2C',
      }));
    }
  };

  // 新增品項
  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { name: '', quantity: 1, unit: '式', price: 0 }],
    }));
  };

  // 刪除品項
  const removeItem = (index: number) => {
    if (form.items.length <= 1) return;
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // 更新品項
  const updateItem = (index: number, field: string, value: string | number) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  // 計算總金額
  const totalAmount = useMemo(() => {
    return form.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [form.items]);

  // 開立發票
  const handleSubmit = async () => {
    if (!company?.id) return;

    if (!form.buyer_name) {
      alert('請填寫買受人名稱');
      return;
    }

    if (form.invoice_type === 'B2B' && !form.buyer_tax_id) {
      alert('B2B 發票請填寫統一編號');
      return;
    }

    if (form.items.some(item => !item.name || item.price <= 0)) {
      alert('請填寫完整的品項資料');
      return;
    }

    if (form.issue_to_ezpay && !hasConfig) {
      alert('尚未設定 ezPay API，請先至設定頁面設定');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          ...form,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setShowModal(false);
        loadInvoices();
        alert(result.message || '發票已開立');
        
        // 重置表單
        resetForm();
      } else {
        alert(result.error || '開立失敗');
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('開立失敗');
    } finally {
      setIsSaving(false);
    }
  };

  // 重置表單
  const resetForm = () => {
    setForm({
      invoice_type: 'B2B',
      tax_type: 'taxable',
      customer_id: '',
      buyer_name: '',
      buyer_tax_id: '',
      buyer_email: '',
      buyer_phone: '',
      buyer_address: '',
      carrier_type: '',
      carrier_num: '',
      love_code: '',
      items: [{ name: '', quantity: 1, unit: '式', price: 0 }],
      comment: '',
      billing_request_id: '',
      issue_to_ezpay: true,
    });
  };

  // 儲存設定
  const handleSaveSettings = async () => {
    if (!company?.id) return;

    if (!settingsForm.merchant_id) {
      alert('請填寫商店代號');
      return;
    }

    // 只有在有填寫新值時才驗證
    if (settingsForm.hash_key && settingsForm.hash_key.length !== 32) {
      alert('HashKey 必須為 32 字元');
      return;
    }

    if (settingsForm.hash_iv && settingsForm.hash_iv.length !== 16) {
      alert('HashIV 必須為 16 字元');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/invoices/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          ...settingsForm,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setShowSettingsModal(false);
        loadSettings();
        alert('設定已儲存');
      } else {
        alert(result.error || '儲存失敗');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  // 測試 API 連線
  const handleTestApi = async () => {
    if (!company?.id) return;

    setIsTesting(true);
    try {
      const response = await fetch('/api/invoices/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.id }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ ${result.message}\n環境：${result.environment}`);
      } else {
        alert(`❌ ${result.error || '測試失敗'}`);
      }
    } catch (error) {
      console.error('Error testing API:', error);
      alert('測試失敗');
    } finally {
      setIsTesting(false);
    }
  };

  // 作廢發票
  const handleVoid = async () => {
    if (!selectedInvoice || !voidReason) {
      alert('請填寫作廢原因');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedInvoice.id,
          action: 'void',
          void_reason: voidReason,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setShowVoidModal(false);
        setSelectedInvoice(null);
        setVoidReason('');
        loadInvoices();
        alert('發票已作廢');
      } else {
        alert(result.error || '作廢失敗');
      }
    } catch (error) {
      console.error('Error voiding invoice:', error);
      alert('作廢失敗');
    } finally {
      setIsSaving(false);
    }
  };

  // 刪除草稿
  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此草稿？')) return;

    try {
      const response = await fetch(`/api/invoices?id=${id}`, { method: 'DELETE' });
      const result = await response.json();

      if (result.success) {
        loadInvoices();
      } else {
        alert(result.error || '刪除失敗');
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('刪除失敗');
    }
  };

  // 篩選發票
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (
          !inv.invoice_number?.toLowerCase().includes(search) &&
          !inv.buyer_name.toLowerCase().includes(search) &&
          !inv.buyer_tax_id?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      if (typeFilter !== 'all' && inv.invoice_type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [invoices, searchTerm, typeFilter]);

  // 統計資料
  const stats = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthInvoices = invoices.filter(inv => 
      inv.invoice_date.startsWith(thisMonth) && inv.status === 'issued'
    );

    return {
      total: invoices.length,
      issued: invoices.filter(inv => inv.status === 'issued').length,
      draft: invoices.filter(inv => inv.status === 'draft').length,
      void: invoices.filter(inv => inv.status === 'void').length,
      monthCount: monthInvoices.length,
      monthAmount: monthInvoices.reduce((sum, inv) => sum + inv.total_amount, 0),
    };
  }, [invoices]);

  // 狀態樣式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'issued': return 'bg-green-100 text-green-700';
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'void': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'issued': return '已開立';
      case 'draft': return '草稿';
      case 'void': return '已作廢';
      default: return status;
    }
  };

  const formatAmount = (amount: number) => `NT$ ${amount.toLocaleString()}`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-7 h-7 text-brand-primary-600" />
            電子發票
          </h1>
          <p className="text-gray-500 mt-1">ezPay 電子發票管理</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            設定
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            開立發票
          </button>
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="brand-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.monthCount}</p>
              <p className="text-sm text-gray-500">本月開立</p>
            </div>
          </div>
        </div>
        <div className="brand-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{formatAmount(stats.monthAmount)}</p>
              <p className="text-sm text-gray-500">本月金額</p>
            </div>
          </div>
        </div>
        <div className="brand-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.draft}</p>
              <p className="text-sm text-gray-500">草稿</p>
            </div>
          </div>
        </div>
        <div className="brand-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.void}</p>
              <p className="text-sm text-gray-500">已作廢</p>
            </div>
          </div>
        </div>
      </div>

      {/* 篩選列 */}
      <div className="brand-card p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜尋發票號碼、買受人..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                loadInvoices();
              }}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
            >
              <option value="all">全部狀態</option>
              <option value="issued">已開立</option>
              <option value="draft">草稿</option>
              <option value="void">已作廢</option>
            </select>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
            >
              <option value="all">全部類型</option>
              <option value="B2B">B2B</option>
              <option value="B2C">B2C</option>
            </select>
            <button
              onClick={loadInvoices}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* 發票列表 */}
      <div className="brand-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-primary-600" />
            <p className="mt-2 text-gray-500">載入中...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">尚無發票資料</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">發票號碼</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">日期</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">買受人</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">類型</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">金額</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">狀態</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredInvoices.map(invoice => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {invoice.invoice_number || '（草稿）'}
                    </div>
                    {invoice.ezpay_random_num && (
                      <div className="text-xs text-gray-500">
                        隨機碼：{invoice.ezpay_random_num}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {invoice.invoice_date}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{invoice.buyer_name}</div>
                    {invoice.buyer_tax_id && (
                      <div className="text-xs text-gray-500">統編：{invoice.buyer_tax_id}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                      invoice.invoice_type === 'B2B' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {invoice.invoice_type === 'B2B' ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {invoice.invoice_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-semibold text-gray-900">{formatAmount(invoice.total_amount)}</div>
                    <div className="text-xs text-gray-500">
                      稅額：{formatAmount(invoice.tax_amount)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(invoice.status)}`}>
                      {getStatusText(invoice.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {invoice.status === 'issued' && (
                        <button
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setShowVoidModal(true);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="作廢"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                      {invoice.status === 'draft' && (
                        <button
                          onClick={() => handleDelete(invoice.id)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="刪除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 開票 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Receipt className="w-5 h-5 text-brand-primary-600" />
                開立電子發票
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 發票類型 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">發票類型</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, invoice_type: 'B2B' }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      form.invoice_type === 'B2B'
                        ? 'border-brand-primary-500 bg-brand-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      <span className="font-medium">B2B 發票</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">公司行號（需統編）</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, invoice_type: 'B2C' }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      form.invoice_type === 'B2C'
                        ? 'border-brand-primary-500 bg-brand-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      <span className="font-medium">B2C 發票</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">個人消費者</p>
                  </button>
                </div>
              </div>

              {/* 買受人資訊 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">買受人資訊</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">選擇客戶</label>
                    <select
                      value={form.customer_id}
                      onChange={e => handleCustomerSelect(e.target.value)}
                      className="input-field"
                    >
                      <option value="">-- 選擇或手動輸入 --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.tax_id ? `(${c.tax_id})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      買受人名稱 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.buyer_name}
                      onChange={e => setForm(prev => ({ ...prev, buyer_name: e.target.value }))}
                      className="input-field"
                      placeholder="公司名稱或個人姓名"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      統一編號 {form.invoice_type === 'B2B' && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      value={form.buyer_tax_id}
                      onChange={e => setForm(prev => ({ ...prev, buyer_tax_id: e.target.value }))}
                      className="input-field"
                      placeholder="8 碼統編"
                      maxLength={8}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Email</label>
                    <input
                      type="email"
                      value={form.buyer_email}
                      onChange={e => setForm(prev => ({ ...prev, buyer_email: e.target.value }))}
                      className="input-field"
                      placeholder="發票寄送 Email"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">電話</label>
                    <input
                      type="text"
                      value={form.buyer_phone}
                      onChange={e => setForm(prev => ({ ...prev, buyer_phone: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              {/* B2C 載具/捐贈 */}
              {form.invoice_type === 'B2C' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">載具/捐贈</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">載具類型</label>
                      <select
                        value={form.carrier_type}
                        onChange={e => setForm(prev => ({ ...prev, carrier_type: e.target.value as any }))}
                        className="input-field"
                      >
                        <option value="">不使用載具</option>
                        <option value="0">手機條碼</option>
                        <option value="1">自然人憑證</option>
                        <option value="2">ezPay 載具</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">載具號碼</label>
                      <input
                        type="text"
                        value={form.carrier_num}
                        onChange={e => setForm(prev => ({ ...prev, carrier_num: e.target.value }))}
                        className="input-field"
                        placeholder="/ABC+123"
                        disabled={!form.carrier_type}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">愛心碼（捐贈發票）</label>
                      <input
                        type="text"
                        value={form.love_code}
                        onChange={e => setForm(prev => ({ ...prev, love_code: e.target.value }))}
                        className="input-field"
                        placeholder="3~7 碼愛心碼"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 發票品項 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">發票品項</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-sm text-brand-primary-600 hover:text-brand-primary-700"
                  >
                    + 新增品項
                  </button>
                </div>
                <div className="space-y-2">
                  {form.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={e => updateItem(index, 'name', e.target.value)}
                        className="input-field flex-1"
                        placeholder="品名"
                      />
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="input-field w-20 text-center"
                        min="1"
                      />
                      <input
                        type="text"
                        value={item.unit}
                        onChange={e => updateItem(index, 'unit', e.target.value)}
                        className="input-field w-16 text-center"
                        placeholder="單位"
                      />
                      <input
                        type="number"
                        value={item.price}
                        onChange={e => updateItem(index, 'price', parseInt(e.target.value) || 0)}
                        className="input-field w-28 text-right"
                        placeholder="單價"
                      />
                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                  <span className="font-medium text-gray-700">發票總金額</span>
                  <span className="text-2xl font-bold text-brand-primary-600">{formatAmount(totalAmount)}</span>
                </div>
              </div>

              {/* 備註 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
                <textarea
                  value={form.comment}
                  onChange={e => setForm(prev => ({ ...prev, comment: e.target.value }))}
                  className="input-field"
                  rows={2}
                  placeholder="發票備註（選填）"
                />
              </div>

              {/* 開立選項 */}
              <div className="flex items-center gap-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <input
                  type="checkbox"
                  id="issue_to_ezpay"
                  checked={form.issue_to_ezpay}
                  onChange={e => setForm(prev => ({ ...prev, issue_to_ezpay: e.target.checked }))}
                  className="w-4 h-4 text-brand-primary-600"
                />
                <label htmlFor="issue_to_ezpay" className="text-sm">
                  <span className="font-medium">立即開立 ezPay 電子發票</span>
                  <span className="text-gray-500 ml-2">（取消勾選則只儲存草稿）</span>
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary">
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="btn-primary flex items-center gap-2"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {form.issue_to_ezpay ? '開立發票' : '儲存草稿'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 設定 Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5" />
                ezPay API 設定
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <p className="font-medium mb-1">設定說明</p>
                <p>請至 ezPay 電子發票平台取得 API 金鑰</p>
                <a 
                  href="https://inv.ezpay.com.tw" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 underline flex items-center gap-1 mt-1"
                >
                  前往 ezPay <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  商店代號 (Merchant ID) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={settingsForm.merchant_id}
                  onChange={e => setSettingsForm(prev => ({ ...prev, merchant_id: e.target.value }))}
                  className="input-field"
                  placeholder="例：347148408"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HashKey (32 字元)
                </label>
                <input
                  type="password"
                  value={settingsForm.hash_key}
                  onChange={e => setSettingsForm(prev => ({ ...prev, hash_key: e.target.value }))}
                  className="input-field font-mono"
                  placeholder={hasConfig ? '已設定（留空不修改）' : '請輸入 HashKey'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HashIV (16 字元)
                </label>
                <input
                  type="password"
                  value={settingsForm.hash_iv}
                  onChange={e => setSettingsForm(prev => ({ ...prev, hash_iv: e.target.value }))}
                  className="input-field font-mono"
                  placeholder={hasConfig ? '已設定（留空不修改）' : '請輸入 HashIV'}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_production"
                  checked={settingsForm.is_production}
                  onChange={e => setSettingsForm(prev => ({ ...prev, is_production: e.target.checked }))}
                  className="w-4 h-4 text-brand-primary-600"
                />
                <label htmlFor="is_production" className="text-sm text-gray-700">
                  使用正式環境
                </label>
              </div>

              {hasConfig && (
                <button
                  onClick={handleTestApi}
                  disabled={isTesting}
                  className="w-full btn-secondary flex items-center justify-center gap-2"
                >
                  {isTesting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  測試 API 連線
                </button>
              )}
            </div>

            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setShowSettingsModal(false)} className="btn-secondary">
                取消
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="btn-primary flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                儲存設定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 作廢 Modal */}
      {showVoidModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-red-600 flex items-center gap-2">
                <Ban className="w-5 h-5" />
                作廢發票
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  確定要作廢發票 <span className="font-bold">{selectedInvoice.invoice_number}</span>？
                </p>
                <p className="text-sm text-red-600 mt-1">此操作無法復原。</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  作廢原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  className="input-field"
                  rows={3}
                  placeholder="請填寫作廢原因..."
                />
              </div>
            </div>

            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button 
                onClick={() => {
                  setShowVoidModal(false);
                  setSelectedInvoice(null);
                  setVoidReason('');
                }} 
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleVoid}
                disabled={isSaving || !voidReason}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                確認作廢
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
