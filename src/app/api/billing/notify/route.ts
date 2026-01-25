export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';


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
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
}

// POST - 發送請款通知
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { billing_id, template_id, custom_message } = body;

    if (!billing_id) {
      return NextResponse.json({ error: '缺少 billing_id' }, { status: 400 });
    }

    // 取得請款單資料
    const { data: billing, error: billingError } = await supabase
      .from('acct_billing_requests')
      .select(`
        *,
        payment_account:acct_payment_accounts(bank_name, branch_name, account_number, account_name)
      `)
      .eq('id', billing_id)
      .single();

    if (billingError || !billing) {
      return NextResponse.json({ error: '找不到請款單' }, { status: 404 });
    }

    // 檢查是否有 LINE 群組或個人 ID
    const lineRecipientId = billing.customer_line_group_id || billing.customer_line_id;
    if (!lineRecipientId) {
      return NextResponse.json({ error: '客戶沒有設定 LINE 群組或個人 ID' }, { status: 400 });
    }

    // 取得 LINE 設定
    const { data: lineSettings } = await supabase
      .from('acct_line_settings')
      .select('channel_access_token')
      .eq('company_id', billing.company_id)
      .eq('is_active', true)
      .single();

    if (!lineSettings?.channel_access_token) {
      return NextResponse.json({ error: '尚未設定 LINE API' }, { status: 400 });
    }

    // 決定訊息內容
    let finalMessage: string;
    
    if (custom_message) {
      // 使用前端傳來的自訂訊息（已經編輯過的）
      finalMessage = custom_message;
    } else if (template_id) {
      const { data: template } = await supabase
        .from('acct_line_templates')
        .select('content')
        .eq('id', template_id)
        .single();
      
      const messageContent = template?.content || '';
      const variables = {
        customer_name: billing.customer_name,
        billing_number: billing.billing_number,
        billing_month: billing.billing_month || '',
        amount: billing.total_amount?.toLocaleString() || billing.amount?.toLocaleString(),
        due_date: new Date(billing.due_date).toLocaleDateString('zh-TW'),
        title: billing.title
      };
      finalMessage = replaceVariables(messageContent, variables);
    } else {
      // 預設請款通知模板
      const account = billing.payment_account;
      const messageContent = `親愛的 {{customer_name}}，您好：

您的 {{billing_month}} 月份服務費用已產生。

📋 請款單號：{{billing_number}}
💰 金額：NT$ {{amount}} 元
📅 付款期限：{{due_date}}

匯款資訊：
🏦 ${account?.bank_name || ''} ${account?.branch_name || ''}
👤 戶名：${account?.account_name || ''}
🔢 帳號：${account?.account_number || ''}

如有疑問，請與我們聯繫。

智慧媽咪國際 敬上`;

      const variables = {
        customer_name: billing.customer_name,
        billing_number: billing.billing_number,
        billing_month: billing.billing_month || '',
        amount: billing.total_amount?.toLocaleString() || billing.amount?.toLocaleString(),
        due_date: new Date(billing.due_date).toLocaleDateString('zh-TW'),
        title: billing.title
      };
      finalMessage = replaceVariables(messageContent, variables);
    }

    // 發送 LINE 訊息（優先發送到群組）
    await sendLineMessage(
      lineSettings.channel_access_token,
      lineRecipientId,
      finalMessage
    );

    // 記錄發送
    const recipientType = billing.customer_line_group_id ? 'group' : 'user';
    const recipientName = billing.customer_line_group_id 
      ? (billing.customer_line_group_name || billing.customer_name)
      : billing.customer_name;
      
    await supabase
      .from('acct_line_messages')
      .insert({
        company_id: billing.company_id,
        template_id: template_id || null,
        recipient_type: recipientType,
        recipient_id: lineRecipientId,
        recipient_name: recipientName,
        message_type: 'text',
        content: finalMessage,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    // 更新請款單狀態
    await supabase
      .from('acct_billing_requests')
      .update({
        status: 'sent',
        notification_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', billing_id);

    return NextResponse.json({ 
      success: true, 
      message: '請款通知已發送'
    });

  } catch (error) {
    console.error('Error sending billing notification:', error);
    const errorMessage = error instanceof Error ? error.message : '發送失敗';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
