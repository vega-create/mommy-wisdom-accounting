import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

function aesEncrypt(data: string, key: string, iv: string): string {
  const blockSize = 32;
  const dataBuffer = Buffer.from(data, 'utf8');
  const len = dataBuffer.length;
  const pad = blockSize - (len % blockSize);
  const padding = Buffer.alloc(pad, pad);  // 正確的 PKCS7 填充
  const paddedBuffer = Buffer.concat([dataBuffer, padding]);
  
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(paddedBuffer), cipher.final()]);
  return encrypted.toString('hex');
}

export async function GET(request: NextRequest) {
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
    keyLen: hash_key.length,
    ivLen: hash_iv.length,
    result
  });
}
