export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

// 計算下次執行時間
function calculateNextRunAt(scheduleType: string, scheduleDay: number, scheduleMonth?: number): Date {
    const now = new Date();
    let nextRun = new Date();

    nextRun.setUTCHours(1, 0, 0, 0);

    if (scheduleType === 'monthly') {
        nextRun.setDate(scheduleDay);
        nextRun.setMonth(nextRun.getMonth() + 1);
    } else if (scheduleType === 'quarterly') {
        const currentMonth = now.getMonth();
        const quarterMonths = [0, 3, 6, 9];
        let targetMonth = quarterMonths.find(m => m > currentMonth);
        if (targetMonth === undefined) {
            targetMonth = 0;
            nextRun.setFullYear(nextRun.getFullYear() + 1);
        } else {
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
        nextRun.setFullYear(nextRun.getFullYear() + 1);
    }

    return nextRun;
}

// 替換訊息模板中的變數
function replaceMessageVariables(
    template: string,
    data: {
        customerName: string;
        title: string;
        amount: number;
        dueDate: string;
        paymentAccount?: string;
    }
): string {
    return template
        .replace(/\{客戶名稱\}/g, data.customerName)
        .replace(/\{請款項目\}/g, data.title)
        .replace(/\{金額\}/g, data.amount.toLocaleString())
        .replace(/\{到期日\}/g, data.dueDate)
        .replace(/\{匯款帳戶\}/g, data.paymentAccount || '請洽詢客服');
}

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

// Cron Job - 自動執行週期性請款
export async function GET() {
    try {
        const supabase = await createClient();
        const now = new Date();

        // 查詢所有到期的週期性請款（不需要 company_id，查詢所有公司）
        const { data: dueRecurrings, error: fetchError } = await supabase
            .from('acct_recurring_billings')
            .select('*')
            .eq('is_active', true)
            .lte('next_run_at', now.toISOString());

        if (fetchError) {
            console.error('[CRON] 查詢週期性請款錯誤:', fetchError);
            return NextResponse.json({ error: '查詢失敗' }, { status: 500 });
        }

        console.log(`[CRON] 找到 ${dueRecurrings?.length || 0} 個待執行週期性請款`);

        if (!dueRecurrings || dueRecurrings.length === 0) {
            return NextResponse.json({ success: true, created: 0, sent: 0, total: 0 });
        }

        let created = 0;
        let sent = 0;

        for (const recurring of dueRecurrings) {
            try {
                // 計算到期日
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + (recurring.days_before_due || 14));
                const dueDateStr = dueDate.toISOString().split('T')[0];

                // 產生請款單號
                const year = new Date().getFullYear();
                const month = String(new Date().getMonth() + 1).padStart(2, '0');
                const billingNumber = `BIL${year}${month}${Date.now().toString().slice(-4)}`;

                // 決定狀態：auto_send 為 true 則直接發送，否則存為草稿
                const status = recurring.auto_send ? 'sent' : 'draft';

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
                        amount: recurring.amount,
                        tax_amount: recurring.tax_amount || 0,
                        total_amount: (recurring.amount || 0) + (recurring.tax_amount || 0),
                        cost_amount: recurring.cost_amount,
                        cost_vendor_id: recurring.cost_vendor_id,
                        cost_vendor_name: recurring.cost_vendor_name,
                        payment_account_id: recurring.payment_account_id,
                        due_date: dueDateStr,
                        status: status,
                        recurring_billing_id: recurring.id,
                        line_sent_at: recurring.auto_send ? new Date().toISOString() : null
                    })
                    .select()
                    .single();

                if (insertError) {
                    console.error(`[CRON] 建立請款單失敗 (${recurring.id}):`, insertError);
                    continue;
                }

                created++;
                console.log(`[CRON] 建立請款單成功: ${billingNumber}`);

                // 如果開啟自動發送且有 LINE 群組，發送通知
                if (recurring.auto_send && recurring.customer_line_group_id && recurring.message_template) {
                    try {
                        // 取得 LINE token
                        const { data: lineSettings } = await supabase
                            .from('acct_line_settings')
                            .select('channel_access_token')
                            .eq('company_id', recurring.company_id)
                            .eq('is_active', true)
                            .single();

                        if (lineSettings?.channel_access_token) {
                            // 取得收款帳戶資訊
                            let paymentAccountInfo = '';
                            if (recurring.payment_account_id) {
                                const { data: account } = await supabase
                                    .from('acct_payment_accounts')
                                    .select('bank_name, branch_name, account_number, account_name')
                                    .eq('id', recurring.payment_account_id)
                                    .single();

                                if (account) {
                                    paymentAccountInfo = `${account.bank_name} ${account.branch_name || ''}\n戶名：${account.account_name}\n帳號：${account.account_number}`;
                                }
                            }

                            // 替換變數
                            const message = replaceMessageVariables(recurring.message_template, {
                                customerName: recurring.customer_name,
                                title: recurring.title,
                                amount: (recurring.amount || 0) + (recurring.tax_amount || 0),
                                dueDate: dueDateStr,
                                paymentAccount: paymentAccountInfo
                            });

                            await sendLineMessage(
                                lineSettings.channel_access_token,
                                recurring.customer_line_group_id,
                                message
                            );

                            sent++;
                            console.log(`[CRON] LINE 發送成功: ${recurring.customer_name}`);
                        }
                    } catch (lineError) {
                        console.error(`[CRON] LINE 發送失敗 (${recurring.id}):`, lineError);
                    }
                }

                // 更新下次執行時間
                const nextRunAt = calculateNextRunAt(
                    recurring.schedule_type,
                    recurring.schedule_day,
                    recurring.schedule_month
                );

                await supabase
                    .from('acct_recurring_billings')
                    .update({
                        next_run_at: nextRunAt.toISOString(),
                        last_run_at: now.toISOString(),
                        run_count: (recurring.run_count || 0) + 1,
                        updated_at: now.toISOString()
                    })
                    .eq('id', recurring.id);

            } catch (error) {
                console.error(`[CRON] 處理週期性請款錯誤 (${recurring.id}):`, error);
            }
        }

        return NextResponse.json({
            success: true,
            created,
            sent,
            total: dueRecurrings.length
        });

    } catch (error) {
        console.error('[CRON] 週期性請款執行錯誤:', error);
        return NextResponse.json({ error: '執行失敗' }, { status: 500 });
    }
}