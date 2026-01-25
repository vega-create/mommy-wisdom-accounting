export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const LINE_API_URL = 'https://api.line.me/v2/bot/message';

// 發送訊息到 LINE
async function sendLineMessage(
  accessToken: string,
  targetType: 'push' | 'multicast',
  targetId: string | string[],
  messages: { type: string; text: string }[]
) {
  const endpoint = targetType === 'push' 
    ? `${LINE_API_URL}/push`
    : `${LINE_API_URL}/multicast`;

  const body = targetType === 'push'
    ? { to: targetId as string, messages }
    : { to: targetId as string[], messages };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
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
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

// POST - 發送訊息
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      company_id, 
      recipient_type,  // 'group' | 'user' | 'multicast'
      recipient_id,    // group_id 或 user_id
      recipient_name,  // 顯示名稱
      template_id,     // 使用模板
      content,         // 自訂內容
      variables,       // 模板變數
      created_by 
    } = body;

    if (!company_id || !recipient_id) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    // 取得 LINE 設定
    const { data: settings, error: settingsError } = await supabase
      .from('acct_line_settings')
      .select('*')
      .eq('company_id', company_id)
      .single();

    if (settingsError || !settings?.channel_access_token) {
      return NextResponse.json({ error: '尚未設定 LINE API' }, { status: 400 });
    }

    if (!settings.is_active) {
      return NextResponse.json({ error: 'LINE 通知功能已停用' }, { status: 400 });
    }

    // 取得訊息內容
    // 優先使用前端傳來的已替換內容
    let messageContent = content;

    if (template_id && !content) {
      // 只有在沒有傳入 content 時才從模板取得
      const { data: template } = await supabase
        .from('acct_line_templates')
        .select('*')
        .eq('id', template_id)
        .single();

      if (template) {
        messageContent = template.content;

        // 替換變數
        if (variables && Object.keys(variables).length > 0) {
          messageContent = replaceVariables(messageContent, variables);
        }
      }
    }

    if (!messageContent) {
      return NextResponse.json({ error: '缺少訊息內容' }, { status: 400 });
    }

    // 如果有使用模板，更新使用次數
    if (template_id) {
      const { data: template } = await supabase
        .from('acct_line_templates')
        .select('usage_count')
        .eq('id', template_id)
        .single();
      
      if (template) {
        await supabase
          .from('acct_line_templates')
          .update({ usage_count: (template.usage_count || 0) + 1 })
          .eq('id', template_id);
      }
    }

    // 建立發送記錄
    const { data: message, error: messageError } = await supabase
      .from('acct_line_messages')
      .insert({
        company_id,
        template_id: template_id || null,
        recipient_type,
        recipient_id,
        recipient_name,
        message_type: 'text',
        content: messageContent,
        variables_used: variables || null,
        status: 'pending',
        created_by
      })
      .select()
      .single();

    if (messageError) throw messageError;

    // 發送到 LINE
    try {
      await sendLineMessage(
        settings.channel_access_token,
        'push',
        recipient_id,
        [{ type: 'text', text: messageContent }]
      );

      // 更新狀態為已發送
      await supabase
        .from('acct_line_messages')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        })
        .eq('id', message.id);

      return NextResponse.json({ 
        success: true, 
        data: { ...message, status: 'sent' } 
      });

    } catch (lineError: unknown) {
      // 更新狀態為失敗
      const errorMessage = lineError instanceof Error ? lineError.message : '發送失敗';
      await supabase
        .from('acct_line_messages')
        .update({ 
          status: 'failed', 
          error_message: errorMessage
        })
        .eq('id', message.id);

      return NextResponse.json({ 
        success: false, 
        error: errorMessage,
        data: { ...message, status: 'failed', error_message: errorMessage }
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error sending LINE message:', error);
    return NextResponse.json({ error: '發送訊息失敗' }, { status: 500 });
  }
}

// GET - 取得發送記錄
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('acct_line_messages')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching LINE messages:', error);
    return NextResponse.json({ error: '取得發送記錄失敗' }, { status: 500 });
  }
}

// DELETE - 刪除發送記錄
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('acct_line_messages')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting LINE message:', error);
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}
