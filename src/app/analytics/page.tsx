'use client';

import { useState, useMemo } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon, BarChart3, Calendar } from 'lucide-react';

// 顏色設定
const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

// 快速日期範圍
const dateRangePresets = [
  { label: '本月', getValue: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
  { label: '上月', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: '近3個月', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 2)), end: endOfMonth(new Date()) }) },
  { label: '近6個月', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 5)), end: endOfMonth(new Date()) }) },
  { label: '今年', getValue: () => ({ start: startOfYear(new Date()), end: new Date() }) },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function AnalyticsPage() {
  const { transactions, customers } = useDataStore();
  
  const [dateRange, setDateRange] = useState(() => {
    const preset = dateRangePresets[4]; // 預設今年
    return preset.getValue();
  });
  const [activePeriod, setActivePeriod] = useState('今年');

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
      .slice(0, 8); // 取前8名
  }, [filteredTransactions, customers]);

  // 支出分類
  const expenseByCategory = useMemo(() => {
    const byCategory: Record<string, number> = {};
    
    filteredTransactions
      .filter(t => t.transaction_type === 'expense')
      .forEach(t => {
        // 從描述中取得分類，或用預設
        const category = t.description?.split('-')[0]?.trim() || '其他支出';
        byCategory[category] = (byCategory[category] || 0) + t.amount + (t.fee_amount || 0);
      });
    
    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredTransactions]);

  const handleDateRangeChange = (preset: typeof dateRangePresets[0]) => {
    setDateRange(preset.getValue());
    setActivePeriod(preset.label);
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
        <div className="flex flex-wrap gap-2">
          {dateRangePresets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleDateRangeChange(preset)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                activePeriod === preset.label
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
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
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">收入/支出趨勢</h2>
        </div>
        {monthlyTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                labelStyle={{ color: '#374151' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="income" 
                name="收入" 
                stroke="#10B981" 
                strokeWidth={3}
                dot={{ fill: '#10B981', strokeWidth: 2 }}
              />
              <Line 
                type="monotone" 
                dataKey="expense" 
                name="支出" 
                stroke="#EF4444" 
                strokeWidth={3}
                dot={{ fill: '#EF4444', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-400">
            此期間沒有交易資料
          </div>
        )}
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
