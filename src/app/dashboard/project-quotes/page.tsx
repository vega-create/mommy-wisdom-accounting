'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { FileText, Plus, Edit2, Trash2, RefreshCw, Search, X, Download, Filter, Calendar, ChevronDown, ChevronRight } from 'lucide-react';

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
  project_type?: string;
  billing_cycle?: string;
  next_billing_date?: string;
  show_subtotal?: boolean;
  notes?: string;
  created_at: string;
}

interface GroupedQuotes {
  client_name: string;
  items: ProjectQuote[];
  totalCost: number;
  totalSelling: number;
  totalProfit: number;
  show_subtotal?: boolean;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  discussing: { label: '討論中', color: 'text-blue-600', bg: 'bg-blue-100' },
  in_progress: { label: '進行中', color: 'text-orange-600', bg: 'bg-orange-100' },
  completed: { label: '結案', color: 'text-green-600', bg: 'bg-green-100' },
  cancelled: { label: '取消', color: 'text-gray-600', bg: 'bg-gray-100' },
  contract_changed: { label: '更換合約', color: 'text-purple-600', bg: 'bg-purple-100' },
  not_cooperated: { label: '未合作', color: 'text-red-600', bg: 'bg-red-100' }
};

const projectTypeConfig: Record<string, { label: string; color: string; bg: string }> = {
  quote: { label: '客戶報價', color: 'text-blue-600', bg: 'bg-blue-100' },
  website: { label: '網站架設', color: 'text-green-600', bg: 'bg-green-100' },
  ads_seo: { label: '廣告/SEO', color: 'text-orange-600', bg: 'bg-orange-100' },
  design: { label: '設計服務', color: 'text-pink-600', bg: 'bg-pink-100' },
  social: { label: '社群經營', color: 'text-purple-600', bg: 'bg-purple-100' },
  other: { label: '其他', color: 'text-gray-600', bg: 'bg-gray-100' }
};

const billingCycleConfig: Record<string, string> = {
  yearly: '每年',
  monthly: '每月',
  quarterly: '每季',
  one_time: '一次性'
};

