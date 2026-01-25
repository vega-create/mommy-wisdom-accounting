import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data, error } = await supabase
    .from('acct_contracts')
    .select('*, items:acct_contract_items(*)')
    .eq('signature_token', token)
    .gt('signature_token_expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: '連結無效或已過期' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json();
  const { signature, signer_name } = body;

  const ip = request.headers.get('x-forwarded-for') || 'unknown';

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
    return NextResponse.json({ error: '簽署失敗' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
