export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 計算下次執行時間
function calculateNextRunAt(scheduleType: string, scheduleDay: number, scheduleMonth?: number): Date {
  const now = new Date();
  let nextRun = new Date();

  // 設定台灣時間早上 9 點執行
  nextRun.setUTCHours(1, 0, 0, 0); // UTC 1:00 = 台灣 9:00

  if (scheduleType === 'monthly') {
    nextRun.setDate(scheduleDay);
    if (nextRun <= now) {
      nextRun.setMonth(nextRun.getMonth() + 1);
    }
  } else if (scheduleType === 'quarterly') {
    // 每季：1月、4月、7月、10月
    const currentMonth = now.getMonth();
    const quarterMonths = [0, 3, 6, 9]; // 1月、4月、7月、10月
    let targetMonth = quarterMonths.find(m => m > currentMonth);
    if (targetMonth === undefined) {
      targetMonth = 0; // 明年1月
      nextRun.setFullYear(nextRun.getFullYear() + 1);
    }
    nextRun.setMonth(targetMonth, scheduleDay);
    if (nextRun <= now) {
      const nextQuarterIndex = quarterMonths.indexOf(targetMonth) + 1;
      if (nextQuarterIndex >= quarterMonths.length) {
        nextRun.setFullYear(nextRun.getFullYear() + 1);
        nextRun.setMonth(0, scheduleDay);
      } else {
        nextRun.setMonth(quarterMonths[nextQuarterIndex], scheduleDay);
      }
    }
  } else if (scheduleType === 'yearly') {
    nextRun.setMonth((scheduleMonth || 1) - 1, scheduleDay);
    if (nextRun <= now) {
      nextRun.setFullYear(nextRun.getFullYear() + 1);
    }
  }

  return nextRun;
}

// GET - 取得週期性請款列表
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('acct_recurring_billings')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching recurring billings:', error);
    return NextResponse.json({ error: '取得週期性請款失敗' }, { status: 500 });
  }
}

// POST - 新增週期性請款
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const {
      company_id,
      customer_id,
      customer_name,
      customer_line_group_id,
      customer_line_group_name,
      title,
      description,
      amount,
      tax_amount = 0,
      cost_amount,
      cost_vendor_id,
      cost_vendor_name,
      payment_account_id,
      schedule_type,
      schedule_day,
      schedule_month,
      days_before_due = 14
    } = body;

    if (!company_id || !customer_name || !title || !amount || !schedule_type || !schedule_day) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    // 計算下次執行時間
    const next_run_at = calculateNextRunAt(schedule_type, schedule_day, schedule_month);

    const { data, error } = await supabase
      .from('acct_recurring_billings')
      .insert({
        company_id,
        customer_id: customer_id || null,
        customer_name,
        customer_line_group_id: customer_line_group_id || null,
        customer_line_group_name: customer_line_group_name || null,
        title,
        description: description || null,
        amount: parseFloat(amount),
        tax_amount: parseFloat(tax_amount || 0),
        cost_amount: cost_amount ? parseFloat(cost_amount) : null,
        cost_vendor_id: cost_vendor_id || null,
        cost_vendor_name: cost_vendor_name || null,
        payment_account_id: payment_account_id || null,
        schedule_type,
        schedule_day,
        schedule_month: schedule_month || null,
        days_before_due,
        next_run_at: next_run_at.toISOString(),
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating recurring billing:', error);
    return NextResponse.json({ error: '新增週期性請款失敗' }, { status: 500 });
  }
}

// PUT - 更新週期性請款
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    // 如果更新了週期設定，重新計算下次執行時間
    if (updates.schedule_type || updates.schedule_day || updates.schedule_month) {
      const { data: current } = await supabase
        .from('acct_recurring_billings')
        .select('schedule_type, schedule_day, schedule_month')
        .eq('id', id)
        .single();

      const scheduleType = updates.schedule_type || current?.schedule_type;
      const scheduleDay = updates.schedule_day || current?.schedule_day;
      const scheduleMonth = updates.schedule_month || current?.schedule_month;

      updates.next_run_at = calculateNextRunAt(scheduleType, scheduleDay, scheduleMonth).toISOString();
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('acct_recurring_billings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating recurring billing:', error);
    return NextResponse.json({ error: '更新週期性請款失敗' }, { status: 500 });
  }
}

// DELETE - 刪除週期性請款
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('acct_recurring_billings')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting recurring billing:', error);
    return NextResponse.json({ error: '刪除週期性請款失敗' }, { status: 500 });
  }
}