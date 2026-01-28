'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import {
  FileText, Plus, Send, Check, Clock, AlertCircle,
  Edit2, Trash2, RefreshCw, DollarSign, Calendar,
  User, Building, X, MessageCircle, CheckCircle, Receipt,
  Repeat, Play, Pause
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  email?: string;
  line_user_id?: string;
  line_group_id?: string;
  line_group_name?: string;
  customer_type: string;
  vendor_type?: string;
  is_internal?: boolean;
  tax_id?: string;
}

interface PaymentAccount {
  id: string;
  bank_name: string;
  branch_name?: string;
  account_number: string;
  account_name: string;
  is_default: boolean;
}

interface BillingRequest {
  id: string;
  billing_number: string;
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_line_id?: string;
  customer_line_group_id?: string;
  customer_line_group_name?: string;
  title: string;
  description?: string;
  billing_month?: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  cost_vendor_id?: string;
  cost_vendor_name?: string;
  cost_amount?: number;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  notification_sent_at?: string;
  paid_at?: string;
  paid_amount?: number;
  created_at: string;
  customer?: Customer;
  payment_account_id?: string;
  payment_account?: PaymentAccount;
}

interface RecurringBilling {
  id: string;
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
}

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const url_status = searchParams.get('status') || 'all';

  const updateURL = (statusFilter: string) => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    router.replace(`/dashboard/billing?${params.toString()}`, { scroll: false });
  };

  const { company } = useAuthStore();
  const [billings, setBillings] = useState<BillingRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(url_status);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingBilling, setEditingBilling] = useState<BillingRequest | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Payment confirmation modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [confirmingBilling, setConfirmingBilling] = useState<BillingRequest | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // 發送預覽 Modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewBilling, setPreviewBilling] = useState<BillingRequest | null>(null);
  const [previewMessage, setPreviewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // 廠商列表
  const [vendors, setVendors] = useState<Customer[]>([]);

  // ========== 週期性請款 ==========
  const [recurringBillings, setRecurringBillings] = useState<RecurringBilling[]>([]);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringBilling | null>(null);
  const [isSavingRecurring, setIsSavingRecurring] = useState(false);
  const [showRecurringList, setShowRecurringList] = useState(false);

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
    schedule_type: 'yearly' as 'monthly' | 'quarterly' | 'yearly',
    schedule_day: 1,
    schedule_month: 1,
    days_before_due: 14
  });

  // Form state
  const [form, setForm] = useState({
    customer_id: '',
    customer_name: '',
    customer_email: '',
    customer_line_id: '',
    customer_line_group_id: '',
    customer_line_group_name: '',
    title: '',
    description: '',
    billing_month: new Date().toISOString().slice(0, 7),
    amount: '',
    tax_amount: '0',
    payment_account_id: '',
    due_date: '',
    cost_vendor_id: '',
    cost_vendor_name: '',
    cost_amount: ''
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    paid_amount: '',
    payment_method: '銀行轉帳',
    payment_note: '',
    send_notification: true,
    invoice_action: 'auto' as 'manual' | 'auto',
    invoice_item_name: '服務費'
  });

  // 載入請款單列表
  const loadBillings = async () => {
    if (!company?.id) return;
    setIsLoading(true);
    try {
      const url = statusFilter === 'all'
        ? `/api/billing?company_id=${company.id}`
        : `/api/billing?company_id=${company.id}&status=${statusFilter}`;

      const response = await fetch(url);
      const result = await response.json();
      if (result.data) {
        setBillings(result.data);
      }
    } catch (error) {
      console.error('Error loading billings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 載入客戶列表
  const loadCustomers = async () => {
    if (!company?.id) return;
    try {
      const response = await fetch(`/api/customers?company_id=${company.id}`);
      const result = await response.json();
      if (result.data) {
        setCustomers(result.data);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  // 載入收款帳戶
  const loadPaymentAccounts = async () => {
    if (!company?.id) return;
    try {
      const response = await fetch(`/api/payment-accounts?company_id=${company.id}`);
      const result = await response.json();
      if (result.data) {
        setPaymentAccounts(result.data);
        const defaultAccount = result.data.find((a: PaymentAccount) => a.is_default);
        if (defaultAccount) {
          setForm(prev => ({ ...prev, payment_account_id: defaultAccount.id }));
        }
      }
    } catch (error) {
      console.error('Error loading payment accounts:', error);
    }
  };

  // 載入廠商列表
  const loadVendors = async () => {
    if (!company?.id) return;
    try {
      const response = await fetch(`/api/customers?company_id=${company.id}`);
      const result = await response.json();
      if (result.data) {
        setVendors(result.data.filter((c: Customer) =>
          (c.customer_type === 'vendor' || c.customer_type === 'both') &&
          !c.is_internal
        ));
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  // ========== 載入週期性請款 ==========
  const loadRecurringBillings = async () => {
    if (!company?.id) return;
    try {
      const response = await fetch(`/api/billing/recurring?company_id=${company.id}`);
      const result = await response.json();
      if (result.data) {
        setRecurringBillings(result.data);
      }
    } catch (error) {
      console.error('Error loading recurring billings:', error);
    }
  };

  useEffect(() => {
    if (company?.id) {
      loadBillings();
      loadCustomers();
      loadPaymentAccounts();
      loadVendors();
      loadRecurringBillings();
    }
  }, [company?.id, statusFilter]);

  // 選擇客戶時自動帶入資料
  const handleCustomerSelect = async (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      let newForm = {
        ...form,
        customer_id: customer.id,
        customer_name: customer.name,
        customer_email: customer.email || '',
        customer_line_id: customer.line_user_id || '',
        customer_line_group_id: customer.line_group_id || '',
        customer_line_group_name: customer.line_group_name || '',
        cost_vendor_id: '',
        cost_vendor_name: '',
        cost_amount: ''
      };

      try {
        const response = await fetch(`/api/billing/last-cost?customer_id=${customerId}&company_id=${company?.id}`);
        const result = await response.json();
        if (result.data) {
          newForm = {
            ...newForm,
            cost_vendor_id: result.data.cost_vendor_id || '',
            cost_vendor_name: result.data.cost_vendor_name || '',
            cost_amount: result.data.cost_amount?.toString() || ''
          };
        }
      } catch (error) {
        console.error('Error loading last cost:', error);
      }

      setForm(newForm);
    } else {
      setForm({
        ...form,
        customer_id: '',
        customer_name: '',
        customer_email: '',
        customer_line_id: '',
        customer_line_group_id: '',
        customer_line_group_name: '',
        cost_vendor_id: '',
        cost_vendor_name: '',
        cost_amount: ''
      });
    }
  };

  // ========== 週期性請款客戶選擇 ==========
  const handleRecurringCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setRecurringForm({
        ...recurringForm,
        customer_id: customer.id,
        customer_name: customer.name,
        customer_line_group_id: customer.line_group_id || '',
        customer_line_group_name: customer.line_group_name || ''
      });
    } else {
      setRecurringForm({
        ...recurringForm,
        customer_id: '',
        customer_name: '',
        customer_line_group_id: '',
        customer_line_group_name: ''
      });
    }
  };

  // 開啟新增 Modal
  const openAddModal = () => {
    setEditingBilling(null);
    const defaultAccount = paymentAccounts.find(a => a.is_default);
    setForm({
      customer_id: '',
      customer_name: '',
      customer_email: '',
      customer_line_id: '',
      customer_line_group_id: '',
      customer_line_group_name: '',
      title: '',
      description: '',
      billing_month: new Date().toISOString().slice(0, 7),
      amount: '',
      tax_amount: '0',
      payment_account_id: defaultAccount?.id || '',
      due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      cost_vendor_id: '',
      cost_vendor_name: '',
      cost_amount: ''
    });
    setShowModal(true);
  };

  // 開啟編輯 Modal
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
      billing_month: billing.billing_month || '',
      amount: billing.amount.toString(),
      tax_amount: billing.tax_amount.toString(),
      payment_account_id: billing.payment_account?.id || '',
      due_date: billing.due_date,
      cost_vendor_id: billing.cost_vendor_id || '',
      cost_vendor_name: billing.cost_vendor_name || '',
      cost_amount: billing.cost_amount?.toString() || ''
    });
    setShowModal(true);
  };

  // ========== 週期性請款 Modal ==========
  const openAddRecurringModal = () => {
    setEditingRecurring(null);
    const defaultAccount = paymentAccounts.find(a => a.is_default);
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
      payment_account_id: defaultAccount?.id || '',
      schedule_type: 'yearly',
      schedule_day: 1,
      schedule_month: 1,
      days_before_due: 14
    });
    setShowRecurringModal(true);
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
      tax_amount: recurring.tax_amount?.toString() || '0',
      cost_amount: recurring.cost_amount?.toString() || '',
      cost_vendor_id: recurring.cost_vendor_id || '',
      cost_vendor_name: recurring.cost_vendor_name || '',
      payment_account_id: recurring.payment_account_id || '',
      schedule_type: recurring.schedule_type,
      schedule_day: recurring.schedule_day,
      schedule_month: recurring.schedule_month || 1,
      days_before_due: recurring.days_before_due || 14
    });
    setShowRecurringModal(true);
  };

  // 選擇成本廠商
  const handleCostVendorSelect = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    if (vendor) {
      setForm({
        ...form,
        cost_vendor_id: vendor.id,
        cost_vendor_name: vendor.name
      });
    }
  };

  const handleRecurringCostVendorSelect = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    if (vendor) {
      setRecurringForm({
        ...recurringForm,
        cost_vendor_id: vendor.id,
        cost_vendor_name: vendor.name
      });
    }
  };

  // 儲存請款單
  const handleSave = async () => {
    if (!company?.id) return;
    if (!form.customer_name || !form.amount || !form.due_date || !form.title) {
      alert('請填寫必要欄位');
      return;
    }

    setIsSaving(true);
    try {
      const url = '/api/billing';
      const method = editingBilling ? 'PUT' : 'POST';
      const body = editingBilling
        ? { id: editingBilling.id, ...form }
        : { company_id: company.id, ...form };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();

      if (result.success || result.data) {
        setShowModal(false);
        loadBillings();
        alert(editingBilling ? '請款單已更新！' : '請款單已建立！');
      } else {
        alert(result.error || '儲存失敗');
      }
    } catch (error) {
      console.error('Error saving billing:', error);
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  // ========== 儲存週期性請款 ==========
  const handleSaveRecurring = async () => {
    if (!company?.id) return;
    if (!recurringForm.customer_name || !recurringForm.amount || !recurringForm.title) {
      alert('請填寫必要欄位');
      return;
    }

    setIsSavingRecurring(true);
    try {
      const url = '/api/billing/recurring';
      const method = editingRecurring ? 'PUT' : 'POST';
      const body = editingRecurring
        ? { id: editingRecurring.id, ...recurringForm }
        : { company_id: company.id, ...recurringForm };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();

      if (result.success || result.data) {
        setShowRecurringModal(false);
        loadRecurringBillings();
        alert(editingRecurring ? '週期性請款已更新！' : '週期性請款已建立！');
      } else {
        alert(result.error || '儲存失敗');
      }
    } catch (error) {
      console.error('Error saving recurring billing:', error);
      alert('儲存失敗');
    } finally {
      setIsSavingRecurring(false);
    }
  };

  // 切換週期性請款狀態
  const handleToggleRecurring = async (id: string, currentActive: boolean) => {
    try {
      const response = await fetch('/api/billing/recurring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive })
      });
      const result = await response.json();
      if (result.success) {
        loadRecurringBillings();
      } else {
        alert(result.error || '更新失敗');
      }
    } catch (error) {
      console.error('Error toggling recurring:', error);
      alert('更新失敗');
    }
  };

  // 刪除週期性請款
  const handleDeleteRecurring = async (id: string) => {
    if (!confirm('確定要刪除此週期性請款？')) return;
    try {
      const response = await fetch(`/api/billing/recurring?id=${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        loadRecurringBillings();
      } else {
        alert(result.error || '刪除失敗');
      }
    } catch (error) {
      console.error('Error deleting recurring:', error);
      alert('刪除失敗');
    }
  };

  // 打開發送預覽 Modal
  const openSendPreview = async (billing: BillingRequest) => {
    const hasLineContact = billing.customer_line_group_id || billing.customer_line_id;
    if (!hasLineContact) {
      alert('此客戶沒有設定 LINE 群組，無法發送通知');
      return;
    }

    const account = paymentAccounts.find(a => a.id === billing.payment_account_id);
    const accountInfo = account
      ? `${account.bank_name} ${account.branch_name || ''}\n帳號：${account.account_number}\n戶名：${account.account_name}`
      : '（請設定收款帳戶）';

    const defaultMessage = `【請款通知】

${billing.customer_name} 您好，

${billing.billing_month ? `${billing.billing_month.replace('-', '年')}月` : ''}${billing.title}費用請款如下：

請款金額：NT$ ${billing.total_amount?.toLocaleString() || billing.amount?.toLocaleString()}
付款期限：${new Date(billing.due_date).toLocaleDateString('zh-TW')}

匯款資訊：
${accountInfo}

如已付款請忽略此通知，謝謝！

智慧媽咪國際 敬上`;

    setPreviewBilling(billing);
    setPreviewMessage(defaultMessage);
    setShowPreviewModal(true);
  };

  // 確認發送通知
  const handleConfirmSend = async () => {
    if (!previewBilling) return;

    setIsSending(true);
    try {
      const response = await fetch('/api/billing/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billing_id: previewBilling.id,
          custom_message: previewMessage
        })
      });
      const result = await response.json();

      if (result.success) {
        alert('請款通知已發送！');
        setShowPreviewModal(false);
        setPreviewBilling(null);
        setPreviewMessage('');
        loadBillings();
      } else {
        alert(result.error || '發送失敗');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('發送失敗');
    } finally {
      setIsSending(false);
    }
  };

  // 開啟確認收款 Modal
  const openPaymentModal = (billing: BillingRequest) => {
    setConfirmingBilling(billing);
    setPaymentForm({
      paid_amount: billing.total_amount.toString(),
      payment_method: '銀行轉帳',
      payment_note: '',
      send_notification: true,
      invoice_action: 'auto',
      invoice_item_name: '服務費'
    });
    setShowPaymentModal(true);
  };

  // 確認收款
  const handleConfirmPayment = async () => {
    if (!confirmingBilling || !paymentForm.paid_amount) return;

    setIsConfirming(true);
    try {
      const response = await fetch('/api/billing/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billing_id: confirmingBilling.id,
          paid_amount: paymentForm.paid_amount,
          payment_method: paymentForm.payment_method,
          payment_note: paymentForm.payment_note,
          send_notification: paymentForm.send_notification
        })
      });
      const result = await response.json();

      if (result.success) {
        let message = '✅ 收款確認完成！\n\n';
        message += '📝 已自動建立收入記錄\n';

        if (result.data?.has_cost) {
          message += '📋 已建立應付款項提醒（外包成本）\n';
        }

        if (result.data?.notification_sent) {
          message += '📱 已發送收款通知給客戶\n';
        }

        if (paymentForm.invoice_action === 'auto') {
          try {
            const customer = customers.find(c => c.id === confirmingBilling.customer_id);

            const invoiceResponse = await fetch('/api/invoices', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                company_id: company?.id,
                billing_request_id: confirmingBilling.id,
                invoice_type: customer?.tax_id ? 'B2B' : 'B2C',
                customer_id: confirmingBilling.customer_id || null,
                buyer_name: confirmingBilling.customer_name,
                buyer_tax_id: customer?.tax_id || '',
                buyer_email: confirmingBilling.customer_email || '',
                items: [{
                  name: paymentForm.invoice_item_name || '服務費',
                  quantity: 1,
                  unit: '式',
                  price: parseFloat(paymentForm.paid_amount),
                }],
                issue_to_ezpay: true,
              })
            });
            const invoiceResult = await invoiceResponse.json();

            if (invoiceResult.success) {
              message += `🧾 發票已開立：${invoiceResult.data?.invoice_number || '成功'}\n`;
              message += '📤 已自動發送發票通知\n';
            } else {
              message += `⚠️ 發票開立失敗：${invoiceResult.error}\n`;
              message += '請至發票頁面手動開立\n';
            }
          } catch (invoiceError) {
            console.error('Auto invoice error:', invoiceError);
            message += '⚠️ 發票開立失敗，請至發票頁面手動開立\n';
          }

          alert(message);
          setShowPaymentModal(false);
          loadBillings();

        } else {
          alert(message);
          setShowPaymentModal(false);
          loadBillings();

          if (confirm('是否要前往開立發票？')) {
            window.location.href = `/dashboard/invoices?billing_id=${confirmingBilling.id}`;
          }
        }
      } else {
        alert(result.error || '確認收款失敗');
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert('確認收款失敗');
    } finally {
      setIsConfirming(false);
    }
  };

  // 刪除請款單
  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此請款單？')) return;
    try {
      const response = await fetch(`/api/billing?id=${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        loadBillings();
      } else {
        alert(result.error || '刪除失敗');
      }
    } catch (error) {
      console.error('Error deleting billing:', error);
      alert('刪除失敗');
    }
  };

  // 狀態顏色
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'sent': return 'bg-blue-100 text-blue-700';
      case 'paid': return 'bg-green-100 text-green-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      case 'cancelled': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return '草稿';
      case 'sent': return '已發送';
      case 'paid': return '已收款';
      case 'overdue': return '逾期';
      case 'cancelled': return '已取消';
      default: return status;
    }
  };

  const getScheduleTypeText = (type: string) => {
    switch (type) {
      case 'monthly': return '每月';
      case 'quarterly': return '每季';
      case 'yearly': return '每年';
      default: return type;
    }
  };

  // 統計
  const stats = {
    total: billings.length,
    draft: billings.filter(b => b.status === 'draft').length,
    sent: billings.filter(b => b.status === 'sent').length,
    paid: billings.filter(b => b.status === 'paid').length,
    overdue: billings.filter(b => b.status === 'overdue').length,
    totalAmount: billings.filter(b => b.status !== 'cancelled').reduce((sum, b) => sum + b.total_amount, 0),
    paidAmount: billings.filter(b => b.status === 'paid').reduce((sum, b) => sum + (b.paid_amount || b.total_amount), 0),
    pendingAmount: billings.filter(b => ['sent', 'overdue'].includes(b.status)).reduce((sum, b) => sum + b.total_amount, 0)
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-brand-primary-500" />
            請款管理
          </h1>
          <p className="text-gray-500 mt-1">建立請款單、發送通知、確認收款</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRecurringList(!showRecurringList)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${showRecurringList
              ? 'bg-purple-600 text-white'
              : 'border border-purple-300 text-purple-600 hover:bg-purple-50'
              }`}
          >
            <Repeat className="w-4 h-4" />
            週期請款 {recurringBillings.length > 0 && `(${recurringBillings.filter(r => r.is_active).length})`}
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> 新增請款單
          </button>
        </div>
      </div>

      {/* 週期性請款列表 */}
      {showRecurringList && (
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-purple-800 flex items-center gap-2">
              <Repeat className="w-5 h-5" />
              週期性請款
            </h2>
            <button
              onClick={openAddRecurringModal}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-1 text-sm"
            >
              <Plus className="w-4 h-4" /> 新增
            </button>
          </div>

          {recurringBillings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-lg">
                <thead className="bg-purple-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-purple-700">客戶</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-purple-700">項目</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-purple-700">金額</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-purple-700">週期</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-purple-700">下次執行</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-purple-700">狀態</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-purple-700">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100">
                  {recurringBillings.map((recurring) => (
                    <tr key={recurring.id} className="hover:bg-purple-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{recurring.customer_name}</div>
                        {recurring.customer_line_group_name && (
                          <div className="text-xs text-green-600 flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" /> {recurring.customer_line_group_name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{recurring.title}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        NT$ {(recurring.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-purple-600">
                          {getScheduleTypeText(recurring.schedule_type)}
                          {recurring.schedule_type === 'yearly' && ` ${recurring.schedule_month}/${recurring.schedule_day}`}
                          {recurring.schedule_type === 'monthly' && ` ${recurring.schedule_day}日`}
                          {recurring.schedule_type === 'quarterly' && ` ${recurring.schedule_day}日`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {recurring.next_run_at
                          ? new Date(recurring.next_run_at).toLocaleDateString('zh-TW')
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {recurring.is_active ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                            啟用中
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                            已暫停
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleToggleRecurring(recurring.id, recurring.is_active)}
                            className={`p-1.5 rounded ${recurring.is_active ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                            title={recurring.is_active ? '暫停' : '啟用'}
                          >
                            {recurring.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => openEditRecurringModal(recurring)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                            title="編輯"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecurring(recurring.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-purple-600">
              <Repeat className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>尚無週期性請款</p>
              <p className="text-sm text-purple-500">設定後系統會自動產生請款單並發送通知</p>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">待收款金額</div>
          <div className="text-2xl font-bold text-orange-600">
            NT$ {stats.pendingAmount.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400 mt-1">{stats.sent + stats.overdue} 筆待收</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">本月已收</div>
          <div className="text-2xl font-bold text-green-600">
            NT$ {stats.paidAmount.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400 mt-1">{stats.paid} 筆</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">草稿</div>
          <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
          <div className="text-xs text-gray-400 mt-1">尚未發送</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">逾期</div>
          <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          <div className="text-xs text-gray-400 mt-1">需要跟進</div>
        </div>
      </div>

      {/* Filter & Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex gap-2">
            {['all', 'draft', 'sent', 'paid', 'overdue'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-sm ${statusFilter === status
                  ? 'bg-brand-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {status === 'all' ? '全部' : getStatusText(status)}
              </button>
            ))}
          </div>
          <button
            onClick={loadBillings}
            disabled={isLoading}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">請款單號</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">客戶</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">項目</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">金額</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">成本</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">毛利</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">到期日</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">狀態</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {billings.map((billing) => (
                <tr key={billing.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-mono text-sm">{billing.billing_number}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(billing.created_at).toLocaleDateString('zh-TW')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{billing.customer_name}</div>
                    {billing.customer_line_id && (
                      <div className="text-xs text-green-600 flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" /> LINE 已綁定
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">{billing.title}</div>
                    {billing.billing_month && (
                      <div className="text-xs text-gray-400">{billing.billing_month}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-medium">NT$ {billing.total_amount.toLocaleString()}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {billing.cost_amount ? (
                      <div>
                        <div className="text-sm text-red-600">NT$ {billing.cost_amount.toLocaleString()}</div>
                        {billing.cost_vendor_name && (
                          <div className="text-xs text-gray-400">{billing.cost_vendor_name}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {billing.cost_amount ? (
                      <div>
                        <div className="text-sm font-medium text-green-600">
                          NT$ {(billing.total_amount - billing.cost_amount).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-400">
                          {((billing.total_amount - billing.cost_amount) / billing.total_amount * 100).toFixed(0)}%
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className={`text-sm ${new Date(billing.due_date) < new Date() && billing.status !== 'paid' ? 'text-red-600' : ''}`}>
                      {new Date(billing.due_date).toLocaleDateString('zh-TW')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getStatusStyle(billing.status)}`}>
                      {getStatusText(billing.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {billing.status === 'draft' && (
                        <>
                          <button
                            onClick={() => openSendPreview(billing)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="發送請款通知"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(billing)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                            title="編輯"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(billing.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {billing.status === 'sent' && (
                        <>
                          <button
                            onClick={() => openPaymentModal(billing)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="確認收款"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openSendPreview(billing)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="再次發送通知"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {billing.status === 'overdue' && (
                        <>
                          <button
                            onClick={() => openPaymentModal(billing)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="確認收款"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openSendPreview(billing)}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded"
                            title="發送催款通知"
                          >
                            <AlertCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {billing.status === 'paid' && (
                        <span className="text-xs text-gray-400">
                          {billing.paid_at && new Date(billing.paid_at).toLocaleDateString('zh-TW')}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {billings.length === 0 && !isLoading && (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>尚無請款單</p>
            <p className="text-sm">點擊「新增請款單」開始建立</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingBilling ? '編輯請款單' : '新增請款單'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 客戶選擇 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">客戶 *</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                >
                  <option value="">選擇客戶或手動輸入...</option>
                  {customers.filter(c => ['customer', 'both'].includes(c.customer_type)).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.line_user_id ? '📱' : ''}
                    </option>
                  ))}
                </select>
                {!form.customer_id && (
                  <input
                    type="text"
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    placeholder="或手動輸入客戶名稱"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 mt-2"
                  />
                )}
                {form.customer_line_group_id && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> LINE 群組：{form.customer_line_group_name || form.customer_line_group_id}
                  </p>
                )}
                {!form.customer_line_group_id && form.customer_id && (
                  <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> 此客戶尚未設定 LINE 群組
                  </p>
                )}
              </div>

              {/* 請款標題 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">請款項目 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="例：1月份網站維護服務"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>

              {/* 請款月份 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">請款月份</label>
                <input
                  type="month"
                  value={form.billing_month}
                  onChange={(e) => setForm({ ...form, billing_month: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>

              {/* 金額 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">請款金額 *</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/^0+(?=\d)/, "") })}
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                  />
                </div>
              </div>

              {/* 到期日 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">付款期限 *</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>

              {/* 收款帳戶 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">收款帳戶</label>
                <select
                  value={form.payment_account_id}
                  onChange={(e) => setForm({ ...form, payment_account_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                >
                  <option value="">選擇收款帳戶...</option>
                  {paymentAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bank_name} {a.account_number} {a.is_default ? '(預設)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 成本資訊 */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  成本資訊（選填，只有外部廠商會記入成本）
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">外包廠商</label>
                    <select
                      value={form.cost_vendor_id}
                      onChange={(e) => handleCostVendorSelect(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                    >
                      <option value="">選擇外包廠商...</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} {v.vendor_type === 'company' ? '(公司)' : '(個人)'}
                          {v.tax_id ? ` - ${v.tax_id}` : ''}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={form.cost_vendor_name}
                      onChange={(e) => setForm({ ...form, cost_vendor_name: e.target.value })}
                      placeholder="或直接輸入廠商名稱"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 mt-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">成本金額</label>
                    <input
                      type="number"
                      value={form.cost_amount}
                      onChange={(e) => setForm({ ...form, cost_amount: e.target.value.replace(/^0+(?=\d)/, "") })}
                      placeholder="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                    />
                  </div>
                  {form.amount && form.cost_amount && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">毛利：</span>
                        <span className="font-semibold text-green-600">
                          NT$ {(parseFloat(form.amount || '0') - parseFloat(form.cost_amount || '0')).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-600">毛利率：</span>
                        <span className="font-semibold text-green-600">
                          {((parseFloat(form.amount || '0') - parseFloat(form.cost_amount || '0')) / parseFloat(form.amount || '1') * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 說明 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備註說明</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="選填"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                disabled={isSaving}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-2 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isSaving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 週期性請款 Modal */}
      {showRecurringModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Repeat className="w-5 h-5 text-purple-600" />
                {editingRecurring ? '編輯週期性請款' : '新增週期性請款'}
              </h3>
              <button onClick={() => setShowRecurringModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 客戶選擇 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">客戶 *</label>
                <select
                  value={recurringForm.customer_id}
                  onChange={(e) => handleRecurringCustomerSelect(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">選擇客戶...</option>
                  {customers.filter(c => ['customer', 'both'].includes(c.customer_type)).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.line_group_id ? '📱' : ''}
                    </option>
                  ))}
                </select>
                {recurringForm.customer_line_group_id && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> LINE 群組：{recurringForm.customer_line_group_name}
                  </p>
                )}
              </div>

              {/* 請款標題 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">請款項目 *</label>
                <input
                  type="text"
                  value={recurringForm.title}
                  onChange={(e) => setRecurringForm({ ...recurringForm, title: e.target.value })}
                  placeholder="例：網站主機維護費"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* 金額 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">請款金額 *</label>
                <input
                  type="number"
                  value={recurringForm.amount}
                  onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value.replace(/^0+(?=\d)/, "") })}
                  placeholder="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* 週期設定 */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">週期類型 *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'monthly', label: '每月' },
                    { value: 'quarterly', label: '每季' },
                    { value: 'yearly', label: '每年' }
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setRecurringForm({ ...recurringForm, schedule_type: type.value as any })}
                      className={`px-4 py-2 rounded-lg border text-sm ${recurringForm.schedule_type === type.value
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 日期設定 */}
              <div className="grid grid-cols-2 gap-4">
                {recurringForm.schedule_type === 'yearly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">月份</label>
                    <select
                      value={recurringForm.schedule_month}
                      onChange={(e) => setRecurringForm({ ...recurringForm, schedule_month: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <option key={month} value={month}>{month} 月</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                  <select
                    value={recurringForm.schedule_day}
                    onChange={(e) => setRecurringForm({ ...recurringForm, schedule_day: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>{day} 日</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">付款期限（天）</label>
                  <input
                    type="number"
                    value={recurringForm.days_before_due}
                    onChange={(e) => setRecurringForm({ ...recurringForm, days_before_due: parseInt(e.target.value) || 14 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* 成本資訊 */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">成本資訊（選填）</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">外包廠商</label>
                    <select
                      value={recurringForm.cost_vendor_id}
                      onChange={(e) => handleRecurringCostVendorSelect(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">選擇外包廠商...</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">成本金額</label>
                    <input
                      type="number"
                      value={recurringForm.cost_amount}
                      onChange={(e) => setRecurringForm({ ...recurringForm, cost_amount: e.target.value.replace(/^0+(?=\d)/, "") })}
                      placeholder="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* 預覽 */}
              <div className="bg-purple-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-purple-800 mb-1">排程預覽</p>
                <p className="text-purple-600">
                  {recurringForm.schedule_type === 'yearly' && `每年 ${recurringForm.schedule_month} 月 ${recurringForm.schedule_day} 日`}
                  {recurringForm.schedule_type === 'quarterly' && `每季 ${recurringForm.schedule_day} 日`}
                  {recurringForm.schedule_type === 'monthly' && `每月 ${recurringForm.schedule_day} 日`}
                  {' '}自動產生請款單並發送 LINE 通知
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRecurringModal(false)}
                disabled={isSavingRecurring}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveRecurring}
                disabled={isSavingRecurring}
                className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingRecurring && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isSavingRecurring ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {showPaymentModal && confirmingBilling && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">確認收款</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="text-sm text-gray-500">請款單號</div>
              <div className="font-mono">{confirmingBilling.billing_number}</div>
              <div className="text-sm text-gray-500 mt-2">客戶</div>
              <div className="font-medium">{confirmingBilling.customer_name}</div>
              <div className="text-sm text-gray-500 mt-2">應收金額</div>
              <div className="text-xl font-bold text-brand-primary-600">
                NT$ {confirmingBilling.total_amount.toLocaleString()}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">實收金額 *</label>
                <input
                  type="number"
                  value={paymentForm.paid_amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paid_amount: e.target.value.replace(/^0+(?=\d)/, "") })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">付款方式</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                >
                  <option value="銀行轉帳">銀行轉帳</option>
                  <option value="現金">現金</option>
                  <option value="支票">支票</option>
                  <option value="信用卡">信用卡</option>
                  <option value="其他">其他</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
                <input
                  type="text"
                  value={paymentForm.payment_note}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_note: e.target.value })}
                  placeholder="選填"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>

              {(confirmingBilling.customer_line_id || confirmingBilling.customer_line_group_id) && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={paymentForm.send_notification}
                    onChange={(e) => setPaymentForm({ ...paymentForm, send_notification: e.target.checked })}
                    className="rounded text-brand-primary-600"
                  />
                  <span className="text-sm">發送收款確認通知給客戶</span>
                </label>
              )}

              {/* 發票開立選項 */}
              <div className="border-t pt-4 mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  開立發票
                </label>

                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${paymentForm.invoice_action === 'auto'
                    ? 'border-brand-primary-500 bg-brand-primary-50'
                    : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                    <input
                      type="radio"
                      name="invoice_action"
                      value="auto"
                      checked={paymentForm.invoice_action === 'auto'}
                      onChange={() => setPaymentForm({ ...paymentForm, invoice_action: 'auto' })}
                      className="mt-0.5 text-brand-primary-600"
                    />
                    <div>
                      <span className="text-sm font-medium">立即自動開立</span>
                      <p className="text-xs text-gray-500">確認收款後自動開發票並發送通知</p>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${paymentForm.invoice_action === 'manual'
                    ? 'border-brand-primary-500 bg-brand-primary-50'
                    : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                    <input
                      type="radio"
                      name="invoice_action"
                      value="manual"
                      checked={paymentForm.invoice_action === 'manual'}
                      onChange={() => setPaymentForm({ ...paymentForm, invoice_action: 'manual' })}
                      className="mt-0.5 text-brand-primary-600"
                    />
                    <div>
                      <span className="text-sm font-medium">稍後手動開立</span>
                      <p className="text-xs text-gray-500">跳轉到發票頁面自行開立</p>
                    </div>
                  </label>
                </div>

                {paymentForm.invoice_action === 'auto' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">發票品項</label>
                    <input
                      type="text"
                      value={paymentForm.invoice_item_name}
                      onChange={(e) => setPaymentForm({ ...paymentForm, invoice_item_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                      placeholder="服務費"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      預設為「服務費」，可依需求修改（如：網站架設費）
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                disabled={isConfirming}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={isConfirming}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isConfirming && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isConfirming ? '處理中...' : paymentForm.invoice_action === 'auto' ? '確認收款並開發票' : '確認收款'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 發送預覽 Modal */}
      {showPreviewModal && previewBilling && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">發送請款通知</h3>
              <button onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {/* 發送對象 */}
              <div className="bg-green-50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 text-green-700">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    發送至：{previewBilling.customer_line_group_name || previewBilling.customer_name}
                  </span>
                </div>
              </div>

              {/* 請款資訊摘要 */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-500">請款單號：</span>
                    <span className="font-mono">{previewBilling.billing_number}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">金額：</span>
                    <span className="font-semibold text-brand-primary-600">
                      NT$ {previewBilling.total_amount?.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* 訊息編輯 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  訊息內容（可編輯）
                </label>
                <textarea
                  value={previewMessage}
                  onChange={(e) => setPreviewMessage(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 text-sm font-mono"
                />
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowPreviewModal(false)}
                disabled={isSending}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmSend}
                disabled={isSending}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSending && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isSending ? '發送中...' : '確認發送'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}