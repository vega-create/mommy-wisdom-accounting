import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';


const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

// 發送 LINE 訊息
async function sendLineMessage(accessToken: string, to: string, text: string) {
  try {
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
    return response.ok;
  } catch {
    return false;
  }
}

// POST - 確認付款
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payable_id, paid_amount, payment_note, bank_account_id, send_notification = true } = body;

    console.log('=== 應付付款 API 開始 ===');
    console.log('payable_id:', payable_id);
    console.log('paid_amount:', paid_amount);

    if (!payable_id || !paid_amount) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    const supabase = await createClient();

    // 取得應付款項資料（包含廠商 LINE 資訊）
    const { data: payable, error: payableError } = await supabase
      .from('acct_payable_requests')
      .select(`
        *,
        vendor:acct_customers(line_user_id, line_group_id, line_group_name)
      `)
      .eq('id', payable_id)
      .single();

    if (payableError || !payable) {
      console.error('找不到應付款項:', payableError);
      return NextResponse.json({ error: '找不到應付款項' }, { status: 404 });
    }

    console.log('找到應付款項:', payable.payable_number);

    const today = new Date().toISOString().split('T')[0];

    // 查詢預設費用科目（勞務成本）
    const { data: expenseCat } = await supabase
      .from('acct_account_categories')
      .select('id')
      .eq('company_id', payable.company_id)
      .eq('code', '5100')
      .single();

    // 1. 建立支出交易記錄
    console.log('建立支出交易記錄...');
    const { data: transaction, error: transactionError } = await supabase
      .from('acct_transactions')
      .insert({
        company_id: payable.company_id,
        transaction_date: today,
        transaction_type: 'expense',
        description: `${payable.title} - ${payable.vendor_name}`,
        amount: parseFloat(paid_amount),
        customer_id: payable.vendor_id,
        bank_account_id: bank_account_id || null,
        category_id: expenseCat?.id || null,
        notes: payment_note || `應付款項付款：${payable.payable_number}`
      })
      .select()
      .single();

    if (transactionError) {
      console.error('建立交易記錄失敗:', transactionError);
      return NextResponse.json({ error: `建立交易記錄失敗: ${transactionError.message}` }, { status: 500 });
    }

    console.log('✅ 交易記錄已建立:', transaction.id);

    // 2. 更新應付款項狀態
    console.log('更新應付款項狀態...');
    const { error: updateError } = await supabase
      .from('acct_payable_requests')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_amount: parseFloat(paid_amount),
        payment_note,
        transaction_id: transaction.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', payable_id);

    if (updateError) {
      console.error('更新應付款項失敗:', updateError);
      return NextResponse.json({ error: '更新應付款項失敗' }, { status: 500 });
    }

    console.log('✅ 應付款項已更新為已付款');

    // 3. 發送通知給外包
    let notificationSent = false;
    if (send_notification) {
      const lineRecipientId = payable.vendor?.line_group_id || payable.vendor?.line_user_id;

      if (lineRecipientId) {
        try {
          const { data: lineSettings } = await supabase
            .from('acct_line_settings')
            .select('channel_access_token')
            .eq('company_id', payable.company_id)
            .eq('is_active', true)
            .single();

          if (lineSettings?.channel_access_token) {
            // 根據廠商類型使用不同訊息
            let message = '';

            if (payable.vendor_type === 'company') {
              // 公司類型：通知開發票
              message = `${payable.vendor_name} 您好：

已匯款 NT$ ${parseFloat(paid_amount).toLocaleString()} 元至貴司帳戶。

📋 項目：${payable.title}
📅 付款日期：${new Date().toLocaleDateString('zh-TW')}

請開立發票，謝謝！

智慧媽咪國際 敬上`;
            } else {
              // 個人類型：通知已匯款
              message = `${payable.vendor_name} 您好：

已匯款 NT$ ${parseFloat(paid_amount).toLocaleString()} 元至您的帳戶。

📋 項目：${payable.title}
📅 付款日期：${new Date().toLocaleDateString('zh-TW')}

如有問題請與我們聯繫，謝謝！

智慧媽咪國際 敬上`;
            }

            notificationSent = await sendLineMessage(
              lineSettings.channel_access_token,
              lineRecipientId,
              message
            );

            if (notificationSent) {
              await supabase
                .from('acct_line_messages')
                .insert({
                  company_id: payable.company_id,
                  recipient_type: payable.vendor?.line_group_id ? 'group' : 'user',
                  recipient_id: lineRecipientId,
                  recipient_name: payable.vendor_name,
                  message_type: 'text',
                  content: message,
                  status: 'sent',
                  sent_at: new Date().toISOString()
                });
            }
          }
        } catch (lineError) {
          console.error('LINE notification error:', lineError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: notificationSent
        ? '付款已確認，已通知廠商開立發票'
        : '付款已確認，已建立支出記錄',
      transaction_id: transaction.id,
      notification_sent: notificationSent
    });

  } catch (error) {
    console.error('Error confirming payment:', error);
    return NextResponse.json({ error: '確認付款失敗' }, { status: 500 });
  }
}
