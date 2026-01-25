'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

interface Item { item_name: string; description: string; quantity: number; unit: string; unit_price: number; amount: number; }

export default function QuotationEditPage() {
  const params = useParams();
  const router = useRouter();
  const { company } = useAuthStore();
  const isNew = params.id === 'new';

  const [form, setForm] = useState({ customer_name: '', customer_tax_id: '', customer_email: '', customer_phone: '', contact_person: '', title: '', description: '', payment_terms: '', notes: '', tax_type: 'taxable' });
  const [items, setItems] = useState<Item[]>([{ item_name: '', description: '', quantity: 1, unit: '式', unit_price: 0, amount: 0 }]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!isNew) fetchQuotation(); }, [params.id]);

  const fetchQuotation = async () => {
    const res = await fetch(`/api/quotations/${params.id}`);
    const data = await res.json();
    setForm({ customer_name: data.customer_name || '', customer_tax_id: data.customer_tax_id || '', customer_email: data.customer_email || '', customer_phone: data.customer_phone || '', contact_person: data.contact_person || '', title: data.title || '', description: data.description || '', payment_terms: data.payment_terms || '', notes: data.notes || '', tax_type: data.tax_type || 'taxable' });
    if (data.items?.length > 0) setItems(data.items);
    setLoading(false);
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
    const url = isNew ? '/api/quotations' : `/api/quotations/${params.id}`;
    const res = await fetch(url, { method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    setSaving(false);
    if (data.error) alert(data.error); else router.push('/dashboard/quotations');
  };

  if (loading) return <div className="p-6">載入中...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{isNew ? '新增報價單' : '編輯報價單'}</h1>
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold mb-4">客戶資訊</h2>
        <div className="grid grid-cols-2 gap-4">
          <input placeholder="客戶名稱 *" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="border rounded-lg px-4 py-2" />
          <input placeholder="統一編號" value={form.customer_tax_id} onChange={(e) => setForm({ ...form, customer_tax_id: e.target.value })} className="border rounded-lg px-4 py-2" />
          <input placeholder="聯絡人" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="border rounded-lg px-4 py-2" />
          <input placeholder="電話" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} className="border rounded-lg px-4 py-2" />
          <input placeholder="Email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} className="border rounded-lg px-4 py-2 col-span-2" />
        </div>
      </div>
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold mb-4">報價內容</h2>
        <input placeholder="報價主旨 *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded-lg px-4 py-2 mb-4" />
        <textarea placeholder="說明" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-lg px-4 py-2 mb-4" rows={3} />
        <input placeholder="付款條件" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} className="w-full border rounded-lg px-4 py-2" />
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
