export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 計算下次執行時間
function calculateNextRunAt(scheduleType: string, scheduleDay: number, scheduleMonth?: number): Date {
    const now = new Date();
    let nextRun = new Date();

    nextRun.setUTCHours(1, 0, 0, 0); // UTC 1:00 = 台灣 9:00

    if (scheduleType === 'monthly') {
        nextRun.setMonth(nextRun.getMonth() + 1);
        nextRun.setDate(scheduleDay);
    } else if (scheduleType === 'quarterly') {
        const currentMonth = nextRun.getMonth();
        const quarterMonths = [0, 3, 6, 9];
        let nextQuarterIndex = quarterMonths.findIndex(m => m > currentMonth);
        if (nextQuarterIndex === -1) {
            nextRun.setFullYear(nextRun.getFullYear() + 1);
            nextRun.setMonth(0);
        } else {
            nextRun.setMonth(quarterMonths[nextQuarterIndex]);
        }
        nextRun.setDate(scheduleDay);
    } else if (scheduleType === 'yearly') {
        nextRun.setFullYear(nextRun.getFullYear() + 1);
        nextRun.setMonth((scheduleMonth || 1) - 1, scheduleDay);
    }

    return nextRun;
}

export async function POST() {
    try {
        const supabase = await createClient();
        const now = new Date();

        // 查詢需要執行的週期性請款
        const { data: recurringBillings, error } = await supabase
            .from('acct_recurring_billings')
            .select('*')
            .eq('is_active', true)
            .lte('next_run_at', now.toISOString());

        if (error) {
            console.error('[CRON] 查詢週期性請款錯誤:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log(`[CRON] 找到 ${recurringBillings?.length || 0} 個待執行週期性請款`);

        let createdCount = 0;

        for (const recurring of recurringBillings || []) {
            try {
                // 產生請款單號
                const { data: numberData } = await supabase
                    .rpc('generate_billing_number', { p_company_id: recurring.company_id });

                const billing_number = numberData || `BIL${Date.now()}`;
                const total_amount = parseFloat(recurring.amount) + parseFloat(recurring.tax_amount || 0);

                // 計算付款期限
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + (recurring.days_before_due || 14));

                // 建立請款單
                const { data: newBilling, error: insertError } = await supabase
                    .from('acct_billing_requests')
                    .insert({
                        company_id: recurring.company_id,
                        billing_number,
                        customer_id: recurring.customer_id,
                        customer_name: recurring.customer_name,
                        customer_line_group_id: recurring.customer_line_group_id,
                        customer_line_group_name: recurring.customer_line_group_name,
                        title: recurring.title,
                        description: recurring.description,
                        amount: recurring.amount,
                        tax_amount: recurring.tax_amount || 0,
                        total_amount,
                        cost_amount: recurring.cost_amount,
                        cost_vendor_id: recurring.cost_vendor_id,
                        cost_vendor_name: recurring.cost_vendor_name,
                        payment_account_id: recurring.payment_account_id,
                        due_date: dueDate.toISOString().split('T')[0],
                        status: 'pending', // 直接設為待付款，會觸發 LINE 通知
                        recurring_billing_id: recurring.id
                    })
                    .select()
                    .single();

                if (insertError) {
                    console.error(`[CRON] 建立請款單失敗 (${recurring.id}):`, insertError);
                    continue;
                }

                createdCount++;
                console.log(`[CRON] 已建立請款單 ${billing_number} (週期性請款: ${recurring.title})`);

                // 發送 LINE 通知（如果有設定群組）
                if (recurring.customer_line_group_id) {
                    try {
                        // 取得 LINE 設定
                        const { data: lineSettings } = await supabase
                            .from('acct_line_settings')
                            .select('channel_access_token')
                            .eq('company_id', recurring.company_id)
                            .eq('is_active', true)
                            .single();

                        if (lineSettings?.channel_access_token) {
                            const message = `📋 請款通知

親愛的 ${recurring.customer_name}，您好：

${recurring.title}
金額：NT$ ${total_amount.toLocaleString()} 元
付款期限：${dueDate.toLocaleDateString('zh-TW')}

匯款資訊：
彰化銀行 潭子分行
戶名：智慧媽咪國際有限公司
帳號：5765-01-07879-500

如有疑問，請與我們聯繫。`;

                            await fetch('https://api.line.me/v2/bot/message/push', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${lineSettings.channel_access_token}`,
                                },
                                body: JSON.stringify({
                                    to: recurring.customer_line_group_id,
                                    messages: [{ type: 'text', text: message }],
                                }),
                            });

                            console.log(`[CRON] 已發送 LINE 通知到 ${recurring.customer_line_group_name || recurring.customer_line_group_id}`);
                        }
                    } catch (lineError) {
                        console.error(`[CRON] LINE 通知發送失敗:`, lineError);
                    }
                }

                // 更新週期性請款狀態
                const nextRunAt = calculateNextRunAt(
                    recurring.schedule_type,
                    recurring.schedule_day,
                    recurring.schedule_month
                );

                await supabase
                    .from('acct_recurring_billings')
                    .update({
                        last_run_at: now.toISOString(),
                        next_run_at: nextRunAt.toISOString(),
                        run_count: (recurring.run_count || 0) + 1,
                        updated_at: now.toISOString()
                    })
                    .eq('id', recurring.id);

            } catch (itemError) {
                console.error(`[CRON] 處理週期性請款 ${recurring.id} 錯誤:`, itemError);
            }
        }

        return NextResponse.json({
            success: true,
            created: createdCount,
            total: recurringBillings?.length || 0
        });
    } catch (error: any) {
        console.error('[CRON] 週期性請款執行錯誤:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET() {
    return POST();
}