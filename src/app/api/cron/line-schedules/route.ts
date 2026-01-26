export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const currentDay = now.getDay();

    const { data: schedules, error } = await supabase
      .from('acct_line_schedules')
      .select('*, template:acct_line_templates(*), group:acct_line_groups(*)')
      .eq('is_active', true)
      .eq('send_time', currentTime);

    if (error) {
      console.error('[CRON] 查詢排程錯誤:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let sentCount = 0;

    for (const schedule of schedules || []) {
      const shouldSend = 
        schedule.frequency === 'daily' ||
        (schedule.frequency === 'weekly' && schedule.send_days?.includes(currentDay)) ||
        (schedule.frequency === 'monthly' && now.getDate() === schedule.send_day_of_month);

      if (!shouldSend) continue;

      const { data: settings } = await supabase
        .from('acct_line_settings')
        .select('channel_access_token')
        .eq('company_id', schedule.company_id)
        .single();

      if (!settings?.channel_access_token) continue;

      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.channel_access_token}`,
        },
        body: JSON.stringify({
          to: schedule.group?.group_id,
          messages: [{ type: 'text', text: schedule.template?.content || schedule.message }],
        }),
      });

      if (response.ok) {
        sentCount++;
        await supabase
          .from('acct_line_schedules')
          .update({ last_sent_at: now.toISOString() })
          .eq('id', schedule.id);
      }
    }

    return NextResponse.json({ success: true, sent: sentCount });
  } catch (error: any) {
    console.error('[CRON] 排程執行錯誤:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
