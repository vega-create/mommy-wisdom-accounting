import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - 取得單一報價單
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('acct_quotations')
    .select(`
      *,
      customer:acct_customers(*),
      items:acct_quotation_items(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PUT - 更新報價單
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();

  const { items, ...quotationData } = body;

  // 更新報價單
  const { data, error } = await supabase
    .from('acct_quotations')
    .update(quotationData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 更新明細：先刪除再新增
  if (items) {
    await supabase.from('acct_quotation_items').delete().eq('quotation_id', id);

    if (items.length > 0) {
      const itemsWithQuotationId = items.map((item: any, index: number) => ({
        ...item,
        quotation_id: id,
        item_order: index,
      }));
      await supabase.from('acct_quotation_items').insert(itemsWithQuotationId);
    }
  }

  return NextResponse.json(data);
}

// DELETE - 刪除報價單
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from('acct_quotations')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
