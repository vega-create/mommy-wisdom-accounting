import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';


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

// POST - 發送簽署連結
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  try {
    const body = await request.json();
    const { report_id } = body;

    if (!report_id) {
      return NextResponse.json({ error: '缺少 report_id' }, { status: 400 });
    }

    // 取得勞報單資料
    const { data: report, error: reportError } = await supabase
      .from('acct_labor_reports')
      .select(`
        *,
        staff:acct_customers(line_user_id, line_group_id)
      `)
      .eq('id', report_id)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: '找不到勞報單' }, { status: 404 });
    }

    // 產生簽署 token
    const signatureToken = randomBytes(32).toString('hex');
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mommy-wisdom-accounting.vercel.app';
    const signatureUrl = `${baseUrl}/sign/${signatureToken}`;

    // 更新勞報單
    const { error: updateError } = await supabase
      .from('acct_labor_reports')
      .update({
        status: 'pending_sign',
        signature_token: signatureToken,
        signature_url: signatureUrl,
        notification_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', report_id);

    if (updateError) {
      console.error('Update report error:', updateError);
      return NextResponse.json({ error: '更新勞報單失敗' }, { status: 500 });
    }

    // 發送 LINE 通知
    let notificationSent = false;
    const lineRecipientId = report.staff?.line_group_id || report.staff?.line_user_id;
    
    if (lineRecipientId) {
      try {
        const { data: lineSettings } = await supabase
          .from('acct_line_settings')
          .select('channel_access_token')
          .eq('company_id', report.company_id)
          .eq('is_active', true)
          .single();

        if (lineSettings?.channel_access_token) {
          const message = `${report.staff_name} 您好：

請點擊以下連結完成勞報單簽署：

📋 勞報單號：${report.report_number}
📅 服務日期：${new Date(report.service_date).toLocaleDateString('zh-TW')}
💰 實付金額：NT$ ${report.net_amount.toLocaleString()}

🔗 簽署連結：
${signatureUrl}

請於 7 天內完成簽署，謝謝！

智慧媽咪國際 敬上`;

          notificationSent = await sendLineMessage(
            lineSettings.channel_access_token,
            lineRecipientId,
            message
          );

          if (notificationSent) {
            await supabase
              .from('acct_line_messages')
              .insert({
                company_id: report.company_id,
                recipient_type: report.staff?.line_group_id ? 'group' : 'user',
                recipient_id: lineRecipientId,
                recipient_name: report.staff_name,
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

    return NextResponse.json({ 
      success: true, 
      message: notificationSent 
        ? '簽署連結已發送'
        : '勞報單已更新，但無法發送 LINE 通知（請確認人員有設定 LINE ID）',
      signature_url: signatureUrl,
      notification_sent: notificationSent
    });

  } catch (error) {
    console.error('Error sending signature:', error);
    return NextResponse.json({ error: '發送簽署連結失敗' }, { status: 500 });
  }
}
