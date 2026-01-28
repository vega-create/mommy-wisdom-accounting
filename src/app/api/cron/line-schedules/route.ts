export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ✅ 變數替換函數
function replaceVariables(content: string, variables: Record<string, string> | null): string {
  if (!content || !variables) return content;

  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
}

export async function POST() {
  try {
    const supabase = await createClient();
    const now = new Date();

    // 查詢需要執行的排程（next_run_at <= now 且狀態為 active）
    const { data: schedules, error } = await supabase
      .from('acct_line_schedules')
      .select('*, template:acct_line_templates(content)')
      .eq('status', 'active')
      .lte('next_run_at', now.toISOString());

    if (error) {
      console.error('[CRON] 查詢排程錯誤:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[CRON] 找到 ${schedules?.length || 0} 個待執行排程`);

    let sentCount = 0;

    for (const schedule of schedules || []) {
      try {
        // 取得 LINE 設定
        const { data: settings } = await supabase
          .from('acct_line_settings')
          .select('channel_access_token')
          .eq('company_id', schedule.company_id)
          .eq('is_active', true)
          .single();

        if (!settings?.channel_access_token) {
          console.log(`[CRON] 排程 ${schedule.id} 無 LINE 設定，跳過`);
          continue;
        }

        // 決定訊息內容
        let messageContent = schedule.custom_content || schedule.template?.content;
        if (!messageContent) {
          console.log(`[CRON] 排程 ${schedule.id} 無訊息內容，跳過`);
          continue;
        }

        // ✅ 替換變數
        messageContent = replaceVariables(messageContent, schedule.variables);

        // 發送 LINE 訊息
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.channel_access_token}`,
          },
          body: JSON.stringify({
            to: schedule.recipient_id,
            messages: [{ type: 'text', text: messageContent }],
          }),
        });

        if (response.ok) {
          sentCount++;
          console.log(`[CRON] 排程 ${schedule.id} 發送成功`);

          // 計算下次執行時間
          const nextRunAt = calculateNextRunAt(schedule);

          // 更新排程狀態
          await supabase
            .from('acct_line_schedules')
            .update({
              last_run_at: now.toISOString(),
              next_run_at: nextRunAt?.toISOString() || null,
              run_count: (schedule.run_count || 0) + 1,
              status: schedule.schedule_type === 'once' ? 'completed' : 'active'
            })
            .eq('id', schedule.id);

          // 記錄發送歷史（✅ 記錄替換後的內容）
          await supabase
            .from('acct_line_messages')
            .insert({
              company_id: schedule.company_id,
              template_id: schedule.template_id,
              recipient_type: schedule.recipient_type,
              recipient_id: schedule.recipient_id,
              recipient_name: schedule.recipient_name,
              message_type: 'text',
              content: messageContent,
              status: 'sent',
              sent_at: now.toISOString()
            });

        } else {
          const errorData = await response.json();
          console.error(`[CRON] 排程 ${schedule.id} 發送失敗:`, errorData);
        }
      } catch (scheduleError) {
        console.error(`[CRON] 處理排程 ${schedule.id} 錯誤:`, scheduleError);
      }
    }

    return NextResponse.json({ success: true, sent: sentCount, total: schedules?.length || 0 });
  } catch (error: any) {
    console.error('[CRON] 排程執行錯誤:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 計算下次執行時間
function calculateNextRunAt(schedule: any): Date | null {
  if (schedule.schedule_type === 'once') return null;

  if (!schedule.schedule_time) return null;

  const [hours, minutes] = schedule.schedule_time.split(':').map(Number);
  let nextRun = new Date();
  nextRun.setUTCHours(hours - 8, minutes, 0, 0); // 台灣時間轉 UTC

  const now = new Date();

  switch (schedule.schedule_type) {
    case 'daily':
      nextRun.setDate(nextRun.getDate() + 1);
      break;
    case 'weekly':
      nextRun.setDate(nextRun.getDate() + 7);
      break;
    case 'biweekly':
      nextRun.setDate(nextRun.getDate() + 14);
      break;
    case 'monthly':
      nextRun.setMonth(nextRun.getMonth() + 1);
      nextRun.setDate(schedule.schedule_day_of_month || 1);
      break;
    case 'twice_monthly':
      const currentDay = now.getDate();
      const day1 = schedule.schedule_day_of_month || 1;
      const day2 = schedule.schedule_day_of_month_2 || 15;
      if (currentDay < day2) {
        nextRun.setDate(day2);
      } else {
        nextRun.setMonth(nextRun.getMonth() + 1);
        nextRun.setDate(day1);
      }
      break;
    case 'yearly':
      nextRun.setFullYear(nextRun.getFullYear() + 1);
      break;
  }

  return nextRun;
}

export async function GET() {
  return POST();
}