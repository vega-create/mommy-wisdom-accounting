export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const LINE_API_URL = 'https://api.line.me/v2/bot/message/reply';

async function replyMessage(replyToken: string, accessToken: string, text: string) {
  await fetch(LINE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }]
    }),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const events = JSON.parse(body);
    console.log('LINE Webhook received:', JSON.stringify(events, null, 2));

    const { data: settings } = await supabase
      .from('acct_line_settings')
      .select('channel_access_token')
      .limit(1)
      .single();

    const accessToken = settings?.channel_access_token;

    for (const event of events.events || []) {
      const sourceType = event.source?.type;
      const groupId = event.source?.groupId || event.source?.roomId;
      const userId = event.source?.userId;
      const replyToken = event.replyToken;

      if (event.type === 'message' && event.message?.type === 'text') {
        const text = event.message.text.trim().toLowerCase();
        
        if (text === '!groupid' || text === '/groupid' || text === 'groupid') {
          if (accessToken && replyToken) {
            let reply = '';
            if (sourceType === 'group' && groupId) {
              reply = `📋 群組 ID:\n${groupId}`;
            } else if (sourceType === 'room' && groupId) {
              reply = `📋 聊天室 ID:\n${groupId}`;
            } else if (sourceType === 'user' && userId) {
              reply = `📋 用戶 ID:\n${userId}`;
            } else {
              reply = '無法取得 ID';
            }
            await replyMessage(replyToken, accessToken, reply);
          }
          continue;
        }
      }

      if ((sourceType === 'group' || sourceType === 'room') && groupId) {
        const { data: existing } = await supabase
          .from('acct_line_groups')
          .select('id')
          .eq('group_id', groupId)
          .single();

        if (!existing) {
          const { data: company } = await supabase
            .from('acct_companies')
            .select('id')
            .limit(1)
            .single();

          if (company) {
            await supabase
              .from('acct_line_groups')
              .insert({
                company_id: company.id,
                group_id: groupId,
                group_name: `${sourceType === 'group' ? '群組' : '聊天室'} (自動偵測)`,
                group_type: sourceType,
                is_active: true,
                description: `自動偵測於 ${new Date().toLocaleString('zh-TW')}`
              });
            
            console.log(`新群組已記錄: ${groupId}`);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook 處理失敗' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'LINE Webhook is ready' });
}
