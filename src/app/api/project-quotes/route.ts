export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const status = searchParams.get('status');
    const projectType = searchParams.get('project_type');
    const search = searchParams.get('search');

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    let query = supabase
      .from('acct_project_quotes')
      .select('*')
      .eq('company_id', companyId)
      .order('quote_date', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // 新增：專案類型篩選
    if (projectType && projectType !== 'all') {
      query = query.eq('project_type', projectType);
    }

    if (search) {
      query = query.or(`client_name.ilike.%${search}%,project_item.ilike.%${search}%,vendor_name.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching project quotes:', error);
    return NextResponse.json({ error: '取得專案報價失敗' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { company_id, quote_date, client_name, project_item, vendor_name, cost_price, cost_note, selling_price, selling_note, status, project_type, notes } = body;

    if (!company_id || !client_name || !project_item) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('acct_project_quotes')
      .insert({
        company_id,
        quote_date: quote_date || new Date().toISOString().split('T')[0],
        client_name,
        project_item,
        vendor_name: vendor_name || null,
        cost_price: cost_price ? parseFloat(cost_price) : null,
        cost_note: cost_note || null,
        selling_price: selling_price ? parseFloat(selling_price) : null,
        selling_note: selling_note || null,
        status: status || 'discussing',
        project_type: project_type || 'quote',
        notes: notes || null
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating project quote:', error);
    return NextResponse.json({ error: '新增專案報價失敗' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    if (updates.cost_price === '') updates.cost_price = null;
    if (updates.selling_price === '') updates.selling_price = null;
    if (updates.cost_price) updates.cost_price = parseFloat(updates.cost_price);
    if (updates.selling_price) updates.selling_price = parseFloat(updates.selling_price);

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('acct_project_quotes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating project quote:', error);
    return NextResponse.json({ error: '更新專案報價失敗' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const { error } = await supabase.from('acct_project_quotes').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project quote:', error);
    return NextResponse.json({ error: '刪除專案報價失敗' }, { status: 500 });
  }
}