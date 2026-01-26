export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - 取得外包人員列表
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
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
    const supabase = await createClient();
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

// PUT - 更新外包人員
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json();

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    const allowedFields = [
      'name', 'english_name', 'id_number', 'birthday', 'phone', 'email',
      'address', 'line_user_id', 'line_display_name', 'bank_code', 'bank_name',
      'bank_account', 'bank_account_name', 'is_union_member', 'notes', 'is_active'
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    // 更新完整性判斷
    if (body.id_number !== undefined || body.bank_code !== undefined || body.bank_account !== undefined) {
      const { data: current } = await supabase
        .from('acct_freelancers')
        .select('id_number, bank_code, bank_account')
        .eq('id', id)
        .single();

      const idNum = body.id_number ?? current?.id_number;
      const bankCode = body.bank_code ?? current?.bank_code;
      const bankAcct = body.bank_account ?? current?.bank_account;
      updateData.is_complete = !!(idNum && bankCode && bankAcct);
    }

    const { data, error } = await supabase
      .from('acct_freelancers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Database update error:', error);
      return NextResponse.json({ error: `更新失敗: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating freelancer:', error);
    return NextResponse.json({ error: '更新外包人員失敗' }, { status: 500 });
  }
}

// DELETE - 刪除外包人員
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('acct_freelancers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting freelancer:', error);
    return NextResponse.json({ error: '刪除外包人員失敗' }, { status: 500 });
  }
}