import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

function aesEncrypt(data: string, key: string, iv: string): string {
  const blockSize = 32;
  const dataBuffer = Buffer.from(data, 'utf8');
  const pad = blockSize - (dataBuffer.length % blockSize);
  const padding = Buffer.alloc(pad, pad);
  const paddedBuffer = Buffer.concat([dataBuffer, padding]);
  
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'utf8'), Buffer.from(iv, 'utf8'));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(paddedBuffer), cipher.final()]).toString('hex');
}

export async function GET() {
  const supabase = await createClient();
  
  const { data: settings } = await supabase
    .from('company_ezpay_settings')
    .select('*')
    .eq('company_id', '00000000-0000-0000-0000-000000000001')
    .single();

  if (!settings) {
    return NextResponse.json({ error: 'No settings found' });
  }

  const { merchant_id, hash_key, hash_iv } = settings;
  const testData = 'RespondType=JSON&Version=1.5&TimeStamp=' + Math.floor(Date.now()/1000);
  const encrypted = aesEncrypt(testData, hash_key, hash_iv);

  // 方法1: URLSearchParams
  const res1 = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ MerchantID_: merchant_id, PostData_: encrypted }),
  }).then(r => r.json());

  // 方法2: 手動構建 body
  const res2 = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `MerchantID_=${merchant_id}&PostData_=${encrypted}`,
  }).then(r => r.json());

  // 方法3: 加密後轉大寫
  const res3 = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `MerchantID_=${merchant_id}&PostData_=${encrypted.toUpperCase()}`,
  }).then(r => r.json());

  return NextResponse.json({
    merchant_id,
    encrypted_sample: encrypted.substring(0, 40),
    method1_urlsearch: { status: res1.Status, message: res1.Message },
    method2_manual: { status: res2.Status, message: res2.Message },
    method3_uppercase: { status: res3.Status, message: res3.Message },
  });
}
