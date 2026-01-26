import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// 完全按照 PHP addpadding 函數
function addPadding(str: string, blocksize: number = 32): string {
  const buf = Buffer.from(str, 'utf8');
  const len = buf.length;
  const pad = blocksize - (len % blocksize);
  const padChar = String.fromCharCode(pad);
  return str + padChar.repeat(pad);
}

// 完全按照 PHP openssl_encrypt
function aesEncrypt(data: string, key: string, iv: string): string {
  const padded = addPadding(data, 32);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(key, 'utf8'),
    Buffer.from(iv, 'utf8')
  );
  cipher.setAutoPadding(false);
  
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(padded, 'binary')),
    cipher.final()
  ]);
  
  return encrypted.toString('hex');
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
  
  // 簡單測試資料（純 ASCII）
  const timestamp = Math.floor(Date.now() / 1000);
  const testData = `RespondType=JSON&Version=1.5&TimeStamp=${timestamp}`;
  
  const encrypted = aesEncrypt(testData, hash_key, hash_iv);

  const response = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `MerchantID_=${merchant_id}&PostData_=${encrypted}`,
  });
  
  const result = await response.json();

  return NextResponse.json({
    merchant_id,
    hash_key_first4: hash_key.substring(0, 4),
    hash_key_last4: hash_key.substring(hash_key.length - 4),
    testData,
    testDataLength: testData.length,
    paddedLength: addPadding(testData, 32).length,
    encryptedLength: encrypted.length,
    result
  });
}
