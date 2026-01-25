export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';


// GET - 取得 LINE 設定
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('acct_line_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // 如果沒有設定，回傳空物件
    if (!data) {
      return NextResponse.json({
        data: {
          company_id: companyId,
          channel_access_token: null,
          channel_secret: null,
          is_active: false,
          has_token: false,
          has_secret: false,
        }
      });
    }

    // 隱藏敏感資訊（只顯示部分）
    const maskedData = {
      ...data,
      channel_access_token: data.channel_access_token 
        ? `${data.channel_access_token.substring(0, 10)}...` 
        : null,
      channel_secret: data.channel_secret 
        ? `${data.channel_secret.substring(0, 5)}...` 
        : null,
      has_token: !!data.channel_access_token,
      has_secret: !!data.channel_secret,
    };

    return NextResponse.json({ data: maskedData });
  } catch (error) {
    console.error('Error fetching LINE settings:', error);
    return NextResponse.json({ error: '取得設定失敗' }, { status: 500 });
  }
}

// PUT - 更新 LINE 設定
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, channel_access_token, channel_secret, ...otherSettings } = body;

    if (!company_id) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    // 檢查是否已有設定
    const { data: existing } = await supabase
      .from('acct_line_settings')
      .select('id')
      .eq('company_id', company_id)
      .single();

    const updateData: Record<string, unknown> = {
      ...otherSettings,
      company_id,
      updated_at: new Date().toISOString(),
    };

    // 只有在有提供新值時才更新 token
    if (channel_access_token && !channel_access_token.includes('...')) {
      updateData.channel_access_token = channel_access_token;
    }
    if (channel_secret && !channel_secret.includes('...')) {
      updateData.channel_secret = channel_secret;
    }

    let result;

    if (existing) {
      // 更新
      result = await supabase
        .from('acct_line_settings')
        .update(updateData)
        .eq('company_id', company_id)
        .select()
        .single();
    } else {
      // 新增
      result = await supabase
        .from('acct_line_settings')
        .insert(updateData)
        .select()
        .single();
    }

    if (result.error) {
      throw result.error;
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error updating LINE settings:', error);
    return NextResponse.json({ error: '更新設定失敗' }, { status: 500 });
  }
}
