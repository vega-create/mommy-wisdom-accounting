export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const LINE_API_URL = 'https://api.line.me/v2/bot/message';

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

function replaceVariables(content: string, variables: Record<string, string>) {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { 
      company_id, 
      recipient_type,
      recipient_id,
      recipient_name,
      template_id,
      content,
      variables,
      created_by 
    } = body;

    if (!company_id || !recipient_id) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

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

    let messageContent = content;

    if (template_id && !content) {
      const { data: template } = await supabase
        .from('acct_line_templates')
        .select('*')
        .eq('id', template_id)
        .single();

      if (template) {
        messageContent = template.content;
        if (variables && Object.keys(variables).length > 0) {
          messageContent = replaceVariables(messageContent, variables);
        }
      }
    }

    if (!messageContent) {
      return NextResponse.json({ error: '缺少訊息內容' }, { status: 400 });
    }

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

    try {
      await sendLineMessage(
        settings.channel_access_token,
        'push',
        recipient_id,
        [{ type: 'text', text: messageContent }]
      );

      await supabase
        .from('acct_line_messages')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', message.id);

      return NextResponse.json({ success: true, data: { ...message, status: 'sent' } });

    } catch (lineError: unknown) {
      const errorMessage = lineError instanceof Error ? lineError.message : '發送失敗';
      await supabase
        .from('acct_line_messages')
        .update({ status: 'failed', error_message: errorMessage })
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
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

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
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
