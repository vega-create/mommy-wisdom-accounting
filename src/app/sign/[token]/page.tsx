'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  FileCheck,
  User,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Info,
  Upload,
  Camera,
  X,
  Image as ImageIcon,
} from 'lucide-react';

interface ReportData {
  id: string;
  report_number: string;
  company_name: string;
  company_logo?: string;
  staff_name: string;
  id_number?: string;
  income_type_code: string;
  income_type_name: string;
  work_description?: string;
  service_period_start?: string;
  service_period_end?: string;
  gross_amount: number;
  withholding_tax: number;
  nhi_premium: number;
  net_amount: number;
  status: string;
  bank_code?: string;
  bank_account?: string;
  id_card_front?: string;
  id_card_back?: string;
  passbook_image?: string;
}

export default function SignPage() {
  const params = useParams();
  const token = params.token as string;
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  
  // 表單資料
  const [idNumber, setIdNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [agreed, setAgreed] = useState(false);
  
  // 文件上傳
  const [idCardFront, setIdCardFront] = useState<string | null>(null);
  const [idCardBack, setIdCardBack] = useState<string | null>(null);
  const [passbookImage, setPassbookImage] = useState<string | null>(null);
  
  // 簽名畫布
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // 載入勞報單資料
  useEffect(() => {
    const loadReport = async () => {
      try {
        const res = await fetch(`/api/sign/${token}`);
        const json = await res.json();
        
        if (json.error) {
          setError(json.error);
        } else if (json.data) {
          setReport(json.data);
          setIdNumber(json.data.id_number || '');
          setBankCode(json.data.bank_code || '');
          setBankAccount(json.data.bank_account || '');
          setIdCardFront(json.data.id_card_front || null);
          setIdCardBack(json.data.id_card_back || null);
          setPassbookImage(json.data.passbook_image || null);
        }
      } catch (err) {
        setError('載入資料失敗，請稍後再試');
      } finally {
        setLoading(false);
      }
    };

    if (token) loadReport();
  }, [token]);

  // 初始化畫布
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [report]);

  // 處理文件上傳
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setImage: (url: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 檢查檔案大小（最大 5MB）
    if (file.size > 5 * 1024 * 1024) {
      alert('檔案大小不能超過 5MB');
      return;
    }

    // 轉換為 base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImage(base64);
    };
    reader.readAsDataURL(file);
  };

  // 簽名相關函數
  const getCoordinates = (e: React.TouchEvent | React.MouseEvent) => {
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
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const getSignatureImage = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return null;
    return canvas.toDataURL('image/png');
  };

  // 提交簽署
  const handleSubmit = async () => {
    if (!agreed) {
      alert('請先勾選同意條款');
      return;
    }

    if (!hasSignature) {
      alert('請先簽名');
      return;
    }

    if (!idNumber) {
      alert('請填寫身分證字號');
      return;
    }

    const signatureImage = getSignatureImage();
    if (!signatureImage) {
      alert('簽名無效，請重新簽名');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_number: idNumber,
          bank_code: bankCode,
          bank_account: bankAccount,
          signature_image: signatureImage,
          id_card_front: idCardFront,
          id_card_back: idCardBack,
          passbook_image: passbookImage,
        }),
      });

      const json = await res.json();
      
      if (json.success) {
        setSuccess(true);
      } else {
        alert(json.error || '簽署失敗');
      }
    } catch (err) {
      alert('簽署失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  const formatAmount = (amount: number) => new Intl.NumberFormat('zh-TW').format(amount);

  // 載入中
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-red-700 mx-auto mb-4" />
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  // 錯誤
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">無法載入</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // 已簽署或成功
  if (success || report?.status === 'signed' || report?.status === 'paid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {success ? '簽署完成！' : '此勞報單已簽署'}
          </h1>
          <p className="text-gray-600 mb-6">
            {success 
              ? '感謝您的簽署，款項將於近日匯入您的帳戶。' 
              : '此勞報單已經簽署完成。'}
          </p>
          {report && (
            <div className="bg-gray-50 rounded-xl p-4 text-left">
              <p className="text-sm text-gray-500">勞報單號</p>
              <p className="font-medium">{report.report_number}</p>
              <p className="text-sm text-gray-500 mt-2">實付金額</p>
              <p className="text-2xl font-bold text-green-600">NT$ {formatAmount(report.net_amount)}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 文件上傳元件
  const FileUploadBox = ({ 
    label, 
    value, 
    onChange, 
    onClear 
  }: { 
    label: string; 
    value: string | null; 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClear: () => void;
  }) => (
    <div className="flex-1">
      <p className="text-sm text-gray-600 mb-2">{label}</p>
      {value ? (
        <div className="relative">
          <img src={value} alt={label} className="w-full h-24 object-cover rounded-lg border" />
          <button
            onClick={onClear}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-red-400 transition-colors">
          <Camera className="w-6 h-6 text-gray-400 mb-1" />
          <span className="text-xs text-gray-400">點擊上傳</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onChange}
          />
        </label>
      )}
    </div>
  );

  // 主要簽署頁面
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-700 to-red-600 text-white py-6 px-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <FileCheck className="w-8 h-8" />
            <h1 className="text-xl font-bold">勞報單簽署</h1>
          </div>
          <p className="text-red-100 text-sm">{report?.company_name}</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 pb-8 space-y-4">
        {/* 金額卡片 */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">實付金額</p>
            <p className="text-4xl font-bold text-red-700">
              NT$ {formatAmount(report?.net_amount || 0)}
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">應稅所得</span>
              <span className="font-medium">NT$ {formatAmount(report?.gross_amount || 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">扣繳稅額</span>
              <span className="text-red-600">- NT$ {formatAmount(report?.withholding_tax || 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">二代健保</span>
              <span className="text-orange-600">- NT$ {formatAmount(report?.nhi_premium || 0)}</span>
            </div>
          </div>
        </div>

        {/* 勞報資訊 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Info className="w-5 h-5 text-gray-400" />
            勞報資訊
          </h2>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">單號</p>
              <p className="font-medium">{report?.report_number}</p>
            </div>
            <div>
              <p className="text-gray-500">所得類別</p>
              <p className="font-medium">{report?.income_type_name}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500">領款人</p>
              <p className="font-medium">{report?.staff_name}</p>
            </div>
            {report?.work_description && (
              <div className="col-span-2">
                <p className="text-gray-500">服務內容</p>
                <p className="font-medium">{report.work_description}</p>
              </div>
            )}
            {report?.service_period_start && (
              <div className="col-span-2">
                <p className="text-gray-500">服務期間</p>
                <p className="font-medium">
                  {report.service_period_start} ~ {report.service_period_end}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 身分驗證文件 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-gray-400" />
            身分驗證文件
            <span className="text-xs text-gray-400 font-normal">（首次需上傳）</span>
          </h2>

          <div className="flex gap-3">
            <FileUploadBox
              label="身分證正面"
              value={idCardFront}
              onChange={(e) => handleFileUpload(e, setIdCardFront)}
              onClear={() => setIdCardFront(null)}
            />
            <FileUploadBox
              label="身分證反面"
              value={idCardBack}
              onChange={(e) => handleFileUpload(e, setIdCardBack)}
              onClear={() => setIdCardBack(null)}
            />
          </div>

          <FileUploadBox
            label="銀行存摺封面"
            value={passbookImage}
            onChange={(e) => handleFileUpload(e, setPassbookImage)}
            onClear={() => setPassbookImage(null)}
          />

          <p className="text-xs text-gray-400">
            上傳的文件僅供身分核驗使用，將會安全保存
          </p>
        </div>

        {/* 填寫資料 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5 text-gray-400" />
            確認資料
          </h2>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              身分證字號 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-lg"
              placeholder="A123456789"
              maxLength={10}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">銀行代碼</label>
              <input
                type="text"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="004"
                maxLength={3}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-1">銀行帳號</label>
              <input
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="12345678901234"
              />
            </div>
          </div>
        </div>

        {/* 簽名區 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">手寫簽名 <span className="text-red-500">*</span></h2>
            <button
              onClick={clearSignature}
              className="text-sm text-red-600 flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              清除
            </button>
          </div>

          <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-gray-50">
            <canvas
              ref={canvasRef}
              className="w-full touch-none cursor-crosshair"
              style={{ height: '180px' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>

          {!hasSignature && (
            <p className="text-center text-sm text-gray-400">請在上方區域簽名</p>
          )}
        </div>

        {/* 同意條款 */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-5 h-5 mt-0.5 text-red-600 rounded"
            />
            <span className="text-sm text-gray-600">
              我已確認以上資訊正確無誤，並同意以電子簽名方式簽署此勞報單。我了解簽署後此勞報單將產生法律效力。
            </span>
          </label>
        </div>

        {/* 提交按鈕 */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !agreed || !hasSignature || !idNumber}
          className="w-full bg-gradient-to-r from-red-700 to-red-600 text-white py-4 rounded-2xl font-semibold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              提交中...
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              確認簽署
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-400">
          簽署完成後，款項將於確認後匯入您的帳戶
        </p>
      </main>
    </div>
  );
}
