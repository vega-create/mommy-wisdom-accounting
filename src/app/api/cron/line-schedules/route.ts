export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

// 發送 LINE 訊息
async function sendLineMessage(accessToken: string, to: string, text: string) {
  const response = await fetch(LINE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text }]
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'LINE API 錯誤');
  }

  return response;
}

// 替換模板變數
function replaceVariables(content: string, variables: Record<string, string>) {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

// 計算下次執行時間
function calculateNextRunAt(schedule: {
  schedule_type: string;
  schedule_time?: string;
  schedule_day_of_week?: number;
  schedule_day_of_month?: number;
  schedule_day_of_month_2?: number;
  schedule_month?: number;
  last_run_at?: string;
}): Date | null {
  if (schedule.schedule_type === 'once') {
    return null; // 單次排程執行後不再排程
  }
  
  if (!schedule.schedule_time) return null;
  
  const [hours, minutes] = schedule.schedule_time.split(':').map(Number);
  let nextRun = new Date();
  nextRun.setUTCHours(hours - 8, minutes, 0, 0);
  
  // 設為下一個週期
  if (schedule.schedule_type === 'daily') {
    nextRun.setDate(nextRun.getDate() + 1);
  } else if (schedule.schedule_type === 'weekly') {
    nextRun.setDate(nextRun.getDate() + 7);
  } else if (schedule.schedule_type === 'biweekly') {
    nextRun.setDate(nextRun.getDate() + 14);
  } else if (schedule.schedule_type === 'monthly') {
    nextRun.setMonth(nextRun.getMonth() + 1);
  } else if (schedule.schedule_type === 'twice_monthly') {
    // 每月2次：判斷下一個日期
    const day1 = schedule.schedule_day_of_month ?? 1;
    const day2 = schedule.schedule_day_of_month_2 ?? 15;
    const currentDate = nextRun.getDate();
    
    if (currentDate === day1) {
      // 剛執行完 day1，下次是 day2
      nextRun.setDate(day2);
    } else {
      // 剛執行完 day2，下次是下個月的 day1
      nextRun.setMonth(nextRun.getMonth() + 1);
      nextRun.setDate(day1);
    }
  } else if (schedule.schedule_type === 'yearly') {
    nextRun.setFullYear(nextRun.getFullYear() + 1);
  }
  
  return nextRun;
}

// GET - Cron Job 執行排程
export async function GET(request: NextRequest) {
  // 驗證 Cron 密鑰（可選，增加安全性）
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // 如果設定了密鑰但不匹配，仍然允許執行（方便測試）
    console.log('Warning: CRON_SECRET mismatch or not set');
  }

  try {
    const now = new Date();
    console.log(`[CRON] 開始執行排程檢查 - ${now.toISOString()}`);

    // 查詢需要執行的排程
    const { data: schedules, error: scheduleError } = await supabase
      .from('acct_line_schedules')
      .select(`
        *,
        template:acct_line_templates(content)
      `)
      .eq('status', 'active')
      .lte('next_run_at', now.toISOString());

    if (scheduleError) throw scheduleError;

    if (!schedules || schedules.length === 0) {
      console.log('[CRON] 沒有需要執行的排程');
      return NextResponse.json({ 
        success: true, 
        message: '沒有需要執行的排程',
        executed: 0 
      });
    }

    console.log(`[CRON] 找到 ${schedules.length} 個待執行排程`);

    let successCount = 0;
    let failCount = 0;

    for (const schedule of schedules) {
      try {
        // 取得公司的 LINE 設定
        const { data: settings } = await supabase
          .from('acct_line_settings')
          .select('channel_access_token')
          .eq('company_id', schedule.company_id)
          .eq('is_active', true)
          .single();

        if (!settings?.channel_access_token) {
          console.log(`[CRON] 排程 ${schedule.id} 的公司沒有有效的 LINE 設定`);
          continue;
        }

        // 準備訊息內容
        let messageContent = schedule.custom_content || schedule.template?.content;
        if (!messageContent) {
          console.log(`[CRON] 排程 ${schedule.id} 沒有訊息內容`);
          continue;
        }

        // 替換變數
        if (schedule.variables && Object.keys(schedule.variables).length > 0) {
          messageContent = replaceVariables(messageContent, schedule.variables);
        }

        // 發送訊息
        await sendLineMessage(
          settings.channel_access_token,
          schedule.recipient_id,
          messageContent
        );

        // 記錄發送成功
        const { data: message } = await supabase
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
            sent_at: new Date().toISOString()
          })
          .select()
          .single();

        // 記錄執行日誌
        await supabase
          .from('acct_line_schedule_logs')
          .insert({
            schedule_id: schedule.id,
            status: 'success',
            message_id: message?.id
          });

        // 更新排程狀態
        const nextRunAt = calculateNextRunAt(schedule);
        const newStatus = schedule.schedule_type === 'once' ? 'completed' : 'active';

        await supabase
          .from('acct_line_schedules')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRunAt,
            run_count: (schedule.run_count || 0) + 1,
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', schedule.id);

        successCount++;
        console.log(`[CRON] 排程 ${schedule.id} 執行成功`);

      } catch (error) {
        failCount++;
        const errorMessage = error instanceof Error ? error.message : '未知錯誤';
        console.error(`[CRON] 排程 ${schedule.id} 執行失敗:`, errorMessage);

        // 記錄失敗日誌
        await supabase
          .from('acct_line_schedule_logs')
          .insert({
            schedule_id: schedule.id,
            status: 'failed',
            error_message: errorMessage
          });
      }
    }

    return NextResponse.json({
      success: true,
      message: `執行完成：成功 ${successCount}，失敗 ${failCount}`,
      executed: successCount,
      failed: failCount
    });

  } catch (error) {
    console.error('[CRON] 排程執行錯誤:', error);
    return NextResponse.json({ 
      success: false, 
      error: '排程執行失敗' 
    }, { status: 500 });
  }
}

// POST - 給 pg_cron 呼叫用
export async function POST(request: NextRequest) {
  return GET(request);
}
