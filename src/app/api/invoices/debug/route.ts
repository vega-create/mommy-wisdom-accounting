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
  
  // 方法A: 使用 Buffer 做 PKCS7 填充 (32 bytes block)
  function encryptA(data: string, key: string, iv: string): string {
    const dataBuffer = Buffer.from(data, 'utf8');
    const blockSize = 32;
    const padLen = blockSize - (dataBuffer.length % blockSize);
    const padBuffer = Buffer.alloc(padLen, padLen);
    const paddedBuffer = Buffer.concat([dataBuffer, padBuffer]);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), Buffer.from(iv));
    cipher.setAutoPadding(false);
    return Buffer.concat([cipher.update(paddedBuffer), cipher.final()]).toString('hex');
  }
  
  // 方法B: 標準 Node.js (自動 PKCS7 16 bytes)
  function encryptB(data: string, key: string, iv: string): string {
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), Buffer.from(iv));
    return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
  }
  
  // 方法C: 16 bytes block 手動填充
  function encryptC(data: string, key: string, iv: string): string {
    const dataBuffer = Buffer.from(data, 'utf8');
    const blockSize = 16;
    const padLen = blockSize - (dataBuffer.length % blockSize);
    const padBuffer = Buffer.alloc(padLen, padLen);
    const paddedBuffer = Buffer.concat([dataBuffer, padBuffer]);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), Buffer.from(iv));
    cipher.setAutoPadding(false);
    return Buffer.concat([cipher.update(paddedBuffer), cipher.final()]).toString('hex');
  }

  const encA = encryptA(testData, hash_key, hash_iv);
  const encB = encryptB(testData, hash_key, hash_iv);
  const encC = encryptC(testData, hash_key, hash_iv);

  // 測試三種方法
  const results: Record<string, any> = {};
  
  for (const [name, enc] of [['A_32block', encA], ['B_auto', encB], ['C_16block', encC]]) {
    const res = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `MerchantID_=${merchant_id}&PostData_=${enc}`,
    }).then(r => r.json());
    results[name] = { len: enc.length, status: res.Status, msg: res.Message };
  }

  return NextResponse.json({
    merchant_id,
    testData,
    testDataLen: testData.length,
    results
  });
}
