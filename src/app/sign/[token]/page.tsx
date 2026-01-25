'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import {
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Banknote,
  Eraser,
  Send,
  Loader2,
  Building2,
} from 'lucide-react';

// 模擬資料（實際會從 API 取得）
const mockReportData = {
  report_number: 'LR-2026-0001',
  company_name: '智慧媽咪國際有限公司',
  company_logo: '/logo.png',
  staff_name: '王小明',
  id_number: 'A123456789',
  income_type_code: '50',
  income_type_name: '執行業務所得',
  work_description: '2026年1月份SEO優化服務',
  service_period_start: '2026-01-01',
  service_period_end: '2026-01-31',
  gross_amount: 30000,
  withholding_tax: 3000,
  nhi_premium: 633,
  net_amount: 26367,
  bank_code: '004',
  bank_name: '台灣銀行',
  bank_account: '12345678901234',
  status: 'pending', // pending, signed, cancelled
};

export default function SignPage() {
  const params = useParams();
  const token = params.token as string;
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<typeof mockReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);

  // 簽名相關
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // 表單資料（可能需要填寫或確認）
  const [formData, setFormData] = useState({
    id_number: '',
    bank_code: '',
    bank_account: '',
    agree: false,
  });

  // 載入資料
  useEffect(() => {
    const loadReport = async () => {
      try {
        // TODO: 實際呼叫 API
        await new Promise(resolve => setTimeout(resolve, 1000));
        setReport(mockReportData);
        setFormData(prev => ({
          ...prev,
          id_number: mockReportData.id_number,
          bank_code: mockReportData.bank_code,
          bank_account: mockReportData.bank_account,
        }));
      } catch (err) {
        setError('無法載入勞報單資料，請確認連結是否正確');
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [token]);

  // Canvas 初始化
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 設定畫布大小
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // 設定繪圖樣式
    ctx.strokeStyle = '#1a365d';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 填入白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [report]);

  // 繪圖事件
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // 取得簽名圖片
  const getSignatureImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  };

  // 提交簽署
  const handleSubmit = async () => {
    if (!formData.agree || !hasSignature) return;

    setSubmitting(true);
    try {
      const signatureImage = getSignatureImage();
      
      // TODO: 呼叫 API 提交
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setSigned(true);
    } catch (err) {
      alert('提交失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  // 格式化金額
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('zh-TW').format(amount);
  };

  // 載入中
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand-primary-700 animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  // 錯誤
  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="brand-card p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">無法載入</h1>
          <p className="text-gray-600">{error || '勞報單不存在或已過期'}</p>
        </div>
      </div>
    );
  }

  // 已簽署或已取消
  if (report.status === 'signed' || signed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="brand-card p-8 max-w-md text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">簽署完成！</h1>
          <p className="text-gray-600 mb-6">
            感謝您完成簽署，款項將於審核後匯入您的帳戶。
          </p>
          <div className="bg-green-50 p-4 rounded-lg text-left">
            <p className="text-sm text-green-700">
              <strong>勞報單號：</strong>{report.report_number}
            </p>
            <p className="text-sm text-green-700 mt-1">
              <strong>實付金額：</strong>NT$ {formatAmount(report.net_amount)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (report.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="brand-card p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">此勞報單已取消</h1>
          <p className="text-gray-600">如有疑問，請聯繫發放公司。</p>
        </div>
      </div>
    );
  }

  // 簽署頁面
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-brand-primary-700" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{report.company_name}</p>
              <p className="text-sm text-gray-500">勞報單線上簽署</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 勞報單資訊 */}
        <div className="brand-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-brand-primary-700" />
            <h2 className="font-semibold text-gray-900">勞報單資訊</h2>
            <span className="ml-auto text-sm text-gray-500">{report.report_number}</span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">姓名</span>
              <span className="font-medium text-gray-900">{report.staff_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">所得類別</span>
              <span className="text-gray-900">{report.income_type_code} - {report.income_type_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">工作內容</span>
              <span className="text-gray-900 text-right max-w-[60%]">{report.work_description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">服務期間</span>
              <span className="text-gray-900">{report.service_period_start} ~ {report.service_period_end}</span>
            </div>
          </div>
        </div>

        {/* 金額明細 */}
        <div className="brand-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Banknote className="w-5 h-5 text-brand-primary-700" />
            <h2 className="font-semibold text-gray-900">金額明細</h2>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">應稅所得</span>
              <span className="font-medium text-gray-900">NT$ {formatAmount(report.gross_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">扣繳稅額（10%）</span>
              <span className="text-red-600">-NT$ {formatAmount(report.withholding_tax)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">二代健保（2.11%）</span>
              <span className="text-orange-600">-NT$ {formatAmount(report.nhi_premium)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t-2 border-brand-primary-200">
              <span className="font-semibold text-gray-900">實付金額</span>
              <span className="text-xl font-bold text-brand-primary-700">
                NT$ {formatAmount(report.net_amount)}
              </span>
            </div>
          </div>
        </div>

        {/* 匯款帳戶確認 */}
        <div className="brand-card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">匯款帳戶確認</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500 block mb-1">銀行代碼</label>
              <input
                type="text"
                value={formData.bank_code}
                onChange={(e) => setFormData(prev => ({ ...prev, bank_code: e.target.value }))}
                className="input-field"
                maxLength={3}
              />
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1">帳號</label>
              <input
                type="text"
                value={formData.bank_account}
                onChange={(e) => setFormData(prev => ({ ...prev, bank_account: e.target.value }))}
                className="input-field"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            請確認帳戶正確，避免匯款失敗
          </p>
        </div>

        {/* 簽名區 */}
        <div className="brand-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">手寫簽名</h2>
            <button
              onClick={clearSignature}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <Eraser className="w-4 h-4" />
              清除
            </button>
          </div>

          <div className="border-2 border-dashed border-gray-200 rounded-xl bg-white">
            <canvas
              ref={canvasRef}
              className="w-full h-40 touch-none cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            請在上方區域手寫簽名
          </p>
        </div>

        {/* 同意條款 */}
        <div className="brand-card p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.agree}
              onChange={(e) => setFormData(prev => ({ ...prev, agree: e.target.checked }))}
              className="w-5 h-5 text-brand-primary-600 rounded mt-0.5"
            />
            <span className="text-sm text-gray-700">
              本人確認以上資料正確無誤，同意依中華民國稅法規定辦理扣繳申報，
              並授權 {report.company_name} 代為申報執行業務所得。
            </span>
          </label>
        </div>

        {/* 提交按鈕 */}
        <button
          onClick={handleSubmit}
          disabled={!formData.agree || !hasSignature || submitting}
          className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              提交中...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              確認簽署
            </>
          )}
        </button>

        {/* 注意事項 */}
        <div className="text-center text-xs text-gray-400 pb-8">
          <p>提交後將無法修改，請確認資料正確</p>
          <p className="mt-1">如有疑問請聯繫 {report.company_name}</p>
        </div>
      </main>
    </div>
  );
}
