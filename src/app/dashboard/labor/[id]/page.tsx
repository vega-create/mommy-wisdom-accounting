'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import {
  ArrowLeft,
  Copy,
  Send,
  Banknote,
  CheckCircle2,
  Clock,
  FileText,
  User,
  Calendar,
  Building2,
  AlertCircle,
  Download,
  MessageSquare,
  ExternalLink,
  RefreshCw,
  Edit2,
} from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-700', icon: Clock },
  pending: { label: '待簽名', color: 'bg-yellow-100 text-yellow-700', icon: Send },
  signed: { label: '已簽名', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  paid: { label: '已付款', color: 'bg-green-100 text-green-700', icon: Banknote },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

const incomeTypeNames: Record<string, string> = {
  '50': '執行業務所得',
  '9A': '稿費/講演鐘點費',
  '9B': '稿費/講演鐘點費',
};

export default function LaborReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { company } = useAuthStore();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchReport();
    }
  }, [params.id]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/labor-reports/${params.id}`);
      const result = await res.json();
      if (result.data) {
        setReport(result.data);
      } else {
        setError(result.error || '找不到勞報單');
      }
    } catch (err) {
      setError('載入失敗');
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('zh-TW').format(amount);
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-TW');
  };

  const copySignUrl = () => {
    if (report?.sign_url) {
      navigator.clipboard.writeText(report.sign_url);
      alert('簽署連結已複製！');
    }
  };

  const handleConfirmPayment = async () => {
    if (!report) return;
    setIsPaying(true);
    try {
      const res = await fetch(`/api/labor-reports/${report.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_reference: paymentReference,
          paid_by: null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setShowPaymentModal(false);
        alert('付款已確認，會計傳票已自動產生！');
        fetchReport(); // 重新載入
      } else {
        alert(result.error || '付款失敗');
      }
    } catch (err) {
      alert('付款失敗');
    } finally {
      setIsPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
        <p className="text-red-600">{error || '找不到勞報單'}</p>
        <button onClick={() => router.push('/dashboard/labor')} className="mt-4 btn-secondary">
          返回列表
        </button>
      </div>
    );
  }

  const status = statusConfig[report.status] || statusConfig.draft;
  const StatusIcon = status.icon;

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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{report.report_number}</h1>
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                <StatusIcon className="w-4 h-4" />
                {status.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              建立於 {formatDateTime(report.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {report.status === 'pending' && (
            <>
              <button onClick={copySignUrl} className="btn-secondary flex items-center gap-2">
                <Copy className="w-4 h-4" />
                複製連結
              </button>
            </>
          )}

          {report.status === 'signed' && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Banknote className="w-4 h-4" />
              確認付款
            </button>
          )}

          {(report.status === 'draft' || report.status === 'pending') && (
            <Link
              href={`/dashboard/labor/${report.id}/edit`}
              className="btn-secondary flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              編輯
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 主要資訊 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 人員資訊 */}
          <div className="brand-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-brand-primary-700" />
              人員資訊
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">姓名</p>
                <p className="font-medium text-gray-900">{report.staff_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">身分證字號</p>
                <p className="font-medium text-gray-900">{report.id_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">人員類型</p>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  report.staff_type === 'external' 
                    ? 'bg-brand-primary-100 text-brand-primary-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {report.staff_type === 'external' ? '外部人員' : '內部人員'}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">工會成員</p>
                <p className="font-medium text-gray-900">
                  {report.is_union_member ? (
                    <span className="text-green-600">是（免扣二代健保）</span>
                  ) : (
                    <span>否</span>
                  )}
                </p>
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">所得類別</p>
                  <p className="font-medium text-gray-900">
                    {report.income_type_code} - {incomeTypeNames[report.income_type_code] || '其他'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">服務期間</p>
                  <p className="font-medium text-gray-900">
                    {report.service_period_start} ~ {report.service_period_end}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">發放公司</p>
                  <p className="font-medium text-gray-900">{company?.name || '-'}</p>
                </div>
              </div>

              {report.work_description && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">工作內容說明</p>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{report.work_description}</p>
                </div>
              )}
            </div>
          </div>

          {/* 關聯請款單 */}
          {report.billing_request_id && (
            <div className="brand-card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-primary-700" />
                關聯請款單
              </h2>

              <div className="flex items-center justify-between p-4 bg-brand-primary-50 rounded-lg">
                <div>
                  <p className="font-medium text-brand-primary-700">{report.billing_request_id}</p>
                </div>
                <Link
                  href={`/dashboard/billing/${report.billing_request_id}`}
                  className="btn-secondary text-sm flex items-center gap-1"
                >
                  查看
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                此勞報金額將計入該專案成本，用於計算毛利
              </p>
            </div>
          )}

          {/* 簽署資訊 */}
          {(report.status === 'signed' || report.status === 'paid') && report.signed_at && (
            <div className="brand-card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                簽署資訊
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">簽署時間</p>
                    <p className="font-medium text-gray-900">{formatDateTime(report.signed_at)}</p>
                  </div>
                  {report.signed_ip && (
                    <div>
                      <p className="text-sm text-gray-500">簽署 IP</p>
                      <p className="font-medium text-gray-900">{report.signed_ip}</p>
                    </div>
                  )}
                </div>
                {report.signature_image && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">簽名圖檔</p>
                    <div className="border rounded-lg p-4 bg-white">
                      <img
                        src={report.signature_image}
                        alt="簽名"
                        className="max-h-24 mx-auto"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 付款資訊 */}
          {report.status === 'paid' && report.paid_at && (
            <div className="brand-card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-green-600" />
                付款資訊
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">付款時間</p>
                  <p className="font-medium text-gray-900">{formatDateTime(report.paid_at)}</p>
                </div>
                {report.payment_reference && (
                  <div>
                    <p className="text-sm text-gray-500">匯款備註</p>
                    <p className="font-medium text-gray-900">{report.payment_reference}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右側金額摘要 */}
        <div className="lg:col-span-1">
          <div className="brand-card p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">金額明細</h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <span className="text-gray-600">應稅所得</span>
                <span className="text-lg font-semibold text-gray-900">
                  ${formatAmount(report.gross_amount)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <span className="text-gray-600">扣繳稅額</span>
                  <p className="text-xs text-gray-400">10%</p>
                </div>
                <span className="text-red-600 font-medium">
                  -${formatAmount(report.withholding_tax || 0)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <span className="text-gray-600">二代健保</span>
                  <p className="text-xs text-gray-400">
                    {report.is_union_member ? '工會成員免扣' : '2.11%'}
                  </p>
                </div>
                <span className={`font-medium ${report.is_union_member ? 'text-green-600' : 'text-orange-600'}`}>
                  {report.is_union_member ? '免扣' : `-$${formatAmount(report.nhi_premium || 0)}`}
                </span>
              </div>

              <div className="flex justify-between items-center pt-3 border-t-2 border-brand-primary-200">
                <span className="font-semibold text-gray-900">實付金額</span>
                <span className="text-2xl font-bold text-brand-primary-700">
                  ${formatAmount(report.net_amount)}
                </span>
              </div>
            </div>

            {/* 匯款資訊 */}
            {(report.bank_code || report.bank_account) && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3">匯款帳戶</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  {report.bank_code && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">銀行</span>
                      <span className="text-gray-900">{report.bank_code}</span>
                    </div>
                  )}
                  {report.bank_account && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">帳號</span>
                      <span className="text-gray-900 font-mono">{report.bank_account}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">戶名</span>
                    <span className="text-gray-900">{report.staff_name}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 簽署連結 */}
            {report.status === 'pending' && report.sign_url && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3">簽署連結</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={report.sign_url}
                    readOnly
                    className="input-field text-xs flex-1"
                  />
                  <button onClick={copySignUrl} className="btn-secondary px-3">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 付款確認 Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">確認付款</h3>
            
            <div className="space-y-4">
              <div className="bg-brand-primary-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-brand-primary-700">實付金額</span>
                  <span className="text-xl font-bold text-brand-primary-700">
                    ${formatAmount(report.net_amount)}
                  </span>
                </div>
              </div>

              <div>
                <label className="input-label">匯款備註（選填）</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="input-field"
                  placeholder="例：1月份勞報"
                />
              </div>

              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-700">
                    確認付款後，系統將自動產生會計傳票
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="btn-secondary flex-1"
              >
                取消
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={isPaying}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {isPaying && <RefreshCw className="w-4 h-4 animate-spin" />}
                確認付款
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
