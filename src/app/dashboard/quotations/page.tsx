'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

const statusLabels: Record<string, string> = {
  draft: '草稿', sent: '已發送', accepted: '已接受', rejected: '已拒絕', expired: '已過期', converted: '已轉合約',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700', sent: 'bg-blue-100 text-blue-700', accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700', expired: 'bg-yellow-100 text-yellow-700', converted: 'bg-purple-100 text-purple-700',
};

export default function QuotationsPage() {
  const { company } = useAuthStore();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) {
      fetchQuotations();
    } else {
      setLoading(false);
    }
  }, [company]);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotations?company_id=${company?.id}`);
      const data = await res.json();
      setQuotations(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSendLink = async (id: string) => {
    const res = await fetch(`/api/quotations/${id}/send-link`, { method: "POST" });
    const data = await res.json();
    if (data.view_url) {
      navigator.clipboard.writeText(data.view_url);
      alert("報價單連結已複製到剪貼簿！\n\n" + data.view_url);
      fetchQuotations();
    } else {
      alert(data.error || "產生連結失敗");
    }
  };
  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除此報價單？')) return;
    await fetch(`/api/quotations/${id}`, { method: 'DELETE' });
    fetchQuotations();
  };

  const handleConvert = async (id: string) => {
    if (!confirm('確定將此報價單轉為合約？')) return;
    const res = await fetch(`/api/quotations/${id}/convert`, { method: 'POST' });
    const data = await res.json();
    if (data.contract_id) {
      alert('已成功轉換為合約');
      fetchQuotations();
    } else {
      alert(data.error || '轉換失敗');
    }
  };

  if (!company) {
    return <div className="p-6 text-center text-gray-500">請先選擇公司</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">報價單管理</h1>
        <Link href="/dashboard/quotations/new" className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
          新增報價單
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-10">載入中...</div>
      ) : quotations.length === 0 ? (
        <div className="text-center py-10 text-gray-500">尚無報價單，點擊右上角新增</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4">報價單號</th>
                <th className="text-left p-4">客戶</th>
                <th className="text-left p-4">主旨</th>
                <th className="text-right p-4">金額</th>
                <th className="text-center p-4">狀態</th>
                <th className="text-center p-4">日期</th>
                <th className="text-center p-4">操作</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => (
                <tr key={q.id} className="border-t hover:bg-gray-50">
                  <td className="p-4 font-mono">{q.quotation_number}</td>
                  <td className="p-4">{q.customer_name}</td>
                  <td className="p-4">{q.title}</td>
                  <td className="p-4 text-right">${q.total_amount?.toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${statusColors[q.status]}`}>{statusLabels[q.status]}</span>
                  </td>
                  <td className="p-4 text-center text-gray-500">{q.quotation_date}</td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                      <Link href={`/dashboard/quotations/${q.id}`} className="text-blue-600 hover:underline text-sm">編輯</Link>
                      {q.status === "draft" && (
                        <button onClick={() => handleSendLink(q.id)} className="text-green-600 hover:underline text-sm">發送連結</button>
                      )}
                      {q.status !== 'converted' && (
                        <button onClick={() => handleConvert(q.id)} className="text-purple-600 hover:underline text-sm">轉合約</button>
                      )}
                      <button onClick={() => handleDelete(q.id)} className="text-red-600 hover:underline text-sm">刪除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
