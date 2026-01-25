'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

export default function ContractSignPage() {
  const params = useParams();
  const token = params.token as string;
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [stampFile, setStampFile] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    fetchContract();
  }, [token]);

  const fetchContract = async () => {
    try {
      const res = await fetch(`/api/sign/${token}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setContract(data);
        if (data.status === 'signed') setSigned(true);
      }
    } catch (e) {
      setError('無法載入合約');
    }
    setLoading(false);
  };

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  };

  useEffect(() => {
    initCanvas();
  }, [contract]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) setSignatureDataUrl(canvas.toDataURL());
  };

  const clearSignature = () => {
    initCanvas();
    setSignatureDataUrl('');
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setStampFile(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!signerName.trim()) { alert('請輸入簽署人姓名'); return; }
    if (!signatureDataUrl) { alert('請簽名'); return; }
    setSigning(true);
    const res = await fetch(`/api/sign/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature: signatureDataUrl, signer_name: signerName, company_stamp: stampFile }),
    });
    const data = await res.json();
    setSigning(false);
    if (data.success) setSigned(true);
    else alert(data.error || '簽署失敗');
  };

  const handlePrint = () => window.print();

  if (loading) return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  if (!contract) return <div className="min-h-screen flex items-center justify-center text-red-600">無法載入合約</div>;

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto bg-white shadow-lg print:shadow-none">
        {/* 合約標題 */}
        <div className="p-8 border-b-2 border-gray-800">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">服務合約書</h1>
            <p className="text-gray-600">Contract Agreement</p>
          </div>
          <div className="flex justify-between mt-6 text-sm">
            <div>合約編號：{contract.contract_number}</div>
            <div>日期：{contract.contract_date}</div>
          </div>
        </div>

        {/* 雙方資訊 */}
        <div className="p-8 grid grid-cols-2 gap-8 border-b">
          <div>
            <h3 className="font-bold text-lg mb-3 border-b pb-2">甲方（委託方）</h3>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-500 w-20 inline-block">公司名稱：</span>{contract.customer_name}</p>
              {contract.customer_tax_id && <p><span className="text-gray-500 w-20 inline-block">統一編號：</span>{contract.customer_tax_id}</p>}
              {contract.contact_person && <p><span className="text-gray-500 w-20 inline-block">聯絡人：</span>{contract.contact_person}</p>}
              {contract.customer_phone && <p><span className="text-gray-500 w-20 inline-block">電話：</span>{contract.customer_phone}</p>}
              {contract.customer_email && <p><span className="text-gray-500 w-20 inline-block">Email：</span>{contract.customer_email}</p>}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-3 border-b pb-2">乙方（服務方）</h3>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-500 w-20 inline-block">公司名稱：</span>{contract.company?.name}</p>
              {contract.company?.tax_id && <p><span className="text-gray-500 w-20 inline-block">統一編號：</span>{contract.company?.tax_id}</p>}
              {contract.company?.phone && <p><span className="text-gray-500 w-20 inline-block">電話：</span>{contract.company?.phone}</p>}
              {contract.company?.email && <p><span className="text-gray-500 w-20 inline-block">Email：</span>{contract.company?.email}</p>}
            </div>
          </div>
        </div>

        {/* 合約內容 */}
        <div className="p-8 border-b">
          <h3 className="font-bold text-lg mb-4">壹、合約標的</h3>
          <p className="mb-4 font-medium">{contract.title}</p>
          {contract.description && <p className="text-gray-700 whitespace-pre-wrap">{contract.description}</p>}
        </div>

        {/* 服務項目明細 */}
        <div className="p-8 border-b">
          <h3 className="font-bold text-lg mb-4">貳、服務項目與費用</h3>
          <table className="w-full border-collapse border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">項目名稱</th>
                <th className="border p-2 text-center w-20">數量</th>
                <th className="border p-2 text-center w-16">單位</th>
                <th className="border p-2 text-right w-28">單價</th>
                <th className="border p-2 text-right w-28">小計</th>
              </tr>
            </thead>
            <tbody>
              {contract.items?.map((item: any, i: number) => (
                <tr key={i}>
                  <td className="border p-2">{item.item_name}</td>
                  <td className="border p-2 text-center">{item.quantity}</td>
                  <td className="border p-2 text-center">{item.unit}</td>
                  <td className="border p-2 text-right">${item.unit_price?.toLocaleString()}</td>
                  <td className="border p-2 text-right">${item.amount?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="border p-2 text-right font-medium">小計</td>
                <td className="border p-2 text-right">${contract.subtotal?.toLocaleString()}</td>
              </tr>
              <tr>
                <td colSpan={4} className="border p-2 text-right font-medium">稅額 (5%)</td>
                <td className="border p-2 text-right">${contract.tax_amount?.toLocaleString()}</td>
              </tr>
              <tr className="bg-gray-50">
                <td colSpan={4} className="border p-2 text-right font-bold">合計金額</td>
                <td className="border p-2 text-right font-bold text-lg">${contract.total_amount?.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 付款條件 */}
        {contract.payment_terms && (
          <div className="p-8 border-b">
            <h3 className="font-bold text-lg mb-4">參、付款條件</h3>
            <p className="whitespace-pre-wrap">{contract.payment_terms}</p>
          </div>
        )}

        {/* 條款 */}
        {contract.terms_and_conditions && (
          <div className="p-8 border-b">
            <h3 className="font-bold text-lg mb-4">肆、條款與條件</h3>
            <p className="whitespace-pre-wrap text-sm">{contract.terms_and_conditions}</p>
          </div>
        )}

        {/* 合約期間 */}
        {(contract.start_date || contract.end_date) && (
          <div className="p-8 border-b">
            <h3 className="font-bold text-lg mb-4">伍、合約期間</h3>
            <p>自 {contract.start_date || '___'} 起至 {contract.end_date || '___'} 止</p>
          </div>
        )}

        {/* 簽署區域 */}
        <div className="p-8">
          <h3 className="font-bold text-lg mb-6">簽署欄</h3>
          <div className="grid grid-cols-2 gap-8">
            {/* 甲方簽署 */}
            <div className="border-2 p-4 rounded-lg">
              <h4 className="font-bold mb-4 text-center">甲方（委託方）</h4>
              {signed ? (
                <div className="text-center">
                  <p className="text-green-600 font-bold mb-2">✓ 已簽署</p>
                  <p className="text-sm">簽署人：{contract.customer_signed_name}</p>
                  <p className="text-sm text-gray-500">{new Date(contract.customer_signed_at).toLocaleString()}</p>
                  {contract.customer_signature && <img src={contract.customer_signature} alt="簽名" className="mx-auto mt-2 max-h-20 border" />}
                </div>
              ) : (
                <div className="print:hidden">
                  <div className="mb-4">
                    <label className="block text-sm mb-1">簽署人姓名 *</label>
                    <input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="請輸入姓名" />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm mb-1">簽名 *</label>
                    <canvas ref={canvasRef} width={280} height={100} className="border rounded bg-white cursor-crosshair w-full"
                      onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                    <button onClick={clearSignature} className="text-sm text-blue-600 hover:underline mt-1">清除重簽</button>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm mb-1">公司大小章（選填）</label>
                    <input type="file" accept="image/*" onChange={handleStampUpload} className="text-sm" />
                    {stampFile && <img src={stampFile} alt="公司章" className="mt-2 max-h-16 border" />}
                  </div>
                  <button onClick={handleSubmit} disabled={signing} className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
                    {signing ? '簽署中...' : '確認簽署'}
                  </button>
                </div>
              )}
              <div className="hidden print:block h-32 border-t mt-4 pt-4">
                <p className="text-sm text-gray-500">簽名：________________</p>
                <p className="text-sm text-gray-500 mt-8">日期：________________</p>
                <p className="text-sm text-gray-500 mt-4">（蓋公司大小章）</p>
              </div>
            </div>

            {/* 乙方簽署 */}
            <div className="border-2 p-4 rounded-lg">
              <h4 className="font-bold mb-4 text-center">乙方（服務方）</h4>
              <div className="text-center">
                <p className="font-medium">{contract.company?.name}</p>
                {contract.company?.logo_url && <img src={contract.company.logo_url} alt="公司章" className="mx-auto mt-2 max-h-20" />}
              </div>
              <div className="hidden print:block h-32 border-t mt-4 pt-4">
                <p className="text-sm text-gray-500">代表人：________________</p>
                <p className="text-sm text-gray-500 mt-8">日期：________________</p>
                <p className="text-sm text-gray-500 mt-4">（蓋公司大小章）</p>
              </div>
            </div>
          </div>
        </div>

        {/* 列印/下載按鈕 */}
        <div className="p-8 border-t flex gap-4 print:hidden">
          <button onClick={handlePrint} className="flex-1 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50">
            🖨️ 列印合約 / 下載 PDF
          </button>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>
    </div>
  );
}
