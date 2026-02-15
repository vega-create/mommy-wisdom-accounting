export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const {
      billing_id,
      paid_amount,
      payment_method,
      payment_note,
      bank_account_id,
      send_notification = true
    } = body;

    if (!billing_id || !paid_amount) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    const { data: billing, error: billingError } = await supabase
      .from('acct_billing_requests')
      .select('*')
      .eq('id', billing_id)
      .single();

    if (billingError || !billing) {
      return NextResponse.json({ error: '找不到請款單' }, { status: 404 });
    }

    if (billing.status === 'paid') {
      return NextResponse.json({ error: '此請款單已收款' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    // 更新請款單狀態
    await supabase
      .from('acct_billing_requests')
      .update({
        status: 'paid',
        paid_at: now,
        paid_amount: parseFloat(paid_amount),
        payment_method: payment_method || null,
        payment_note: payment_note || null,
        paid_account_id: bank_account_id || null,
        updated_at: now
      })
      .eq('id', billing_id);

    // 查詢預設收入科目
    const { data: incomeCat } = await supabase
      .from('acct_account_categories')
      .select('id')
      .eq('company_id', billing.company_id)
      .eq('code', '4100')
      .single();

    // 建立收入交易記錄
    const { data: transaction, error: transactionError } = await supabase
      .from('acct_transactions')
      .insert({
        company_id: billing.company_id,
        transaction_date: today,
        transaction_type: 'income',
        description: `${billing.title} - ${billing.customer_name}`,
        amount: parseFloat(paid_amount),
        customer_id: billing.customer_id || null,
        bank_account_id: bank_account_id || null,
        category_id: incomeCat?.id || null,
        notes: payment_note || `請款單收款：${billing.billing_number}`
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Transaction insert error:', transactionError);
    }

    if (transaction) {
      await supabase
        .from('acct_billing_requests')
        .update({ transaction_id: transaction.id })
        .eq('id', billing_id);
    }

    // 注意：應付帳款已在請款單建立時自動建立，這裡不再重複建立

    // 發送 LINE 通知
    const lineRecipientId = billing.customer_line_group_id || billing.customer_line_id;
    if (send_notification && lineRecipientId) {
      try {
        const { data: lineSettings } = await supabase
          .from('acct_line_settings')
          .select('channel_access_token')
          .eq('company_id', billing.company_id)
          .eq('is_active', true)
          .single();

        if (lineSettings?.channel_access_token) {
          const message = `親愛的 ${billing.customer_name}，您好：\n\n已收到您的款項 NT$ ${parseFloat(paid_amount).toLocaleString()} 元，感謝您的付款！\n\n📋 請款單號：${billing.billing_number}\n📅 收款日期：${new Date().toLocaleDateString('zh-TW')}\n\n發票將於近日開立並寄送。\n\n智慧媽咪國際 敬上`;

          await sendLineMessage(lineSettings.channel_access_token, lineRecipientId, message);
        }
      } catch (e) {
        console.error('LINE error:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: '收款確認完成',
      data: { billing_id, transaction_id: transaction?.id }
    });

  } catch (error) {
    console.error('Error confirming payment:', error);
    return NextResponse.json({ error: '確認收款失敗' }, { status: 500 });
  }
}
