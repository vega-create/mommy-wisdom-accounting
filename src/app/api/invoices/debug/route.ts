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

  // 檢查是否有隱藏字符
  const rawKey = settings.hash_key;
  const rawIV = settings.hash_iv;
  const trimmedKey = rawKey.trim();
  const trimmedIV = rawIV.trim();
  
  const testData = 'RespondType=JSON&Version=1.5&TimeStamp=' + Math.floor(Date.now()/1000);
  
  // 用 trim 過的金鑰測試
  const encrypted = aesEncrypt(testData, trimmedKey, trimmedIV);

  const prodRes = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ MerchantID_: settings.merchant_id, PostData_: encrypted }),
  }).then(r => r.json());

  return NextResponse.json({
    merchant_id: settings.merchant_id,
    raw_key_length: rawKey.length,
    trimmed_key_length: trimmedKey.length,
    raw_iv_length: rawIV.length,
    trimmed_iv_length: trimmedIV.length,
    key_has_whitespace: rawKey !== trimmedKey,
    iv_has_whitespace: rawIV !== trimmedIV,
    key_hex: Buffer.from(trimmedKey).toString('hex'),
    iv_hex: Buffer.from(trimmedIV).toString('hex'),
    result: { status: prodRes.Status, message: prodRes.Message },
  });
}
