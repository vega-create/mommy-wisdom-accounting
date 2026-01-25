import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - 取得報價單列表
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company_id');
  const status = searchParams.get('status');

  let query = supabase
    .from('acct_quotations')
    .select(`
      *,
      customer:acct_customers(id, name),
      items:acct_quotation_items(*)
    `)
    .order('created_at', { ascending: false });

  if (companyId) query = query.eq('company_id', companyId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST - 新增報價單
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '未登入' }, { status: 401 });
  }

  const { items, ...quotationData } = body;

  // 產生報價單號
  const { data: numData } = await supabase
    .rpc('generate_quotation_number', { p_company_id: quotationData.company_id });

  const quotation = {
    ...quotationData,
    quotation_number: numData || `Q-${Date.now()}`,
    created_by: user.id,
  };

  // 新增報價單
  const { data, error } = await supabase
    .from('acct_quotations')
    .insert(quotation)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 新增明細
  if (items && items.length > 0) {
    const itemsWithQuotationId = items.map((item: any, index: number) => ({
      ...item,
      quotation_id: data.id,
      item_order: index,
    }));

    await supabase.from('acct_quotation_items').insert(itemsWithQuotationId);
  }

  return NextResponse.json(data);
}
