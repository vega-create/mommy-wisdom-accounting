import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    const companyId = searchParams.get('company_id');

    if (!customerId || !companyId) {
      return NextResponse.json({ error: '缺少參數' }, { status: 400 });
    }

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
