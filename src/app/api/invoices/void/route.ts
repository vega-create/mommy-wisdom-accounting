import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const EZPAY_URL = 'https://inv.ezpay.com.tw/Api/invoice_invalid';

function aesEncrypt(data: string, key: string, iv: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { company_id, invoice_id, invoice_number, invalid_reason } = body;

    if (!company_id || !invoice_number || !invalid_reason) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    // 取得 ezPay 設定
    const { data: settings } = await supabase
      .from('company_ezpay_settings')
      .select('*')
      .eq('company_id', company_id)
      .single();

    if (!settings) {
      return NextResponse.json({ error: '尚未設定發票金鑰' }, { status: 400 });
    }

    const { merchant_id, hash_key, hash_iv } = settings;

    // 組合作廢參數
    const postData: Record<string, string> = {
      RespondType: 'JSON',
      Version: '1.0',
      TimeStamp: Math.floor(Date.now() / 1000).toString(),
      InvoiceNumber: invoice_number,
      InvalidReason: invalid_reason.substring(0, 6), // 限制中文6字
    };

    const queryString = Object.entries(postData)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const encrypted = aesEncrypt(queryString, hash_key, hash_iv);

    const formData = new URLSearchParams();
    formData.append('MerchantID_', merchant_id);
    formData.append('PostData_', encrypted);

    const response = await fetch(EZPAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const result = await response.json();

    if (result.Status === 'SUCCESS') {
      // 更新資料庫狀態
      const { error: updateError } = await supabase
        .from('acct_invoices')
        .update({
          status: 'void',
          void_at: new Date().toISOString(),
          void_reason: invalid_reason,
        })
        .eq('id', invoice_id);

      if (updateError) {
        console.error('Update error:', updateError);
      }

      return NextResponse.json({
        success: true,
        status: result.Status,
        message: result.Message,
      });
    }

    return NextResponse.json({
      success: false,
      status: result.Status,
      message: result.Message,
    });

  } catch (error: any) {
    console.error('Invoice void error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
