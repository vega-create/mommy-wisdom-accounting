export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - 取得單筆外包人員
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data, error } = await supabase
      .from('acct_freelancers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '外包人員不存在' }, { status: 404 });
      }
      throw error;
    }

    // 取得勞報統計
    const { data: reports } = await supabase
      .from('acct_labor_reports')
      .select('id, report_number, gross_amount, net_amount, status, created_at')
      .eq('freelancer_id', id)
      .order('created_at', { ascending: false });

    const stats = {
      total_reports: reports?.length || 0,
      total_amount: reports?.reduce((sum, r) => sum + (r.net_amount || 0), 0) || 0,
      recent_reports: reports?.slice(0, 5) || [],
    };

    return NextResponse.json({ data: { ...data, stats } });
  } catch (error) {
    console.error('Error fetching freelancer:', error);
    return NextResponse.json({ error: '取得外包人員失敗' }, { status: 500 });
  }
}

// PUT - 更新外包人員
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const allowedFields = [
      'name', 'id_number', 'phone', 'email', 'address',
      'line_user_id', 'is_union_member',
      'bank_code', 'bank_name', 'bank_branch', 'bank_account',
      'notes', 'is_active'
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('acct_freelancers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating freelancer:', error);
    return NextResponse.json({ error: '更新外包人員失敗' }, { status: 500 });
  }
}

// DELETE - 刪除外包人員（軟刪除）
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 檢查是否有關聯的勞報單
    const { data: reports } = await supabase
      .from('acct_labor_reports')
      .select('id')
      .eq('freelancer_id', id)
      .limit(1);

    if (reports && reports.length > 0) {
      // 有關聯資料，改為停用
      const { error } = await supabase
        .from('acct_freelancers')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      return NextResponse.json({ 
        success: true, 
        message: '已停用（有關聯勞報單，無法完全刪除）' 
      });
    }

    // 無關聯資料，可以刪除
    const { error } = await supabase
      .from('acct_freelancers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting freelancer:', error);
    return NextResponse.json({ error: '刪除外包人員失敗' }, { status: 500 });
  }
}
