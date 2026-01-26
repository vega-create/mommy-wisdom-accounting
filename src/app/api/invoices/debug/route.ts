import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company') || '00000000-0000-0000-0000-000000000001';
  
  const supabase = await createClient();
  
  const { data: settings } = await supabase
    .from('company_ezpay_settings')
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (!settings) {
    return NextResponse.json({ error: 'No settings found' });
  }

  const { merchant_id, hash_key, hash_iv } = settings;
  
  const timestamp = Math.floor(Date.now() / 1000);
  const testData = `RespondType=JSON&Version=1.5&TimeStamp=${timestamp}&MerchantOrderNo=TEST${timestamp}&Status=1&Category=B2C&BuyerName=Test&TaxType=1&TaxRate=5&Amt=100&TaxAmt=5&TotalAmt=105&ItemName=Test&ItemCount=1&ItemUnit=式&ItemPrice=100&ItemAmt=100`;
  
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
    company_id: companyId,
    merchant_id,
    key_len: hash_key.length,
    iv_len: hash_iv.length,
    result: res
  });
}
