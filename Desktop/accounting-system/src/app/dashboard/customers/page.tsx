'use client';

import { useState, useMemo } from 'react';
import { useDataStore, Customer } from '@/stores/dataStore';
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
} from 'lucide-react';

type CustomerType = 'customer' | 'vendor' | 'both';

const customerTypeLabels: Record<CustomerType, { label: string; color: string }> = {
  customer: { label: '客戶', color: 'bg-green-100 text-green-700' },
  vendor: { label: '廠商', color: 'bg-blue-100 text-blue-700' },
  both: { label: '客戶/廠商', color: 'bg-purple-100 text-purple-700' },
};

export default function CustomersPage() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useDataStore();
  const { canEdit } = useAuthStore();

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<CustomerType | 'all'>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
  });

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (
          !c.name.toLowerCase().includes(search) &&
          !c.short_name?.toLowerCase().includes(search) &&
          !c.tax_id?.toLowerCase().includes(search) &&
          !c.contact_person?.toLowerCase().includes(search)
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
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingCustomer) {
      await updateCustomer(editingCustomer.id, formData);
    } else {
      await addCustomer(formData);
    }

    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    await deleteCustomer(id);
    setDeleteConfirm(null);
  };

  // 統計
  const stats = {
    total: customers.length,
    customers: customers.filter(c => c.customer_type === 'customer' || c.customer_type === 'both').length,
    vendors: customers.filter(c => c.customer_type === 'vendor' || c.customer_type === 'both').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">客戶管理</h1>
          <p className="text-gray-500 mt-1">管理您的客戶與廠商資料</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          新增客戶
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
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
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="input-field pl-9"
                placeholder="搜尋客戶名稱、統編、聯絡人..."
              />
            </div>
          </div>
          <div className="flex gap-2">
            {(['all', 'customer', 'vendor'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === type
                    ? 'bg-blue-600 text-white'
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
        {filteredCustomers.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">尚未建立任何客戶資料</p>
            <button onClick={() => handleOpenModal()} className="btn-primary mt-4">
              建立第一筆客戶
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredCustomers.map(customer => (
              <div
                key={customer.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                      {customer.short_name && (
                        <span className="text-sm text-gray-500">({customer.short_name})</span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${customerTypeLabels[customer.customer_type].color}`}>
                        {customerTypeLabels[customer.customer_type].label}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                      {customer.tax_id && (
                        <span>統編：{customer.tax_id}</span>
                      )}
                      {customer.contact_person && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {customer.contact_person}
                        </span>
                      )}
                      {customer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {customer.phone}
                        </span>
                      )}
                      {customer.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {customer.email}
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
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
          <div className="modal-content max-w-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCustomer ? '編輯客戶' : '新增客戶'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Customer Type */}
              <div>
                <label className="input-label">類型</label>
                <div className="flex gap-2">
                  {(['customer', 'vendor', 'both'] as CustomerType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, customer_type: type })}
                      className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                        formData.customer_type === type
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {customerTypeLabels[type].label}
                    </button>
                  ))}
                </div>
              </div>

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

              {/* Tax ID & Contact */}
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
                  <label className="input-label">聯絡人</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                    className="input-field"
                    placeholder="王經理"
                  />
                </div>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-4">
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
              </div>

              {/* Address */}
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

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  取消
                </button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  {editingCustomer ? '儲存' : '新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
