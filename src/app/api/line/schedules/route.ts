export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 計算下次執行時間
function calculateNextRunAt(schedule: {
  schedule_type: string;
  scheduled_at?: string;
  schedule_time?: string;
  schedule_day_of_week?: number;
  schedule_day_of_month?: number;
  schedule_day_of_month_2?: number;
  schedule_month?: number;
  last_run_at?: string;
}): Date | null {
  const now = new Date();
  
  if (schedule.schedule_type === 'once') {
    if (!schedule.scheduled_at) return null;
    // 前端傳來的是台灣時間（無時區），需要轉換為 UTC
    // 例如：2026-01-24T18:50 -> 視為台灣時間 -> 轉為 UTC
    const localDate = new Date(schedule.scheduled_at);
    // 減去 8 小時轉為 UTC
    return new Date(localDate.getTime() - 8 * 60 * 60 * 1000);
  }
  
  if (!schedule.schedule_time) return null;
  
  const [hours, minutes] = schedule.schedule_time.split(':').map(Number);
  let nextRun = new Date();
  nextRun.setUTCHours(hours - 8, minutes, 0, 0); // 轉換為 UTC (台灣時間 -8)
  
  if (schedule.schedule_type === 'daily') {
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
  } else if (schedule.schedule_type === 'weekly') {
    const targetDay = schedule.schedule_day_of_week ?? 0;
    const currentDay = nextRun.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && nextRun <= now)) {
      daysUntil += 7;
    }
    nextRun.setDate(nextRun.getDate() + daysUntil);
  } else if (schedule.schedule_type === 'biweekly') {
    // 每兩週
    const targetDay = schedule.schedule_day_of_week ?? 0;
    const currentDay = nextRun.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && nextRun <= now)) {
      daysUntil += 7;
    }
    nextRun.setDate(nextRun.getDate() + daysUntil);
    
    // 如果上次執行是一週前，再加一週
    if (schedule.last_run_at) {
      const lastRun = new Date(schedule.last_run_at);
      const daysSinceLastRun = Math.floor((now.getTime() - lastRun.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastRun < 14) {
        // 距離上次執行不到兩週，下次執行應該是上次 + 14 天
        nextRun = new Date(lastRun);
        nextRun.setDate(nextRun.getDate() + 14);
        nextRun.setUTCHours(hours - 8, minutes, 0, 0);
      }
    }
  } else if (schedule.schedule_type === 'monthly') {
    const targetDate = schedule.schedule_day_of_month ?? 1;
    nextRun.setDate(targetDate);
    if (nextRun <= now) {
      nextRun.setMonth(nextRun.getMonth() + 1);
    }
  } else if (schedule.schedule_type === 'twice_monthly') {
    // 每月2次
    const day1 = schedule.schedule_day_of_month ?? 1;
    const day2 = schedule.schedule_day_of_month_2 ?? 15;
    const currentDate = now.getDate();
    
    // 找出下一個要執行的日期
    let targetDate: number;
    if (currentDate < day1 || (currentDate === day1 && nextRun > now)) {
      targetDate = day1;
    } else if (currentDate < day2 || (currentDate === day2 && nextRun > now)) {
      targetDate = day2;
    } else {
      // 這個月都過了，下個月的第一個日期
      targetDate = day1;
      nextRun.setMonth(nextRun.getMonth() + 1);
    }
    nextRun.setDate(targetDate);
  } else if (schedule.schedule_type === 'yearly') {
    // 每年
    const targetMonth = (schedule.schedule_month ?? 1) - 1; // 0-indexed
    const targetDate = schedule.schedule_day_of_month ?? 1;
    nextRun.setMonth(targetMonth, targetDate);
    if (nextRun <= now) {
      nextRun.setFullYear(nextRun.getFullYear() + 1);
    }
  }
  
  return nextRun;
}

// GET - 取得排程列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('acct_line_schedules')
      .select(`
        *,
        template:acct_line_templates(id, name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json({ error: '取得排程失敗' }, { status: 500 });
  }
}

// POST - 新增排程
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      company_id, 
      name,
      recipient_type, 
      recipient_id, 
      recipient_name,
      template_id,
      custom_content,
      variables,
      schedule_type,
      scheduled_at,
      schedule_time,
      schedule_day_of_week,
      schedule_day_of_month,
      schedule_day_of_month_2,
      schedule_month
    } = body;

    if (!company_id || !name || !recipient_id || !schedule_type) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    // 根據排程類型決定需要的欄位
    const needsDayOfWeek = ['weekly', 'biweekly'].includes(schedule_type);
    const needsDayOfMonth = ['monthly', 'twice_monthly', 'yearly'].includes(schedule_type);
    const needsDayOfMonth2 = schedule_type === 'twice_monthly';
    const needsMonth = schedule_type === 'yearly';

    // 計算下次執行時間
    const next_run_at = calculateNextRunAt({
      schedule_type,
      scheduled_at,
      schedule_time,
      schedule_day_of_week,
      schedule_day_of_month,
      schedule_day_of_month_2,
      schedule_month
    });

    const { data, error } = await supabase
      .from('acct_line_schedules')
      .insert({
        company_id,
        name,
        recipient_type: recipient_type || 'group',
        recipient_id,
        recipient_name,
        template_id: template_id || null,
        custom_content: custom_content || null,
        variables: variables || {},
        schedule_type,
        scheduled_at: schedule_type === 'once' ? scheduled_at : null,
        schedule_time: schedule_type !== 'once' ? schedule_time : null,
        schedule_day_of_week: needsDayOfWeek ? schedule_day_of_week : null,
        schedule_day_of_month: needsDayOfMonth ? schedule_day_of_month : null,
        schedule_day_of_month_2: needsDayOfMonth2 ? schedule_day_of_month_2 : null,
        schedule_month: needsMonth ? schedule_month : null,
        next_run_at,
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating schedule:', error);
    return NextResponse.json({ error: '新增排程失敗' }, { status: 500 });
  }
}

// PUT - 更新排程
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    // 如果更新排程設定，重新計算下次執行時間
    if (updates.schedule_type || updates.scheduled_at || updates.schedule_time) {
      const next_run_at = calculateNextRunAt({
        schedule_type: updates.schedule_type,
        scheduled_at: updates.scheduled_at,
        schedule_time: updates.schedule_time,
        schedule_day_of_week: updates.schedule_day_of_week,
        schedule_day_of_month: updates.schedule_day_of_month,
        schedule_day_of_month_2: updates.schedule_day_of_month_2,
        schedule_month: updates.schedule_month
      });
      updateData.next_run_at = next_run_at;
    }

    if (status) {
      updateData.status = status;
    }

    const { data, error } = await supabase
      .from('acct_line_schedules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating schedule:', error);
    return NextResponse.json({ error: '更新排程失敗' }, { status: 500 });
  }
}

// DELETE - 刪除排程
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('acct_line_schedules')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return NextResponse.json({ error: '刪除排程失敗' }, { status: 500 });
  }
}
