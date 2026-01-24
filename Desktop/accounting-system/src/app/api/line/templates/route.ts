import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - 取得模板列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('acct_line_templates')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching LINE templates:', error);
    return NextResponse.json({ error: '取得模板失敗' }, { status: 500 });
  }
}

// POST - 新增模板
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, name, category, content, variables, created_by } = body;

    if (!company_id || !name || !content) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    // 自動從內容中提取變數 {{xxx}}
    const extractedVars = content.match(/\{\{(\w+)\}\}/g)?.map((v: string) => v.replace(/[{}]/g, '')) || [];
    const finalVariables = variables || extractedVars;

    const { data, error } = await supabase
      .from('acct_line_templates')
      .insert({
        company_id,
        name,
        category,
        content,
        variables: finalVariables,
        is_active: true,
        usage_count: 0,
        created_by
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating LINE template:', error);
    return NextResponse.json({ error: '新增模板失敗' }, { status: 500 });
  }
}

// PUT - 更新模板
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, category, content, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (content !== undefined) {
      updateData.content = content;
      // 重新提取變數
      const extractedVars = content.match(/\{\{(\w+)\}\}/g)?.map((v: string) => v.replace(/[{}]/g, '')) || [];
      updateData.variables = extractedVars;
    }
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('acct_line_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating LINE template:', error);
    return NextResponse.json({ error: '更新模板失敗' }, { status: 500 });
  }
}

// DELETE - 刪除模板
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('acct_line_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting LINE template:', error);
    return NextResponse.json({ error: '刪除模板失敗' }, { status: 500 });
  }
}
