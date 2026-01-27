'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const url_status = searchParams.get('status') || 'all';
  const url_from = searchParams.get('from') || '';
  const url_to = searchParams.get('to') || '';

  // 更新 URL 參數
  const updateURL = (statusFilter: string, dateFrom: string, dateTo: string) => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    router.replace(`/dashboard/contracts?${params.toString()}`, { scroll: false });
  };


  const { company } = useAuthStore();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(url_from);
  const [dateTo, setDateTo] = useState(url_to);
  const [statusFilter, setStatusFilter] = useState(url_status);

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
      const lineMsg = data.line_sent ? '\n\n✅ 已發送 LINE 通知' : '';
      alert('簽署連結已複製到剪貼簿！\n\n' + data.sign_url + lineMsg);
      fetchContracts();
    } else {
      alert(data.error || '產生連結失敗');
    }
  };

  const handleSendLine = async (contract: any) => {
    if (!contract.signature_token) {
      alert('請先產生簽署連結');
      return;
    }
    const signUrl = `https://mommy-wisdom-accounting.vercel.app/sign/${contract.signature_token}`;
    const res = await fetch('/api/line/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: company?.id,
        recipient_type: 'group',
        recipient_id: contract.customer?.line_group_id,
        recipient_name: contract.customer?.line_group_name,
        content: `📋 合約簽署通知\n\n合約編號：${contract.contract_number}\n主旨：${contract.title}\n金額：$${contract.total_amount?.toLocaleString()}\n\n請點擊下方連結進行簽署：\n${signUrl}`,
      }),
    });
    const data = await res.json();
    if (data.success) {
      alert('LINE 通知已發送！');
    } else {
      alert(data.error || '發送失敗');
    }
  };

  const filteredContracts = contracts.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (dateFrom && c.contract_date < dateFrom) return false;
    if (dateTo && c.contract_date > dateTo) return false;
    return true;
  });

  const handleExport = () => {
    const headers = ['合約編號', '客戶', '主旨', '金額', '狀態', '日期'];
    const rows = filteredContracts.map(c => [
      c.contract_number,
      c.customer_name,
      c.title,
      c.total_amount,
      statusLabels[c.status] || c.status,
      c.contract_date || ''
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contracts_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
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
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); updateURL(e.target.value, dateFrom, dateTo); }} className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="all">全部</option>
              <option value="draft">草稿</option>
              <option value="pending_signature">待簽署</option>
              <option value="signed">已簽署</option>
              <option value="active">執行中</option>
              <option value="completed">已完成</option>
            </select>
          </div>
          <button onClick={handleExport} className="ml-auto px-4 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm">
            匯出 CSV
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">共 {filteredContracts.length} 筆合約</p>
      </div>

      {loading ? (
        <div className="text-center py-10">載入中...</div>
      ) : filteredContracts.length === 0 ? (
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
              {filteredContracts.map((c) => (
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
                          {c.status === 'draft' ? '產生連結' : '複製連結'}
                        </button>
                      )}
                      {c.status === 'pending_signature' && c.customer?.line_group_id && (
                        <button onClick={() => handleSendLine(c)} className="text-purple-600 hover:underline text-sm">
                          LINE通知
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
