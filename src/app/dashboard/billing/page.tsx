'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import {
  FileText, Plus, Send, Check, Clock, AlertCircle, Edit2, Trash2, RefreshCw,
  DollarSign, Calendar, User, Building, X, ChevronDown, ChevronUp, Download,
  Filter, Search, CheckSquare, Square, Repeat
} from 'lucide-react';

interface BillingRequest {
  id: string;
  company_id: string;
  billing_number: string;
  billing_month?: string;
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_line_id?: string;
  customer_line_group_id?: string;
  customer_line_group_name?: string;
  title: string;
  description?: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  cost_amount?: number;
  cost_vendor_id?: string;
  cost_vendor_name?: string;
  payment_account_id?: string;
  due_date: string;
  status: 'draft' | 'sent' | 'pending' | 'paid' | 'overdue' | 'cancelled';
  paid_at?: string;
  paid_amount?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  line_sent_at?: string;
  line_message_id?: string;
  transaction_id?: string;
  recurring_billing_id?: string;
}

interface RecurringBilling {
  id: string;
  company_id: string;
  customer_id?: string;
  customer_name: string;
  customer_line_group_id?: string;
  customer_line_group_name?: string;
  title: string;
  description?: string;
  amount: number;
  tax_amount: number;
  cost_amount?: number;
  cost_vendor_id?: string;
  cost_vendor_name?: string;
  payment_account_id?: string;
  schedule_type: 'monthly' | 'quarterly' | 'yearly';
  schedule_day: number;
  schedule_month?: number;
  days_before_due: number;
  is_active: boolean;
  next_run_at?: string;
  last_run_at?: string;
  run_count: number;
  auto_send: boolean;
  message_template?: string;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  line_user_id?: string;
  line_group_id?: string;
  line_group_name?: string;
}

interface Vendor {
  id: string;
  name: string;
}

interface PaymentAccount {
  id: string;
  bank_code: string;
  bank_name: string;
  branch_name?: string;
  account_number: string;
  account_name: string;
  is_default: boolean;
}

interface LineGroup {
  id: string;
  group_id: string;
  group_name: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: '草稿', color: 'text-gray-600', bg: 'bg-gray-100' },
  sent: { label: '已發送', color: 'text-blue-600', bg: 'bg-blue-100' },
  pending: { label: '待付款', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  paid: { label: '已收款', color: 'text-green-600', bg: 'bg-green-100' },
  overdue: { label: '逾期', color: 'text-red-600', bg: 'bg-red-100' },
  cancelled: { label: '已取消', color: 'text-gray-400', bg: 'bg-gray-50' },
};

