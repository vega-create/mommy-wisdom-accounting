import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

function addPadding(data: string): string {
  const blockSize = 32;
  const len = Buffer.byteLength(data, 'utf8');
  const pad = blockSize - (len % blockSize);
  return data + String.fromCharCode(pad).repeat(pad);
}

function aesEncrypt(data: string, key: string, iv: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  cipher.setAutoPadding(false);
  const padded = addPadding(data);
  let encrypted = cipher.update(padded, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  // 取得智慧媽咪的設定
  const { data: settings } = await supabase
    .from('company_ezpay_settings')
    .select('*')
    .eq('company_id', '00000000-0000-0000-0000-000000000001')
    .single();

  if (!settings) {
    return NextResponse.json({ error: 'No settings found' });
  }

  const { merchant_id, hash_key, hash_iv } = settings;
  
  // 測試資料
  const testData = 'RespondType=JSON&Version=1.5&TimeStamp=' + Math.floor(Date.now()/1000);
  const encrypted = aesEncrypt(testData, hash_key, hash_iv);
  
  // 呼叫 ezPay
  const formData = new URLSearchParams({
    MerchantID_: merchant_id,
    PostData_: encrypted,
  });

  const response = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  });
  
  const result = await response.json();

  return NextResponse.json({
    merchant_id,
    hash_key_length: hash_key.length,
    hash_iv_length: hash_iv.length,
    test_data: testData,
    encrypted_preview: encrypted.substring(0, 50),
    ezpay_response: result
  });
}
