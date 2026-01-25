export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { testLineConnection } from '@/lib/line-service';


// POST - 測試 LINE API 連線
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, access_token } = body;

    let tokenToTest = access_token;

    // 如果沒有直接提供 token，從資料庫取得
    if (!tokenToTest && company_id) {
      const { data: settings } = await supabase
        .from('acct_line_settings')
        .select('channel_access_token')
        .eq('company_id', company_id)
        .single();

      tokenToTest = settings?.channel_access_token;
    }

    if (!tokenToTest) {
      return NextResponse.json({ 
        success: false, 
        error: 'Access Token 未設定' 
      }, { status: 400 });
    }

    const result = await testLineConnection(tokenToTest);

    if (result.success) {
      return NextResponse.json({
        success: true,
        bot_name: result.botInfo?.displayName,
        bot_id: result.botInfo?.userId,
        message: `連線成功！Bot 名稱: ${result.botInfo?.displayName}`,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || '連線失敗',
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error testing LINE connection:', error);
    return NextResponse.json({ 
      success: false, 
      error: '測試連線失敗' 
    }, { status: 500 });
  }
}
