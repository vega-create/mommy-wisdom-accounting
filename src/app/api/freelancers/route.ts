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
    const search = searchParams.get('search');
    const activeOnly = searchParams.get('active') !== 'false';

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    let query = supabase
      .from('acct_freelancers')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // 計算每位人員的統計資料
    const freelancersWithStats = await Promise.all(
      (data || []).map(async (freelancer) => {
        const { data: reports } = await supabase
          .from('acct_labor_reports')
          .select('gross_amount')
          .eq('freelancer_id', freelancer.id);

        const totalReports = reports?.length || 0;
        const totalAmount = reports?.reduce((sum, r) => sum + (r.gross_amount || 0), 0) || 0;

        return {
          ...freelancer,
          total_reports: totalReports,
          total_amount: totalAmount,
        };
      })
    );

    // 搜尋過濾
    let result = freelancersWithStats;
    if (search) {
      const searchLower = search.toLowerCase();
      result = freelancersWithStats.filter(f =>
        f.name?.toLowerCase().includes(searchLower) ||
        f.id_number?.toLowerCase().includes(searchLower) ||
        f.phone?.includes(search)
      );
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Error fetching freelancers:', error);
    return NextResponse.json({ error: '取得人員失敗' }, { status: 500 });
  }
}

// POST - 新增外包人員
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Creating freelancer:', body);

    const {
      company_id,
      name,
      english_name,
      id_number,
      birthday,
      phone,
      email,
      address,
      line_user_id,
      line_display_name,
      bank_code,
      bank_name,
      bank_account,
      bank_account_name,
      is_union_member = false,
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

    const insertData: Record<string, any> = {
      company_id,
      name,
      is_active: true,
    };

    // 可選欄位
    if (english_name) insertData.english_name = english_name;
    if (id_number) insertData.id_number = id_number;
    if (birthday) insertData.birthday = birthday;
    if (phone) insertData.phone = phone;
    if (email) insertData.email = email;
    if (address) insertData.address = address;
    if (line_user_id) insertData.line_user_id = line_user_id;
    if (line_display_name) insertData.line_display_name = line_display_name;
    if (bank_code) insertData.bank_code = bank_code;
    if (bank_name) insertData.bank_name = bank_name;
    if (bank_account) insertData.bank_account = bank_account;
    if (bank_account_name) insertData.bank_account_name = bank_account_name;
    if (notes) insertData.notes = notes;
    insertData.is_union_member = is_union_member;

    // 判斷資料是否完整
    insertData.is_complete = !!(id_number && bank_code && bank_account);

    const { data, error } = await supabase
      .from('acct_freelancers')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json({ error: `新增失敗: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating freelancer:', error);
    return NextResponse.json({ error: '新增外包人員失敗' }, { status: 500 });
  }
}
