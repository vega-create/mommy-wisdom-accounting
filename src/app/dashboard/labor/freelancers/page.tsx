'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  User,
  Phone,
  Mail,
  Building2,
  CheckCircle2,
  XCircle,
  FileCheck,
  ArrowLeft,
  MessageSquare,
} from 'lucide-react';

// 模擬資料
const mockFreelancers = [
  {
    id: '1',
    name: '王小明',
    id_number: 'A123456789',
    phone: '0912-345-678',
    email: 'wang@example.com',
    line_user_id: 'U1234567890',
    is_union_member: false,
    bank_code: '004',
    bank_name: '台灣銀行',
    bank_account: '12345678901234',
    total_reports: 8,
    total_amount: 240000,
    is_active: true,
    created_at: '2025-06-15',
  },
  {
    id: '2',
    name: '李小華',
    id_number: 'B234567890',
    phone: '0923-456-789',
    email: 'lee@example.com',
    line_user_id: 'U2345678901',
    is_union_member: true,
    bank_code: '012',
    bank_name: '台北富邦',
    bank_account: '98765432109876',
    total_reports: 5,
    total_amount: 150000,
    is_active: true,
    created_at: '2025-08-20',
  },
  {
    id: '3',
    name: '張美玲',
    id_number: 'C345678901',
    phone: '0934-567-890',
    email: 'chang@example.com',
    line_user_id: null,
    is_union_member: false,
    bank_code: '008',
    bank_name: '華南銀行',
    bank_account: '55566677788899',
    total_reports: 3,
    total_amount: 75000,
    is_active: true,
    created_at: '2025-10-01',
  },
];

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

