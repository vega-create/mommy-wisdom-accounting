import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  const merchantId = '347148408';
  const hashKey = 'vwhgNY7Roo7IgpITd7FcXy8g0t3QwEuL';
  const hashIV = 'Pb7Pegcr7o4sOXKC';

  const timestamp = Math.floor(Date.now() / 1000);

  const queryString = `RespondType=JSON&Version=1.4&TimeStamp=${timestamp}&TransNum=&MerchantOrderNo=T${timestamp}&BuyerName=test&BuyerUBN=&BuyerAddress=&BuyerEmail=&Category=B2C&TaxType=1&TaxRate=5&Amt=95&TaxAmt=5&TotalAmt=100&CarrierType=&CarrierNum=&LoveCode=&PrintFlag=Y&ItemName=test&ItemCount=1&ItemUnit=unit&ItemPrice=100&ItemAmt=100&Comment=&CreateStatusTime=&Status=1`;

  // 手動 32 字節塊填充
  const len = Buffer.byteLength(queryString, 'utf8');
  const pad = 32 - (len % 32);
  const padded = queryString + String.fromCharCode(pad).repeat(pad);

  const cipher = crypto.createCipheriv('aes-256-cbc', hashKey, hashIV);
  cipher.setAutoPadding(false);
  let encrypted = cipher.update(padded, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // 試試用 FormData
  const formData = new FormData();
  formData.append('MerchantID_', merchantId);
  formData.append('PostData_', encrypted);

  const response = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    body: formData,
  });
  const result = await response.json();

  return NextResponse.json({ encrypted: encrypted.substring(0, 50), result });
}