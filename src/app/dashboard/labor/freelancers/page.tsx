'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  User,
  Phone,
  Mail,
  Building2,
  FileCheck,
  ArrowLeft,
  Loader2,
  X,
  RefreshCw,
} from 'lucide-react';

interface Freelancer {
  id: string;
  name: string;
  id_number: string;
  phone: string;
  email: string;
  line_user_id: string | null;
  is_union_member: boolean;
  bank_code: string;
  bank_name: string;
  bank_account: string;
  total_reports: number;
  total_amount: number;
  is_active: boolean;
  created_at: string;
}

// 銀行代碼對照
const bankNames: Record<string, string> = {
  '004': '台灣銀行', '005': '土地銀行', '006': '合庫銀行', '007': '第一銀行',
  '008': '華南銀行', '009': '彰化銀行', '012': '台北富邦', '013': '國泰世華',
  '017': '兆豐銀行', '048': '王道銀行', '050': '臺灣企銀', '700': '中華郵政',
  '803': '聯邦銀行', '806': '元大銀行', '807': '永豐銀行', '808': '玉山銀行',
  '812': '台新銀行', '822': '中信銀行',
};

const getBankName = (code: string) => bankNames[code] || '其他銀行';

export default function FreelancersPage() {
  const { company } = useAuthStore();
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFreelancer, setEditingFreelancer] = useState<Freelancer | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 表單狀態
  const [formData, setFormData] = useState({
    name: '',
    id_number: '',
    phone: '',
    email: '',
    line_user_id: '',
    is_union_member: false,
    bank_code: '',
    bank_account: '',
  });

  // 載入資料
  const loadFreelancers = async () => {
    if (!company?.id) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/freelancers?company_id=${company.id}`);
      const json = await res.json();
      if (json.data) {
        setFreelancers(json.data);
      }
    } catch (error) {
      console.error('Error loading freelancers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFreelancers();
  }, [company?.id]);

  // 篩選
  const filteredFreelancers = freelancers.filter(f =>
    !searchTerm ||
    f.name.includes(searchTerm) ||
    (f.id_number && f.id_number.includes(searchTerm)) ||
    (f.phone && f.phone.includes(searchTerm))
  );

  // 格式化金額
  const formatAmount = (amount: number) => new Intl.NumberFormat('zh-TW').format(amount);

  // 開啟新增/編輯 Modal
  const openModal = (freelancer?: Freelancer) => {
    if (freelancer) {
      setEditingFreelancer(freelancer);
      setFormData({
        name: freelancer.name,
        id_number: freelancer.id_number || '',
        phone: freelancer.phone || '',
        email: freelancer.email || '',
        line_user_id: freelancer.line_user_id || '',
        is_union_member: freelancer.is_union_member,
        bank_code: freelancer.bank_code || '',
        bank_account: freelancer.bank_account || '',
      });
    } else {
      setEditingFreelancer(null);
      setFormData({
        name: '',
        id_number: '',
        phone: '',
        email: '',
        line_user_id: '',
        is_union_member: false,
        bank_code: '',
        bank_account: '',
      });
    }
    setShowModal(true);
  };

  // 儲存
  const handleSave = async () => {
    if (!company?.id || !formData.name) {
      alert('請填寫姓名');
      return;
    }

    setSaving(true);
    try {
      const url = editingFreelancer 
        ? `/api/freelancers/${editingFreelancer.id}`
        : '/api/freelancers';
      
      const res = await fetch(url, {
        method: editingFreelancer ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          ...formData,
          bank_name: getBankName(formData.bank_code),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowModal(false);
        loadFreelancers();
      } else {
        alert(json.error || '儲存失敗');
      }
    } catch (error) {
      alert('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  // 刪除
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/freelancers/${id}`, { method: 'DELETE' });
      const json = await res.json();
      
      if (json.success) {
        setDeleteId(null);
        loadFreelancers();
      } else {
        alert(json.error || '刪除失敗');
      }
    } catch (error) {
      alert('刪除失敗');
    }
  };

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/labor" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">人員管理</h1>
            <p className="text-sm text-gray-500 mt-1">管理內部/外部人員資料、銀行帳戶、LINE 綁定</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadFreelancers} className="btn-secondary" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            新增人員
          </button>
        </div>
      </div>

      {/* 搜尋 */}
      <div className="brand-card p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋姓名、身分證、電話..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '2.75rem' }}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 人員列表 */}
      {isLoading ? (
        <div className="brand-card p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">載入中...</p>
        </div>
      ) : filteredFreelancers.length === 0 ? (
        <div className="brand-card p-12 text-center">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">
            {searchTerm ? '沒有找到符合條件的人員' : '尚無人員資料'}
          </p>
          {!searchTerm && (
            <button onClick={() => openModal()} className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              新增第一位人員
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFreelancers.map((freelancer) => (
            <div key={freelancer.id} className="brand-card p-5 hover:shadow-brand transition-shadow">
              {/* 頭部 */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-brand-primary-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-brand-primary-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{freelancer.name}</h3>
                    <p className="text-sm text-gray-500">{freelancer.id_number || '未填身分證'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {freelancer.is_union_member && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">工會</span>
                  )}
                  {freelancer.line_user_id && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">LINE</span>
                  )}
                </div>
              </div>

              {/* 聯絡資訊 */}
              <div className="space-y-2 mb-4">
                {freelancer.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{freelancer.phone}</span>
                  </div>
                )}
                {freelancer.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{freelancer.email}</span>
                  </div>
                )}
                {freelancer.bank_code && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building2 className="w-4 h-4" />
                    <span>{freelancer.bank_code} {getBankName(freelancer.bank_code)}</span>
                  </div>
                )}
              </div>

              {/* 統計 */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg mb-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500">累計勞報單</p>
                  <p className="text-lg font-bold text-brand-primary-700">{freelancer.total_reports || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">累計金額</p>
                  <p className="text-lg font-bold text-brand-primary-700">
                    ${formatAmount(freelancer.total_amount || 0)}
                  </p>
                </div>
              </div>

              {/* 操作按鈕 */}
              <div className="flex gap-2">
                <button onClick={() => openModal(freelancer)}
                  className="btn-secondary flex-1 text-sm flex items-center justify-center gap-1">
                  <Edit2 className="w-4 h-4" />
                  編輯
                </button>
                <Link href={`/dashboard/labor?freelancer_id=${freelancer.id}`}
                  className="btn-secondary flex-1 text-sm flex items-center justify-center gap-1">
                  <FileCheck className="w-4 h-4" />
                  勞報單
                </Link>
                <button onClick={() => setDeleteId(freelancer.id)}
                  className="btn-secondary px-3 text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新增/編輯 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingFreelancer ? '編輯人員' : '新增人員'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">姓名 *</label>
                  <input type="text" value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="input-field" placeholder="請輸入姓名" />
                </div>
                <div>
                  <label className="input-label">身分證字號</label>
                  <input type="text" value={formData.id_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, id_number: e.target.value.toUpperCase() }))}
                    className="input-field" placeholder="A123456789" maxLength={10} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">電話</label>
                  <input type="tel" value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="input-field" placeholder="0912-345-678" />
                </div>
                <div>
                  <label className="input-label">Email</label>
                  <input type="email" value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="input-field" placeholder="email@example.com" />
                </div>
              </div>

              <div>
                <label className="input-label">LINE User ID</label>
                <input type="text" value={formData.line_user_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, line_user_id: e.target.value }))}
                  className="input-field" placeholder="U1234567890..." />
                <p className="text-xs text-gray-500 mt-1">可由 LINE 官方帳號綁定取得</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">銀行代碼</label>
                  <input type="text" value={formData.bank_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, bank_code: e.target.value }))}
                    className="input-field" placeholder="004" maxLength={3} />
                  {formData.bank_code && (
                    <p className="text-xs text-gray-500 mt-1">{getBankName(formData.bank_code)}</p>
                  )}
                </div>
                <div>
                  <label className="input-label">銀行帳號</label>
                  <input type="text" value={formData.bank_account}
                    onChange={(e) => setFormData(prev => ({ ...prev, bank_account: e.target.value }))}
                    className="input-field" placeholder="12345678901234" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_union_member" checked={formData.is_union_member}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_union_member: e.target.checked }))}
                  className="w-4 h-4 text-brand-primary-600 rounded" />
                <label htmlFor="is_union_member" className="text-sm text-gray-700">
                  工會成員（免扣二代健保補充保費）
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">取消</button>
              <button onClick={handleSave} disabled={saving || !formData.name}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingFreelancer ? '更新' : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 刪除確認 Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">確認刪除</h3>
            <p className="text-gray-600 mb-6">確定要刪除此人員嗎？如有關聯勞報單將改為停用。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">取消</button>
              <button onClick={() => handleDelete(deleteId)}
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700">確認刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
