import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company_id');
  const status = searchParams.get('status');

  let query = supabase
    .from('acct_quotations')
    .select('*')
    .order('created_at', { ascending: false });

  if (companyId) query = query.eq('company_id', companyId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { items, ...quotationData } = body;

  // 產生報價單號
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('acct_quotations')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', quotationData.company_id);
  
  const quotationNumber = `Q-${year}-${String((count || 0) + 1).padStart(3, '0')}`;

  const quotation = {
    ...quotationData,
    quotation_number: quotationNumber,
    quotation_date: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'draft',
  };

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
