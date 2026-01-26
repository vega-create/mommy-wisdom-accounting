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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

  const filteredQuotations = quotations.filter(q => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    if (dateFrom && q.quotation_date < dateFrom) return false;
    if (dateTo && q.quotation_date > dateTo) return false;
    return true;
  });

  const handleExport = () => {
    const headers = ['報價單號', '客戶', '主旨', '金額', '狀態', '日期'];
    const rows = filteredQuotations.map(q => [
      q.quotation_number,
      q.customer_name,
      q.title,
      q.total_amount,
      statusLabels[q.status] || q.status,
      q.quotation_date || ''
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quotations_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
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

      {/* 篩選區 */}
      <div className="bg-white rounded-xl border p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">日期：</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
            <span className="text-gray-400">~</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">狀態：</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="all">全部</option>
              <option value="draft">草稿</option>
              <option value="sent">已發送</option>
              <option value="accepted">已接受</option>
              <option value="converted">已轉合約</option>
            </select>
          </div>
          <button onClick={handleExport} className="ml-auto px-4 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm">
            匯出 CSV
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">共 {filteredQuotations.length} 筆報價單</p>
      </div>

      {loading ? (
        <div className="text-center py-10">載入中...</div>
      ) : filteredQuotations.length === 0 ? (
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
              {filteredQuotations.map((q) => (
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
                      {(q.status === "draft" || q.status === "sent") && (
                        <button onClick={() => handleSendLink(q.id)} className="text-green-600 hover:underline text-sm">產生連結</button>
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
