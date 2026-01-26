'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { FileText, Plus, Settings, X, Check } from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  buyer_name: string;
  buyer_tax_id: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  category: string;
}

interface InvoiceSettings {
  merchant_id: string;
  hash_key: string;
  hash_iv: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

export default function InvoicesPage() {
  const { company } = useAuthStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ merchant_id: '', hash_key: '', hash_iv: '' });
  const [issueForm, setIssueForm] = useState({
    buyer_name: '',
    buyer_email: '',
    buyer_tax_id: '',
    category: 'B2C',
    item_name: '',
    total_price: '',
    carrier_type: '',
    carrier_num: '',
  });
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showCustomItem, setShowCustomItem] = useState(false);

  // 常用品項清單
  const defaultProducts = [
    { id: '1', name: '顧問費', price: 0 },
    { id: '2', name: '設計費', price: 0 },
    { id: '3', name: '服務費', price: 0 },
    { id: '4', name: '廣告費', price: 0 },
    { id: '5', name: '行銷費', price: 0 },
    { id: '6', name: '企劃費', price: 0 },
    { id: '7', name: '網站製作費', price: 0 },
    { id: '8', name: '影片製作費', price: 0 },
    { id: '9', name: '攝影費', price: 0 },
    { id: '10', name: '活動費', price: 0 },
  ];

  useEffect(() => {
    if (company?.id) {
      loadSettings();
      loadInvoices();
      loadProducts();
    }
  }, [company]);

  const loadSettings = async () => {
    const { data } = await supabase
      .from('acct_invoice_settings')
      .select('*')
      .eq('company_id', company?.id)
      .single();
    
    if (data) {
      setSettings(data);
      setSettingsForm({
        merchant_id: data.merchant_id || '',
        hash_key: data.hash_key || '',
        hash_iv: data.hash_iv || '',
      });
    }
  };

  const loadInvoices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('acct_invoices')
      .select('*')
      .eq('company_id', company?.id)
      .order('created_at', { ascending: false });
    
    setInvoices(data || []);
    setLoading(false);
  };

  const loadProducts = async () => {
    const { data } = await supabase
      .from('acct_invoice_products')
      .select('*')
      .eq('company_id', company?.id)
      .order('name');
    
    setProducts(data || []);
  };

  const handleSaveSettings = async () => {
    if (!company?.id) return;
    setSaving(true);
    setMessage({ type: '', text: '' });

    const { error } = await supabase
      .from('acct_invoice_settings')
      .upsert({
        company_id: company.id,
        merchant_id: settingsForm.merchant_id,
        hash_key: settingsForm.hash_key,
        hash_iv: settingsForm.hash_iv,
      }, { onConflict: 'company_id' });

    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: '儲存失敗：' + error.message });
    } else {
      setMessage({ type: 'success', text: '設定已儲存' });
      loadSettings();
      setTimeout(() => setShowSettingsModal(false), 1000);
    }
  };

  const calcFromTotal = (totalPrice: string) => {
    const total = parseInt(totalPrice) || 0;
    const amt = Math.round(total / 1.05);
    const tax = total - amt;
    return { amt, tax, total };
  };

  const handleSelectProduct = (productName: string) => {
    if (productName === '__custom__') {
      setShowCustomItem(true);
      setIssueForm({ ...issueForm, item_name: '' });
    } else {
      setShowCustomItem(false);
      setIssueForm({ ...issueForm, item_name: productName });
    }
  };

  const handleIssueInvoice = async () => {
    if (!company?.id || !settings) return;
    if (!issueForm.buyer_name || !issueForm.item_name || !issueForm.total_price) {
      setMessage({ type: 'error', text: '請填寫必填欄位' });
      return;
    }

    setIssuing(true);
    setMessage({ type: '', text: '' });

    const { amt } = calcFromTotal(issueForm.total_price);
    
    const res = await fetch('/api/invoices/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: company.id,
        buyer_name: issueForm.buyer_name,
        buyer_email: issueForm.buyer_email,
        buyer_tax_id: issueForm.buyer_tax_id,
        category: issueForm.category,
        carrier_type: issueForm.carrier_type,
        carrier_num: issueForm.carrier_num,
        items: [{
          name: issueForm.item_name,
          count: 1,
          unit: '式',
          price: amt,
          amount: amt,
        }],
      }),
    });

    const data = await res.json();
    setIssuing(false);

    if (data.success) {
      setMessage({ type: 'success', text: `發票開立成功！號碼：${data.result?.InvoiceNumber}` });
      loadInvoices();
      setTimeout(() => {
        setShowIssueModal(false);
        setIssueForm({ buyer_name: '', buyer_email: '', buyer_tax_id: '', category: 'B2C', item_name: '', total_price: '', carrier_type: '', carrier_num: '' });
        setMessage({ type: '', text: '' });
        setShowCustomItem(false);
      }, 2000);
    } else {
      setMessage({ type: 'error', text: `開立失敗：${data.message}` });
    }
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    issued: { label: '已開立', color: 'bg-green-100 text-green-700' },
    voided: { label: '已作廢', color: 'bg-red-100 text-red-700' },
  };

  const priceCalc = calcFromTotal(issueForm.total_price);
  const allProducts = [...defaultProducts, ...products];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">電子發票</h1>
          <p className="text-gray-500">管理 ezPay 電子發票</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowSettingsModal(true)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            發票設定
          </button>
          <button
            onClick={() => {
              if (!settings) { alert('請先設定發票金鑰'); setShowSettingsModal(true); return; }
              setShowIssueModal(true);
            }}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            開立發票
          </button>
        </div>
      </div>

      {!settings && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <Settings className="w-5 h-5 text-yellow-600" />
          <div>
            <p className="font-medium text-yellow-800">尚未設定發票金鑰</p>
            <p className="text-sm text-yellow-600">請先設定 ezPay 商店代號與金鑰才能開立發票</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border">
        {loading ? (
          <div className="p-8 text-center">載入中...</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">尚無發票記錄</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4">發票號碼</th>
                <th className="text-left p-4">買受人</th>
                <th className="text-left p-4">統編</th>
                <th className="text-right p-4">金額</th>
                <th className="text-center p-4">類型</th>
                <th className="text-center p-4">狀態</th>
                <th className="text-center p-4">開立日期</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t hover:bg-gray-50">
                  <td className="p-4 font-mono">{inv.invoice_number}</td>
                  <td className="p-4">{inv.buyer_name}</td>
                  <td className="p-4">{inv.buyer_tax_id || '-'}</td>
                  <td className="p-4 text-right">${inv.total_amount?.toLocaleString()}</td>
                  <td className="p-4 text-center">{inv.category}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${statusLabels[inv.status]?.color || 'bg-gray-100'}`}>
                      {statusLabels[inv.status]?.label || inv.status}
                    </span>
                  </td>
                  <td className="p-4 text-center text-gray-500">
                    {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 設定 Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSettingsModal(false)}>
          <div className="bg-white rounded-xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">ezPay 發票設定</h2>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">商店代號 (MerchantID)</label>
                <input type="text" value={settingsForm.merchant_id} onChange={e => setSettingsForm({ ...settingsForm, merchant_id: e.target.value })} className="w-full border rounded-lg px-4 py-2" placeholder="例：347148408" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">HashKey</label>
                <input type="text" value={settingsForm.hash_key} onChange={e => setSettingsForm({ ...settingsForm, hash_key: e.target.value })} className="w-full border rounded-lg px-4 py-2 font-mono text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">HashIV</label>
                <input type="text" value={settingsForm.hash_iv} onChange={e => setSettingsForm({ ...settingsForm, hash_iv: e.target.value })} className="w-full border rounded-lg px-4 py-2 font-mono text-sm" />
              </div>
              {message.text && (
                <div className={`px-4 py-2 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {message.text}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowSettingsModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">取消</button>
                <button onClick={handleSaveSettings} disabled={saving} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
                  {saving ? '儲存中...' : '儲存設定'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 開立發票 Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowIssueModal(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">開立電子發票</h2>
              <button onClick={() => setShowIssueModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">買受人名稱 *</label>
                  <input type="text" value={issueForm.buyer_name} onChange={e => setIssueForm({ ...issueForm, buyer_name: e.target.value })} className="w-full border rounded-lg px-4 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input type="email" value={issueForm.buyer_email} onChange={e => setIssueForm({ ...issueForm, buyer_email: e.target.value })} className="w-full border rounded-lg px-4 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">發票類型</label>
                  <select value={issueForm.category} onChange={e => setIssueForm({ ...issueForm, category: e.target.value })} className="w-full border rounded-lg px-4 py-2">
                    <option value="B2C">B2C (個人)</option>
                    <option value="B2B">B2B (公司)</option>
                  </select>
                </div>
                {issueForm.category === 'B2B' && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">統一編號 *</label>
                    <input type="text" value={issueForm.buyer_tax_id} onChange={e => setIssueForm({ ...issueForm, buyer_tax_id: e.target.value })} className="w-full border rounded-lg px-4 py-2" />
                  </div>
                )}
              </div>

              <hr />

              <div>
                <label className="block text-sm font-medium mb-1">品項名稱 *</label>
                <select 
                  onChange={e => handleSelectProduct(e.target.value)} 
                  className="w-full border rounded-lg px-4 py-2 mb-2"
                  value={showCustomItem ? '__custom__' : issueForm.item_name}
                >
                  <option value="">-- 選擇品項 --</option>
                  {allProducts.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                  <option value="__custom__">✏️ 自行輸入...</option>
                </select>
                {showCustomItem && (
                  <input 
                    type="text" 
                    value={issueForm.item_name} 
                    onChange={e => setIssueForm({ ...issueForm, item_name: e.target.value })} 
                    className="w-full border rounded-lg px-4 py-2" 
                    placeholder="輸入自訂品項名稱"
                    autoFocus
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">金額（含稅）*</label>
                <input type="number" value={issueForm.total_price} onChange={e => setIssueForm({ ...issueForm, total_price: e.target.value })} className="w-full border rounded-lg px-4 py-2" placeholder="例：10500" />
                {issueForm.total_price && (
                  <div className="bg-gray-50 rounded-lg p-3 mt-2 text-sm">
                    <div className="flex justify-between"><span>未稅金額：</span><span>${priceCalc.amt.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>營業稅 5%：</span><span>${priceCalc.tax.toLocaleString()}</span></div>
                    <div className="flex justify-between font-bold border-t pt-2 mt-2"><span>含稅總計：</span><span>${priceCalc.total.toLocaleString()}</span></div>
                  </div>
                )}
              </div>

              <hr />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">載具類型</label>
                  <select value={issueForm.carrier_type} onChange={e => setIssueForm({ ...issueForm, carrier_type: e.target.value })} className="w-full border rounded-lg px-4 py-2">
                    <option value="">無（列印紙本）</option>
                    <option value="0">手機條碼</option>
                    <option value="1">自然人憑證</option>
                    <option value="2">ezPay 載具</option>
                  </select>
                </div>
                {issueForm.carrier_type && (
                  <div>
                    <label className="block text-sm font-medium mb-1">載具號碼</label>
                    <input type="text" value={issueForm.carrier_num} onChange={e => setIssueForm({ ...issueForm, carrier_num: e.target.value })} className="w-full border rounded-lg px-4 py-2" placeholder={issueForm.carrier_type === '0' ? '/ABC+123' : ''} />
                  </div>
                )}
              </div>

              {message.text && (
                <div className={`px-4 py-2 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {message.text}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowIssueModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">取消</button>
                <button onClick={handleIssueInvoice} disabled={issuing} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2">
                  {issuing ? '開立中...' : <><Check className="w-4 h-4" />開立發票</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
