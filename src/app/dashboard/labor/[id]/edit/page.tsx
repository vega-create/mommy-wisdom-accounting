'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import {
  ArrowLeft,
  Save,
  Send,
  Calculator,
  User,
  FileText,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// 所得類型配置（2025年）
const incomeTypes = [
  { code: '50', name: '執行業務所得', taxRate: 0.10, description: '扣繳 10%' },
  { code: '9A', name: '稿費所得', taxRate: 0.10, description: '全年 18 萬內免稅' },
  { code: '9B', name: '講演鐘點費', taxRate: 0.10, description: '全年 18 萬內免稅' },
  { code: '92', name: '競技競賽獎金', taxRate: 0.10, description: '扣繳 10%' },
];

const NHI_RATE = 0.0211;
const NHI_THRESHOLD = 20010;

export default function EditLaborReportPage() {
  const params = useParams();
  const router = useRouter();
  const { company } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    staff_name: '',
    id_number: '',
    is_union_member: false,
    income_type_code: '50',
    work_description: '',
    service_period_start: '',
    service_period_end: '',
    gross_amount: 0,
    withholding_tax: 0,
    nhi_premium: 0,
    net_amount: 0,
    bank_code: '',
    bank_account: '',
    status: 'draft',
  });

  // 載入資料
  useEffect(() => {
    const loadReport = async () => {
      try {
        const res = await fetch(`/api/labor-reports/${params.id}`);
        const json = await res.json();
        
        if (json.data) {
          setFormData({
            staff_name: json.data.staff_name || '',
            id_number: json.data.id_number || '',
            is_union_member: json.data.is_union_member || false,
            income_type_code: json.data.income_type_code || '50',
            work_description: json.data.work_description || '',
            service_period_start: json.data.service_period_start || '',
            service_period_end: json.data.service_period_end || '',
            gross_amount: json.data.gross_amount || 0,
            withholding_tax: json.data.withholding_tax || 0,
            nhi_premium: json.data.nhi_premium || 0,
            net_amount: json.data.net_amount || 0,
            bank_code: json.data.bank_code || '',
            bank_account: json.data.bank_account || '',
            status: json.data.status || 'draft',
          });
        } else {
          setError('找不到勞報單');
        }
      } catch (err) {
        setError('載入失敗');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) loadReport();
  }, [params.id]);

  // 計算稅務
  const calculateTax = (grossAmount: number, incomeTypeCode: string, isUnionMember: boolean) => {
    let withholdingTax = 0;
    let nhiPremium = 0;

    if (!['9A', '9B'].includes(incomeTypeCode)) {
      withholdingTax = Math.round(grossAmount * 0.10);
    }

    if (!isUnionMember && grossAmount >= NHI_THRESHOLD) {
      nhiPremium = Math.round(grossAmount * NHI_RATE);
    }

    return {
      withholding_tax: withholdingTax,
      nhi_premium: nhiPremium,
      net_amount: grossAmount - withholdingTax - nhiPremium,
    };
  };

  // 金額變更時重新計算
  useEffect(() => {
    if (formData.gross_amount > 0) {
      const calc = calculateTax(formData.gross_amount, formData.income_type_code, formData.is_union_member);
      setFormData(prev => ({ ...prev, ...calc }));
    }
  }, [formData.gross_amount, formData.income_type_code, formData.is_union_member]);

  // 儲存
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/labor-reports/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (json.success) {
        alert('儲存成功');
        router.push('/dashboard/labor');
      } else {
        alert(json.error || '儲存失敗');
      }
    } catch (err) {
      alert('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const formatAmount = (amount: number) => new Intl.NumberFormat('zh-TW').format(amount);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="brand-card p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">{error}</p>
        <Link href="/dashboard/labor" className="btn-primary mt-4 inline-block">返回列表</Link>
      </div>
    );
  }

  if (!['draft', 'pending'].includes(formData.status)) {
    return (
      <div className="brand-card p-8 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600">此勞報單狀態無法編輯</p>
        <Link href="/dashboard/labor" className="btn-primary mt-4 inline-block">返回列表</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/labor" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">編輯勞報單</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* 人員資訊 */}
          <div className="brand-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-brand-primary-700" />
              人員資訊
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="input-label">姓名 *</label>
                <input type="text" value={formData.staff_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, staff_name: e.target.value }))}
                  className="input-field" />
              </div>
              <div>
                <label className="input-label">身分證字號</label>
                <input type="text" value={formData.id_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, id_number: e.target.value.toUpperCase() }))}
                  className="input-field" maxLength={10} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_union_member" checked={formData.is_union_member}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_union_member: e.target.checked }))}
                  className="w-4 h-4 text-brand-primary-600 rounded" />
                <label htmlFor="is_union_member" className="text-sm text-gray-700">工會成員</label>
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
                <label className="input-label">所得類別</label>
                <select value={formData.income_type_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, income_type_code: e.target.value }))}
                  className="input-field">
                  {incomeTypes.map(t => (
                    <option key={t.code} value={t.code}>{t.code} - {t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">工作內容說明</label>
                <textarea value={formData.work_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, work_description: e.target.value }))}
                  className="input-field" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                    className="input-field pl-14 text-right text-lg font-semibold" />
                </div>
              </div>
            </div>
          </div>

          {/* 匯款帳戶 */}
          <div className="brand-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">匯款帳戶</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">銀行代碼</label>
                <input type="text" value={formData.bank_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank_code: e.target.value }))}
                  className="input-field" maxLength={3} />
              </div>
              <div>
                <label className="input-label">銀行帳號</label>
                <input type="text" value={formData.bank_account}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank_account: e.target.value }))}
                  className="input-field" />
              </div>
            </div>
          </div>
        </div>

        {/* 右側計算 */}
        <div className="lg:col-span-1">
          <div className="brand-card p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-brand-primary-700" />
              稅務計算
            </h2>

            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">應稅所得</span>
                <span className="font-semibold">${formatAmount(formData.gross_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">扣繳稅額</span>
                <span className="text-red-600">-${formatAmount(formData.withholding_tax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">二代健保</span>
                <span className="text-orange-600">-${formatAmount(formData.nhi_premium)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t-2 border-brand-primary-200">
                <span className="font-semibold">實付金額</span>
                <span className="text-2xl font-bold text-brand-primary-700">${formatAmount(formData.net_amount)}</span>
              </div>
            </div>

            <button onClick={handleSave} disabled={saving}
              className="btn-primary w-full mt-6 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              儲存變更
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