export default function FreelancersPage() {
  const [freelancers, setFreelancers] = useState<Freelancer[]>(mockFreelancers);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFreelancer, setEditingFreelancer] = useState<Freelancer | null>(null);

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

  // 篩選
  const filteredFreelancers = freelancers.filter(f =>
    f.name.includes(searchTerm) ||
    f.id_number.includes(searchTerm) ||
    f.phone.includes(searchTerm)
  );

  // 格式化金額
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('zh-TW').format(amount);
  };

  // 開啟新增/編輯 Modal
  const openModal = (freelancer?: Freelancer) => {
    if (freelancer) {
      setEditingFreelancer(freelancer);
      setFormData({
        name: freelancer.name,
        id_number: freelancer.id_number,
        phone: freelancer.phone,
        email: freelancer.email,
        line_user_id: freelancer.line_user_id || '',
        is_union_member: freelancer.is_union_member,
        bank_code: freelancer.bank_code,
        bank_account: freelancer.bank_account,
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
  const handleSave = () => {
    if (editingFreelancer) {
      // 更新
      setFreelancers(prev => prev.map(f =>
        f.id === editingFreelancer.id
          ? { ...f, ...formData }
          : f
      ));
    } else {
      // 新增
      const newFreelancer: Freelancer = {
        id: Date.now().toString(),
        ...formData,
        bank_name: getBankName(formData.bank_code),
        total_reports: 0,
        total_amount: 0,
        is_active: true,
        created_at: new Date().toISOString().split('T')[0],
      };
      setFreelancers(prev => [...prev, newFreelancer]);
    }
    setShowModal(false);
  };

  // 取得銀行名稱
  const getBankName = (code: string) => {
    const banks: Record<string, string> = {
      '004': '台灣銀行',
      '005': '土地銀行',
      '006': '合庫銀行',
      '007': '第一銀行',
      '008': '華南銀行',
      '009': '彰化銀行',
      '011': '上海商銀',
      '012': '台北富邦',
      '013': '國泰世華',
      '017': '兆豐銀行',
      '021': '花旗銀行',
      '048': '王道銀行',
      '050': '臺灣企銀',
      '052': '渣打銀行',
      '053': '台中銀行',
      '054': '京城銀行',
      '081': '匯豐銀行',
      '101': '瑞興銀行',
      '102': '華泰銀行',
      '108': '陽信銀行',
      '118': '板信銀行',
      '147': '三信銀行',
      '700': '中華郵政',
      '803': '聯邦銀行',
      '805': '遠東銀行',
      '806': '元大銀行',
      '807': '永豐銀行',
      '808': '玉山銀行',
      '809': '凱基銀行',
      '810': '星展銀行',
      '812': '台新銀行',
      '816': '安泰銀行',
      '822': '中信銀行',
    };
    return banks[code] || '其他銀行';
  };

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/labor"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">外包人員管理</h1>
            <p className="text-sm text-gray-500 mt-1">管理外包人員資料、銀行帳戶、LINE 綁定</p>
          </div>
        </div>
        <button
          onClick={() => openModal()}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新增人員
        </button>
      </div>

      {/* 搜尋 */}
      <div className="brand-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋姓名、身分證、電話..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* 人員列表 */}
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
                  <p className="text-sm text-gray-500">{freelancer.id_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {freelancer.is_union_member && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                    工會
                  </span>
                )}
                {freelancer.line_user_id && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                    LINE
                  </span>
                )}
              </div>
            </div>

            {/* 聯絡資訊 */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4" />
                <span>{freelancer.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="w-4 h-4" />
                <span className="truncate">{freelancer.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Building2 className="w-4 h-4" />
                <span>{freelancer.bank_code} {freelancer.bank_name}</span>
              </div>
            </div>

            {/* 統計 */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg mb-4">
              <div className="text-center">
                <p className="text-xs text-gray-500">累計勞報單</p>
                <p className="text-lg font-bold text-brand-primary-700">{freelancer.total_reports}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">累計金額</p>
                <p className="text-lg font-bold text-brand-primary-700">
                  ${formatAmount(freelancer.total_amount)}
                </p>
              </div>
            </div>

            {/* 操作按鈕 */}
            <div className="flex gap-2">
              <button
                onClick={() => openModal(freelancer)}
                className="btn-secondary flex-1 text-sm flex items-center justify-center gap-1"
              >
                <Edit2 className="w-4 h-4" />
                編輯
              </button>
              <Link
                href={`/dashboard/labor?staff=${freelancer.id}`}
                className="btn-secondary flex-1 text-sm flex items-center justify-center gap-1"
              >
                <FileCheck className="w-4 h-4" />
                勞報單
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filteredFreelancers.length === 0 && (
        <div className="brand-card p-12 text-center">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">尚無外包人員資料</p>
          <button
            onClick={() => openModal()}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新增第一位人員
          </button>
        </div>
      )}

      {/* 新增/編輯 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              {editingFreelancer ? '編輯人員' : '新增人員'}
            </h3>

            <div className="space-y-4">
              {/* 基本資訊 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">姓名 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="input-field"
                    placeholder="請輸入姓名"
                  />
                </div>
                <div>
                  <label className="input-label">身分證字號 *</label>
                  <input
                    type="text"
                    value={formData.id_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, id_number: e.target.value.toUpperCase() }))}
                    className="input-field"
                    placeholder="A123456789"
                    maxLength={10}
                  />
                </div>
              </div>

              {/* 聯絡資訊 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">電話</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="input-field"
                    placeholder="0912-345-678"
                  />
                </div>
                <div>
                  <label className="input-label">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="input-field"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              {/* LINE */}
              <div>
                <label className="input-label">LINE User ID（可由系統自動綁定）</label>
                <input
                  type="text"
                  value={formData.line_user_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, line_user_id: e.target.value }))}
                  className="input-field"
                  placeholder="U1234567890abcdef..."
                />
              </div>

              {/* 銀行帳戶 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">銀行代碼 *</label>
                  <input
                    type="text"
                    value={formData.bank_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, bank_code: e.target.value }))}
                    className="input-field"
                    placeholder="004"
                    maxLength={3}
                  />
                  {formData.bank_code && (
                    <p className="text-xs text-gray-500 mt-1">
                      {getBankName(formData.bank_code)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="input-label">銀行帳號 *</label>
                  <input
                    type="text"
                    value={formData.bank_account}
                    onChange={(e) => setFormData(prev => ({ ...prev, bank_account: e.target.value }))}
                    className="input-field"
                    placeholder="12345678901234"
                  />
                </div>
              </div>

              {/* 工會成員 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_union_member"
                  checked={formData.is_union_member}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_union_member: e.target.checked }))}
                  className="w-4 h-4 text-brand-primary-600 rounded"
                />
                <label htmlFor="is_union_member" className="text-sm text-gray-700">
                  工會成員（免扣二代健保補充保費）
                </label>
              </div>
            </div>

            {/* 按鈕 */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="btn-secondary flex-1"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || !formData.id_number || !formData.bank_code || !formData.bank_account}
                className="btn-primary flex-1"
              >
                {editingFreelancer ? '更新' : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
