'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

interface Item { item_name: string; description: string; quantity: number; unit: string; unit_price: number; amount: number; }
interface Customer { id: string; name: string; tax_id: string; email: string; phone: string; contact_person: string; line_group_id: string; line_group_name: string; }

export default function ContractEditPage() {
  const params = useParams();
  const router = useRouter();
  const { company } = useAuthStore();
  const isNew = params.id === 'new';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({ customer_id: '', customer_name: '', customer_tax_id: '', customer_email: '', customer_phone: '', contact_person: '', title: '', description: '', payment_terms: '', terms_and_conditions: '', notes: '', tax_type: 'taxable', start_date: '', end_date: '' });
  const [items, setItems] = useState<Item[]>([{ item_name: '', description: '', quantity: 1, unit: '式', unit_price: 0, amount: 0 }]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [signatureInfo, setSignatureInfo] = useState<any>(null);
  const [showCustomCustomer, setShowCustomCustomer] = useState(false);

  useEffect(() => { 
    fetchCustomers();
    if (!isNew) fetchContract(); 
  }, [params.id, company?.id]);

  const fetchCustomers = async () => {
    if (!company?.id) return;
    const { data } = await supabase.from('acct_customers').select('*').eq('company_id', company.id).eq('is_active', true).order('name');
    setCustomers(data || []);
  };

  const fetchContract = async () => {
    const res = await fetch(`/api/contracts/${params.id}`);
    const data = await res.json();
    setForm({ 
      customer_id: data.customer_id || '', 
      customer_name: data.customer_name || '', 
      customer_tax_id: data.customer_tax_id || '', 
      customer_email: data.customer_email || '', 
      customer_phone: data.customer_phone || '', 
      contact_person: data.contact_person || '', 
      title: data.title || '', 
      description: data.description || '', 
      payment_terms: data.payment_terms || '', 
      terms_and_conditions: data.terms_and_conditions || '', 
      notes: data.notes || '', 
      tax_type: data.tax_type || 'taxable', 
      start_date: data.start_date || '', 
      end_date: data.end_date || '' 
    });
    if (data.items?.length > 0) setItems(data.items);
    if (data.customer_signed_at) setSignatureInfo({ signed_at: data.customer_signed_at, signed_name: data.customer_signed_name, signature: data.customer_signature });
    setLoading(false);
  };

  const handleCustomerChange = (customerId: string) => {
    if (customerId === 'custom') {
      setShowCustomCustomer(true);
      setForm({ ...form, customer_id: '', customer_name: '', customer_tax_id: '', customer_email: '', customer_phone: '', contact_person: '' });
    } else if (customerId) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setShowCustomCustomer(false);
        setForm({
          ...form,
          customer_id: customer.id,
          customer_name: customer.name,
          customer_tax_id: customer.tax_id || '',
          customer_email: customer.email || '',
          customer_phone: customer.phone || '',
          contact_person: customer.contact_person || '',
        });
      }
    } else {
      setShowCustomCustomer(false);
      setForm({ ...form, customer_id: '', customer_name: '', customer_tax_id: '', customer_email: '', customer_phone: '', contact_person: '' });
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') newItems[index].amount = newItems[index].quantity * newItems[index].unit_price;
    setItems(newItems);
  };

  const addItem = () => setItems([...items, { item_name: '', description: '', quantity: 1, unit: '式', unit_price: 0, amount: 0 }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const calcSubtotal = () => items.reduce((sum, i) => sum + (i.amount || 0), 0);
  const calcTax = () => form.tax_type === 'taxable' ? Math.round(calcSubtotal() * 0.05) : 0;
  const calcTotal = () => calcSubtotal() + calcTax();

  const handleSave = async () => {
    if (!form.customer_name || !form.title) { alert('請填寫客戶名稱和主旨'); return; }
    setSaving(true);
    const payload = { ...form, company_id: company?.id, subtotal: calcSubtotal(), tax_amount: calcTax(), total_amount: calcTotal(), items };
    const url = isNew ? '/api/contracts' : `/api/contracts/${params.id}`;
    const res = await fetch(url, { method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    setSaving(false);
    if (data.error) alert(data.error); else router.push('/dashboard/contracts');
  };

  if (loading) return <div className="p-6">載入中...</div>;

  const selectedCustomer = customers.find(c => c.id === form.customer_id);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{isNew ? '新增合約' : '編輯合約'}</h1>
      {signatureInfo && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <div className="font-semibold text-green-700 mb-2">✓ 客戶已簽署</div>
          <div className="text-sm text-gray-600">簽署人：{signatureInfo.signed_name}</div>
          <div className="text-sm text-gray-600">簽署時間：{new Date(signatureInfo.signed_at).toLocaleString()}</div>
          {signatureInfo.signature && <img src={signatureInfo.signature} alt="簽名" className="mt-2 border rounded h-20" />}
        </div>
      )}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold mb-4">客戶資訊</h2>
        
        {/* 客戶下拉選單 */}
        <div className="mb-4">
          <label className="block text-sm text-gray-500 mb-1">選擇客戶</label>
          <select 
            value={showCustomCustomer ? 'custom' : form.customer_id} 
            onChange={(e) => handleCustomerChange(e.target.value)}
            className="w-full border rounded-lg px-4 py-2"
          >
            <option value="">-- 選擇客戶 --</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.tax_id ? `(${c.tax_id})` : ''} {c.line_group_name ? `📱${c.line_group_name}` : ''}
              </option>
            ))}
            <option value="custom">✏️ 自行輸入...</option>
          </select>
        </div>

        {/* 顯示已選客戶的 LINE 群組 */}
        {selectedCustomer?.line_group_name && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg text-sm text-green-700">
            📱 LINE 群組：{selectedCustomer.line_group_name}（產生連結時會自動發送通知）
          </div>
        )}

        {/* 客戶詳細資訊 */}
        <div className="grid grid-cols-2 gap-4">
          <input 
            placeholder="客戶名稱 *" 
            value={form.customer_name} 
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })} 
            className="border rounded-lg px-4 py-2"
            disabled={!showCustomCustomer && !!form.customer_id}
          />
          <input 
            placeholder="統一編號" 
            value={form.customer_tax_id} 
            onChange={(e) => setForm({ ...form, customer_tax_id: e.target.value })} 
            className="border rounded-lg px-4 py-2"
            disabled={!showCustomCustomer && !!form.customer_id}
          />
          <input 
            placeholder="聯絡人" 
            value={form.contact_person} 
            onChange={(e) => setForm({ ...form, contact_person: e.target.value })} 
            className="border rounded-lg px-4 py-2"
          />
          <input 
            placeholder="電話" 
            value={form.customer_phone} 
            onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} 
            className="border rounded-lg px-4 py-2"
          />
          <input 
            placeholder="Email" 
            value={form.customer_email} 
            onChange={(e) => setForm({ ...form, customer_email: e.target.value })} 
            className="border rounded-lg px-4 py-2 col-span-2"
          />
        </div>
      </div>
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold mb-4">合約內容</h2>
        <input placeholder="合約主旨 *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded-lg px-4 py-2 mb-4" />
        <textarea placeholder="合約說明" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-lg px-4 py-2 mb-4" rows={3} />
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div><label className="text-sm text-gray-500">開始日期</label><input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full border rounded-lg px-4 py-2" /></div>
          <div><label className="text-sm text-gray-500">結束日期</label><input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full border rounded-lg px-4 py-2" /></div>
        </div>
        <input placeholder="付款條件" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} className="w-full border rounded-lg px-4 py-2 mb-4" />
        <textarea placeholder="條款與條件" value={form.terms_and_conditions} onChange={(e) => setForm({ ...form, terms_and_conditions: e.target.value })} className="w-full border rounded-lg px-4 py-2" rows={4} />
      </div>
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">項目明細</h2>
          <button onClick={addItem} className="text-blue-600 hover:underline text-sm">+ 新增項目</button>
        </div>
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
            <input placeholder="項目名稱" value={item.item_name} onChange={(e) => updateItem(i, 'item_name', e.target.value)} className="col-span-4 border rounded px-2 py-1" />
            <input type="number" placeholder="數量" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} className="col-span-2 border rounded px-2 py-1" />
            <input placeholder="單位" value={item.unit} onChange={(e) => updateItem(i, 'unit', e.target.value)} className="col-span-1 border rounded px-2 py-1" />
            <input type="number" placeholder="單價" value={item.unit_price} onChange={(e) => updateItem(i, 'unit_price', Number(e.target.value))} className="col-span-2 border rounded px-2 py-1" />
            <div className="col-span-2 text-right">${item.amount?.toLocaleString()}</div>
            <button onClick={() => removeItem(i)} className="col-span-1 text-red-500 hover:text-red-700">✕</button>
          </div>
        ))}
        <div className="border-t mt-4 pt-4 text-right">
          <div>小計: ${calcSubtotal().toLocaleString()}</div>
          <div>稅額 (5%): ${calcTax().toLocaleString()}</div>
          <div className="text-xl font-bold text-red-600">總計: ${calcTotal().toLocaleString()}</div>
        </div>
      </div>
      <div className="flex gap-4">
        <button onClick={() => router.back()} className="px-6 py-2 border rounded-lg hover:bg-gray-50">取消</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">{saving ? '儲存中...' : '儲存'}</button>
      </div>
    </div>
  );
}
