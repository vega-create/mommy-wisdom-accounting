import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - 取得應付款項列表
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
      .from('acct_payable_requests')
      .select('*')
      .eq('company_id', companyId)
      .order('due_date', { ascending: true });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Payables GET error:', error);
      return NextResponse.json({ error: `取得應付款項失敗: ${error.message}` }, { status: 500 });
    }

    // 檢查逾期狀態
    const now = new Date();
    const processedData = (data || []).map(item => {
      if (item.status === 'pending' && new Date(item.due_date) < now) {
        return { ...item, status: 'overdue' };
      }
      return item;
    });

    return NextResponse.json({ data: processedData });
  } catch (error) {
    console.error('Error fetching payables:', error);
    return NextResponse.json({ error: '取得應付款項失敗' }, { status: 500 });
  }
}

// POST - 新增應付款項
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { 
      company_id,
      vendor_id,
      vendor_name,
      vendor_type,
      title,
      description,
      amount,
      due_date,
      invoice_number,
      notes,
      billing_request_id,
      labor_report_id
    } = body;

    if (!company_id || !vendor_name || !amount || !due_date || !title) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    // 產生應付單號
    const { data: numberData } = await supabase
      .rpc('generate_payable_number', { p_company_id: company_id });
    
    const payable_number = numberData || `PAY${Date.now()}`;

    const { data, error } = await supabase
      .from('acct_payable_requests')
      .insert({
        company_id,
        payable_number,
        vendor_id,
        vendor_name,
        vendor_type: vendor_type || 'company',
        title,
        description,
        amount: parseFloat(amount),
        due_date,
        invoice_number,
        notes,
        billing_request_id,
        labor_report_id,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Payable insert error:', error);
      return NextResponse.json({ error: `新增應付款項失敗: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating payable:', error);
    return NextResponse.json({ error: '新增應付款項失敗' }, { status: 500 });
  }
}

// PUT - 更新應付款項
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('acct_payable_requests')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Payable update error:', error);
      return NextResponse.json({ error: `更新應付款項失敗: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating payable:', error);
    return NextResponse.json({ error: '更新應付款項失敗' }, { status: 500 });
  }
}

// DELETE - 刪除應付款項
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('acct_payable_requests')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Payable delete error:', error);
      return NextResponse.json({ error: `刪除應付款項失敗: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payable:', error);
    return NextResponse.json({ error: '刪除應付款項失敗' }, { status: 500 });
  }
}
