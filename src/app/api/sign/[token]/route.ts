import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const supabase = await createClient();
  const token = params.token;

  const { data, error } = await supabase
    .from('acct_contracts')
    .select('*, items:acct_contract_items(*)')
    .eq('signature_token', token)
    .gt('signature_token_expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: '連結無效或已過期' }, { status: 404 });
  }

  // 取得公司資訊
  const { data: company } = await supabase
    .from('acct_companies')
    .select('name, tax_id, address, phone, email, logo_url')
    .eq('id', data.company_id)
    .single();

  return NextResponse.json({ ...data, company });
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const supabase = await createClient();
  const token = params.token;
  const body = await request.json();
  const { signature, signer_name } = body;

  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // 只更新存在的欄位
  const { data, error } = await supabase
    .from('acct_contracts')
    .update({
      customer_signature: signature,
      customer_signed_name: signer_name,
      customer_signed_at: new Date().toISOString(),
      customer_signed_ip: ip,
      status: 'signed',
    })
    .eq('signature_token', token)
    .gt('signature_token_expires_at', new Date().toISOString())
    .select()
    .single();

  if (error) {
    console.error('Sign error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
