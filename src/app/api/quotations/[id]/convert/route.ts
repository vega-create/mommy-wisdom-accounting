import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const quotationId = params.id;

  // 取得報價單
  const { data: quotation, error: qError } = await supabase
    .from('acct_quotations')
    .select('*')
    .eq('id', quotationId)
    .single();

  if (qError || !quotation) {
    return NextResponse.json({ error: '找不到報價單' }, { status: 404 });
  }

  // 取得報價單明細
  const { data: items } = await supabase
    .from('acct_quotation_items')
    .select('*')
    .eq('quotation_id', quotationId);

  // 產生合約編號
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('acct_contracts')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', quotation.company_id);
  
  const contractNumber = `C-${year}-${String((count || 0) + 1).padStart(3, '0')}`;

  // 建立合約
  const contract = {
    company_id: quotation.company_id,
    quotation_id: quotationId,
    contract_number: contractNumber,
    contract_date: new Date().toISOString().split('T')[0],
    customer_id: quotation.customer_id,
    customer_name: quotation.customer_name,
    customer_tax_id: quotation.customer_tax_id,
    customer_email: quotation.customer_email,
    customer_phone: quotation.customer_phone,
    contact_person: quotation.contact_person,
    title: quotation.title,
    description: quotation.description,
    subtotal: quotation.subtotal,
    tax_type: quotation.tax_type,
    tax_amount: quotation.tax_amount,
    total_amount: quotation.total_amount,
    payment_terms: quotation.payment_terms,
    notes: quotation.notes,
    status: 'draft',
  };

  const { data: newContract, error: cError } = await supabase
    .from('acct_contracts')
    .insert(contract)
    .select()
    .single();

  if (cError) {
    return NextResponse.json({ error: cError.message }, { status: 500 });
  }

  // 複製明細到合約
  if (items && items.length > 0) {
    const contractItems = items.map((item: any) => ({
      contract_id: newContract.id,
      item_name: item.item_name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      amount: item.amount,
      item_order: item.item_order,
    }));
    await supabase.from('acct_contract_items').insert(contractItems);
  }

  // 更新報價單狀態
  await supabase
    .from('acct_quotations')
    .update({ status: 'converted' })
    .eq('id', quotationId);

  return NextResponse.json({ contract_id: newContract.id, contract_number: contractNumber });
}
