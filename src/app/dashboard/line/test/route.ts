import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { company_id } = await request.json();

        if (!company_id) {
            return NextResponse.json({ success: false, error: '缺少 company_id' });
        }

        const { data: settings, error } = await supabase
            .from('acct_line_settings')
            .select('channel_access_token, channel_secret')
            .eq('company_id', company_id)
            .single();

        if (error || !settings) {
            return NextResponse.json({ success: false, error: '尚未設定 LINE API' });
        }

        if (!settings.channel_access_token || !settings.channel_secret) {
            return NextResponse.json({ success: false, error: 'Channel Access Token 或 Channel Secret 未設定' });
        }

        const response = await fetch('https://api.line.me/v2/bot/info', {
            headers: { 'Authorization': `Bearer ${settings.channel_access_token}` }
        });

        if (response.ok) {
            const botInfo = await response.json();
            return NextResponse.json({ success: true, message: `連線成功！Bot: ${botInfo.displayName || botInfo.basicId}` });
        } else {
            const errorData = await response.json();
            return NextResponse.json({ success: false, error: errorData.message || 'LINE API 連線失敗' });
        }
    } catch (error) {
        console.error('Test LINE connection error:', error);
        return NextResponse.json({ success: false, error: '連線測試失敗' });
    }
}
