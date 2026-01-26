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

  // 測試環境
  const testRes = await fetch('https://cinv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ MerchantID_: merchant_id, PostData_: encrypted }),
  }).then(r => r.json());

  // 正式環境
  const prodRes = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ MerchantID_: merchant_id, PostData_: encrypted }),
  }).then(r => r.json());

  return NextResponse.json({
    merchant_id,
    test_env: { url: 'cinv.ezpay.com.tw', status: testRes.Status, message: testRes.Message },
    prod_env: { url: 'inv.ezpay.com.tw', status: prodRes.Status, message: prodRes.Message },
  });
}
