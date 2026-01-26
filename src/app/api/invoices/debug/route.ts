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
  
  const timestamp = Math.floor(Date.now() / 1000);
  const testData = `RespondType=JSON&Version=1.5&TimeStamp=${timestamp}`;
  
  // 標準 AES-256-CBC 加密（讓 Node.js 自動處理 PKCS7 Padding）
  function aesEncrypt(data: string, key: string, iv: string): string {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  const encrypted = aesEncrypt(testData, hash_key, hash_iv);

  const res = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `MerchantID_=${merchant_id}&PostData_=${encrypted}`,
  }).then(r => r.json());

  return NextResponse.json({
    merchant_id,
    testData,
    encrypted_len: encrypted.length,
    ezpay_result: res
  });
}
