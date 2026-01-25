import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data, error } = await supabase.from('acct_contracts').update({
    signature_token: token,
    signature_token_expires_at: expiresAt.toISOString(),
    status: 'pending_signature',
  }).eq('id', id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const signUrl = `https://mommy-wisdom-accounting.vercel.app/sign/${token}`;
  return NextResponse.json({ token, sign_url: signUrl, expires_at: expiresAt.toISOString() });
}
