'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import {
  ArrowLeft,
  Save,
  Send,
  Calculator,
  User,
  FileText,
  CheckCircle2,
  Copy,
  MessageSquare,
  Eye,
  X,
  Loader2,
} from 'lucide-react';

// 所得類型配置（2025年）
const incomeTypes = [
  { code: '50', name: '執行業務所得', taxRate: 0.10, description: '扣繳 10%' },
  { code: '9A', name: '稿費所得', taxRate: 0.10, description: '全年 18 萬內免稅' },
  { code: '9B', name: '講演鐘點費', taxRate: 0.10, description: '全年 18 萬內免稅' },
  { code: '92', name: '競技競賽獎金', taxRate: 0.10, description: '扣繳 10%' },
];

// 2025 稅務計算常數
const NHI_RATE = 0.0211;
const NHI_THRESHOLD = 20010;

// 定義完整的 Freelancer 型別
interface Freelancer {
  id: string;
  name: string;
  id_number?: string;
  is_union_member?: boolean;
  bank_code?: string;
  bank_account?: string;
  phone?: string;
  email?: string;
  line_user_id?: string;
}

interface BillingRequest {
  id: string;
  billing_number: string;
  customer_name?: string;
  amount: number;
}

interface LineGroup {
  id: string;
  group_id: string;
  group_name: string;
  is_active: boolean;
}

