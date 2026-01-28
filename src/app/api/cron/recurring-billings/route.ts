export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 計算下次執行時間
function calculateNextRunAt(scheduleType: string, scheduleDay: number, scheduleMonth?: number): Date {
    const now = new Date();
    let nextRun = new Date();

    nextRun.setUTCHours(1, 0, 0, 0);

    if (scheduleType === 'monthly') {
        nextRun.setDate(scheduleDay);
        if (nextRun <= now) {
            nextRun.setMonth(nextRun.getMonth() + 1);
        }
    } else if (scheduleType === 'quarterly') {
        const currentMonth = now.getMonth();
        const quarterMonths = [0, 3, 6, 9];
        let targetMonth = quarterMonths.find(m => m > currentMonth);
        if (targetMonth === undefined) {
            targetMonth = 0;
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

// 替換訊息模板中的變數
function replaceTemplateVariables(
    template: string,
    data: {
        customerName: string;
        title: string;
        amount: number;
        dueDate: string;
        accountInfo: string;
    }
): string {
    return template
        .replace(/\{客戶名稱\}/g, data.customerName)
        .replace(/\{請款項目\}/g, data.title)
        .replace(/\{金額\}/g, data.amount.toLocaleString())
        .replace(/\{到期日\}/g, data.dueDate)
        .replace(/\{匯款帳戶\}/g, data.accountInfo);
}

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const now = new Date();

        // 查詢到期的週期性請款
        const { data: recurringBillings, error: fetchError } = await supabase
            .from('acct_recurring_billings')
            .select('*')
            .eq('is_active', true)
            .lte('next_run_at', now.toISOString());

        if (fetchError) throw fetchError;

        console.log(`[CRON] 找到 ${recurringBillings?.length || 0} 個待執行週期性請款`);

        let createdCount = 0;
        let sentCount = 0;

        for (const recurring of recurringBillings || []) {
            try {
                // 取得請款單號
                const { data: billingNumber } = await supabase.rpc('generate_billing_number', {
                    p_company_id: recurring.company_id
                });

                // 計算到期日
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + (recurring.days_before_due || 14));
                const dueDateStr = dueDate.toISOString().split('T')[0];

                // 計算當前月份
                const currentMonth = now.toISOString().slice(0, 7);

                // 決定狀態：auto_send = true 時為 'pending'，否則為 'draft'
                const status = recurring.auto_send ? 'pending' : 'draft';

                // 建立請款單
                const { data: newBilling, error: insertError } = await supabase
                    .from('acct_billing_requests')
                    .insert({
                        company_id: recurring.company_id,
                        billing_number: billingNumber,
                        customer_id: recurring.customer_id,
                        customer_name: recurring.customer_name,
                        customer_line_group_id: recurring.customer_line_group_id,
                        customer_line_group_name: recurring.customer_line_group_name,
                        title: recurring.title,
                        description: recurring.description,
                        billing_month: currentMonth,
                        amount: recurring.amount,
                        tax_amount: recurring.tax_amount || 0,
                        total_amount: (recurring.amount || 0) + (recurring.tax_amount || 0),
                        cost_vendor_id: recurring.cost_vendor_id,
                        cost_vendor_name: recurring.cost_vendor_name,
                        cost_amount: recurring.cost_amount,
                        payment_account_id: recurring.payment_account_id,
                        due_date: dueDateStr,
                        status: status,
                        recurring_billing_id: recurring.id
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;

                createdCount++;

                // 如果 auto_send = true 且有 LINE 群組，自動發送
                if (recurring.auto_send && recurring.customer_line_group_id && recurring.message_template) {
                    try {
                        // 取得收款帳戶資訊
                        let accountInfo = '（未設定）';
                        if (recurring.payment_account_id) {
                            const { data: account } = await supabase
                                .from('acct_payment_accounts')
                                .select('*')
                                .eq('id', recurring.payment_account_id)
                                .single();

                            if (account) {
                                accountInfo = `${account.bank_name} ${account.branch_name || ''}\n帳號：${account.account_number}\n戶名：${account.account_name}`;
                            }
                        }

                        // 替換訊息模板變數
                        const message = replaceTemplateVariables(recurring.message_template, {
                            customerName: recurring.customer_name,
                            title: recurring.title,
                            amount: (recurring.amount || 0) + (recurring.tax_amount || 0),
                            dueDate: new Date(dueDateStr).toLocaleDateString('zh-TW'),
                            accountInfo: accountInfo
                        });

                        // 取得公司的 LINE 設定
                        const { data: company } = await supabase
                            .from('companies')
                            .select('line_channel_access_token')
                            .eq('id', recurring.company_id)
                            .single();

                        if (company?.line_channel_access_token) {
                            // 發送 LINE 訊息
                            const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${company.line_channel_access_token}`
                                },
                                body: JSON.stringify({
                                    to: recurring.customer_line_group_id,
                                    messages: [{ type: 'text', text: message }]
                                })
                            });

                            if (lineResponse.ok) {
                                // 更新請款單狀態為已發送
                                await supabase
                                    .from('acct_billing_requests')
                                    .update({
                                        status: 'sent',
                                        notification_sent_at: now.toISOString()
                                    })
                                    .eq('id', newBilling.id);

                                sentCount++;
                                console.log(`[CRON] 已發送 LINE 通知 (${recurring.customer_name})`);
                            } else {
                                console.error(`[CRON] LINE 發送失敗:`, await lineResponse.text());
                            }
                        }
                    } catch (lineError) {
                        console.error(`[CRON] LINE 發送錯誤:`, lineError);
                    }
                }

                // 更新週期性請款：下次執行時間
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

                console.log(`[CRON] 已建立請款單 (${recurring.customer_name} - ${recurring.title}) - ${recurring.auto_send ? '已發送' : '草稿'}`);

            } catch (error) {
                console.error(`[CRON] 建立請款單失敗 (${recurring.id}):`, error);
            }
        }

        return NextResponse.json({
            success: true,
            created: createdCount,
            sent: sentCount,
            total: recurringBillings?.length || 0
        });

    } catch (error) {
        console.error('[CRON] 週期性請款執行失敗:', error);
        return NextResponse.json({ error: '執行失敗' }, { status: 500 });
    }
}