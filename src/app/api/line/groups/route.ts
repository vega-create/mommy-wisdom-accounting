export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - 取得群組列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('acct_line_groups')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching LINE groups:', error);
    return NextResponse.json({ error: '取得群組失敗' }, { status: 500 });
  }
}

// POST - 新增群組
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, group_id, group_name, group_type, description } = body;

    if (!company_id || !group_name || !group_id) {
      return NextResponse.json({ 
        error: '缺少必要欄位' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('acct_line_groups')
      .insert({
        company_id,
        group_id,
        group_name,
        group_type: group_type || 'group',
        description,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating LINE group:', error);
    return NextResponse.json({ error: '新增群組失敗' }, { status: 500 });
  }
}

// PUT - 更新群組
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, group_name, group_type, description, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (group_name !== undefined) updateData.group_name = group_name;
    if (group_type !== undefined) updateData.group_type = group_type;
    if (description !== undefined) updateData.description = description;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('acct_line_groups')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating LINE group:', error);
    return NextResponse.json({ error: '更新群組失敗' }, { status: 500 });
  }
}

// DELETE - 刪除群組（軟刪除）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('acct_line_groups')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting LINE group:', error);
    return NextResponse.json({ error: '刪除群組失敗' }, { status: 500 });
  }
}