export default function ProjectQuotesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const url_status = searchParams.get('status') || 'all';
  const url_type = searchParams.get('type') || 'all';
  const url_client = searchParams.get('client') || 'all';

  const updateURL = (status: string, type: string, client: string) => {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (type && type !== 'all') params.set('type', type);
    if (client && client !== 'all') params.set('client', client);
    router.replace(`/dashboard/project-quotes?${params.toString()}`, { scroll: false });
  };

  const { company } = useAuthStore();
  const [quotes, setQuotes] = useState<ProjectQuote[]>([]);
  const [clientList, setClientList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState(url_status);
  const [typeFilter, setTypeFilter] = useState(url_type);
  const [clientFilter, setClientFilter] = useState(url_client);
  const [searchText, setSearchText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState<ProjectQuote | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const defaultForm = {
    quote_date: new Date().toISOString().split('T')[0],
    client_name: '',
    project_item: '',
    vendor_name: '',
    cost_price: '',
    cost_note: '',
    selling_price: '',
    selling_note: '',
    status: 'discussing',
    project_type: 'quote',
    billing_cycle: '',
    next_billing_date: '',
    show_subtotal: false,
    notes: ''
  };

  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (company?.id) {
      loadQuotes();
      loadClientList();
    }
  }, [company?.id, statusFilter, typeFilter, clientFilter]);

  useEffect(() => {
    const allClients = new Set(quotes.map(q => q.client_name));
    setExpandedClients(allClients);
  }, [quotes]);

  const loadQuotes = async () => {
    if (!company?.id) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ company_id: company.id });
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('project_type', typeFilter);
      if (clientFilter !== 'all') params.append('client_name', clientFilter);
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

  const loadClientList = async () => {
    if (!company?.id) return;
    try {
      const params = new URLSearchParams({
        company_id: company.id,
        action: 'get_clients'
      });
      const res = await fetch(`/api/project-quotes?${params}`);
      const result = await res.json();
      if (result.data) setClientList(result.data);
    } catch (e) {
      console.error('Error loading client list:', e);
    }
  };

  const handleSearch = () => loadQuotes();

  const handleStatusFilter = (s: string) => {
    setStatusFilter(s);
    updateURL(s, typeFilter, clientFilter);
  };

  const handleTypeFilter = (t: string) => {
    setTypeFilter(t);
    updateURL(statusFilter, t, clientFilter);
  };

  const handleClientFilter = (c: string) => {
    setClientFilter(c);
    updateURL(statusFilter, typeFilter, c);
  };

  const toggleClient = (clientName: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientName)) {
      newExpanded.delete(clientName);
    } else {
      newExpanded.add(clientName);
    }
    setExpandedClients(newExpanded);
  };

  const openAddModal = (presetClient?: string) => {
    setEditingQuote(null);
    setForm({
      ...defaultForm,
      client_name: presetClient || ''
    });
    setShowModal(true);
  };

  const openEditModal = (quote: ProjectQuote) => {
    setEditingQuote(quote);
    setForm({
      quote_date: quote.quote_date || '',
      client_name: quote.client_name || '',
      project_item: quote.project_item || '',
      vendor_name: quote.vendor_name || '',
      cost_price: quote.cost_price?.toString() || '',
      cost_note: quote.cost_note || '',
      selling_price: quote.selling_price?.toString() || '',
      selling_note: quote.selling_note || '',
      status: quote.status || 'discussing',
      project_type: quote.project_type || 'quote',
      billing_cycle: quote.billing_cycle || '',
      next_billing_date: quote.next_billing_date || '',
      show_subtotal: quote.show_subtotal || false,
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
      const body = editingQuote
        ? { id: editingQuote.id, ...form }
        : { company_id: company.id, ...form };

      const res = await fetch('/api/project-quotes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await res.json();
      if (result.success) {
        setShowModal(false);
        loadQuotes();
        loadClientList();
      } else {
        alert(result.error || '儲存失敗');
      }
    } catch (e) {
      console.error('Save error:', e);
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
      if (result.success) {
        loadQuotes();
        loadClientList();
      } else alert(result.error || '刪除失敗');
    } catch (e) {
      alert('刪除失敗');
    }
  };

  const groupedQuotes: GroupedQuotes[] = Object.values(
    quotes.reduce((acc, quote) => {
      const key = quote.client_name;
      if (!acc[key]) {
        acc[key] = {
          client_name: key,
          items: [],
          totalCost: 0,
          totalSelling: 0,
          totalProfit: 0,
          show_subtotal: false
        };
      }
      acc[key].items.push(quote);
      acc[key].totalCost += quote.cost_price || 0;
      acc[key].totalSelling += quote.selling_price || 0;
      acc[key].totalProfit += (quote.selling_price || 0) - (quote.cost_price || 0);
      if (quote.show_subtotal) {
        acc[key].show_subtotal = true;
      }
      return acc;
    }, {} as Record<string, GroupedQuotes>)
  ).sort((a, b) => a.client_name.localeCompare(b.client_name));

  const exportCSV = () => {
    const headers = ['客戶', '日期', '類型', '需求品項', '製作單位', '成本價', '報價', '毛利', '狀況', '請款週期', '下次請款日'];
    const rows = quotes.map(q => [
      q.client_name,
      q.quote_date,
      projectTypeConfig[q.project_type || 'quote']?.label || q.project_type,
      q.project_item,
      q.vendor_name || '',
      q.cost_price?.toString() || '',
      q.selling_price?.toString() || '',
      ((q.selling_price || 0) - (q.cost_price || 0)).toString(),
      statusConfig[q.status]?.label || q.status,
      billingCycleConfig[q.billing_cycle || ''] || '',
      q.next_billing_date || ''
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
    clients: groupedQuotes.length,
    inProgress: quotes.filter(q => q.status === 'in_progress').length,
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
          <button onClick={() => openAddModal()} className="flex items-center gap-2 px-4 py-2 bg-brand-primary-500 text-white rounded-lg hover:bg-brand-primary-600">
            <Plus className="w-4 h-4" /> 新增報價
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <p className="text-sm text-gray-500">客戶數</p>
          <p className="text-2xl font-bold">{stats.clients}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <p className="text-sm text-gray-500">總品項數</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <p className="text-sm text-gray-500">進行中</p>
          <p className="text-2xl font-bold text-orange-600">{stats.inProgress}</p>
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
                onClick={() => handleStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm ${statusFilter === s ? 'bg-brand-primary-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                {s === 'all' ? '全部' : statusConfig[s]?.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => handleTypeFilter(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm bg-white"
            >
              <option value="all">所有類型</option>
              {Object.entries(projectTypeConfig).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={clientFilter}
              onChange={(e) => handleClientFilter(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm bg-white"
            >
              <option value="all">所有客戶</option>
              {clientList.map(client => (
                <option key={client} value={client}>{client}</option>
              ))}
            </select>
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

      <div className="space-y-4">
        {groupedQuotes.length === 0 && !isLoading && (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            尚無資料
          </div>
        )}

        {groupedQuotes.map(group => {
          const isExpanded = expandedClients.has(group.client_name);

          return (
            <div key={group.client_name} className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div
                className="px-4 py-3 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                onClick={() => toggleClient(group.client_name)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                  <span className="font-semibold text-gray-900">{group.client_name}</span>
                  <span className="text-sm text-gray-500">({group.items.length} 個品項)</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); openAddModal(group.client_name); }}
                  className="px-2 py-1 text-brand-primary-600 hover:bg-brand-primary-50 rounded"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">日期</th>
                        <th className="px-4 py-2 text-left">類型</th>
                        <th className="px-4 py-2 text-left">需求品項</th>
                        <th className="px-4 py-2 text-left">製作單位</th>
                        <th className="px-4 py-2 text-right">成本價</th>
                        <th className="px-4 py-2 text-right">報價</th>
                        <th className="px-4 py-2 text-right">毛利</th>
                        <th className="px-4 py-2 text-center">請款</th>
                        <th className="px-4 py-2 text-center">狀況</th>
                        <th className="px-4 py-2 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {group.items.map(quote => {
                        const profit = (quote.selling_price || 0) - (quote.cost_price || 0);
                        const sConfig = statusConfig[quote.status] || { label: quote.status, color: 'text-gray-600', bg: 'bg-gray-100' };
                        const tConfig = projectTypeConfig[quote.project_type || 'quote'] || projectTypeConfig.quote;

                        return (
                          <tr key={quote.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600">{quote.quote_date}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${tConfig.bg} ${tConfig.color}`}>{tConfig.label}</span>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium max-w-xs truncate" title={quote.project_item}>{quote.project_item}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{quote.vendor_name || '-'}</td>
                            <td className="px-4 py-3 text-sm text-right text-orange-600">{quote.cost_price ? `$${quote.cost_price.toLocaleString()}` : '-'}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-blue-600">{quote.selling_price ? `$${quote.selling_price.toLocaleString()}` : '-'}</td>
                            <td className={`px-4 py-3 text-sm text-right font-medium ${profit > 0 ? 'text-green-600' : profit < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {quote.selling_price || quote.cost_price ? `$${profit.toLocaleString()}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-center text-xs">
                              {quote.billing_cycle || quote.next_billing_date ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  {quote.billing_cycle && <span className="text-gray-500">{billingCycleConfig[quote.billing_cycle]}</span>}
                                  {quote.next_billing_date && <span className="text-purple-600 font-medium">{quote.next_billing_date}</span>}
                                </div>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-xs ${sConfig.bg} ${sConfig.color}`}>{sConfig.label}</span>
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
                      {group.show_subtotal && (
                        <tr className="bg-gray-50 font-medium">
                          <td colSpan={4} className="px-4 py-3 text-right text-gray-600">合計</td>
                          <td className="px-4 py-3 text-right text-orange-600">${group.totalCost.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-blue-600">${group.totalSelling.toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right ${group.totalProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>${group.totalProfit.toLocaleString()}</td>
                          <td colSpan={3}></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">{editingQuote ? '編輯報價' : '新增報價'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">客戶名稱 *</label>
                  <input
                    type="text"
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                    list="client-list"
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="輸入或選擇客戶"
                  />
                  <datalist id="client-list">
                    {clientList.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">日期</label>
                  <input type="date" value={form.quote_date} onChange={(e) => setForm({ ...form, quote_date: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">專案類型</label>
                  <select value={form.project_type} onChange={(e) => setForm({ ...form, project_type: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                    {Object.entries(projectTypeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">狀況</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                    {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">需求品項 *</label>
                <input type="text" value={form.project_item} onChange={(e) => setForm({ ...form, project_item: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="網站設計、SEO、廣告投放..." />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">製作單位</label>
                <input type="text" value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="外包廠商名稱" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">成本價</label>
                  <input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">智慧媽咪報價</label>
                  <input type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="0" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">成本備註</label>
                  <input type="text" value={form.cost_note} onChange={(e) => setForm({ ...form, cost_note: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="成本細節說明" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">報價備註</label>
                  <input type="text" value={form.selling_note} onChange={(e) => setForm({ ...form, selling_note: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="報價細節說明" />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> 請款資訊
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">請款週期</label>
                    <select value={form.billing_cycle} onChange={(e) => setForm({ ...form, billing_cycle: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                      <option value="">不設定</option>
                      {Object.entries(billingCycleConfig).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">下次請款日</label>
                    <input type="date" value={form.next_billing_date} onChange={(e) => setForm({ ...form, next_billing_date: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="show_subtotal"
                    checked={form.show_subtotal}
                    onChange={(e) => setForm({ ...form, show_subtotal: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="show_subtotal" className="text-sm text-gray-600">顯示該客戶的合計</label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">其他備註</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={2} />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3 sticky bottom-0 bg-white">
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