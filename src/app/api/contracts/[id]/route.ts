import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from('acct_contracts').select('*, customer:acct_customers(*), items:acct_contract_items(*)').eq('id', id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();
  const { items, ...contractData } = body;

  // 處理空字串日期欄位，轉為 null
  const dateFields = ['start_date', 'end_date', 'customer_signed_at', 'company_signed_at', 'signature_token_expires_at', 'last_reminded_at', 'line_notified_at'];
  dateFields.forEach(field => {
    if (contractData[field] === '' || contractData[field] === undefined) {
      contractData[field] = null;
    }
  });

  const { data, error } = await supabase.from('acct_contracts').update(contractData).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (items) {
    await supabase.from('acct_contract_items').delete().eq('contract_id', id);
    if (items.length > 0) {
      const itemsData = items.map((item: any, i: number) => ({ ...item, contract_id: id, item_order: i }));
      await supabase.from('acct_contract_items').insert(itemsData);
    }
  }
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from('acct_contracts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
