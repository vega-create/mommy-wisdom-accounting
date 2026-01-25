export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - 取得外包人員列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const activeOnly = searchParams.get('active_only') !== 'false';
    const search = searchParams.get('search');

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    let query = supabase
      .from('acct_freelancers')
      .select('*')
      .eq('company_id', companyId)
      .order('name');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,id_number.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // 取得每位人員的勞報統計
    const freelancersWithStats = await Promise.all(
      (data || []).map(async (freelancer) => {
        const { data: stats } = await supabase
          .from('acct_labor_reports')
          .select('net_amount')
          .eq('freelancer_id', freelancer.id)
          .in('status', ['signed', 'paid']);

        const totalReports = stats?.length || 0;
        const totalAmount = stats?.reduce((sum, r) => sum + (r.net_amount || 0), 0) || 0;

        return {
          ...freelancer,
          total_reports: totalReports,
          total_amount: totalAmount,
        };
      })
    );

    return NextResponse.json({ data: freelancersWithStats });
  } catch (error) {
    console.error('Error fetching freelancers:', error);
    return NextResponse.json({ error: '取得外包人員失敗' }, { status: 500 });
  }
}

// POST - 新增外包人員
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      company_id,
      name,
      id_number,
      phone,
      email,
      address,
      line_user_id,
      is_union_member = false,
      bank_code,
      bank_name,
      bank_branch,
      bank_account,
      notes,
    } = body;

    if (!company_id || !name) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    // 檢查身分證是否重複
    if (id_number) {
      const { data: existing } = await supabase
        .from('acct_freelancers')
        .select('id')
        .eq('company_id', company_id)
        .eq('id_number', id_number)
        .single();

      if (existing) {
        return NextResponse.json({ error: '此身分證字號已存在' }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('acct_freelancers')
      .insert({
        company_id,
        name,
        id_number: id_number || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        line_user_id: line_user_id || null,
        is_union_member,
        bank_code: bank_code || null,
        bank_name: bank_name || null,
        bank_branch: bank_branch || null,
        bank_account: bank_account || null,
        notes: notes || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating freelancer:', error);
    return NextResponse.json({ error: '新增外包人員失敗' }, { status: 500 });
  }
}
