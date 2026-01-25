import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company_id');
  const status = searchParams.get('status');

  let query = supabase
    .from('acct_contracts')
    .select('*, customer:acct_customers(id, name), items:acct_contract_items(*)')
    .order('created_at', { ascending: false });

  if (companyId) query = query.eq('company_id', companyId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const { items, ...contractData } = body;
  const { data: numData } = await supabase.rpc('generate_contract_number', { p_company_id: contractData.company_id });

  const contract = { ...contractData, contract_number: numData, created_by: user.id };
  const { data, error } = await supabase.from('acct_contracts').insert(contract).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (items?.length > 0) {
    const itemsData = items.map((item: any, i: number) => ({ ...item, contract_id: data.id, item_order: i }));
    await supabase.from('acct_contract_items').insert(itemsData);
  }
  return NextResponse.json(data);
}
