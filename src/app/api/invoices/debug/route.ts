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
  
  // 方法1: 標準 16 bytes (Node.js 預設)
  function encrypt16(data: string, key: string, iv: string): string {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
  }
  
  // 方法2: PHP 風格 32 bytes
  function encrypt32(data: string, key: string, iv: string): string {
    const blockSize = 32;
    const len = Buffer.byteLength(data, 'utf8');
    const pad = blockSize - (len % blockSize);
    const padded = data + String.fromCharCode(pad).repeat(pad);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    cipher.setAutoPadding(false);
    return cipher.update(padded, 'utf8', 'hex') + cipher.final('hex');
  }
  
  // 方法3: PHP 風格但用 Buffer
  function encrypt32Buffer(data: string, key: string, iv: string): string {
    const dataBuffer = Buffer.from(data, 'utf8');
    const blockSize = 32;
    const pad = blockSize - (dataBuffer.length % blockSize);
    const padBuffer = Buffer.alloc(pad, pad);
    const paddedBuffer = Buffer.concat([dataBuffer, padBuffer]);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), Buffer.from(iv));
    cipher.setAutoPadding(false);
    return Buffer.concat([cipher.update(paddedBuffer), cipher.final()]).toString('hex');
  }

  const enc16 = encrypt16(testData, hash_key, hash_iv);
  const enc32 = encrypt32(testData, hash_key, hash_iv);
  const enc32b = encrypt32Buffer(testData, hash_key, hash_iv);

  const results: Record<string, any> = {};
  
  for (const [name, enc] of Object.entries({ enc16, enc32, enc32b })) {
    const res = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `MerchantID_=${merchant_id}&PostData_=${enc}`,
    }).then(r => r.json());
    results[name] = { len: enc.length, status: res.Status, msg: res.Message };
  }

  return NextResponse.json({
    merchant_id,
    key_len: hash_key.length,
    iv_len: hash_iv.length,
    results
  });
}
