export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - 取得單一勞報單
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('acct_labor_reports')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('Error fetching labor report:', error);
      return NextResponse.json({ error: '找不到勞報單' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: '取得勞報單失敗' }, { status: 500 });
  }
}

// PUT - 更新勞報單
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
      'staff_type', 'staff_name', 'staff_id', 'id_number',
      'freelancer_id', 'income_type_code', 'is_union_member',
      'work_description', 'service_period_start', 'service_period_end',
      'gross_amount', 'withholding_tax', 'nhi_premium', 'net_amount', 'total_income',
      'billing_request_id', 'bank_code', 'bank_account', 'status',
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    const { data, error } = await supabase
      .from('acct_labor_reports')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating labor report:', error);
      return NextResponse.json({ error: `更新失敗: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: '更新勞報單失敗' }, { status: 500 });
  }
}

// DELETE - 刪除勞報單
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 檢查狀態，只有草稿可以刪除
    const { data: report } = await supabase
      .from('acct_labor_reports')
      .select('status')
      .eq('id', params.id)
      .single();

    if (report && report.status !== 'draft') {
      return NextResponse.json({ error: '只有草稿狀態的勞報單可以刪除' }, { status: 400 });
    }

    const { error } = await supabase
      .from('acct_labor_reports')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting labor report:', error);
      return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: '刪除勞報單失敗' }, { status: 500 });
  }
}
