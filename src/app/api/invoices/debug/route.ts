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
  
  // 完全按照 PHP 實作，使用 Latin1 編碼
  function encryptPHP(data: string, key: string, iv: string): string {
    // PHP strlen() 返回字節數，對 ASCII 等於字符數
    const len = data.length;
    const blockSize = 32;
    const pad = blockSize - (len % blockSize);
    // PHP chr($pad) 產生單字節字符
    const padded = data + String.fromCharCode(pad).repeat(pad);
    
    // 使用 latin1 (binary) 編碼，與 PHP 一致
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(key, 'latin1'),
      Buffer.from(iv, 'latin1')
    );
    cipher.setAutoPadding(false);
    
    let encrypted = cipher.update(padded, 'latin1', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  const encrypted = encryptPHP(testData, hash_key, hash_iv);

  const res = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `MerchantID_=${merchant_id}&PostData_=${encrypted}`,
  }).then(r => r.json());

  // 也測試解密來驗證
  function decryptPHP(data: string, key: string, iv: string): string {
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(key, 'latin1'),
      Buffer.from(iv, 'latin1')
    );
    decipher.setAutoPadding(false);
    let decrypted = decipher.update(data, 'hex', 'latin1');
    decrypted += decipher.final('latin1');
    // 移除填充
    const padLen = decrypted.charCodeAt(decrypted.length - 1);
    return decrypted.slice(0, -padLen);
  }

  const decrypted = decryptPHP(encrypted, hash_key, hash_iv);

  return NextResponse.json({
    merchant_id,
    testData,
    encrypted_len: encrypted.length,
    encrypted_first50: encrypted.substring(0, 50),
    decrypted,
    decrypt_match: decrypted === testData,
    ezpay_result: res
  });
}
