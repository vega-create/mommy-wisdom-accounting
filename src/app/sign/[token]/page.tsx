'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import SignatureCanvas from 'react-signature-canvas';

export default function SignContractPage() {
  const params = useParams();
  const token = params.token as string;
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signerName, setSignerName] = useState('');
  const sigCanvas = useRef<SignatureCanvas>(null);

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
        if (data.customer_signed_at) setSigned(true);
      }
    } catch (e) {
      setError('無法載入合約');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      alert('請先簽名');
      return;
    }
    if (!signerName.trim()) {
      alert('請輸入姓名');
      return;
    }

    setSigning(true);
    try {
      const signature = sigCanvas.current.toDataURL();
      const res = await fetch(`/api/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, signer_name: signerName }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setSigned(true);
      }
    } catch (e) {
      alert('簽署失敗');
    } finally {
      setSigning(false);
    }
  };

  const clearSignature = () => sigCanvas.current?.clear();

  if (loading) return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>;
  if (!contract) return <div className="min-h-screen flex items-center justify-center">找不到合約</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{contract.title}</h1>
          <p className="text-gray-500 mb-4">合約編號：{contract.contract_number}</p>
          
          <div className="border-t pt-4 mt-4">
            <h2 className="font-semibold mb-2">合約內容</h2>
            <p className="text-gray-600 whitespace-pre-wrap">{contract.description}</p>
          </div>

          <div className="border-t pt-4 mt-4">
            <h2 className="font-semibold mb-2">項目明細</h2>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">項目</th>
                  <th className="text-right p-2">數量</th>
                  <th className="text-right p-2">單價</th>
                  <th className="text-right p-2">金額</th>
                </tr>
              </thead>
              <tbody>
                {contract.items?.map((item: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{item.item_name}</td>
                    <td className="text-right p-2">{item.quantity} {item.unit}</td>
                    <td className="text-right p-2">${item.unit_price?.toLocaleString()}</td>
                    <td className="text-right p-2">${item.amount?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t font-semibold">
                <tr><td colSpan={3} className="text-right p-2">小計</td><td className="text-right p-2">${contract.subtotal?.toLocaleString()}</td></tr>
                <tr><td colSpan={3} className="text-right p-2">稅額</td><td className="text-right p-2">${contract.tax_amount?.toLocaleString()}</td></tr>
                <tr className="text-lg"><td colSpan={3} className="text-right p-2">總計</td><td className="text-right p-2 text-red-600">${contract.total_amount?.toLocaleString()}</td></tr>
              </tfoot>
            </table>
          </div>

          {contract.terms_and_conditions && (
            <div className="border-t pt-4 mt-4">
              <h2 className="font-semibold mb-2">條款與條件</h2>
              <p className="text-gray-600 text-sm whitespace-pre-wrap">{contract.terms_and_conditions}</p>
            </div>
          )}
        </div>

        {signed ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <div className="text-green-600 text-xl font-bold mb-2">✓ 已完成簽署</div>
            <p className="text-gray-600">感謝您的簽署，合約已生效。</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="font-semibold mb-4">請在下方簽名</h2>
            <input
              type="text"
              placeholder="請輸入您的姓名"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 mb-4"
            />
            <div className="border-2 border-dashed border-gray-300 rounded-lg mb-4">
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{ className: 'w-full h-48' }}
                backgroundColor="white"
              />
            </div>
            <div className="flex gap-4">
              <button onClick={clearSignature} className="px-4 py-2 border rounded-lg hover:bg-gray-50">清除</button>
              <button onClick={handleSign} disabled={signing} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
                {signing ? '簽署中...' : '確認簽署'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
