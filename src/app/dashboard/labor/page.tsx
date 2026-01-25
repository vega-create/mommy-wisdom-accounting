'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { 
  FileCheck, ExternalLink, Check, Clock, AlertCircle,
  RefreshCw, User, DollarSign, FileText, Send
} from 'lucide-react';

interface LaborReport {
  id: string;
  report_number: string;
  staff_id?: string;
  staff_name: string;
  staff_type: 'internal' | 'external';
  id_number?: string;
  service_date: string;
  service_description: string;
  gross_amount: number;
  tax_amount: number;
  health_insurance: number;
  net_amount: number;
  income_type?: string;
  status: 'draft' | 'pending' | 'signed' | 'paid' | 'cancelled';
  signature_url?: string;
  signed_at?: string;
  paid_at?: string;
  payable_id?: string;
  is_union_member?: boolean;
  created_at: string;
}

// 所得類別名稱
const INCOME_TYPE_NAMES: Record<string, string> = {
  '50': '兼職所得 (50)',
  '9A': '執行業務所得 (9A)',
  '9B': '稿費 (9B)',
  '92': '其他所得 (92)',
};

export default function LaborReportsPage() {
  const { company } = useAuthStore();
  const [reports, setReports] = useState<LaborReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 載入勞報單列表
  useEffect(() => {
    if (company?.id) {
      loadReports();
    }
  }, [company?.id, statusFilter]);

  const loadReports = async () => {
    if (!company?.id) return;
    setIsLoading(true);
    try {
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const response = await fetch(`/api/labor-reports?company_id=${company.id}${statusParam}`);
      const result = await response.json();
      if (result.data) {
        setReports(result.data);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 統計
  const stats = {
    draft: reports.filter(r => r.status === 'draft').length,
    pending: reports.filter(r => r.status === 'pending').length,
    signed: reports.filter(r => r.status === 'signed').length,
    paid: reports.filter(r => r.status === 'paid').length,
    totalPending: reports.filter(r => r.status === 'signed')
      .reduce((sum, r) => sum + r.net_amount, 0)
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: '草稿', color: 'text-gray-600', bg: 'bg-gray-100' },
    pending: { label: '待簽署', color: 'text-orange-600', bg: 'bg-orange-100' },
    signed: { label: '已簽署', color: 'text-blue-600', bg: 'bg-blue-100' },
    paid: { label: '已付款', color: 'text-green-600', bg: 'bg-green-100' },
    cancelled: { label: '已取消', color: 'text-red-600', bg: 'bg-red-100' }
  };

  // 開啟原勞報單系統
  const openLaborSystem = () => {
    window.open('https://labor-report.vercel.app', '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">勞報管理</h1>
          <p className="text-gray-500 mt-1">查看勞報單、追蹤簽署與付款狀態</p>
        </div>
        <button 
          onClick={openLaborSystem} 
          className="btn-primary flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          開啟勞報單系統
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
              <p className="text-sm text-gray-500">草稿</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Send className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
              <p className="text-sm text-gray-500">待簽署</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Check className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.signed}</p>
              <p className="text-sm text-gray-500">已簽署待付</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
              <p className="text-sm text-gray-500">已付款</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-red-600">NT$ {stats.totalPending.toLocaleString()}</p>
              <p className="text-sm text-gray-500">待付總額</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          {['all', 'draft', 'pending', 'signed', 'paid'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-brand-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? '全部' : statusConfig[status].label}
            </button>
          ))}
          <div className="ml-auto">
            <button onClick={loadReports} className="p-2 hover:bg-gray-100 rounded-lg">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">勞報單系統整合說明</h4>
            <ul className="text-sm text-blue-700 mt-1 space-y-1">
              <li>• 新增/編輯勞報單請點擊右上角「開啟勞報單系統」</li>
              <li>• 當對方簽署完成，會自動建立應付款項</li>
              <li>• 在「應付管理」確認付款後，勞報單狀態會自動更新</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">勞報單號</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">領款人</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">所得類別</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">勞務說明</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">稅前</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">扣繳</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">實付</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600">狀態</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600">應付</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  載入中...
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  <div className="mb-4">尚無勞報單</div>
                  <button 
                    onClick={openLaborSystem}
                    className="text-brand-primary-600 hover:text-brand-primary-700"
                  >
                    前往勞報單系統建立
                  </button>
                </td>
              </tr>
            ) : (
              reports.map(report => {
                const config = statusConfig[report.status] || statusConfig.draft;
                const totalDeduction = (report.tax_amount || 0) + (report.health_insurance || 0);
                
                return (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm">{report.report_number}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(report.service_date).toLocaleDateString('zh-TW')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{report.staff_name}</span>
                      </div>
                      {report.is_union_member && (
                        <span className="text-xs text-purple-600">工會會員</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {INCOME_TYPE_NAMES[report.income_type || '9A'] || report.income_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm max-w-xs truncate">{report.service_description}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm">NT$ {report.gross_amount.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {totalDeduction > 0 ? (
                        <span className="text-sm text-red-600">
                          -NT$ {totalDeduction.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-green-600">
                        NT$ {report.net_amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                      {report.signed_at && (
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(report.signed_at).toLocaleDateString('zh-TW')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {report.payable_id ? (
                        <a 
                          href="/dashboard/payables"
                          className="text-blue-600 hover:text-blue-800 text-xs"
                        >
                          已建立
                        </a>
                      ) : report.status === 'signed' ? (
                        <span className="text-orange-600 text-xs">待建立</span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
