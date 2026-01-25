'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

const statusLabels: Record<string, string> = {
  draft: '草稿', pending_signature: '待簽署', signed: '已簽署', active: '執行中', completed: '已完成', cancelled: '已取消',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700', pending_signature: 'bg-yellow-100 text-yellow-700', signed: 'bg-green-100 text-green-700',
  active: 'bg-blue-100 text-blue-700', completed: 'bg-purple-100 text-purple-700', cancelled: 'bg-red-100 text-red-700',
};

export default function ContractsPage() {
  const { company } = useAuthStore();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) fetchContracts();
    else setLoading(false);
  }, [company]);

  const fetchContracts = async () => {
    setLoading(true);
    const res = await fetch(`/api/contracts?company_id=${company?.id}`);
    const data = await res.json();
    setContracts(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除此合約？')) return;
    await fetch(`/api/contracts/${id}`, { method: 'DELETE' });
    fetchContracts();
  };

  const handleGenerateLink = async (id: string) => {
    const res = await fetch(`/api/contracts/${id}/signature-link`, { method: 'POST' });
    const data = await res.json();
    if (data.sign_url) {
      await navigator.clipboard.writeText(data.sign_url);
      alert('簽署連結已複製到剪貼簿！\n\n' + data.sign_url);
      fetchContracts();
    } else {
      alert(data.error || '產生連結失敗');
    }
  };

  if (!company) {
    return <div className="p-6 text-center text-gray-500">請先選擇公司</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">合約管理</h1>
        <Link href="/dashboard/contracts/new" className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
          新增合約
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-10">載入中...</div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-10 text-gray-500">尚無合約</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4">合約編號</th>
                <th className="text-left p-4">客戶</th>
                <th className="text-left p-4">主旨</th>
                <th className="text-right p-4">金額</th>
                <th className="text-center p-4">狀態</th>
                <th className="text-center p-4">日期</th>
                <th className="text-center p-4">操作</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="p-4 font-mono">{c.contract_number}</td>
                  <td className="p-4">{c.customer_name}</td>
                  <td className="p-4">{c.title}</td>
                  <td className="p-4 text-right">${c.total_amount?.toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${statusColors[c.status]}`}>{statusLabels[c.status]}</span>
                  </td>
                  <td className="p-4 text-center text-gray-500">{c.contract_date}</td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                      <Link href={`/dashboard/contracts/${c.id}`} className="text-blue-600 hover:underline text-sm">編輯</Link>
                      {(c.status === 'draft' || c.status === 'pending_signature') && (
                        <button onClick={() => handleGenerateLink(c.id)} className="text-green-600 hover:underline text-sm">
                          {c.status === 'draft' ? '產生簽署連結' : '複製連結'}
                        </button>
                      )}
                      <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:underline text-sm">刪除</button>
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
