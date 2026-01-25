export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - 取得單一人員
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('acct_freelancers')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;

    // 取得相關勞報單統計
    const { data: reports } = await supabase
      .from('acct_labor_reports')
      .select('id, gross_amount, net_amount, status, created_at')
      .eq('freelancer_id', params.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const totalReports = reports?.length || 0;
    const totalAmount = reports?.reduce((sum, r) => sum + (r.gross_amount || 0), 0) || 0;

    return NextResponse.json({
      data: {
        ...data,
        total_reports: totalReports,
        total_amount: totalAmount,
        recent_reports: reports || [],
      }
    });
  } catch (error) {
    console.error('Error fetching freelancer:', error);
    return NextResponse.json({ error: '取得人員失敗' }, { status: 500 });
  }
}

// PUT - 更新人員
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // 允許更新的欄位
    const allowedFields = [
      'name', 'english_name', 'id_number', 'birthday',
      'phone', 'email', 'address',
      'line_user_id', 'line_display_name',
      'bank_code', 'bank_name', 'bank_account', 'bank_account_name',
      'is_union_member', 'is_active', 'notes',
      'id_card_front', 'id_card_back', 'passbook_image',
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    // 判斷資料是否完整
    const { data: current } = await supabase
      .from('acct_freelancers')
      .select('id_number, bank_code, bank_account')
      .eq('id', params.id)
      .single();

    const idNumber = updateData.id_number ?? current?.id_number;
    const bankCode = updateData.bank_code ?? current?.bank_code;
    const bankAccount = updateData.bank_account ?? current?.bank_account;
    updateData.is_complete = !!(idNumber && bankCode && bankAccount);

    const { data, error } = await supabase
      .from('acct_freelancers')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating freelancer:', error);
    return NextResponse.json({ error: '更新人員失敗' }, { status: 500 });
  }
}

// DELETE - 刪除人員
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 檢查是否有關聯的勞報單
    const { data: reports } = await supabase
      .from('acct_labor_reports')
      .select('id')
      .eq('freelancer_id', params.id)
      .limit(1);

    if (reports && reports.length > 0) {
      // 有關聯資料，改為停用
      const { error } = await supabase
        .from('acct_freelancers')
        .update({ is_active: false })
        .eq('id', params.id);

      if (error) throw error;

      return NextResponse.json({ 
        success: true, 
        message: '人員已停用（有關聯勞報單，無法刪除）' 
      });
    }

    // 無關聯資料，直接刪除
    const { error } = await supabase
      .from('acct_freelancers')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: '人員已刪除' });
  } catch (error) {
    console.error('Error deleting freelancer:', error);
    return NextResponse.json({ error: '刪除人員失敗' }, { status: 500 });
  }
}
