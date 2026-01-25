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

// 產生應付單號
async function generatePayableNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  const { data } = await supabase
    .from('acct_payable_requests')
    .select('payable_number')
    .eq('company_id', companyId)
    .like('payable_number', `PAY${year}${month}%`)
    .order('payable_number', { ascending: false })
    .limit(1);
  
  let seq = 1;
  if (data && data.length > 0) {
    const lastNum = data[0].payable_number;
    seq = parseInt(lastNum.slice(-4)) + 1;
  }
  
  return `PAY${year}${month}${String(seq).padStart(4, '0')}`;
}

// POST - 確認收款
export async function POST(request: NextRequest) {
  try {
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

    // 取得請款單資料
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

    // 1. 更新請款單狀態
    await supabase
      .from('acct_billing_requests')
      .update({
        status: 'paid',
        paid_at: now,
        paid_amount: parseFloat(paid_amount),
        payment_method,
        payment_note,
        updated_at: now
      })
      .eq('id', billing_id);

    // 2. 建立交易記錄（收入）- 使用正確欄位名稱
    const { data: transaction, error: transactionError } = await supabase
      .from('acct_transactions')
      .insert({
        company_id: billing.company_id,
        transaction_date: today,
        transaction_type: 'income',
        description: `${billing.title} - ${billing.customer_name}`,
        amount: parseFloat(paid_amount),
        customer_id: billing.customer_id,
        bank_account_id: bank_account_id || null,
        notes: payment_note || `請款單收款：${billing.billing_number}`
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Transaction insert error:', transactionError);
    }

    // 3. 更新請款單關聯交易
    if (transaction) {
      await supabase
        .from('acct_billing_requests')
        .update({ transaction_id: transaction.id })
        .eq('id', billing_id);
    }

    // 4. 如果有成本，自動建立應付款項
    let payableId = null;
    if (billing.cost_amount > 0 && (billing.cost_vendor_id || billing.cost_vendor_name)) {
      try {
        const payableNumber = await generatePayableNumber(billing.company_id);
        
        const { data: payable, error: payableError } = await supabase
          .from('acct_payable_requests')
          .insert({
            company_id: billing.company_id,
            payable_number: payableNumber,
            vendor_id: billing.cost_vendor_id || null,
            vendor_name: billing.cost_vendor_name || '未指定',
            vendor_type: 'company',
            title: `${billing.title} - 外包成本`,
            description: `來源請款單：${billing.billing_number}`,
            amount: billing.cost_amount,
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7天後
            status: 'pending',
            billing_request_id: billing.id
          })
          .select()
          .single();

        if (!payableError && payable) {
          payableId = payable.id;
        }
      } catch (payableErr) {
        console.error('Create payable error:', payableErr);
      }
    }

    // 5. 發送收款確認通知（可選）
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
          const message = `親愛的 ${billing.customer_name}，您好：

已收到您的款項 NT$ ${parseFloat(paid_amount).toLocaleString()} 元，感謝您的付款！

📋 請款單號：${billing.billing_number}
📅 收款日期：${new Date().toLocaleDateString('zh-TW')}

發票將於近日開立並寄送。

智慧媽咪國際 敬上`;

          await sendLineMessage(
            lineSettings.channel_access_token,
            lineRecipientId,
            message
          );

          // 記錄發送
          await supabase
            .from('acct_line_messages')
            .insert({
              company_id: billing.company_id,
              recipient_type: billing.customer_line_group_id ? 'group' : 'user',
              recipient_id: lineRecipientId,
              recipient_name: billing.customer_line_group_name || billing.customer_name,
              message_type: 'text',
              content: message,
              status: 'sent',
              sent_at: now
            });
        }
      } catch (lineError) {
        console.error('LINE notification error:', lineError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: billing.cost_amount > 0 
        ? '收款確認完成，已建立應付款項提醒'
        : '收款確認完成',
      data: {
        billing_id,
        transaction_id: transaction?.id,
        payable_id: payableId,
        paid_amount,
        has_cost: billing.cost_amount > 0,
        notification_sent: send_notification && !!lineRecipientId
      }
    });

  } catch (error) {
    console.error('Error confirming payment:', error);
    return NextResponse.json({ error: '確認收款失敗' }, { status: 500 });
  }
}
