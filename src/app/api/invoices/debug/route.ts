import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// 方法1: 32字節填充（ezPay PHP範例）
function encrypt32(data: string, key: string, iv: string): string {
  const blockSize = 32;
  const dataBuffer = Buffer.from(data, 'utf8');
  const pad = blockSize - (dataBuffer.length % blockSize);
  const padding = Buffer.alloc(pad, pad);
  const paddedBuffer = Buffer.concat([dataBuffer, padding]);
  
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'utf8'), Buffer.from(iv, 'utf8'));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(paddedBuffer), cipher.final()]).toString('hex');
}

// 方法2: 標準PKCS7（16字節，Node.js預設）
function encrypt16(data: string, key: string, iv: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'utf8'), Buffer.from(iv, 'utf8'));
  return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
}

// 方法3: 不填充直接加密（如果資料已是16的倍數）
function encryptNoPad(data: string, key: string, iv: string): string {
  const blockSize = 16;
  const dataBuffer = Buffer.from(data, 'utf8');
  const pad = blockSize - (dataBuffer.length % blockSize);
  const padding = Buffer.alloc(pad, pad);
  const paddedBuffer = Buffer.concat([dataBuffer, padding]);
  
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'utf8'), Buffer.from(iv, 'utf8'));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(paddedBuffer), cipher.final()]).toString('hex');
}

async function testEncrypt(merchantId: string, encrypted: string) {
  const formData = new URLSearchParams({
    MerchantID_: merchantId,
    PostData_: encrypted,
  });
  const response = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  });
  return response.json();
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
  
  const enc32 = encrypt32(testData, hash_key, hash_iv);
  const enc16 = encrypt16(testData, hash_key, hash_iv);
  const encNo = encryptNoPad(testData, hash_key, hash_iv);

  const [res32, res16, resNo] = await Promise.all([
    testEncrypt(merchant_id, enc32),
    testEncrypt(merchant_id, enc16),
    testEncrypt(merchant_id, encNo),
  ]);

  return NextResponse.json({
    merchant_id,
    key_length: hash_key.length,
    iv_length: hash_iv.length,
    method_32byte: { status: res32.Status, message: res32.Message },
    method_16byte: { status: res16.Status, message: res16.Message },
    method_16noPad: { status: resNo.Status, message: resNo.Message },
  });
}
