'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Check,
  Users,
  Building2,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  CreditCard,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

// Types
interface Customer {
  id: string;
  company_id: string;
  name: string;
  short_name?: string;
  tax_id?: string;
  customer_type: 'customer' | 'vendor' | 'both';
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  is_active: boolean;
  // Phase 2 擴充欄位
  line_user_id?: string;
  line_display_name?: string;
  line_group_id?: string;
  line_group_name?: string;
  preferred_title?: string;
  vendor_type?: 'company' | 'individual';
  is_internal?: boolean;  // 是否內部人員
  can_issue_invoice?: boolean;
  billing_contact_name?: string;
  billing_email?: string;
  line_notify_enabled?: boolean;
  payment_terms?: number;
  credit_limit?: number;
  // 銀行資訊
  bank_code?: string;
  bank_name?: string;
  bank_account?: string;
  created_at?: string;
  updated_at?: string;
}

interface LineGroup {
  id: string;
  group_id: string;
  group_name: string;
}

type CustomerType = 'customer' | 'vendor' | 'both';
type VendorType = 'company' | 'individual';

const customerTypeLabels: Record<CustomerType, { label: string; color: string }> = {
  customer: { label: '客戶', color: 'bg-green-100 text-green-700' },
  vendor: { label: '廠商', color: 'bg-blue-100 text-blue-700' },
  both: { label: '客戶/廠商', color: 'bg-purple-100 text-purple-700' },
};

const vendorTypeLabels: Record<VendorType, string> = {
  company: '公司',
  individual: '個人',
};

