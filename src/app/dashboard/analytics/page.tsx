'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDataStore } from '@/stores/dataStore';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
  AreaChart, Area,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon, BarChart3, Calendar, LineChartIcon, AreaChartIcon } from 'lucide-react';

// 顏色設定
const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

// 快速日期範圍
const dateRangePresets = [
  { label: '本月', key: 'this-month', getValue: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
  { label: '上月', key: 'last-month', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: '近3個月', key: '3-months', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 2)), end: endOfMonth(new Date()) }) },
  { label: '近6個月', key: '6-months', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 5)), end: endOfMonth(new Date()) }) },
  { label: '今年', key: 'this-year', getValue: () => ({ start: startOfYear(new Date()), end: new Date() }) },
];

// 圖表類型
type ChartType = 'line' | 'bar' | 'area';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function AnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { transactions, customers } = useDataStore();

  // 從 URL 讀取參數
  const urlPeriod = searchParams.get('period') || '6-months';
  const urlChartType = (searchParams.get('chart') || 'line') as ChartType;
  const urlStartDate = searchParams.get('start') || '';
  const urlEndDate = searchParams.get('end') || '';

  const [activePeriod, setActivePeriod] = useState(urlPeriod);
  const [chartType, setChartType] = useState<ChartType>(urlChartType);
  const [customStart, setCustomStart] = useState(urlStartDate);
  const [customEnd, setCustomEnd] = useState(urlEndDate);

  // 計算日期範圍
  const dateRange = useMemo(() => {
    if (activePeriod === 'custom' && customStart && customEnd) {
      return {
        start: parseISO(customStart),
        end: parseISO(customEnd),
      };
    }
    const preset = dateRangePresets.find(p => p.key === activePeriod) || dateRangePresets[3];
    return preset.getValue();
  }, [activePeriod, customStart, customEnd]);

  // 更新 URL 參數
  const updateURL = (period: string, chart: ChartType, start?: string, end?: string) => {
    const params = new URLSearchParams();
    params.set('period', period);
    params.set('chart', chart);
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    router.replace(`/dashboard/analytics?${params.toString()}`, { scroll: false });
  };

  // 處理期間變更
  const handlePeriodChange = (preset: typeof dateRangePresets[0]) => {
    setActivePeriod(preset.key);
    setCustomStart('');
    setCustomEnd('');
    updateURL(preset.key, chartType);
  };

  // 處理自訂日期變更
  const handleCustomDateChange = (start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
    if (start && end) {
      setActivePeriod('custom');
      updateURL('custom', chartType, start, end);
    }
  };

  // 處理圖表類型變更
  const handleChartTypeChange = (type: ChartType) => {
    setChartType(type);
    updateURL(activePeriod, type, customStart, customEnd);
  };

  // 篩選期間內的交易
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const date = parseISO(t.transaction_date);
      return date >= dateRange.start && date <= dateRange.end;
    });
  }, [transactions, dateRange]);

  // 計算總收入/支出
  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.transaction_type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredTransactions
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + t.amount + (t.fee_amount || 0), 0);
    return { income, expense, net: income - expense };
  }, [filteredTransactions]);

  // 每月收入/支出趨勢
  const monthlyTrend = useMemo(() => {
    const months: Record<string, { month: string; income: number; expense: number }> = {};
    
    filteredTransactions.forEach(t => {
      const monthKey = format(parseISO(t.transaction_date), 'yyyy-MM');
      const monthLabel = format(parseISO(t.transaction_date), 'M月', { locale: zhTW });
      
      if (!months[monthKey]) {
        months[monthKey] = { month: monthLabel, income: 0, expense: 0 };
      }
      
      if (t.transaction_type === 'income') {
        months[monthKey].income += t.amount;
      } else if (t.transaction_type === 'expense') {
        months[monthKey].expense += t.amount + (t.fee_amount || 0);
      }
    });
    
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => data);
  }, [filteredTransactions]);

  // 收入來源（按客戶）
  const incomeByCustomer = useMemo(() => {
    const byCustomer: Record<string, number> = {};
    
    filteredTransactions
      .filter(t => t.transaction_type === 'income')
      .forEach(t => {
        const customer = customers.find(c => c.id === t.customer_id);
        const name = customer?.short_name || customer?.name || '未分類';
        byCustomer[name] = (byCustomer[name] || 0) + t.amount;
      });
    
    return Object.entries(byCustomer)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredTransactions, customers]);

  // 支出分類
  const expenseByCategory = useMemo(() => {
    const byCategory: Record<string, number> = {};
    
    filteredTransactions
      .filter(t => t.transaction_type === 'expense')
      .forEach(t => {
        const category = t.description?.split('-')[0]?.trim() || '其他支出';
        byCategory[category] = (byCategory[category] || 0) + t.amount + (t.fee_amount || 0);
      });
    
    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredTransactions]);

  // 渲染趨勢圖
  const renderTrendChart = () => {
    if (monthlyTrend.length === 0) {
      return (
        <div className="h-[300px] flex items-center justify-center text-gray-400">
          此期間沒有交易資料
        </div>
      );
    }

    const commonProps = {
      data: monthlyTrend,
    };

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="income" name="收入" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="支出" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Area type="monotone" dataKey="income" name="收入" stroke="#10B981" fill="#10B98133" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" name="支出" stroke="#EF4444" fill="#EF444433" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="income" name="收入" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', strokeWidth: 2 }} />
              <Line type="monotone" dataKey="expense" name="支出" stroke="#EF4444" strokeWidth={3} dot={{ fill: '#EF4444', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📊 數據分析</h1>
        <p className="text-gray-500 mt-1">查看收入支出趨勢與分析</p>
      </div>

      {/* 時間篩選 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">選擇期間</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {dateRangePresets.map((preset) => (
            <button
              key={preset.key}
              onClick={() => handlePeriodChange(preset)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                activePeriod === preset.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={() => setActivePeriod('custom')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              activePeriod === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            自訂
          </button>
        </div>
        
        {/* 自訂日期選擇 */}
        {activePeriod === 'custom' && (
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <input
              type="date"
              value={customStart}
              onChange={(e) => handleCustomDateChange(e.target.value, customEnd)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-gray-400">至</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => handleCustomDateChange(customStart, e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}
        
        <p className="text-xs text-gray-400 mt-2">
          {format(dateRange.start, 'yyyy/MM/dd')} ~ {format(dateRange.end, 'yyyy/MM/dd')}
        </p>
      </div>

      {/* 總覽卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-600">總收入</span>
          </div>
          <p className="text-3xl font-bold text-green-700">{formatCurrency(totals.income)}</p>
          <p className="text-xs text-green-600 mt-1">
            {filteredTransactions.filter(t => t.transaction_type === 'income').length} 筆交易
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-600">總支出</span>
          </div>
          <p className="text-3xl font-bold text-red-700">{formatCurrency(totals.expense)}</p>
          <p className="text-xs text-red-600 mt-1">
            {filteredTransactions.filter(t => t.transaction_type === 'expense').length} 筆交易
          </p>
        </div>

        <div className={`${totals.net >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border rounded-xl p-5`}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className={`w-5 h-5 ${totals.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
            <span className={`text-sm font-medium ${totals.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>淨利潤</span>
          </div>
          <p className={`text-3xl font-bold ${totals.net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            {totals.net >= 0 ? '+' : ''}{formatCurrency(totals.net)}
          </p>
          <p className={`text-xs mt-1 ${totals.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            利潤率 {totals.income > 0 ? ((totals.net / totals.income) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* 收入/支出趨勢圖 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">收入/支出趨勢</h2>
          </div>
          
          {/* 圖表類型切換 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleChartTypeChange('line')}
              className={`p-2 rounded-md transition-colors ${
                chartType === 'line' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
              title="折線圖"
            >
              <LineChartIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleChartTypeChange('bar')}
              className={`p-2 rounded-md transition-colors ${
                chartType === 'bar' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
              title="長條圖"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleChartTypeChange('area')}
              className={`p-2 rounded-md transition-colors ${
                chartType === 'area' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
              title="面積圖"
            >
              <AreaChartIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {renderTrendChart()}
      </div>

      {/* 圓餅圖區塊 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 收入來源 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">收入來源</h2>
          </div>
          {incomeByCustomer.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={incomeByCustomer}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {incomeByCustomer.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {incomeByCustomer.slice(0, 5).map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-gray-600">{item.name}</span>
                    </div>
                    <span className="font-medium text-gray-900">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">
              此期間沒有收入資料
            </div>
          )}
        </div>

        {/* 支出分類 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">支出分類</h2>
          </div>
          {expenseByCategory.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={expenseByCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" stroke="#6B7280" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="name" stroke="#6B7280" fontSize={12} width={80} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="value" name="支出" radius={[0, 4, 4, 0]}>
                    {expenseByCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 text-sm text-gray-500">
                共 {expenseByCategory.length} 個支出分類
              </div>
            </>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">
              此期間沒有支出資料
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