const scheduleTypeConfig: Record<string, string> = {
  monthly: '每月',
  quarterly: '每季',
  yearly: '每年',
};

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { company } = useAuthStore();

  // URL 參數
  const tabParam = searchParams.get('tab');
  const statusParam = searchParams.get('status') || 'all';
  const startDateParam = searchParams.get('start_date') || '';
  const endDateParam = searchParams.get('end_date') || '';

  const [billings, setBillings] = useState<BillingRequest[]>([]);
  const [recurringBillings, setRecurringBillings] = useState<RecurringBilling[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [lineGroups, setLineGroups] = useState<LineGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showRecurringList, setShowRecurringList] = useState(tabParam === 'recurring');
  const [editingBilling, setEditingBilling] = useState<BillingRequest | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<RecurringBilling | null>(null);
  const [statusFilter, setStatusFilter] = useState(statusParam);
  const [startDate, setStartDate] = useState(startDateParam);
  const [endDate, setEndDate] = useState(endDateParam);
  const [searchKeyword, setSearchKeyword] = useState('');

  // 批量選擇
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'batch'>('single');
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    customer_id: '',
    customer_name: '',
    customer_email: '',
    customer_line_id: '',
    customer_line_group_id: '',
    customer_line_group_name: '',
    title: '',
    description: '',
    amount: '',
    tax_amount: '0',
    billing_month: new Date().toISOString().slice(0, 7),
    due_date: '',
    cost_amount: '',
    cost_vendor_id: '',
    cost_vendor_name: '',
    payment_account_id: '',
  });

  const [recurringForm, setRecurringForm] = useState({
    customer_id: '',
    customer_name: '',
    customer_line_group_id: '',
    customer_line_group_name: '',
    title: '',
    description: '',
    amount: '',
    tax_amount: '0',
    cost_amount: '',
    cost_vendor_id: '',
    cost_vendor_name: '',
    payment_account_id: '',
    schedule_type: 'monthly' as 'monthly' | 'quarterly' | 'yearly',
    schedule_day: 1,
    schedule_month: 1,
    days_before_due: 14,
    auto_send: true,
    message_template: `【請款通知】
{客戶名稱} 您好，
{請款項目}費用請款如下：
請款金額：NT$ {金額}
付款期限：{到期日}
匯款資訊：
{匯款帳戶}
如已付款請忽略此通知，謝謝！
智慧媽咪國際 敬上`,
  });

  // 更新 URL 參數
  const updateUrlParams = (params: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    router.push(`/dashboard/billing?${newParams.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (company?.id) {
      fetchData();
    }
  }, [company?.id]);

  // 監聽篩選變化，更新 URL
  useEffect(() => {
    updateUrlParams({
      status: statusFilter !== 'all' ? statusFilter : '',
      start_date: startDate,
      end_date: endDate,
      tab: showRecurringList ? 'recurring' : '',
    });
  }, [statusFilter, startDate, endDate, showRecurringList]);

  const fetchData = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const [billingsRes, recurringRes, customersRes, vendorsRes, accountsRes, groupsRes] = await Promise.all([
        fetch(`/api/billing?company_id=${company.id}`),
        fetch(`/api/billing/recurring?company_id=${company.id}`),
        fetch(`/api/customers?company_id=${company.id}`),
        fetch(`/api/vendors?company_id=${company.id}`),
        fetch(`/api/payment-accounts?company_id=${company.id}`),
        fetch(`/api/line/groups?company_id=${company.id}`),
      ]);

      const [billingsData, recurringData, customersData, vendorsData, accountsData, groupsData] = await Promise.all([
        billingsRes.json(),
        recurringRes.json(),
        customersRes.json(),
        vendorsRes.json(),
        accountsRes.json(),
        groupsRes.json(),
      ]);

      setBillings(billingsData.data || []);
      setRecurringBillings(recurringData.data || []);
      setCustomers(customersData.data || []);
      setVendors(vendorsData.data || []);
      setPaymentAccounts(accountsData.data || []);
      setLineGroups(groupsData.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 篩選後的請款單
  const filteredBillings = useMemo(() => {
    return billings.filter(b => {
      // 狀態篩選
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;

      // 時間篩選
      if (startDate && b.created_at < startDate) return false;
      if (endDate && b.created_at > endDate + 'T23:59:59') return false;

      // 關鍵字搜尋
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase();
        return (
          b.billing_number.toLowerCase().includes(keyword) ||
          b.customer_name.toLowerCase().includes(keyword) ||
          b.title.toLowerCase().includes(keyword)
        );
      }

      return true;
    });
  }, [billings, statusFilter, startDate, endDate, searchKeyword]);

  // 全選/取消全選
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredBillings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBillings.map(b => b.id)));
    }
  };

  // 切換單筆選擇
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // 單筆刪除確認
  const confirmSingleDelete = (id: string) => {
    setSingleDeleteId(id);
    setDeleteTarget('single');
    setShowDeleteConfirm(true);
  };

  // 批量刪除確認
  const confirmBatchDelete = () => {
    if (selectedIds.size === 0) {
      alert('請先選擇要刪除的請款單');
      return;
    }
    setDeleteTarget('batch');
    setShowDeleteConfirm(true);
  };

  // 執行刪除
  const executeDelete = async () => {
    try {
      if (deleteTarget === 'single' && singleDeleteId) {
        const res = await fetch(`/api/billing?id=${singleDeleteId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('刪除失敗');
      } else if (deleteTarget === 'batch') {
        // 批量刪除
        const deletePromises = Array.from(selectedIds).map(id =>
          fetch(`/api/billing?id=${id}`, { method: 'DELETE' })
        );
        await Promise.all(deletePromises);
        setSelectedIds(new Set());
      }

      setShowDeleteConfirm(false);
      setSingleDeleteId(null);
      fetchData();
    } catch (error) {
      console.error('Delete error:', error);
      alert('刪除失敗');
    }
  };

  // 匯出 CSV
  const exportCSV = () => {
    const headers = ['請款單號', '日期', '客戶', '項目', '金額', '成本', '毛利', '到期日', '狀態'];
    const rows = filteredBillings.map(b => [
      b.billing_number,
      b.created_at.split('T')[0],
      b.customer_name,
      b.title,
      b.total_amount || 0,
      b.cost_amount || 0,
      (b.total_amount || 0) - (b.cost_amount || 0),
      b.due_date,
      statusConfig[b.status]?.label || b.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `請款單_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    if (!company?.id || !form.customer_name || !form.title || !form.amount) {
      alert('請填寫必要欄位');
      return;
    }

    try {
      const body = {
        company_id: company.id,
        customer_id: form.customer_id || null,
        customer_name: form.customer_name,
        customer_email: form.customer_email || null,
        customer_line_id: form.customer_line_id || null,
        customer_line_group_id: form.customer_line_group_id || null,
        customer_line_group_name: form.customer_line_group_name || null,
        title: form.title,
        description: form.description || null,
        amount: parseFloat(form.amount),
        tax_amount: parseFloat(form.tax_amount || '0'),
        billing_month: form.billing_month || null,
        due_date: form.due_date || null,
        cost_amount: form.cost_amount ? parseFloat(form.cost_amount) : null,
        cost_vendor_id: form.cost_vendor_id || null,
        cost_vendor_name: form.cost_vendor_name || null,
        payment_account_id: form.payment_account_id || null,
      };

      const res = await fetch('/api/billing', {
        method: editingBilling ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingBilling ? { id: editingBilling.id, ...body } : body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '儲存失敗');
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      alert(error.message || '儲存失敗');
    }
  };

  const handleSaveRecurring = async () => {
    if (!company?.id || !recurringForm.customer_name || !recurringForm.title || !recurringForm.amount) {
      alert('請填寫必要欄位');
      return;
    }

    try {
      const body = {
        company_id: company.id,
        customer_id: recurringForm.customer_id || null,
        customer_name: recurringForm.customer_name,
        customer_line_group_id: recurringForm.customer_line_group_id || null,
        customer_line_group_name: recurringForm.customer_line_group_name || null,
        title: recurringForm.title,
        description: recurringForm.description || null,
        amount: parseFloat(recurringForm.amount),
        tax_amount: parseFloat(recurringForm.tax_amount || '0'),
        cost_amount: recurringForm.cost_amount ? parseFloat(recurringForm.cost_amount) : null,
        cost_vendor_id: recurringForm.cost_vendor_id || null,
        cost_vendor_name: recurringForm.cost_vendor_name || null,
        payment_account_id: recurringForm.payment_account_id || null,
        schedule_type: recurringForm.schedule_type,
        schedule_day: recurringForm.schedule_day,
        schedule_month: recurringForm.schedule_month,
        days_before_due: recurringForm.days_before_due,
        auto_send: recurringForm.auto_send,
        message_template: recurringForm.message_template,
      };

      const res = await fetch('/api/billing/recurring', {
        method: editingRecurring ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRecurring ? { id: editingRecurring.id, ...body } : body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '儲存失敗');
      }

      setShowRecurringModal(false);
      resetRecurringForm();
      fetchData();
    } catch (error: any) {
      alert(error.message || '儲存失敗');
    }
  };

  const resetForm = () => {
    setEditingBilling(null);
    setForm({
      customer_id: '',
      customer_name: '',
      customer_email: '',
      customer_line_id: '',
      customer_line_group_id: '',
      customer_line_group_name: '',
      title: '',
      description: '',
      amount: '',
      tax_amount: '0',
      billing_month: new Date().toISOString().slice(0, 7),
      due_date: '',
      cost_amount: '',
      cost_vendor_id: '',
      cost_vendor_name: '',
      payment_account_id: '',
    });
  };

  const resetRecurringForm = () => {
    setEditingRecurring(null);
    setRecurringForm({
      customer_id: '',
      customer_name: '',
      customer_line_group_id: '',
      customer_line_group_name: '',
      title: '',
      description: '',
      amount: '',
      tax_amount: '0',
      cost_amount: '',
      cost_vendor_id: '',
      cost_vendor_name: '',
      payment_account_id: '',
      schedule_type: 'monthly',
      schedule_day: 1,
      schedule_month: 1,
      days_before_due: 14,
      auto_send: true,
      message_template: `【請款通知】
{客戶名稱} 您好，
{請款項目}費用請款如下：
請款金額：NT$ {金額}
付款期限：{到期日}
匯款資訊：
{匯款帳戶}
如已付款請忽略此通知，謝謝！
智慧媽咪國際 敬上`,
    });
  };

  const openEditModal = (billing: BillingRequest) => {
    setEditingBilling(billing);
    setForm({
      customer_id: billing.customer_id || '',
      customer_name: billing.customer_name,
      customer_email: billing.customer_email || '',
      customer_line_id: billing.customer_line_id || '',
      customer_line_group_id: billing.customer_line_group_id || '',
      customer_line_group_name: billing.customer_line_group_name || '',
      title: billing.title,
      description: billing.description || '',
      amount: billing.amount.toString(),
      tax_amount: (billing.tax_amount || 0).toString(),
      billing_month: billing.billing_month || '',
      due_date: billing.due_date || '',
      cost_amount: billing.cost_amount?.toString() || '',
      cost_vendor_id: billing.cost_vendor_id || '',
      cost_vendor_name: billing.cost_vendor_name || '',
      payment_account_id: billing.payment_account_id || '',
    });
    setShowModal(true);
  };

  const openEditRecurringModal = (recurring: RecurringBilling) => {
    setEditingRecurring(recurring);
    setRecurringForm({
      customer_id: recurring.customer_id || '',
      customer_name: recurring.customer_name,
      customer_line_group_id: recurring.customer_line_group_id || '',
      customer_line_group_name: recurring.customer_line_group_name || '',
      title: recurring.title,
      description: recurring.description || '',
      amount: recurring.amount.toString(),
      tax_amount: (recurring.tax_amount || 0).toString(),
      cost_amount: recurring.cost_amount?.toString() || '',
      cost_vendor_id: recurring.cost_vendor_id || '',
      cost_vendor_name: recurring.cost_vendor_name || '',
      payment_account_id: recurring.payment_account_id || '',
      schedule_type: recurring.schedule_type,
      schedule_day: recurring.schedule_day,
      schedule_month: recurring.schedule_month || 1,
      days_before_due: recurring.days_before_due || 14,
      auto_send: recurring.auto_send ?? true,
      message_template: recurring.message_template || `【請款通知】
{客戶名稱} 您好，
{請款項目}費用請款如下：
請款金額：NT$ {金額}
付款期限：{到期日}
匯款資訊：
{匯款帳戶}
如已付款請忽略此通知，謝謝！
智慧媽咪國際 敬上`,
    });
    setShowRecurringModal(true);
  };

  const handleCustomerSelect = (customerId: string, isRecurring = false) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      if (isRecurring) {
        setRecurringForm(prev => ({
          ...prev,
          customer_id: customer.id,
          customer_name: customer.name,
          customer_line_group_id: customer.line_group_id || '',
          customer_line_group_name: customer.line_group_name || '',
        }));
      } else {
        setForm(prev => ({
          ...prev,
          customer_id: customer.id,
          customer_name: customer.name,
          customer_email: customer.email || '',
          customer_line_id: customer.line_user_id || '',
          customer_line_group_id: customer.line_group_id || '',
          customer_line_group_name: customer.line_group_name || '',
        }));
      }
    }
  };

  const handleVendorSelect = (vendorId: string, isRecurring = false) => {
    const vendor = vendors.find(v => v.id === vendorId);
    if (vendor) {
      if (isRecurring) {
        setRecurringForm(prev => ({
          ...prev,
          cost_vendor_id: vendor.id,
          cost_vendor_name: vendor.name,
        }));
      } else {
        setForm(prev => ({
          ...prev,
          cost_vendor_id: vendor.id,
          cost_vendor_name: vendor.name,
        }));
      }
    }
  };

  const handleLineGroupSelect = (groupId: string, isRecurring = false) => {
    const group = lineGroups.find(g => g.group_id === groupId);
    if (group) {
      if (isRecurring) {
        setRecurringForm(prev => ({
          ...prev,
          customer_line_group_id: group.group_id,
          customer_line_group_name: group.group_name,
        }));
      } else {
        setForm(prev => ({
          ...prev,
          customer_line_group_id: group.group_id,
          customer_line_group_name: group.group_name,
        }));
      }
    }
  };

  const handleSendNotification = async (billing: BillingRequest) => {
    if (!billing.customer_line_group_id && !billing.customer_line_id) {
      alert('此客戶未設定 LINE 通知');
      return;
    }

    const message = `親愛的 ${billing.customer_name}，您好：

您的請款單已產生，詳情如下：

📋 請款單號：${billing.billing_number}
📝 項目：${billing.title}
💰 金額：NT$ ${(billing.total_amount || 0).toLocaleString()}
📅 付款期限：${billing.due_date || '請盡快付款'}

如有疑問，請與我們聯繫。
智慧媽咪國際 敬上`;

    const confirmed = window.confirm(`確定要發送請款通知？\n\n${message}`);
    if (!confirmed) return;

    try {
      const res = await fetch('/api/billing/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billing_id: billing.id,
          message,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '發送失敗');
      }

      alert('通知已發送');
      fetchData();
    } catch (error: any) {
      alert(error.message || '發送失敗');
    }
  };

  const handleConfirmPayment = async (billing: BillingRequest) => {
    const paidAmount = prompt('請輸入收款金額', (billing.total_amount || 0).toString());
    if (!paidAmount) return;

    try {
      const res = await fetch('/api/billing/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billing_id: billing.id,
          paid_amount: parseFloat(paidAmount),
          bank_account_id: billing.payment_account_id,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '確認收款失敗');
      }

      alert('收款確認完成');
      fetchData();
    } catch (error: any) {
      alert(error.message || '確認收款失敗');
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    if (!confirm('確定要刪除此週期性請款設定？')) return;

    try {
      const res = await fetch(`/api/billing/recurring?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('刪除失敗');
      fetchData();
    } catch (error) {
      alert('刪除失敗');
    }
  };

  const handleToggleRecurringActive = async (recurring: RecurringBilling) => {
    try {
      const res = await fetch('/api/billing/recurring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: recurring.id,
          is_active: !recurring.is_active,
        }),
      });

      if (!res.ok) throw new Error('更新失敗');
      fetchData();
    } catch (error) {
      alert('更新失敗');
    }
  };

  // 統計
  const stats = useMemo(() => {
    const total = filteredBillings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const paid = filteredBillings.filter(b => b.status === 'paid').reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const pending = filteredBillings.filter(b => ['sent', 'pending'].includes(b.status)).reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const cost = filteredBillings.reduce((sum, b) => sum + (b.cost_amount || 0), 0);
    return { total, paid, pending, cost, profit: total - cost };
  }, [filteredBillings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">請款管理</h1>
          <p className="text-gray-500 mt-1">管理客戶請款單與週期性請款設定</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRecurringList(!showRecurringList)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${showRecurringList ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-300 text-gray-700'
              }`}
          >
            <Repeat className="w-4 h-4" />
            週期請款
            {showRecurringList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            新增請款
          </button>
        </div>
      </div>

      {/* 週期性請款區塊 */}
      {showRecurringList && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-purple-800">週期性請款設定</h2>
            <button
              onClick={() => { resetRecurringForm(); setShowRecurringModal(true); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              新增
            </button>
          </div>

          {recurringBillings.length === 0 ? (
            <p className="text-purple-600 text-center py-4">尚無週期性請款設定</p>
          ) : (
            <div className="space-y-2">
              {recurringBillings.map(recurring => (
                <div key={recurring.id} className="bg-white rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{recurring.customer_name}</span>
                      <span className="text-gray-500">-</span>
                      <span>{recurring.title}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${recurring.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {recurring.is_active ? '啟用' : '停用'}
                      </span>
                      {recurring.auto_send && (
                        <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">自動發送</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {scheduleTypeConfig[recurring.schedule_type]} {recurring.schedule_day} 日
                      {recurring.schedule_type === 'yearly' && ` (${recurring.schedule_month}月)`}
                      {' | '}
                      NT$ {(recurring.amount || 0).toLocaleString()}
                      {recurring.next_run_at && (
                        <span className="ml-2">
                          下次：{new Date(recurring.next_run_at).toLocaleDateString('zh-TW')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleRecurringActive(recurring)}
                      className={`p-2 rounded-lg ${recurring.is_active ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                      title={recurring.is_active ? '停用' : '啟用'}
                    >
                      {recurring.is_active ? <Clock className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEditRecurringModal(recurring)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRecurring(recurring.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 border">
          <div className="text-sm text-gray-500">總請款</div>
          <div className="text-xl font-bold text-gray-900">NT$ {stats.total.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="text-sm text-gray-500">已收款</div>
          <div className="text-xl font-bold text-green-600">NT$ {stats.paid.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="text-sm text-gray-500">待收款</div>
          <div className="text-xl font-bold text-yellow-600">NT$ {stats.pending.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="text-sm text-gray-500">總成本</div>
          <div className="text-xl font-bold text-red-600">NT$ {stats.cost.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="text-sm text-gray-500">毛利</div>
          <div className="text-xl font-bold text-blue-600">NT$ {stats.profit.toLocaleString()}</div>
        </div>
      </div>

      {/* 篩選列 */}
      <div className="bg-white rounded-xl p-4 border">
        <div className="flex flex-wrap items-center gap-4">
          {/* 搜尋 */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋請款單號、客戶、項目..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>

          {/* 狀態篩選 */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="all">全部狀態</option>
            <option value="draft">草稿</option>
            <option value="sent">已發送</option>
            <option value="pending">待付款</option>
            <option value="paid">已收款</option>
            <option value="overdue">逾期</option>
          </select>

          {/* 時間篩選 */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border rounded-lg px-3 py-2"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border rounded-lg px-3 py-2"
            />
          </div>

          {/* 匯出 */}
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            匯出
          </button>

          {/* 批量刪除 */}
          {selectedIds.size > 0 && (
            <button
              onClick={confirmBatchDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4" />
              刪除 ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* 請款單列表 */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left">
                <button onClick={toggleSelectAll} className="p-1">
                  {selectedIds.size === filteredBillings.length && filteredBillings.length > 0 ? (
                    <CheckSquare className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">請款單號</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">客戶</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">項目</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">金額</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">成本</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">毛利</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">到期日</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">狀態</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredBillings.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  尚無請款單資料
                </td>
              </tr>
            ) : (
              filteredBillings.map(billing => {
                const status = statusConfig[billing.status] || statusConfig.draft;
                const profit = (billing.total_amount || 0) - (billing.cost_amount || 0);
                const profitRate = billing.total_amount ? (profit / billing.total_amount * 100).toFixed(0) : 0;

                return (
                  <tr key={billing.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelect(billing.id)} className="p-1">
                        {selectedIds.has(billing.id) ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{billing.billing_number}</div>
                      <div className="text-xs text-gray-500">{billing.created_at.split('T')[0]}</div>
                    </td>
                    <td className="px-4 py-3">{billing.customer_name}</td>
                    <td className="px-4 py-3">
                      <div>{billing.title}</div>
                      {billing.billing_month && (
                        <div className="text-xs text-gray-500">{billing.billing_month}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium">NT$ {(billing.total_amount || 0).toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {billing.cost_amount ? (
                        <div className="text-sm text-red-600">
                          NT$ {(billing.cost_amount || 0).toLocaleString()}
                          {billing.cost_vendor_name && (
                            <div className="text-xs text-gray-500">{billing.cost_vendor_name}</div>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium text-green-600">
                        NT$ {profit.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">{profitRate}%</div>
                    </td>
                    <td className="px-4 py-3">{billing.due_date}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {billing.status === 'draft' && (
                          <>
                            <button
                              onClick={() => openEditModal(billing)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                              title="編輯"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSendNotification(billing)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              title="發送通知"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => confirmSingleDelete(billing.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="刪除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {billing.status === 'sent' && (
                          <>
                            <button
                              onClick={() => handleConfirmPayment(billing)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              title="確認收款"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSendNotification(billing)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                              title="再次發送"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {billing.status === 'pending' && (
                          <button
                            onClick={() => handleConfirmPayment(billing)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="確認收款"
                          >
                            <Check className="w-4 h-4" />
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

      {/* 刪除確認 Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">確認刪除</h3>
            <p className="text-gray-600 mb-6">
              {deleteTarget === 'single'
                ? '確定要刪除這筆請款單嗎？此操作無法復原。'
                : `確定要刪除 ${selectedIds.size} 筆請款單嗎？此操作無法復原。`
              }
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setSingleDeleteId(null); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={executeDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新增/編輯請款單 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingBilling ? '編輯請款單' : '新增請款單'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* 客戶選擇 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">客戶 *</label>
                  <select
                    value={form.customer_id}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">選擇客戶或輸入</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">客戶名稱 *</label>
                  <input
                    type="text"
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="客戶名稱"
                  />
                </div>
              </div>

              {/* LINE 群組 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LINE 通知群組</label>
                <select
                  value={form.customer_line_group_id}
                  onChange={(e) => handleLineGroupSelect(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">選擇群組</option>
                  {lineGroups.map(g => (
                    <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
                  ))}
                </select>
              </div>

              {/* 請款項目 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">請款項目 *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="例：網站維護費"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">請款月份</label>
                  <input
                    type="month"
                    value={form.billing_month}
                    onChange={(e) => setForm({ ...form, billing_month: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* 金額 */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">金額 *</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">稅額</label>
                  <input
                    type="number"
                    value={form.tax_amount}
                    onChange={(e) => setForm({ ...form, tax_amount: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">到期日</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* 成本 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">成本金額</label>
                  <input
                    type="number"
                    value={form.cost_amount}
                    onChange={(e) => setForm({ ...form, cost_amount: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">成本廠商</label>
                  <select
                    value={form.cost_vendor_id}
                    onChange={(e) => handleVendorSelect(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">選擇廠商</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 收款帳戶 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">收款帳戶</label>
                <select
                  value={form.payment_account_id}
                  onChange={(e) => setForm({ ...form, payment_account_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">選擇收款帳戶</option>
                  {paymentAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.bank_name} - {a.account_number} ({a.account_name})
                    </option>
                  ))}
                </select>
              </div>

              {/* 備註 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 週期性請款 Modal */}
      {showRecurringModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingRecurring ? '編輯週期性請款' : '新增週期性請款'}
              </h2>
              <button onClick={() => { setShowRecurringModal(false); resetRecurringForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* 客戶 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">客戶 *</label>
                  <select
                    value={recurringForm.customer_id}
                    onChange={(e) => handleCustomerSelect(e.target.value, true)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">選擇客戶</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">客戶名稱 *</label>
                  <input
                    type="text"
                    value={recurringForm.customer_name}
                    onChange={(e) => setRecurringForm({ ...recurringForm, customer_name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* LINE 群組 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LINE 通知群組</label>
                <select
                  value={recurringForm.customer_line_group_id}
                  onChange={(e) => handleLineGroupSelect(e.target.value, true)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">選擇群組</option>
                  {lineGroups.map(g => (
                    <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
                  ))}
                </select>
              </div>

              {/* 項目 & 金額 */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">請款項目 *</label>
                  <input
                    type="text"
                    value={recurringForm.title}
                    onChange={(e) => setRecurringForm({ ...recurringForm, title: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">金額 *</label>
                  <input
                    type="number"
                    value={recurringForm.amount}
                    onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">稅額</label>
                  <input
                    type="number"
                    value={recurringForm.tax_amount}
                    onChange={(e) => setRecurringForm({ ...recurringForm, tax_amount: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* 成本 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">成本金額</label>
                  <input
                    type="number"
                    value={recurringForm.cost_amount}
                    onChange={(e) => setRecurringForm({ ...recurringForm, cost_amount: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">成本廠商</label>
                  <select
                    value={recurringForm.cost_vendor_id}
                    onChange={(e) => handleVendorSelect(e.target.value, true)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">選擇廠商</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 收款帳戶 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">收款帳戶</label>
                <select
                  value={recurringForm.payment_account_id}
                  onChange={(e) => setRecurringForm({ ...recurringForm, payment_account_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">選擇收款帳戶</option>
                  {paymentAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.bank_name} - {a.account_number} ({a.account_name})
                    </option>
                  ))}
                </select>
              </div>

              {/* 週期設定 */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">週期類型</label>
                  <select
                    value={recurringForm.schedule_type}
                    onChange={(e) => setRecurringForm({ ...recurringForm, schedule_type: e.target.value as any })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="monthly">每月</option>
                    <option value="quarterly">每季</option>
                    <option value="yearly">每年</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={recurringForm.schedule_day}
                    onChange={(e) => setRecurringForm({ ...recurringForm, schedule_day: parseInt(e.target.value) || 1 })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                {recurringForm.schedule_type === 'yearly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">月份</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={recurringForm.schedule_month}
                      onChange={(e) => setRecurringForm({ ...recurringForm, schedule_month: parseInt(e.target.value) || 1 })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">付款期限(天)</label>
                  <input
                    type="number"
                    value={recurringForm.days_before_due}
                    onChange={(e) => setRecurringForm({ ...recurringForm, days_before_due: parseInt(e.target.value) || 14 })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* 自動發送 */}
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <input
                  type="checkbox"
                  id="auto_send"
                  checked={recurringForm.auto_send}
                  onChange={(e) => setRecurringForm({ ...recurringForm, auto_send: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <label htmlFor="auto_send" className="flex-1">
                  <div className="font-medium text-blue-800">自動發送 LINE 通知</div>
                  <div className="text-sm text-blue-600">時間到時自動產生請款單並發送通知</div>
                </label>
              </div>

              {/* 訊息模板 */}
              {recurringForm.auto_send && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">訊息模板</label>
                  <textarea
                    value={recurringForm.message_template}
                    onChange={(e) => setRecurringForm({ ...recurringForm, message_template: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                    rows={8}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    可用變數：{'{客戶名稱}'} {'{請款項目}'} {'{金額}'} {'{到期日}'} {'{匯款帳戶}'}
                  </p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => { setShowRecurringModal(false); resetRecurringForm(); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveRecurring}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}