export default function CustomersPage() {
  const { company } = useAuthStore();

  // State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<CustomerType | 'all'>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'billing' | 'line'>('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [lineGroups, setLineGroups] = useState<LineGroup[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    tax_id: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    customer_type: 'customer' as CustomerType,
    notes: '',
    is_active: true,
    // Phase 2 擴充
    line_user_id: '',
    line_display_name: '',
    line_group_id: '',
    line_group_name: '',
    preferred_title: '',
    vendor_type: 'company' as VendorType,
    is_internal: false,  // 是否內部人員
    can_issue_invoice: true,
    billing_contact_name: '',
    billing_email: '',
    line_notify_enabled: true,
    payment_terms: 30,
    credit_limit: 0,
    // 銀行資訊
    bank_code: '',
    bank_name: '',
    bank_account: '',
  });

  // 載入客戶資料
  useEffect(() => {
    if (company?.id) {
      loadCustomers();
      loadLineGroups();
    }
  }, [company?.id]);

  const loadLineGroups = async () => {
    if (!company?.id) return;
    try {
      const response = await fetch(`/api/line/groups?company_id=${company.id}`);
      const result = await response.json();
      if (result.data) {
        setLineGroups(result.data);
      }
    } catch (error) {
      console.error('Error loading LINE groups:', error);
    }
  };

  const loadCustomers = async () => {
    if (!company?.id) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/customers?company_id=${company.id}`);
      const result = await response.json();
      if (result.data) {
        setCustomers(result.data);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (
          !c.name.toLowerCase().includes(search) &&
          !c.short_name?.toLowerCase().includes(search) &&
          !c.tax_id?.toLowerCase().includes(search) &&
          !c.contact_person?.toLowerCase().includes(search) &&
          !c.line_display_name?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      if (filterType !== 'all' && c.customer_type !== filterType && c.customer_type !== 'both') {
        return false;
      }
      return true;
    });
  }, [customers, searchTerm, filterType]);

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        short_name: customer.short_name || '',
        tax_id: customer.tax_id || '',
        contact_person: customer.contact_person || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        customer_type: customer.customer_type,
        notes: customer.notes || '',
        is_active: customer.is_active,
        line_user_id: customer.line_user_id || '',
        line_display_name: customer.line_display_name || '',
        line_group_id: customer.line_group_id || '',
        line_group_name: customer.line_group_name || '',
        preferred_title: customer.preferred_title || '',
        vendor_type: customer.vendor_type || 'company',
        is_internal: customer.is_internal ?? false,
        can_issue_invoice: customer.can_issue_invoice ?? true,
        billing_contact_name: customer.billing_contact_name || '',
        billing_email: customer.billing_email || '',
        line_notify_enabled: customer.line_notify_enabled ?? true,
        payment_terms: customer.payment_terms || 30,
        credit_limit: customer.credit_limit || 0,
        bank_code: customer.bank_code || '',
        bank_name: customer.bank_name || '',
        bank_account: customer.bank_account || '',
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        short_name: '',
        tax_id: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        customer_type: 'customer',
        notes: '',
        is_active: true,
        line_user_id: '',
        line_display_name: '',
        line_group_id: '',
        line_group_name: '',
        preferred_title: '',
        vendor_type: 'company',
        is_internal: false,
        can_issue_invoice: true,
        billing_contact_name: '',
        billing_email: '',
        line_notify_enabled: true,
        payment_terms: 30,
        credit_limit: 0,
        bank_code: '',
        bank_name: '',
        bank_account: '',
      });
    }
    setActiveTab('basic');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    // 前端驗證 - 失敗時不關閉 Modal
    if (!formData.name.trim()) {
      alert('請先填寫「基本資料」中的客戶名稱');
      setActiveTab('basic');
      return;
    }

    setIsSaving(true);
    try {
      const url = editingCustomer
        ? `/api/customers?id=${editingCustomer.id}`
        : '/api/customers';

      const method = editingCustomer ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          company_id: company.id,
        }),
      });

      const result = await response.json();
      if (result.success || result.data) {
        await loadCustomers();
        setShowModal(false);
        alert(editingCustomer ? '客戶資料已更新！' : '客戶已新增！');
      } else {
        alert(result.error || '儲存失敗');
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/customers?id=${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        setCustomers(customers.filter(c => c.id !== id));
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
    setDeleteConfirm(null);
  };

  // 統計
  const stats = {
    total: customers.length,
    customers: customers.filter(c => c.customer_type === 'customer' || c.customer_type === 'both').length,
    vendors: customers.filter(c => c.customer_type === 'vendor' || c.customer_type === 'both').length,
    lineEnabled: customers.filter(c => c.line_notify_enabled && (c.line_group_id || c.line_user_id)).length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">客戶管理</h1>
          <p className="text-gray-500 mt-1">管理您的客戶與廠商資料，支援 LINE 通知與請款設定</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadCustomers}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            重新整理
          </button>
          <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            新增客戶
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">總數</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.customers}</p>
              <p className="text-sm text-gray-500">客戶</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.vendors}</p>
              <p className="text-sm text-gray-500">廠商</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary-100 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-brand-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.lineEnabled}</p>
              <p className="text-sm text-gray-500">LINE 通知</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-hidden">
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 pl-9 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 focus:border-brand-primary-500 text-sm"
                placeholder="搜尋客戶名稱、統編、聯絡人..."
              />
            </div>
          </div>
          <div className="flex gap-2">
            {(['all', 'customer', 'vendor'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterType === type
                    ? 'bg-brand-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {type === 'all' ? '全部' : type === 'customer' ? '客戶' : '廠商'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-3 animate-spin" />
            <p className="text-gray-500">載入中...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">尚未建立任何客戶資料</p>
            <button onClick={() => handleOpenModal()} className="mt-4 text-brand-primary-600 hover:text-brand-primary-700">
              + 新增第一位客戶
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredCustomers.map(customer => (
              <div key={customer.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{customer.name}</h3>
                      {customer.short_name && (
                        <span className="text-sm text-gray-500">({customer.short_name})</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${customerTypeLabels[customer.customer_type].color}`}>
                        {customerTypeLabels[customer.customer_type].label}
                      </span>
                      {customer.vendor_type === 'individual' && customer.customer_type !== 'customer' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                          個人
                        </span>
                      )}
                      {customer.line_notify_enabled && customer.line_user_id && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" /> LINE
                        </span>
                      )}
                      {!customer.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          停用
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {customer.tax_id && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {customer.tax_id}
                        </span>
                      )}
                      {(customer.preferred_title || customer.contact_person) && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {customer.preferred_title || customer.contact_person}
                        </span>
                      )}
                      {customer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {customer.phone}
                        </span>
                      )}
                      {(customer.billing_email || customer.email) && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {customer.billing_email || customer.email}
                        </span>
                      )}
                      {customer.line_display_name && (
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5" />
                          {customer.line_display_name}
                        </span>
                      )}
                    </div>
                    {customer.address && (
                      <div className="mt-1 text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {customer.address}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenModal(customer)}
                      className="p-2 text-gray-400 hover:text-brand-primary-600 hover:bg-brand-primary-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {deleteConfirm === customer.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(customer.id)}
                          className="p-2 text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(customer.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCustomer ? '編輯客戶' : '新增客戶'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              {[
                { id: 'basic', label: '基本資料', icon: Users },
                { id: 'billing', label: '請款設定', icon: CreditCard },
                { id: 'line', label: 'LINE 通知', icon: MessageCircle },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                      ? 'border-brand-primary-600 text-brand-primary-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Basic Tab */}
              {activeTab === 'basic' && (
                <>
                  {/* Customer Type */}
                  <div>
                    <label className="input-label">類型</label>
                    <div className="flex gap-2">
                      {(['customer', 'vendor', 'both'] as CustomerType[]).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData({ ...formData, customer_type: type })}
                          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${formData.customer_type === type
                              ? 'bg-brand-primary-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                          {customerTypeLabels[type].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vendor Type (only show for vendor) */}
                  {(formData.customer_type === 'vendor' || formData.customer_type === 'both') && (
                    <>
                      <div>
                        <label className="input-label">廠商類型</label>
                        <div className="flex gap-2">
                          {(['company', 'individual'] as VendorType[]).map(type => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setFormData({ ...formData, vendor_type: type, is_internal: false })}
                              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${formData.vendor_type === type && !formData.is_internal
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                              外部{vendorTypeLabels[type]}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, vendor_type: 'individual', is_internal: true })}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${formData.is_internal
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                          >
                            內部人員
                          </button>
                        </div>
                        {formData.vendor_type === 'individual' && !formData.is_internal && (
                          <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            外部個人需填寫勞報單，會記入成本
                          </p>
                        )}
                        {formData.is_internal && (
                          <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            內部人員需填寫勞報單，不計入專案成本
                          </p>
                        )}
                        {formData.vendor_type === 'company' && !formData.is_internal && (
                          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            外部公司需填統編，付款後請對方開發票
                          </p>
                        )}
                      </div>

                      {/* 銀行資訊（付款用） */}
                      {formData.vendor_type === 'individual' && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <label className="input-label mb-3">銀行資訊（匯款用）</label>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <input
                                type="text"
                                value={formData.bank_code}
                                onChange={e => setFormData({ ...formData, bank_code: e.target.value })}
                                className="input-field"
                                placeholder="銀行代碼"
                              />
                            </div>
                            <div>
                              <input
                                type="text"
                                value={formData.bank_name}
                                onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                                className="input-field"
                                placeholder="銀行名稱"
                              />
                            </div>
                            <div>
                              <input
                                type="text"
                                value={formData.bank_account}
                                onChange={e => setFormData({ ...formData, bank_account: e.target.value })}
                                className="input-field"
                                placeholder="帳號"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Name */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">公司/客戶名稱 *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="input-field"
                        placeholder="例：台灣科技股份有限公司"
                        required
                      />
                    </div>
                    <div>
                      <label className="input-label">簡稱</label>
                      <input
                        type="text"
                        value={formData.short_name}
                        onChange={e => setFormData({ ...formData, short_name: e.target.value })}
                        className="input-field"
                        placeholder="例：台灣科技"
                      />
                    </div>
                  </div>

                  {/* Tax ID & Preferred Title */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">統一編號</label>
                      <input
                        type="text"
                        value={formData.tax_id}
                        onChange={e => setFormData({ ...formData, tax_id: e.target.value })}
                        className="input-field"
                        placeholder="12345678"
                      />
                    </div>
                    <div>
                      <label className="input-label">稱呼</label>
                      <input
                        type="text"
                        value={formData.preferred_title}
                        onChange={e => setFormData({ ...formData, preferred_title: e.target.value })}
                        className="input-field"
                        placeholder="例：王總、李經理"
                      />
                    </div>
                  </div>

                  {/* Contact & Phone */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">聯絡人</label>
                      <input
                        type="text"
                        value={formData.contact_person}
                        onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                        className="input-field"
                        placeholder="王小明"
                      />
                    </div>
                    <div>
                      <label className="input-label">電話</label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className="input-field"
                        placeholder="02-1234-5678"
                      />
                    </div>
                  </div>

                  {/* Email & Address */}
                  <div>
                    <label className="input-label">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="input-field"
                      placeholder="contact@example.com"
                    />
                  </div>
                  <div>
                    <label className="input-label">地址</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      className="input-field"
                      placeholder="台北市信義區信義路100號"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="input-label">備註</label>
                    <textarea
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      className="input-field"
                      rows={2}
                      placeholder="選填"
                    />
                  </div>

                  {/* Active Status */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">啟用狀態</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.is_active ? 'bg-brand-primary-600' : 'bg-gray-300'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>
                </>
              )}

              {/* Billing Tab */}
              {activeTab === 'billing' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">請款聯絡人</label>
                      <input
                        type="text"
                        value={formData.billing_contact_name}
                        onChange={e => setFormData({ ...formData, billing_contact_name: e.target.value })}
                        className="input-field"
                        placeholder="財務部 陳小姐"
                      />
                    </div>
                    <div>
                      <label className="input-label">請款 Email</label>
                      <input
                        type="email"
                        value={formData.billing_email}
                        onChange={e => setFormData({ ...formData, billing_email: e.target.value })}
                        className="input-field"
                        placeholder="accounting@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">付款條件（天）</label>
                      <input
                        type="number"
                        value={formData.payment_terms}
                        onChange={e => setFormData({ ...formData, payment_terms: parseInt(e.target.value) || 0 })}
                        className="input-field"
                        placeholder="30"
                        min="0"
                      />
                      <p className="text-xs text-gray-500 mt-1">收到請款單後幾天內付款</p>
                    </div>
                    <div>
                      <label className="input-label">信用額度</label>
                      <input
                        type="number"
                        value={formData.credit_limit}
                        onChange={e => setFormData({ ...formData, credit_limit: parseInt(e.target.value) || 0 })}
                        className="input-field"
                        placeholder="0"
                        min="0"
                      />
                      <p className="text-xs text-gray-500 mt-1">0 表示無限制</p>
                    </div>
                  </div>

                  {/* Vendor specific: can issue invoice */}
                  {(formData.customer_type === 'vendor' || formData.customer_type === 'both') &&
                    formData.vendor_type === 'company' && (
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div>
                          <span className="text-sm font-medium text-gray-700">廠商會開發票</span>
                          <p className="text-xs text-gray-500">公司型廠商是否會開立發票給我們</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, can_issue_invoice: !formData.can_issue_invoice })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.can_issue_invoice ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.can_issue_invoice ? 'translate-x-6' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>
                    )}
                </>
              )}

              {/* LINE Tab */}
              {activeTab === 'line' && (
                <>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg mb-4">
                    <div>
                      <span className="text-sm font-medium text-gray-700">啟用 LINE 通知</span>
                      <p className="text-xs text-gray-500">發送請款通知、收款確認、發票開立等訊息</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, line_notify_enabled: !formData.line_notify_enabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.line_notify_enabled ? 'bg-green-600' : 'bg-gray-300'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.line_notify_enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>

                  {/* LINE 群組選擇 */}
                  <div className="mb-4">
                    <label className="input-label">LINE 群組（請款通知發送目標）</label>
                    <select
                      value={formData.line_group_id}
                      onChange={e => {
                        const group = lineGroups.find(g => g.group_id === e.target.value);
                        setFormData({
                          ...formData,
                          line_group_id: e.target.value,
                          line_group_name: group?.group_name || ''
                        });
                      }}
                      className="input-field"
                    >
                      <option value="">選擇群組...</option>
                      {lineGroups.map(group => (
                        <option key={group.id} value={group.group_id}>
                          {group.group_name}
                        </option>
                      ))}
                    </select>
                    {formData.line_group_id && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" /> 已選擇：{formData.line_group_name}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">LINE User ID（個人）</label>
                      <input
                        type="text"
                        value={formData.line_user_id}
                        onChange={e => setFormData({ ...formData, line_user_id: e.target.value })}
                        className="input-field"
                        placeholder="U1234567890abcdef..."
                      />
                      <p className="text-xs text-gray-500 mt-1">選填，通常使用群組發送</p>
                    </div>
                    <div>
                      <label className="input-label">LINE 顯示名稱</label>
                      <input
                        type="text"
                        value={formData.line_display_name}
                        onChange={e => setFormData({ ...formData, line_display_name: e.target.value })}
                        className="input-field"
                        placeholder="王小明"
                      />
                    </div>
                  </div>

                  {!formData.line_group_id && !formData.line_user_id && formData.line_notify_enabled && (
                    <div className="p-3 bg-yellow-50 rounded-lg flex items-start gap-2 mt-4">
                      <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="text-sm text-yellow-700">尚未設定 LINE 群組</p>
                        <p className="text-xs text-yellow-600">請選擇要發送請款通知的 LINE 群組</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </form>

            {/* Actions - Fixed at bottom */}
            <div className="flex gap-3 p-4 border-t bg-gray-50">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editingCustomer ? '儲存' : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