export default function NewLaborReportPage() {
  const router = useRouter();
  const { company, user } = useAuthStore();
  const [saving, setSaving] = useState(false);

  // 資料來源
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [billingRequests, setBillingRequests] = useState<BillingRequest[]>([]);
  const [lineGroups, setLineGroups] = useState<LineGroup[]>([]);

  // LINE 發送設定
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedLineGroup, setSelectedLineGroup] = useState<string>('');
  const [signUrl, setSignUrl] = useState<string>('');
  const [customMessage, setCustomMessage] = useState('');

  // 表單資料
  const [formData, setFormData] = useState({
    staff_type: 'external' as 'internal' | 'external',
    freelancer_id: '',
    staff_name: '',
    id_number: '',
    is_union_member: false,
    income_type_code: '50',
    work_description: '',
    service_period_start: '',
    service_period_end: '',
    gross_amount: 0,
    billing_request_id: '',
    bank_code: '',
    bank_account: '',
  });

  // 稅務計算結果
  const [taxCalc, setTaxCalc] = useState({
    gross_amount: 0,
    withholding_tax: 0,
    nhi_premium: 0,
    net_amount: 0,
  });

  // 載入資料
  useEffect(() => {
    if (!company?.id) return;

    // 載入外包人員
    fetch(`/api/freelancers?company_id=${company.id}`)
      .then(res => res.json())
      .then(json => {
        console.log('Loaded freelancers:', json.data);
        if (json.data) setFreelancers(json.data);
      })
      .catch(err => console.error('Error loading freelancers:', err));

    // 載入請款單
    fetch(`/api/billing-requests?company_id=${company.id}&status=pending`)
      .then(res => res.json())
      .then(json => {
        if (json.data) setBillingRequests(json.data);
      })
      .catch(() => { });

    // 載入 LINE 群組
    fetch(`/api/line/groups?company_id=${company.id}`)
      .then(res => res.json())
      .then(json => {
        if (json.data) setLineGroups(json.data.filter((g: LineGroup) => g.is_active));
      })
      .catch(() => { });
  }, [company?.id]);

  // 選擇人員時自動帶入資料
  const handleFreelancerSelect = (freelancerId: string) => {
    if (!freelancerId) {
      // 清空選擇
      setFormData(prev => ({
        ...prev,
        freelancer_id: '',
      }));
      return;
    }

    const freelancer = freelancers.find(f => f.id === freelancerId);
    console.log('Selected freelancer:', freelancer);

    if (freelancer) {
      setFormData(prev => ({
        ...prev,
        freelancer_id: freelancerId,
        staff_name: freelancer.name || '',
        id_number: freelancer.id_number || '',
        is_union_member: freelancer.is_union_member || false,
        bank_code: freelancer.bank_code || '',
        bank_account: freelancer.bank_account || '',
      }));
    }
  };

  // 計算稅務
  useEffect(() => {
    const gross = formData.gross_amount || 0;
    const incomeType = incomeTypes.find(t => t.code === formData.income_type_code);

    let withholding = 0;
    let nhi = 0;

    // 扣繳稅額（9A/9B 先不扣）
    if (incomeType && !['9A', '9B'].includes(formData.income_type_code)) {
      withholding = Math.round(gross * incomeType.taxRate);
    }

    // 二代健保（工會成員免扣）
    if (!formData.is_union_member && gross >= NHI_THRESHOLD) {
      nhi = Math.round(gross * NHI_RATE);
    }

    setTaxCalc({
      gross_amount: gross,
      withholding_tax: withholding,
      nhi_premium: nhi,
      net_amount: gross - withholding - nhi,
    });
  }, [formData.gross_amount, formData.income_type_code, formData.is_union_member]);

  // 建立勞報單
  const handleSubmit = async (sendLine: boolean = false) => {
    if (!company?.id) return;

    if (!formData.staff_name) {
      alert('請填寫人員姓名');
      return;
    }

    if (!formData.gross_amount || formData.gross_amount <= 0) {
      alert('請填寫應稅所得金額');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/labor-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          ...formData,
          ...taxCalc,
          total_income: formData.gross_amount,
          created_by: user?.id,
          send_sign_request: sendLine,
        }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        const report = json.data;
        const url = `${window.location.origin}/sign/${report.sign_token}`;
        setSignUrl(url);

        const msg = `${formData.staff_name} 您好，

智慧媽咪國際有限公司 勞報單已建立，請點擊以下連結完成簽署：

${url}

金額明細：
應稅所得：NT$ ${taxCalc.gross_amount.toLocaleString()}
扣繳稅額：NT$ ${taxCalc.withholding_tax.toLocaleString()}
二代健保：NT$ ${taxCalc.nhi_premium.toLocaleString()}
實付金額：NT$ ${taxCalc.net_amount.toLocaleString()}`;

        setCustomMessage(msg);

        if (sendLine) {
          setShowSendModal(true);
        } else {
          alert('勞報單已建立！');
          router.push('/dashboard/labor');
        }
      } else {
        alert(json.error || '建立失敗');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('建立失敗');
    } finally {
      setSaving(false);
    }
  };

  // 發送 LINE
  const handleSendLine = async () => {
    if (!selectedLineGroup) {
      alert('請選擇發送群組');
      return;
    }

    try {
      const res = await fetch('/api/line/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company?.id,
          recipient_type: 'group',
          recipient_id: selectedLineGroup,
          content: customMessage,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert('已發送 LINE 通知！');
        router.push('/dashboard/labor');
      } else {
        alert(json.error || '發送失敗');
      }
    } catch (error) {
      alert('發送失敗');
    }
  };

  const copySignUrl = () => {
    navigator.clipboard.writeText(signUrl);
    alert('連結已複製！');
  };

  const formatAmount = (n: number) => `NT$ ${n.toLocaleString()}`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/labor" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">新增勞報單</h1>
          <p className="text-gray-500 mt-1">建立勞報單並發送簽署連結</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 主表單 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 人員資訊 */}
          <div className="brand-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-brand-primary-600" />
              人員資訊
            </h2>

            {/* 人員類型 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">人員類型</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, staff_type: 'external' }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${formData.staff_type === 'external'
                      ? 'border-brand-primary-500 bg-brand-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <div className="font-medium text-gray-900">外部人員</div>
                  <div className="text-sm text-gray-500 mt-1">計入專案成本，可關聯請款單</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, staff_type: 'internal' }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${formData.staff_type === 'internal'
                      ? 'border-brand-primary-500 bg-brand-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <div className="font-medium text-gray-900">內部人員</div>
                  <div className="text-sm text-gray-500 mt-1">不計入專案成本</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* 選擇人員 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">選擇人員</label>
                <select
                  value={formData.freelancer_id}
                  onChange={(e) => handleFreelancerSelect(e.target.value)}
                  className="input-field"
                >
                  <option value="">-- 選擇或手動輸入 --</option>
                  {freelancers.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.is_union_member ? '(工會)' : ''} {f.id_number ? `- ${f.id_number.slice(0, 4)}****` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 姓名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.staff_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, staff_name: e.target.value }))}
                  className="input-field"
                  placeholder="請輸入姓名"
                />
              </div>

              {/* 身分證 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">身分證字號</label>
                <input
                  type="text"
                  value={formData.id_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, id_number: e.target.value.toUpperCase() }))}
                  className="input-field"
                  placeholder="A123456789"
                  maxLength={10}
                />
              </div>

              {/* 工會成員 */}
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_union_member}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_union_member: e.target.checked }))}
                    className="w-4 h-4 text-brand-primary-600 rounded"
                  />
                  <span className="text-sm text-gray-700">工會成員（免扣二代健保）</span>
                </label>
              </div>
            </div>

            {/* 銀行資訊 - 顯示帶入的資料 */}
            {(formData.bank_code || formData.bank_account) && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">銀行帳戶：</span>
                  {formData.bank_code} - {formData.bank_account}
                </p>
              </div>
            )}
          </div>

          {/* 所得資訊 */}
          <div className="brand-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-brand-primary-600" />
              所得資訊
            </h2>

            <div className="grid grid-cols-2 gap-4">
              {/* 所得類別 */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">所得類別</label>
                <div className="grid grid-cols-2 gap-2">
                  {incomeTypes.map(type => (
                    <button
                      key={type.code}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, income_type_code: type.code }))}
                      className={`p-3 rounded-lg border text-left transition-all ${formData.income_type_code === type.code
                          ? 'border-brand-primary-500 bg-brand-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="font-medium text-sm">{type.code} - {type.name}</div>
                      <div className="text-xs text-gray-500">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 服務內容 */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">服務內容</label>
                <input
                  type="text"
                  value={formData.work_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, work_description: e.target.value }))}
                  className="input-field"
                  placeholder="例：網站設計、影片剪輯"
                />
              </div>

              {/* 服務期間 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">服務起始日</label>
                <input
                  type="date"
                  value={formData.service_period_start}
                  onChange={(e) => setFormData(prev => ({ ...prev, service_period_start: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">服務結束日</label>
                <input
                  type="date"
                  value={formData.service_period_end}
                  onChange={(e) => setFormData(prev => ({ ...prev, service_period_end: e.target.value }))}
                  className="input-field"
                />
              </div>

              {/* 應稅所得 */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  應稅所得 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.gross_amount || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, gross_amount: parseInt(e.target.value) || 0 }))}
                  className="input-field text-lg font-semibold"
                  placeholder="0"
                />
              </div>

              {/* 關聯請款單 */}
              {formData.staff_type === 'external' && billingRequests.length > 0 && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">關聯請款單（選填）</label>
                  <select
                    value={formData.billing_request_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, billing_request_id: e.target.value }))}
                    className="input-field"
                  >
                    <option value="">-- 不關聯 --</option>
                    {billingRequests.map(br => (
                      <option key={br.id} value={br.id}>
                        {br.billing_number} - {br.customer_name} (${br.amount.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 側邊計算結果 */}
        <div className="space-y-6">
          <div className="brand-card p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-primary-600" />
              稅務試算
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">應稅所得</span>
                <span className="font-semibold">{formatAmount(taxCalc.gross_amount)}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">扣繳稅額 (10%)</span>
                <span className="text-red-600">- {formatAmount(taxCalc.withholding_tax)}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">
                  二代健保 (2.11%)
                  {formData.is_union_member && <span className="text-green-600 ml-1">免扣</span>}
                </span>
                <span className="text-orange-600">- {formatAmount(taxCalc.nhi_premium)}</span>
              </div>
              <div className="flex justify-between py-3 bg-brand-primary-50 rounded-lg px-3 -mx-3">
                <span className="font-semibold text-brand-primary-800">實付金額</span>
                <span className="text-xl font-bold text-brand-primary-700">{formatAmount(taxCalc.net_amount)}</span>
              </div>
            </div>

            {formData.is_union_member && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                  <p className="text-sm text-green-800 font-medium">工會成員免扣二代健保</p>
                </div>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <button
                onClick={() => handleSubmit(true)}
                disabled={saving}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                建立並發送 LINE
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={saving}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                稍後發送（僅儲存）
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 發送 LINE Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Eye className="w-5 h-5" />
                發送預覽
              </h3>
              <button onClick={() => setShowSendModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">簽署連結</label>
                <div className="flex gap-2">
                  <input type="text" value={signUrl} readOnly className="input-field flex-1 bg-gray-50 text-sm" />
                  <button onClick={copySignUrl} className="btn-secondary px-3">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">發送群組（LINE）</label>
                <select
                  value={selectedLineGroup}
                  onChange={(e) => setSelectedLineGroup(e.target.value)}
                  className="input-field"
                >
                  <option value="">-- 選擇群組 --</option>
                  {lineGroups.map(g => (
                    <option key={g.id} value={g.group_id}>{g.group_name}</option>
                  ))}
                </select>
                {lineGroups.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">尚無 LINE 群組，可直接複製連結手動發送</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">訊息內容（可編輯）</label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={10}
                  className="input-field text-sm"
                />
              </div>
            </div>

            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => {
                  setShowSendModal(false);
                  router.push('/dashboard/labor');
                }}
                className="btn-secondary flex-1"
              >
                稍後發送（僅儲存）
              </button>
              <button
                onClick={handleSendLine}
                disabled={!selectedLineGroup}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                發送 LINE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
