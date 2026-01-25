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
  Building2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Info,
  Copy,
  MessageSquare,
  Eye,
  X,
  Loader2,
} from 'lucide-react';

// 所得類型配置（2025年）
const incomeTypes = [
  { code: '50', name: '執行業務所得', taxRate: 0.10, description: '扣繳 10%', examples: '設計、顧問、接案等' },
  { code: '9A', name: '稿費所得', taxRate: 0.10, description: '全年 18 萬內免稅', examples: '撰稿、翻譯等' },
  { code: '9B', name: '講演鐘點費', taxRate: 0.10, description: '全年 18 萬內免稅', examples: '演講、授課等' },
  { code: '92', name: '競技競賽獎金', taxRate: 0.10, description: '扣繳 10%', examples: '比賽獎金' },
];

// 2025 稅務計算
const NHI_RATE = 0.0211;
const NHI_THRESHOLD = 20010;

interface Freelancer {
  id: string;
  name: string;
  id_number: string;
  is_union_member: boolean;
  bank_code: string;
  bank_account: string;
  line_user_id?: string;
}

interface BillingRequest {
  id: string;
  billing_number: string;
  customer_name?: string;
  amount: number;
}

interface LineTarget {
  type: 'user' | 'group';
  id: string;
  name: string;
}

export default function NewLaborReportPage() {
  const router = useRouter();
  const { company, user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 資料來源
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [billingRequests, setBillingRequests] = useState<BillingRequest[]>([]);

  // LINE 發送設定
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedLineTarget, setSelectedLineTarget] = useState<string>('');
  const [signUrl, setSignUrl] = useState<string>('');
  const [customMessage, setCustomMessage] = useState('');

  // 從 freelancers 中有 LINE ID 的人員
  const lineTargets = freelancers.filter(f => f.line_user_id).map(f => ({
    id: f.line_user_id!,
    name: f.name,
    type: 'user' as const,
  }));

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

  // 載入人員與請款單資料
  useEffect(() => {
    if (!company?.id) return;

    // 載入外包人員
    fetch(`/api/freelancers?company_id=${company.id}`)
      .then(res => res.json())
      .then(json => {
        if (json.data) setFreelancers(json.data);
      });

    // 載入請款單（待請款狀態）
    fetch(`/api/billing-requests?company_id=${company.id}&status=pending`)
      .then(res => res.json())
      .then(json => {
        if (json.data) setBillingRequests(json.data);
      })
      .catch(() => {}); // 可能還沒有這個 API
  }, [company?.id]);

  // 選擇人員時自動帶入資料
  const handleFreelancerSelect = (freelancerId: string) => {
    const freelancer = freelancers.find(f => f.id === freelancerId);
    if (freelancer) {
      setFormData(prev => ({
        ...prev,
        freelancer_id: freelancerId,
        staff_name: freelancer.name,
        id_number: freelancer.id_number || '',
        is_union_member: freelancer.is_union_member,
        bank_code: freelancer.bank_code || '',
        bank_account: freelancer.bank_account || '',
      }));
      // 如果有 LINE ID，預設選擇
      if (freelancer.line_user_id) {
        setSelectedLineTarget(freelancer.line_user_id);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        freelancer_id: '',
      }));
    }
  };

  // 計算稅務
  const calculateTax = (grossAmount: number, incomeTypeCode: string, isUnionMember: boolean) => {
    let withholdingTax = 0;
    let nhiPremium = 0;

    const incomeType = incomeTypes.find(t => t.code === incomeTypeCode);
    if (incomeType) {
      if (!['9A', '9B'].includes(incomeTypeCode)) {
        withholdingTax = Math.round(grossAmount * incomeType.taxRate);
      }
    }

    if (!isUnionMember && grossAmount >= NHI_THRESHOLD) {
      nhiPremium = Math.round(grossAmount * NHI_RATE);
    }

    const netAmount = grossAmount - withholdingTax - nhiPremium;

    return { gross_amount: grossAmount, withholding_tax: withholdingTax, nhi_premium: nhiPremium, net_amount: netAmount };
  };

  // 金額變更時重新計算
  useEffect(() => {
    if (formData.gross_amount > 0) {
      const calc = calculateTax(formData.gross_amount, formData.income_type_code, formData.is_union_member);
      setTaxCalc(calc);
    } else {
      setTaxCalc({ gross_amount: 0, withholding_tax: 0, nhi_premium: 0, net_amount: 0 });
    }
  }, [formData.gross_amount, formData.income_type_code, formData.is_union_member]);

  // 格式化金額
  const formatAmount = (amount: number) => new Intl.NumberFormat('zh-TW').format(amount);

  // 產生預設訊息
  const getDefaultMessage = () => {
    return `${formData.staff_name} 您好，

${company?.name || '公司'} 勞報單已建立，請點擊以下連結完成簽署：

[簽署連結]

金額明細：
應稅所得：NT$ ${formatAmount(taxCalc.gross_amount)}
扣繳稅額：NT$ ${formatAmount(taxCalc.withholding_tax)}
二代健保：NT$ ${formatAmount(taxCalc.nhi_premium)}
實付金額：NT$ ${formatAmount(taxCalc.net_amount)}

請於收到後 7 日內完成簽署，謝謝！`;
  };

  // 儲存草稿
  const handleSaveDraft = async () => {
    if (!company?.id || !formData.staff_name || !formData.gross_amount) {
      alert('請填寫人員姓名和金額');
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
          created_by: user?.id,
          send_sign_request: false,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert('草稿已儲存');
        router.push('/dashboard/labor');
      } else {
        alert(json.error || '儲存失敗');
      }
    } catch (error) {
      alert('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  // 開啟發送預覽
  const handleOpenSendModal = async () => {
    if (!company?.id || !formData.staff_name || !formData.gross_amount) {
      alert('請填寫人員姓名和金額');
      return;
    }

    // 先建立勞報單取得簽署連結
    setLoading(true);
    try {
      const res = await fetch('/api/labor-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          ...formData,
          ...taxCalc,
          created_by: user?.id,
          send_sign_request: false, // 先不發送
        }),
      });

      const json = await res.json();
      if (json.success && json.sign_url) {
        setSignUrl(json.sign_url);
        setCustomMessage(getDefaultMessage().replace('[簽署連結]', json.sign_url));
        setShowSendModal(true);
      } else {
        alert(json.error || '建立失敗');
      }
    } catch (error) {
      alert('建立失敗');
    } finally {
      setLoading(false);
    }
  };

  // 發送 LINE 通知
  const handleSendLine = async () => {
    if (!selectedLineTarget) {
      alert('請選擇發送對象');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/line/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company?.id,
          to: selectedLineTarget,
          message: customMessage,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert('LINE 通知已發送！');
        router.push('/dashboard/labor');
      } else {
        alert(json.error || '發送失敗');
      }
    } catch (error) {
      alert('發送失敗');
    } finally {
      setLoading(false);
    }
  };

  // 複製連結
  const copySignUrl = () => {
    navigator.clipboard.writeText(signUrl);
    alert('簽署連結已複製！');
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
            <h1 className="text-2xl font-bold text-gray-900">新增勞報單</h1>
            <p className="text-sm text-gray-500 mt-1">建立勞報單並發送簽署連結</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 主表單 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 人員類型選擇 */}
          <div className="brand-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-brand-primary-700" />
              人員資訊
            </h2>

            {/* 人員類型 */}
            <div className="mb-6">
              <label className="input-label">人員類型</label>
              <div className="flex gap-4 mt-2">
                <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  formData.staff_type === 'external' ? 'border-brand-primary-500 bg-brand-primary-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input type="radio" name="staff_type" value="external" checked={formData.staff_type === 'external'}
                    onChange={() => setFormData(prev => ({ ...prev, staff_type: 'external' }))} className="sr-only" />
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.staff_type === 'external' ? 'border-brand-primary-600' : 'border-gray-300'}`}>
                    {formData.staff_type === 'external' && <div className="w-2.5 h-2.5 rounded-full bg-brand-primary-600" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">外部人員</p>
                    <p className="text-sm text-gray-500">計入專案成本，可關聯請款單</p>
                  </div>
                </label>

                <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  formData.staff_type === 'internal' ? 'border-brand-primary-500 bg-brand-primary-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input type="radio" name="staff_type" value="internal" checked={formData.staff_type === 'internal'}
                    onChange={() => setFormData(prev => ({ ...prev, staff_type: 'internal' }))} className="sr-only" />
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.staff_type === 'internal' ? 'border-brand-primary-600' : 'border-gray-300'}`}>
                    {formData.staff_type === 'internal' && <div className="w-2.5 h-2.5 rounded-full bg-brand-primary-600" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">內部人員</p>
                    <p className="text-sm text-gray-500">不計入專案成本</p>
                  </div>
                </label>
              </div>
            </div>

            {/* 選擇或輸入人員 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="input-label">選擇人員</label>
                <select value={formData.freelancer_id} onChange={(e) => handleFreelancerSelect(e.target.value)} className="input-field">
                  <option value="">-- 選擇或手動輸入 --</option>
                  {freelancers.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.is_union_member && '(工會)'}
                    </option>
                  ))}
                </select>
                {freelancers.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    <Link href="/dashboard/labor/freelancers" className="text-brand-primary-600 hover:underline">
                      點此新增人員
                    </Link>
                  </p>
                )}
              </div>

              <div>
                <label className="input-label">姓名 *</label>
                <input type="text" value={formData.staff_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, staff_name: e.target.value }))}
                  className="input-field" placeholder="請輸入姓名" />
              </div>

              <div>
                <label className="input-label">身分證字號</label>
                <input type="text" value={formData.id_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, id_number: e.target.value.toUpperCase() }))}
                  className="input-field" placeholder="A123456789" maxLength={10} />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="is_union_member" checked={formData.is_union_member}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_union_member: e.target.checked }))}
                  className="w-4 h-4 text-brand-primary-600 rounded" />
                <label htmlFor="is_union_member" className="text-sm text-gray-700">
                  工會成員（免扣二代健保）
                </label>
              </div>
            </div>
          </div>

          {/* 服務內容 */}
          <div className="brand-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-primary-700" />
              服務內容
            </h2>

            <div className="space-y-4">
              <div>
                <label className="input-label">所得類別 *</label>
                <select value={formData.income_type_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, income_type_code: e.target.value }))}
                  className="input-field">
                  {incomeTypes.map(type => (
                    <option key={type.code} value={type.code}>
                      {type.code} - {type.name}（{type.description}）
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {incomeTypes.find(t => t.code === formData.income_type_code)?.examples}
                </p>
              </div>

              <div>
                <label className="input-label">工作內容說明</label>
                <textarea value={formData.work_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, work_description: e.target.value }))}
                  className="input-field" rows={3} placeholder="請描述服務內容..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">服務期間起</label>
                  <input type="date" value={formData.service_period_start}
                    onChange={(e) => setFormData(prev => ({ ...prev, service_period_start: e.target.value }))}
                    className="input-field" />
                </div>
                <div>
                  <label className="input-label">服務期間迄</label>
                  <input type="date" value={formData.service_period_end}
                    onChange={(e) => setFormData(prev => ({ ...prev, service_period_end: e.target.value }))}
                    className="input-field" />
                </div>
              </div>

              <div>
                <label className="input-label">應稅所得金額 *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">NT$</span>
                  <input type="number" value={formData.gross_amount || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, gross_amount: parseInt(e.target.value) || 0 }))}
                    className="input-field pl-14 text-right text-lg font-semibold" placeholder="0" />
                </div>
              </div>
            </div>
          </div>

          {/* 關聯請款單（僅外部人員顯示） */}
          {formData.staff_type === 'external' && billingRequests.length > 0 && (
            <div className="brand-card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-primary-700" />
                關聯請款單（計算毛利）
              </h2>
              <select value={formData.billing_request_id}
                onChange={(e) => setFormData(prev => ({ ...prev, billing_request_id: e.target.value }))}
                className="input-field">
                <option value="">-- 不關聯 --</option>
                {billingRequests.map(br => (
                  <option key={br.id} value={br.id}>
                    {br.billing_number} - {br.customer_name} (${formatAmount(br.amount)})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">關聯請款單後，勞報金額將計入該專案成本</p>
            </div>
          )}

          {/* 匯款帳戶 */}
          <div className="brand-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-brand-primary-700" />
              匯款帳戶
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="input-label">銀行代碼</label>
                <input type="text" value={formData.bank_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank_code: e.target.value }))}
                  className="input-field" placeholder="004" maxLength={3} />
              </div>
              <div>
                <label className="input-label">銀行帳號</label>
                <input type="text" value={formData.bank_account}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank_account: e.target.value }))}
                  className="input-field" placeholder="12345678901234" />
              </div>
            </div>
          </div>
        </div>

        {/* 右側計算預覽 */}
        <div className="lg:col-span-1">
          <div className="brand-card p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-brand-primary-700" />
              稅務計算
            </h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <span className="text-gray-600">應稅所得</span>
                <span className="text-lg font-semibold text-gray-900">${formatAmount(taxCalc.gross_amount)}</span>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <span className="text-gray-600">扣繳稅額</span>
                  <p className="text-xs text-gray-400">{incomeTypes.find(t => t.code === formData.income_type_code)?.description}</p>
                </div>
                <span className="text-red-600 font-medium">-${formatAmount(taxCalc.withholding_tax)}</span>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <span className="text-gray-600">二代健保</span>
                  <p className="text-xs text-gray-400">{formData.is_union_member ? '工會成員免扣' : `2.11% (起扣點 $${formatAmount(NHI_THRESHOLD)})`}</p>
                </div>
                <span className={`font-medium ${formData.is_union_member ? 'text-green-600' : 'text-orange-600'}`}>
                  {formData.is_union_member ? '免扣' : `-$${formatAmount(taxCalc.nhi_premium)}`}
                </span>
              </div>

              <div className="flex justify-between items-center pt-3 border-t-2 border-brand-primary-200">
                <span className="font-semibold text-gray-900">實付金額</span>
                <span className="text-2xl font-bold text-brand-primary-700">${formatAmount(taxCalc.net_amount)}</span>
              </div>
            </div>

            {/* 提示 */}
            {formData.gross_amount > 0 && formData.gross_amount < NHI_THRESHOLD && !formData.is_union_member && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-green-700">金額未達二代健保起扣點，免扣補充保費</p>
                </div>
              </div>
            )}

            {/* 動作按鈕 */}
            <div className="mt-6 space-y-3">
              <button onClick={handleOpenSendModal}
                disabled={loading || saving || !formData.staff_name || !formData.gross_amount}
                className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                建立並發送簽署連結
              </button>

              <button onClick={handleSaveDraft} disabled={loading || saving}
                className="btn-secondary w-full flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                儲存草稿
              </button>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600">發送簽署連結後，對方可透過連結填寫資料並簽名。</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 發送預覽 Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Eye className="w-5 h-5" />
                發送預覽
              </h3>
              <button onClick={() => setShowSendModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 簽署連結 */}
            <div className="mb-4">
              <label className="input-label">簽署連結</label>
              <div className="flex gap-2">
                <input type="text" value={signUrl} readOnly className="input-field flex-1 text-sm" />
                <button onClick={copySignUrl} className="btn-secondary px-3">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 發送對象 */}
            <div className="mb-4">
              <label className="input-label">發送對象（LINE）</label>
              <select value={selectedLineTarget} onChange={(e) => setSelectedLineTarget(e.target.value)} className="input-field">
                <option value="">-- 選擇發送對象 --</option>
                {lineTargets.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.type === 'group' ? '👥 ' : '👤 '}{t.name}
                  </option>
                ))}
              </select>
              {lineTargets.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">尚無 LINE 聯絡人，可直接複製連結手動發送</p>
              )}
            </div>

            {/* 訊息內容 */}
            <div className="mb-4">
              <label className="input-label">訊息內容（可編輯）</label>
              <textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)}
                className="input-field font-mono text-sm" rows={10} />
            </div>

            {/* 按鈕 */}
            <div className="flex gap-3">
              <button onClick={() => { setShowSendModal(false); router.push('/dashboard/labor'); }}
                className="btn-secondary flex-1">
                稍後發送（僅儲存）
              </button>
              <button onClick={handleSendLine} disabled={loading || !selectedLineTarget}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                發送 LINE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
