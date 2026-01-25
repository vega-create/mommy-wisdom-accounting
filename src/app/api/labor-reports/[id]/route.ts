export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - 取得單筆勞報單
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data, error } = await supabase
      .from('acct_labor_reports')
      .select(`
        *,
        freelancer:acct_freelancers(id, name, phone, email, is_union_member, bank_code, bank_account),
        billing_request:acct_billing_requests(id, billing_number, customer_id, amount),
        payable:acct_payables(id, payable_number, status, paid_at),
        transaction:acct_transactions(id, transaction_date, description)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '勞報單不存在' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching labor report:', error);
    return NextResponse.json({ error: '取得勞報單失敗' }, { status: 500 });
  }
}

// PUT - 更新勞報單
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // 檢查勞報單是否存在且可編輯
    const { data: existing } = await supabase
      .from('acct_labor_reports')
      .select('status')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: '勞報單不存在' }, { status: 404 });
    }

    if (existing.status === 'paid') {
      return NextResponse.json({ error: '已付款的勞報單無法修改' }, { status: 400 });
    }

    // 過濾可更新的欄位
    const allowedFields = [
      'staff_name', 'id_number', 'is_union_member', 'income_type_code',
      'work_description', 'service_period_start', 'service_period_end',
      'gross_amount', 'withholding_tax', 'nhi_premium', 'net_amount',
      'billing_request_id', 'bank_code', 'bank_account', 'status'
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('acct_labor_reports')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating labor report:', error);
    return NextResponse.json({ error: '更新勞報單失敗' }, { status: 500 });
  }
}

// DELETE - 刪除勞報單
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 檢查勞報單狀態
    const { data: existing } = await supabase
      .from('acct_labor_reports')
      .select('status')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: '勞報單不存在' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: '只能刪除草稿狀態的勞報單' }, { status: 400 });
    }

    const { error } = await supabase
      .from('acct_labor_reports')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting labor report:', error);
    return NextResponse.json({ error: '刪除勞報單失敗' }, { status: 500 });
  }
}
