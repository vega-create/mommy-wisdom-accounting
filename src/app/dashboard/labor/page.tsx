'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import {
  Plus,
  Search,
  Filter,
  Download,
  FileCheck,
  Clock,
  CheckCircle2,
  Banknote,
  Send,
  MoreHorizontal,
  Eye,
  Copy,
  Trash2,
  AlertCircle,
  Users,
  Building2,
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

// 模擬資料
const mockLaborReports = [
  {
    id: '1',
    report_number: 'LR-2026-0001',
    staff_name: '王小明',
    staff_type: 'external',
    is_union_member: false,
    income_type_code: '50',
    work_description: '1月份SEO優化服務',
    service_period_start: '2026-01-01',
    service_period_end: '2026-01-31',
    gross_amount: 30000,
    withholding_tax: 3000,
    nhi_premium: 633,
    net_amount: 26367,
    status: 'signed',
    billing_request_number: 'BR-2026-0015',
    created_at: '2026-01-20',
  },
  {
    id: '2',
    report_number: 'LR-2026-0002',
    staff_name: '李小華',
    staff_type: 'external',
    is_union_member: true,
    income_type_code: '9B',
    work_description: '產品攝影',
    service_period_start: '2026-01-15',
    service_period_end: '2026-01-15',
    gross_amount: 15000,
    withholding_tax: 0,
    nhi_premium: 0,
    net_amount: 15000,
    status: 'pending',
    billing_request_number: null,
    created_at: '2026-01-22',
  },
  {
    id: '3',
    report_number: 'LR-2026-0003',
    staff_name: '張美玲',
    staff_type: 'internal',
    is_union_member: false,
    income_type_code: '50',
    work_description: '行政作業支援',
    service_period_start: '2026-01-01',
    service_period_end: '2026-01-31',
    gross_amount: 25000,
    withholding_tax: 2500,
    nhi_premium: 528,
    net_amount: 21972,
    status: 'paid',
    billing_request_number: null,
    created_at: '2026-01-18',
  },
];

export default function LaborReportsPage() {
  const { company } = useAuthStore();
  const [laborReports, setLaborReports] = useState(mockLaborReports);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [staffTypeFilter, setStaffTypeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 篩選邏輯
  const filteredReports = laborReports.filter(report => {
    const matchSearch = report.staff_name.includes(searchTerm) ||
                       report.report_number.includes(searchTerm) ||
                       report.work_description.includes(searchTerm);
    const matchStatus = statusFilter === 'all' || report.status === statusFilter;
    const matchStaffType = staffTypeFilter === 'all' || report.staff_type === staffTypeFilter;
    return matchSearch && matchStatus && matchStaffType;
  });

  // 統計數據
  const stats = {
    total: laborReports.length,
    pending: laborReports.filter(r => r.status === 'pending').length,
    signed: laborReports.filter(r => r.status === 'signed').length,
    totalAmount: laborReports.reduce((sum, r) => sum + r.net_amount, 0),
  };

  // 複製簽署連結
  const copySignUrl = (reportNumber: string) => {
    const url = `${window.location.origin}/sign/${reportNumber}`;
    navigator.clipboard.writeText(url);
    alert('簽署連結已複製！');
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
            外包人員
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
              <p className="text-sm text-gray-500">本月實付總額</p>
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
        <div className="flex flex-col md:flex-row gap-4">
          {/* 搜尋框 */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋姓名、單號、工作內容..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* 狀態篩選 */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-full md:w-40"
          >
            <option value="all">全部狀態</option>
            <option value="draft">草稿</option>
            <option value="pending">待簽名</option>
            <option value="signed">已簽名</option>
            <option value="paid">已付款</option>
            <option value="cancelled">已取消</option>
          </select>

          {/* 人員類型篩選 */}
          <select
            value={staffTypeFilter}
            onChange={(e) => setStaffTypeFilter(e.target.value)}
            className="input-field w-full md:w-40"
          >
            <option value="all">全部人員</option>
            <option value="internal">內部人員</option>
            <option value="external">外部人員</option>
          </select>

          {/* 匯出按鈕 */}
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            匯出 CSV
          </button>
        </div>
      </div>

      {/* 勞報單列表 */}
      <div className="brand-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brand-primary-50 border-b border-brand-primary-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary-700 uppercase">
                  單號
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary-700 uppercase">
                  人員
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary-700 uppercase">
                  服務內容
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary-700 uppercase">
                  服務期間
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-brand-primary-700 uppercase">
                  應稅所得
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-brand-primary-700 uppercase">
                  扣繳/健保
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-brand-primary-700 uppercase">
                  實付金額
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-brand-primary-700 uppercase">
                  狀態
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-brand-primary-700 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReports.map((report) => {
                const StatusIcon = statusConfig[report.status as keyof typeof statusConfig].icon;
                return (
                  <tr key={report.id} className="hover:bg-brand-primary-50/50 transition-colors">
                    <td className="px-4 py-4">
                      <Link 
                        href={`/dashboard/labor/${report.id}`}
                        className="font-medium text-brand-primary-700 hover:underline"
                      >
                        {report.report_number}
                      </Link>
                      {report.billing_request_number && (
                        <p className="text-xs text-gray-500 mt-1">
                          關聯：{report.billing_request_number}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{report.staff_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${staffTypeConfig[report.staff_type as keyof typeof staffTypeConfig].color}`}>
                          {staffTypeConfig[report.staff_type as keyof typeof staffTypeConfig].label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          所得類別：{report.income_type_code}
                        </span>
                        {report.is_union_member && (
                          <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                            工會
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-gray-900 line-clamp-2">{report.work_description}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      <p>{report.service_period_start}</p>
                      <p>~ {report.service_period_end}</p>
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
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[report.status as keyof typeof statusConfig].color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig[report.status as keyof typeof statusConfig].label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/dashboard/labor/${report.id}`}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="查看詳情"
                        >
                          <Eye className="w-4 h-4 text-gray-600" />
                        </Link>
                        {report.status === 'pending' && (
                          <button
                            onClick={() => copySignUrl(report.report_number)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="複製簽署連結"
                          >
                            <Copy className="w-4 h-4 text-gray-600" />
                          </button>
                        )}
                        {report.status === 'draft' && (
                          <button
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredReports.length === 0 && (
          <div className="text-center py-12">
            <FileCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">沒有找到符合條件的勞報單</p>
            <Link
              href="/dashboard/labor/new"
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              新增第一筆勞報單
            </Link>
          </div>
        )}
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
    </div>
  );
}
