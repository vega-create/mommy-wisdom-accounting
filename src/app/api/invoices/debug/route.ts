import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

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
  
  // 顯示實際讀到的金鑰
  const keyInfo = {
    full: hash_key,
    len: hash_key.length,
    first6: hash_key.substring(0, 6),
    last6: hash_key.substring(hash_key.length - 6),
    hex: Buffer.from(hash_key).toString('hex')
  };
  
  const ivInfo = {
    full: hash_iv,
    len: hash_iv.length,
    hex: Buffer.from(hash_iv).toString('hex')
  };

  const timestamp = Math.floor(Date.now() / 1000);
  const testData = `RespondType=JSON&Version=1.5&TimeStamp=${timestamp}`;
  
  // 標準加密
  function encrypt(data: string, key: string, iv: string): string {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
  }

  const encrypted = encrypt(testData, hash_key, hash_iv);

  const res = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `MerchantID_=${merchant_id}&PostData_=${encrypted}`,
  }).then(r => r.json());

  return NextResponse.json({
    merchant_id,
    keyInfo,
    ivInfo,
    testData,
    result: res
  });
}
