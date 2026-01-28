export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - 取得請款單列表
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const status = searchParams.get('status');

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    let query = supabase
      .from('acct_billing_requests')
      .select(`
        *,
        customer:acct_customers(*),
        payment_account:acct_payment_accounts(*)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching billing requests:', error);
    return NextResponse.json({ error: '取得請款單失敗' }, { status: 500 });
  }
}

// POST - 新增請款單
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
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
      payment_account_id,
      due_date,
      cost_vendor_id,
      cost_vendor_name,
      cost_amount
    } = body;

    if (!company_id || !customer_name || !title || !amount || !due_date) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    // 取得請款單號
    const { data: billingNumber } = await supabase.rpc('generate_billing_number', {
      p_company_id: company_id
    });

    const totalAmount = parseFloat(amount) + parseFloat(tax_amount || 0);

    const { data, error } = await supabase
      .from('acct_billing_requests')
      .insert({
        company_id,
        billing_number: billingNumber,
        customer_id: customer_id || null,
        customer_name,
        customer_email: customer_email || null,
        customer_line_id: customer_line_id || null,
        customer_line_group_id: customer_line_group_id || null,
        customer_line_group_name: customer_line_group_name || null,
        title,
        description: description || null,
        billing_month: billing_month || null,
        amount: parseFloat(amount),
        tax_amount: parseFloat(tax_amount || 0),
        total_amount: totalAmount,
        payment_account_id: payment_account_id || null,
        due_date,
        cost_vendor_id: cost_vendor_id || null,
        cost_vendor_name: cost_vendor_name || null,
        cost_amount: cost_amount ? parseFloat(cost_amount) : null,
        status: 'draft'
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating billing request:', error);
    return NextResponse.json({ error: '新增請款單失敗' }, { status: 500 });
  }
}

// PUT - 更新請款單
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    // 計算總金額
    if (updates.amount !== undefined || updates.tax_amount !== undefined) {
      const amount = parseFloat(updates.amount || 0);
      const taxAmount = parseFloat(updates.tax_amount || 0);
      updates.total_amount = amount + taxAmount;
      updates.amount = amount;
      updates.tax_amount = taxAmount;
    }

    // 處理成本金額
    if (updates.cost_amount !== undefined) {
      updates.cost_amount = updates.cost_amount ? parseFloat(updates.cost_amount) : null;
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
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
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