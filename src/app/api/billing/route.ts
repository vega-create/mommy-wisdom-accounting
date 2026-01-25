export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';


// GET - 取得請款單列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const status = searchParams.get('status');
    const customerId = searchParams.get('customer_id');

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    let query = supabase
      .from('acct_billing_requests')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Billing GET error:', error);
      return NextResponse.json({ error: `取得請款單失敗: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching billing requests:', error);
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    return NextResponse.json({ error: `取得請款單失敗: ${errorMessage}` }, { status: 500 });
  }
}

// POST - 新增請款單
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      company_id,
      customer_id,
      customer_name,
      customer_email,
      customer_line_id,
      customer_line_group_id,
      customer_line_group_name,
      title,
      description,
      billing_month,
      amount,
      tax_amount = 0,
      cost_amount = 0,
      cost_vendor_id,
      cost_vendor_name,
      cost_description,
      payment_account_id,
      due_date,
      created_by
    } = body;

    if (!company_id || !customer_name || !amount || !due_date || !title) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    // 產生請款單號
    const { data: numberData } = await supabase
      .rpc('generate_billing_number', { p_company_id: company_id });
    
    const billing_number = numberData || `BIL${Date.now()}`;
    const total_amount = parseFloat(amount) + parseFloat(tax_amount || 0);

    const { data, error } = await supabase
      .from('acct_billing_requests')
      .insert({
        company_id,
        billing_number,
        customer_id,
        customer_name,
        customer_email,
        customer_line_id,
        customer_line_group_id,
        customer_line_group_name,
        title,
        description,
        billing_month,
        amount: parseFloat(amount),
        tax_amount: parseFloat(tax_amount || 0),
        total_amount,
        cost_amount: cost_amount ? parseFloat(cost_amount) : null,
        cost_vendor_id: cost_vendor_id || null,
        cost_vendor_name: cost_vendor_name || null,
        cost_description,
        payment_account_id,
        due_date,
        status: 'draft',
        created_by
      })
      .select()
      .single();

    if (error) {
      console.error('Billing insert error:', error);
      return NextResponse.json({ error: `新增請款單失敗: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating billing request:', error);
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    return NextResponse.json({ error: `新增請款單失敗: ${errorMessage}` }, { status: 500 });
  }
}

// PUT - 更新請款單
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    // 重新計算總金額
    if (updates.amount !== undefined || updates.tax_amount !== undefined) {
      const amount = parseFloat(updates.amount || 0);
      const tax = parseFloat(updates.tax_amount || 0);
      updates.total_amount = amount + tax;
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('acct_billing_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating billing request:', error);
    return NextResponse.json({ error: '更新請款單失敗' }, { status: 500 });
  }
}

// DELETE - 刪除請款單
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    // 只能刪除草稿狀態的請款單
    const { data: billing } = await supabase
      .from('acct_billing_requests')
      .select('status')
      .eq('id', id)
      .single();

    if (billing?.status !== 'draft') {
      return NextResponse.json({ error: '只能刪除草稿狀態的請款單' }, { status: 400 });
    }

    const { error } = await supabase
      .from('acct_billing_requests')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting billing request:', error);
    return NextResponse.json({ error: '刪除請款單失敗' }, { status: 500 });
  }
}
