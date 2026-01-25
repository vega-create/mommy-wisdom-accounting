export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - 取得發票設定
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('acct_invoice_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Invoice settings GET error:', error);
      return NextResponse.json({ error: `取得設定失敗: ${error.message}` }, { status: 500 });
    }

    // 如果沒有設定，返回預設值
    if (!data) {
      return NextResponse.json({ 
        data: {
          company_id: companyId,
          merchant_id: '',
          hash_key: '',
          hash_iv: '',
          is_production: false,
          default_tax_type: 'taxable',
          auto_issue_on_payment: false,
          auto_notify_customer: true,
        }
      });
    }

    // 隱藏敏感資訊（只顯示部分）
    const maskedData = {
      ...data,
      hash_key: data.hash_key ? `${data.hash_key.substring(0, 8)}****` : '',
      hash_iv: data.hash_iv ? `${data.hash_iv.substring(0, 4)}****` : '',
      has_config: !!(data.merchant_id && data.hash_key && data.hash_iv),
    };

    return NextResponse.json({ data: maskedData });
  } catch (error) {
    console.error('Error fetching invoice settings:', error);
    return NextResponse.json({ error: '取得設定失敗' }, { status: 500 });
  }
}

// POST - 儲存發票設定
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      company_id,
      merchant_id,
      hash_key,
      hash_iv,
      is_production,
      default_tax_type,
      auto_issue_on_payment,
      auto_notify_customer,
    } = body;

    if (!company_id) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    // 檢查是否已有設定
    const { data: existing } = await supabase
      .from('acct_invoice_settings')
      .select('id')
      .eq('company_id', company_id)
      .single();

    const settingsData = {
      company_id,
      merchant_id,
      hash_key,
      hash_iv,
      is_production: is_production || false,
      default_tax_type: default_tax_type || 'taxable',
      auto_issue_on_payment: auto_issue_on_payment || false,
      auto_notify_customer: auto_notify_customer !== false,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      // 更新
      result = await supabase
        .from('acct_invoice_settings')
        .update(settingsData)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // 新增
      result = await supabase
        .from('acct_invoice_settings')
        .insert(settingsData)
        .select()
        .single();
    }

    if (result.error) {
      console.error('Invoice settings save error:', result.error);
      return NextResponse.json({ error: `儲存失敗: ${result.error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error saving invoice settings:', error);
    return NextResponse.json({ error: '儲存設定失敗' }, { status: 500 });
  }
}

// PUT - 測試 API 連線
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id } = body;

    if (!company_id) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    // 取得設定
    const { data: settings } = await supabase
      .from('acct_invoice_settings')
      .select('*')
      .eq('company_id', company_id)
      .single();

    if (!settings || !settings.merchant_id || !settings.hash_key || !settings.hash_iv) {
      return NextResponse.json({ error: '尚未設定 ezPay API 資訊' }, { status: 400 });
    }

    // 動態載入 ezpay 模組
    const { searchInvoice } = await import('@/lib/ezpay');

    // 嘗試查詢發票（測試 API 連線）
    const result = await searchInvoice(
      {
        merchantId: settings.merchant_id,
        hashKey: settings.hash_key,
        hashIV: settings.hash_iv,
        isProduction: settings.is_production,
      },
      {
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
      }
    );

    // ezPay 查無資料也算連線成功
    if (result.success || result.message?.includes('查無資料')) {
      return NextResponse.json({ 
        success: true, 
        message: 'API 連線測試成功',
        environment: settings.is_production ? '正式環境' : '測試環境',
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.message || 'API 連線失敗',
        rawResponse: result.rawResponse,
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error testing API:', error);
    return NextResponse.json({ 
      error: `測試失敗: ${error instanceof Error ? error.message : '未知錯誤'}` 
    }, { status: 500 });
  }
}
