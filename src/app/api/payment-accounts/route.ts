export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - 取得收款帳戶列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('acct_payment_accounts')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching payment accounts:', error);
    return NextResponse.json({ error: '取得收款帳戶失敗' }, { status: 500 });
  }
}

// POST - 新增收款帳戶
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      company_id,
      bank_code,
      bank_name,
      branch_name,
      account_number,
      account_name,
      is_default = false
    } = body;

    if (!company_id || !bank_code || !bank_name || !account_number || !account_name) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    // 如果設為預設，先取消其他預設
    if (is_default) {
      await supabase
        .from('acct_payment_accounts')
        .update({ is_default: false })
        .eq('company_id', company_id);
    }

    const { data, error } = await supabase
      .from('acct_payment_accounts')
      .insert({
        company_id,
        bank_code,
        bank_name,
        branch_name,
        account_number,
        account_name,
        is_default
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating payment account:', error);
    return NextResponse.json({ error: '新增收款帳戶失敗' }, { status: 500 });
  }
}

// PUT - 更新收款帳戶
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, company_id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    // 如果設為預設，先取消其他預設
    if (updates.is_default && company_id) {
      await supabase
        .from('acct_payment_accounts')
        .update({ is_default: false })
        .eq('company_id', company_id)
        .neq('id', id);
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('acct_payment_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating payment account:', error);
    return NextResponse.json({ error: '更新收款帳戶失敗' }, { status: 500 });
  }
}

// DELETE - 刪除收款帳戶（軟刪除）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('acct_payment_accounts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment account:', error);
    return NextResponse.json({ error: '刪除收款帳戶失敗' }, { status: 500 });
  }
}
