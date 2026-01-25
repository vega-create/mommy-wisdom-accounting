'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { FileCheck, Check, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import Image from 'next/image';

interface LaborReport {
  id: string;
  report_number: string;
  staff_name: string;
  staff_type: string;
  service_date: string;
  service_description: string;
  gross_amount: number;
  tax_amount: number;
  health_insurance: number;
  net_amount: number;
  status: string;
  company?: {
    name: string;
  };
}

export default function SignaturePage() {
  const params = useParams();
  const token = params.token as string;
  
  const [report, setReport] = useState<LaborReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  
  // 簽名板
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    if (token) {
      loadReport();
    }
  }, [token]);

  const loadReport = async () => {
    try {
      const response = await fetch(`/api/sign/${token}`);
      const result = await response.json();
      
      if (result.error) {
        setError(result.error);
      } else {
        setReport(result.data);
        if (result.data.status === 'signed' || result.data.status === 'paid') {
          setIsComplete(true);
        }
      }
    } catch (err) {
      setError('載入失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  // 簽名板功能
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    setHasSignature(true);
    
    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if ('touches' in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSubmit = async () => {
    if (!hasSignature) {
      alert('請先簽名');
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsSigning(true);
    try {
      const signatureData = canvas.toDataURL('image/png');
      
      const response = await fetch(`/api/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: signatureData })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setIsComplete(true);
      } else {
        alert(result.error || '簽署失敗');
      }
    } catch (err) {
      alert('簽署失敗，請稍後再試');
    } finally {
      setIsSigning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-primary-600" />
          <p className="mt-2 text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md text-center shadow-lg">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">無法載入</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md text-center shadow-lg">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">簽署完成</h1>
          <p className="text-gray-600">感謝您完成勞報單簽署！</p>
          <p className="text-gray-500 text-sm mt-4">款項將於確認後匯入您的帳戶</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-white rounded-t-xl p-6 border-b">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-brand-primary-100 rounded-lg flex items-center justify-center">
              <FileCheck className="w-6 h-6 text-brand-primary-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">勞報單簽署</h1>
              <p className="text-sm text-gray-500">{report?.company?.name || '智慧媽咪國際'}</p>
            </div>
          </div>
        </div>

        {/* Report Details */}
        <div className="bg-white p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">勞報單號</p>
              <p className="font-medium">{report?.report_number}</p>
            </div>
            <div>
              <p className="text-gray-500">服務日期</p>
              <p className="font-medium">{report?.service_date && new Date(report.service_date).toLocaleDateString('zh-TW')}</p>
            </div>
          </div>
          
          <div>
            <p className="text-gray-500 text-sm">人員姓名</p>
            <p className="font-medium text-lg">{report?.staff_name}</p>
          </div>
          
          <div>
            <p className="text-gray-500 text-sm">服務說明</p>
            <p className="font-medium">{report?.service_description}</p>
          </div>

          {/* Amount Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">稅前金額</span>
              <span>NT$ {report?.gross_amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">扣繳稅額 (10%)</span>
              <span className="text-red-600">- NT$ {report?.tax_amount.toLocaleString()}</span>
            </div>
            {(report?.health_insurance || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">二代健保 (2.11%)</span>
                <span className="text-red-600">- NT$ {report?.health_insurance.toLocaleString()}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>實付金額</span>
              <span className="text-green-600 text-lg">NT$ {report?.net_amount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Signature Pad */}
        <div className="bg-white p-6 border-t">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">請在下方簽名</p>
            {hasSignature && (
              <button
                onClick={clearSignature}
                className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                清除
              </button>
            )}
          </div>
          <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              className="w-full bg-white cursor-crosshair touch-none"
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
            簽署表示您已確認以上內容正確無誤
          </p>
        </div>

        {/* Submit Button */}
        <div className="bg-white rounded-b-xl p-6 border-t">
          <button
            onClick={handleSubmit}
            disabled={!hasSignature || isSigning}
            className="w-full py-3 bg-brand-primary-600 text-white rounded-lg font-medium hover:bg-brand-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSigning && <RefreshCw className="w-5 h-5 animate-spin" />}
            {isSigning ? '簽署中...' : '確認簽署'}
          </button>
        </div>
      </div>
    </div>
  );
}
