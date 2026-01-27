'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import {
  Plus,
  Search,
  Download,
  FileCheck,
  Clock,
  CheckCircle2,
  Banknote,
  Send,
  Eye,
  Edit2,
  Trash2,
  AlertCircle,
  Users,
  RefreshCw,
  Calendar,
  X,
  Copy,
} from 'lucide-react';

// 勞報單狀態配置
const statusConfig = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-700', icon: Clock },
  pending: { label: '待簽名', color: 'bg-yellow-100 text-yellow-700', icon: Send },
  signed: { label: '已簽名', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  paid: { label: '已付款', color: 'bg-green-100 text-green-700', icon: Banknote },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

// 人員類型配置
const staffTypeConfig = {
  internal: { label: '內部人員', color: 'bg-purple-100 text-purple-700' },
  external: { label: '外部人員', color: 'bg-brand-primary-100 text-brand-primary-700' },
};

interface LaborReport {
  id: string;
  report_number: string;
  staff_name: string;
  staff_type: string;
  is_union_member: boolean;
  income_type_code: string;
  work_description: string;
  service_period_start: string;
  service_period_end: string;
  gross_amount: number;
  withholding_tax: number;
  nhi_premium: number;
  net_amount: number;
  status: string;
  sign_token?: string;
  sign_url?: string;
  billing_request?: {
    id: string;
    billing_number: string;
  };
  created_at: string;
}

export default function LaborReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const url_status = searchParams.get('status') || 'all';
  const url_type = searchParams.get('type') || 'all';
  const url_from = searchParams.get('from') || '';
  const url_to = searchParams.get('to') || '';

  // 更新 URL 參數
  const updateURL = (statusFilter: string, staffTypeFilter: string, dateFrom: string, dateTo: string) => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (staffTypeFilter) params.set('type', staffTypeFilter);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    router.replace(`/dashboard/labor?${params.toString()}`, { scroll: false });
  };

  const { company } = useAuthStore();
  const [laborReports, setLaborReports] = useState<LaborReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(url_status);
  const [staffTypeFilter, setStaffTypeFilter] = useState<string>(url_type);

  // 時間篩選
  const [dateFrom, setDateFrom] = useState(url_from);
  const [dateTo, setDateTo] = useState(url_to);

  // 刪除確認
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 載入資料
  const loadReports = async () => {
    if (!company?.id) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({ company_id: company.id });
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (staffTypeFilter !== 'all') params.append('staff_type', staffTypeFilter);

      const res = await fetch(`/api/labor-reports?${params}`);
      const json = await res.json();

      if (json.data) {
        setLaborReports(json.data);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [company?.id, statusFilter, staffTypeFilter]);

  // 篩選邏輯（含時間）
  const filteredReports = laborReports.filter(report => {
    const matchSearch = !searchTerm ||
      report.staff_name.includes(searchTerm) ||
      report.report_number.includes(searchTerm) ||
      (report.work_description && report.work_description.includes(searchTerm));

    // 時間篩選
    let matchDate = true;
    if (dateFrom) {
      matchDate = matchDate && report.created_at >= dateFrom;
    }
    if (dateTo) {
      matchDate = matchDate && report.created_at <= dateTo + 'T23:59:59';
    }

    return matchSearch && matchDate;
  });

  // 統計數據
  const stats = {
    total: filteredReports.length,
    pending: filteredReports.filter(r => r.status === 'pending').length,
    signed: filteredReports.filter(r => r.status === 'signed').length,
    totalAmount: filteredReports.reduce((sum, r) => sum + r.net_amount, 0),
  };

  // 刪除勞報單
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/labor-reports/${id}`, { method: 'DELETE' });
      const json = await res.json();

      if (json.success) {
        setLaborReports(prev => prev.filter(r => r.id !== id));
        setDeleteId(null);
      } else {
        alert(json.error || '刪除失敗');
      }
    } catch (error) {
      alert('刪除失敗');
    }
  };

  // 匯出 CSV
  const handleExport = () => {
    const headers = ['單號', '姓名', '人員類型', '所得類別', '服務內容', '服務期間起', '服務期間迄', '應稅所得', '扣繳稅額', '二代健保', '實付金額', '狀態', '建立日期'];
    const rows = filteredReports.map(r => [
      r.report_number,
      r.staff_name,
      r.staff_type === 'external' ? '外部人員' : '內部人員',
      r.income_type_code,
      r.work_description || '',
      r.service_period_start || '',
      r.service_period_end || '',
      r.gross_amount,
      r.withholding_tax,
      r.nhi_premium,
      r.net_amount,
      statusConfig[r.status as keyof typeof statusConfig]?.label || r.status,
      r.created_at.split('T')[0],
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `勞報單_${dateFrom || 'all'}_${dateTo || 'all'}.csv`;
    link.click();
  };

  // 格式化金額
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('zh-TW').format(amount);
  };

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">勞報單管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理外包人員勞報單、線上簽署、稅務計算</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/labor/freelancers"
            className="btn-secondary flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            人員管理
          </Link>
          <Link
            href="/dashboard/labor/new"
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新增勞報單
          </Link>
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">總勞報單數</p>
              <p className="stats-value">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-brand-primary-100 rounded-xl flex items-center justify-center">
              <FileCheck className="w-6 h-6 text-brand-primary-700" />
            </div>
          </div>
        </div>
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">待簽名</p>
              <p className="stats-value text-yellow-600">{stats.pending}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">已簽名待付款</p>
              <p className="stats-value text-blue-600">{stats.signed}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">篩選結果總額</p>
              <p className="stats-value text-green-600">
                ${formatAmount(stats.totalAmount)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Banknote className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 搜尋與篩選 */}
      <div className="brand-card p-4">
        <div className="flex flex-col gap-4">
          {/* 第一排：搜尋、狀態、人員類型 */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜尋姓名、單號、工作內容..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '2.75rem' }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); updateURL(e.target.value, staffTypeFilter, dateFrom, dateTo); }}
              className="input-field w-full md:w-40"
            >
              <option value="all">全部狀態</option>
              <option value="draft">草稿</option>
              <option value="pending">待簽名</option>
              <option value="signed">已簽名</option>
              <option value="paid">已付款</option>
              <option value="cancelled">已取消</option>
            </select>

            <select
              value={staffTypeFilter}
              onChange={(e) => { setStaffTypeFilter(e.target.value); updateURL(statusFilter, e.target.value, dateFrom, dateTo); }}
              className="input-field w-full md:w-40"
            >
              <option value="all">全部人員</option>
              <option value="internal">內部人員</option>
              <option value="external">外部人員</option>
            </select>

            <button
              onClick={loadReports}
              className="btn-secondary flex items-center gap-2"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              重整
            </button>
          </div>

          {/* 第二排：時間篩選、匯出 */}
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-500">期間：</span>
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); updateURL(statusFilter, staffTypeFilter, e.target.value, dateTo); }}
              className="input-field w-full md:w-40"
              placeholder="起始日期"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); updateURL(statusFilter, staffTypeFilter, dateFrom, e.target.value); }}
              className="input-field w-full md:w-40"
              placeholder="結束日期"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); updateURL(statusFilter, staffTypeFilter, '', ''); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                清除日期
              </button>
            )}
            <div className="ml-auto">
              <button
                onClick={handleExport}
                className="btn-secondary flex items-center gap-2"
                disabled={filteredReports.length === 0}
              >
                <Download className="w-4 h-4" />
                匯出 CSV ({filteredReports.length} 筆)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 勞報單列表 */}
      <div className="brand-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brand-primary-50 border-b border-brand-primary-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary-700 uppercase">單號</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary-700 uppercase">人員</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary-700 uppercase">服務內容</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary-700 uppercase">服務期間</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-brand-primary-700 uppercase">應稅所得</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-brand-primary-700 uppercase">扣繳/健保</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-brand-primary-700 uppercase">實付金額</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-brand-primary-700 uppercase">狀態</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-brand-primary-700 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">載入中...</p>
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <FileCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">沒有找到符合條件的勞報單</p>
                    <Link href="/dashboard/labor/new" className="btn-primary mt-4 inline-flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      新增第一筆勞報單
                    </Link>
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => {
                  const StatusIcon = statusConfig[report.status as keyof typeof statusConfig]?.icon || Clock;
                  return (
                    <tr key={report.id} className="hover:bg-brand-primary-50/50 transition-colors">
                      <td className="px-4 py-4">
                        <Link href={`/dashboard/labor/${report.id}`} className="font-medium text-brand-primary-700 hover:underline">
                          {report.report_number}
                        </Link>
                        {report.billing_request && (
                          <p className="text-xs text-gray-500 mt-1">關聯：{report.billing_request.billing_number}</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{report.staff_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${staffTypeConfig[report.staff_type as keyof typeof staffTypeConfig]?.color || 'bg-gray-100'}`}>
                            {staffTypeConfig[report.staff_type as keyof typeof staffTypeConfig]?.label || report.staff_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">所得類別：{report.income_type_code}</span>
                          {report.is_union_member && (
                            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">工會</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-gray-900 line-clamp-2">{report.work_description || '-'}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {report.service_period_start ? (
                          <>
                            <p>{report.service_period_start}</p>
                            <p>~ {report.service_period_end}</p>
                          </>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-gray-900">
                        ${formatAmount(report.gross_amount)}
                      </td>
                      <td className="px-4 py-4 text-right text-sm">
                        <p className="text-red-600">-${formatAmount(report.withholding_tax)}</p>
                        <p className="text-orange-600">-${formatAmount(report.nhi_premium)}</p>
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-brand-primary-700">
                        ${formatAmount(report.net_amount)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[report.status as keyof typeof statusConfig]?.color || 'bg-gray-100'}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusConfig[report.status as keyof typeof statusConfig]?.label || report.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <Link href={`/dashboard/labor/${report.id}`} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="查看詳情">
                            <Eye className="w-4 h-4 text-gray-600" />
                          </Link>
                          {report.sign_token && (
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}/sign/${report.sign_token}`;
                                navigator.clipboard.writeText(url);
                                alert('簽署連結已複製！');
                              }}
                              className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                              title="複製簽署連結"
                            >
                              <Copy className="w-4 h-4 text-blue-600" />
                            </button>
                          )}
                          {(report.status === 'draft' || report.status === 'pending') && (
                            <Link href={`/dashboard/labor/${report.id}/edit`} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="編輯">
                              <Edit2 className="w-4 h-4 text-gray-600" />
                            </Link>
                          )}
                          {report.status === 'draft' && (
                            <button onClick={() => setDeleteId(report.id)} className="p-2 hover:bg-red-100 rounded-lg transition-colors" title="刪除">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 提示訊息 */}
      <div className="bg-brand-primary-50 border border-brand-primary-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-brand-primary-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-brand-primary-800">
            <p className="font-medium mb-1">2025 年度稅率說明</p>
            <ul className="space-y-1 text-brand-primary-700">
              <li>• 執行業務所得 (50)：扣繳 10%</li>
              <li>• 稿費/講演鐘點費 (9B)：全年 18 萬內免稅，超過部分扣 10%</li>
              <li>• 二代健保補充保費：2.11%（起扣點 NT$20,010）</li>
              <li>• 工會成員免扣二代健保</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 刪除確認 Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">確認刪除</h3>
            <p className="text-gray-600 mb-6">確定要刪除此勞報單嗎？此操作無法復原。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">取消</button>
              <button onClick={() => handleDelete(deleteId)} className="btn-primary flex-1 bg-red-600 hover:bg-red-700">確認刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}