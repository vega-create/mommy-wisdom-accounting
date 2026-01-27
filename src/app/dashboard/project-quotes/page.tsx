'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { FileText, Plus, Edit2, Trash2, RefreshCw, Search, X, Download } from 'lucide-react';

interface ProjectQuote {
  id: string;
  quote_date: string;
  client_name: string;
  project_item: string;
  vendor_name?: string;
  cost_price?: number;
  cost_note?: string;
  selling_price?: number;
  selling_note?: string;
  status: string;
  notes?: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  discussing: { label: '討論中', color: 'text-blue-600', bg: 'bg-blue-100' },
  in_progress: { label: '進行中', color: 'text-orange-600', bg: 'bg-orange-100' },
  completed: { label: '結案', color: 'text-green-600', bg: 'bg-green-100' },
  cancelled: { label: '取消', color: 'text-gray-600', bg: 'bg-gray-100' },
  contract_changed: { label: '更換合約', color: 'text-purple-600', bg: 'bg-purple-100' },
  not_cooperated: { label: '未合作', color: 'text-red-600', bg: 'bg-red-100' }
};

export default function ProjectQuotesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const url_status = searchParams.get('status') || 'all';

  // 更新 URL 參數
  const updateURL = (statusFilter: string) => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    router.replace(`/dashboard/project-quotes?${params.toString()}`, { scroll: false });
  };


  const { company } = useAuthStore();
  const [quotes, setQuotes] = useState<ProjectQuote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState(url_status);
  const [searchText, setSearchText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState<ProjectQuote | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    quote_date: new Date().toISOString().split('T')[0],
    client_name: '',
    project_item: '',
    vendor_name: '',
    cost_price: '',
    cost_note: '',
    selling_price: '',
    selling_note: '',
    status: 'discussing',
    notes: ''
  });

  useEffect(() => {
    if (company?.id) loadQuotes();
  }, [company?.id, statusFilter]);

  const loadQuotes = async () => {
    if (!company?.id) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ company_id: company.id });
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchText) params.append('search', searchText);
      
      const res = await fetch(`/api/project-quotes?${params}`);
      const result = await res.json();
      if (result.data) setQuotes(result.data);
    } catch (e) {
      console.error('Error loading quotes:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => loadQuotes();

  const openAddModal = () => {
    setEditingQuote(null);
    setForm({
      quote_date: new Date().toISOString().split('T')[0],
      client_name: '',
      project_item: '',
      vendor_name: '',
      cost_price: '',
      cost_note: '',
      selling_price: '',
      selling_note: '',
      status: 'discussing',
      notes: ''
    });
    setShowModal(true);
  };

  const openEditModal = (quote: ProjectQuote) => {
    setEditingQuote(quote);
    setForm({
      quote_date: quote.quote_date,
      client_name: quote.client_name,
      project_item: quote.project_item,
      vendor_name: quote.vendor_name || '',
      cost_price: quote.cost_price?.toString() || '',
      cost_note: quote.cost_note || '',
      selling_price: quote.selling_price?.toString() || '',
      selling_note: quote.selling_note || '',
      status: quote.status,
      notes: quote.notes || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!company?.id || !form.client_name || !form.project_item) {
      alert('請填寫必要欄位（客戶、品項）');
      return;
    }
    setIsSaving(true);
    try {
      const method = editingQuote ? 'PUT' : 'POST';
      const body = editingQuote ? { id: editingQuote.id, ...form } : { company_id: company.id, ...form };
      
      const res = await fetch('/api/project-quotes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await res.json();
      if (result.success) {
        setShowModal(false);
        loadQuotes();
      } else {
        alert(result.error || '儲存失敗');
      }
    } catch (e) {
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此筆資料？')) return;
    try {
      const res = await fetch(`/api/project-quotes?id=${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) loadQuotes();
      else alert(result.error || '刪除失敗');
    } catch (e) {
      alert('刪除失敗');
    }
  };

  const exportCSV = () => {
    const headers = ['日期', '需求公司', '需求品項', '製作單位', '成本價', '成本備註', '報價', '報價備註', '狀況'];
    const rows = quotes.map(q => [
      q.quote_date,
      q.client_name,
      q.project_item,
      q.vendor_name || '',
      q.cost_price?.toString() || '',
      q.cost_note || '',
      q.selling_price?.toString() || '',
      q.selling_note || '',
      statusConfig[q.status]?.label || q.status
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `專案報價_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const stats = {
    total: quotes.length,
    inProgress: quotes.filter(q => q.status === 'in_progress').length,
    completed: quotes.filter(q => q.status === 'completed').length,
    totalRevenue: quotes.filter(q => q.status === 'completed').reduce((sum, q) => sum + (q.selling_price || 0), 0),
    totalCost: quotes.filter(q => q.status === 'completed').reduce((sum, q) => sum + (q.cost_price || 0), 0)
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">專案成本報價管理</h1>
          <p className="text-gray-500 mt-1">記錄客戶報價、成本與專案狀態</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" /> 匯出
          </button>
          <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-brand-primary-500 text-white rounded-lg hover:bg-brand-primary-600">
            <Plus className="w-4 h-4" /> 新增報價
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <p className="text-sm text-gray-500">總筆數</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <p className="text-sm text-gray-500">進行中</p>
          <p className="text-2xl font-bold text-orange-600">{stats.inProgress}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <p className="text-sm text-gray-500">已結案</p>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <p className="text-sm text-gray-500">結案總收入</p>
          <p className="text-2xl font-bold text-blue-600">${stats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <p className="text-sm text-gray-500">結案毛利</p>
          <p className="text-2xl font-bold text-purple-600">${(stats.totalRevenue - stats.totalCost).toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2 flex-wrap">
            {['all', 'discussing', 'in_progress', 'completed', 'contract_changed', 'not_cooperated'].map(s => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); updateURL(s); }}
                className={`px-3 py-1.5 rounded-lg text-sm ${statusFilter === s ? 'bg-brand-primary-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                {s === 'all' ? '全部' : statusConfig[s]?.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-1 max-w-md">
            <input
              type="text"
              placeholder="搜尋客戶、品項、廠商..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-3 py-2 border rounded-lg"
            />
            <button onClick={handleSearch} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
              <Search className="w-4 h-4" />
            </button>
          </div>
          <button onClick={loadQuotes} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">日期</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">需求公司</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">需求品項</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">製作單位</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">成本價</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">報價</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">毛利</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">狀況</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quotes.map(quote => {
                const profit = (quote.selling_price || 0) - (quote.cost_price || 0);
                const config = statusConfig[quote.status] || { label: quote.status, color: 'text-gray-600', bg: 'bg-gray-100' };
                return (
                  <tr key={quote.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{quote.quote_date}</td>
                    <td className="px-4 py-3 text-sm font-medium">{quote.client_name}</td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate" title={quote.project_item}>{quote.project_item}</td>
                    <td className="px-4 py-3 text-sm">{quote.vendor_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right">{quote.cost_price ? `$${quote.cost_price.toLocaleString()}` : '-'}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{quote.selling_price ? `$${quote.selling_price.toLocaleString()}` : '-'}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${profit > 0 ? 'text-green-600' : profit < 0 ? 'text-red-600' : ''}`}>
                      {quote.selling_price && quote.cost_price ? `$${profit.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${config.bg} ${config.color}`}>{config.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => openEditModal(quote)} className="p-1 hover:bg-gray-100 rounded" title="編輯">
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </button>
                        <button onClick={() => handleDelete(quote.id)} className="p-1 hover:bg-gray-100 rounded" title="刪除">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {quotes.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">尚無資料</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">{editingQuote ? '編輯報價' : '新增報價'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">日期</label>
                  <input type="date" value={form.quote_date} onChange={(e) => setForm({...form, quote_date: e.target.value})} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">狀況</label>
                  <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="w-full border rounded-lg px-3 py-2">
                    {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">需求公司 *</label>
                <input type="text" value={form.client_name} onChange={(e) => setForm({...form, client_name: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="客戶名稱" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">需求品項 *</label>
                <input type="text" value={form.project_item} onChange={(e) => setForm({...form, project_item: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="網站設計、SEO、廣告投放..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">製作單位</label>
                <input type="text" value={form.vendor_name} onChange={(e) => setForm({...form, vendor_name: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="外包廠商名稱" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">成本價</label>
                  <input type="number" value={form.cost_price} onChange={(e) => setForm({...form, cost_price: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">智慧媽咪報價</label>
                  <input type="number" value={form.selling_price} onChange={(e) => setForm({...form, selling_price: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">成本備註</label>
                <textarea value={form.cost_note} onChange={(e) => setForm({...form, cost_note: e.target.value})} className="w-full border rounded-lg px-3 py-2" rows={2} placeholder="成本細節說明..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">報價備註</label>
                <textarea value={form.selling_note} onChange={(e) => setForm({...form, selling_note: e.target.value})} className="w-full border rounded-lg px-3 py-2" rows={2} placeholder="報價細節說明..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">其他備註</label>
                <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="w-full border rounded-lg px-3 py-2" rows={2} />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={handleSave} disabled={isSaving} className="flex-1 py-2 bg-brand-primary-500 text-white rounded-lg hover:bg-brand-primary-600 disabled:opacity-50">
                {isSaving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
