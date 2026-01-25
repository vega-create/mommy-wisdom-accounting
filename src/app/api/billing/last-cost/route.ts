import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - 取得該客戶上一筆請款單的成本設定
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    const companyId = searchParams.get('company_id');

    if (!customerId || !companyId) {
      return NextResponse.json({ error: '缺少參數' }, { status: 400 });
    }

    // 查詢該客戶最近一筆有成本資訊的請款單
    const { data, error } = await supabase
      .from('acct_billing_requests')
      .select('cost_vendor_id, cost_vendor_name, cost_amount')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .not('cost_vendor_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching last cost:', error);
    return NextResponse.json({ data: null });
  }
}
