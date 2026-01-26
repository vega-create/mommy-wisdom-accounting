import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

async function sendLineNotification(accessToken: string, groupId: string, message: string) {
  const response = await fetch(LINE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: 'text', text: message }]
    }),
  });
  return response.ok;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // 取得合約資料
  const { data: contract } = await supabase
    .from('acct_contracts')
    .select('*, customer:acct_customers(*)')
    .eq('id', id)
    .single();

  if (!contract) {
    return NextResponse.json({ error: '找不到合約' }, { status: 404 });
  }

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

  // 發送 LINE 通知
  let lineSent = false;
  if (contract.customer?.line_group_id && contract.customer?.line_notify_enabled) {
    try {
      const { data: lineSettings } = await supabase
        .from('acct_line_settings')
        .select('channel_access_token, is_active')
        .eq('company_id', contract.company_id)
        .single();

      if (lineSettings?.channel_access_token && lineSettings?.is_active) {
        const message = `📋 合約簽署通知\n\n` +
          `合約編號：${contract.contract_number}\n` +
          `主旨：${contract.title}\n` +
          `金額：$${contract.total_amount?.toLocaleString()}\n\n` +
          `請點擊下方連結進行簽署：\n${signUrl}\n\n` +
          `連結有效期限：7天`;

        lineSent = await sendLineNotification(
          lineSettings.channel_access_token,
          contract.customer.line_group_id,
          message
        );

        if (lineSent) {
          await supabase
            .from('acct_contracts')
            .update({ line_notified_at: new Date().toISOString() })
            .eq('id', id);
        }
      }
    } catch (e) {
      console.error('LINE notification error:', e);
    }
  }

  return NextResponse.json({ 
    token, 
    sign_url: signUrl, 
    expires_at: expiresAt.toISOString(),
    line_sent: lineSent 
  });
}
