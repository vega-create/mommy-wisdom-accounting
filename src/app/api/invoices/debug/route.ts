import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  const merchantId = '347148408';
  const hashKey = 'vwhgNY7Roo7IgpITd7FcXy8g0t3QwEuL';
  const hashIV = 'Pb7Pegcr7o4sOXKC';

  const timestamp = Math.floor(Date.now() / 1000);
  const queryString = `RespondType=JSON&Version=1.4&TimeStamp=${timestamp}&TransNum=&MerchantOrderNo=T${timestamp}&BuyerName=test&BuyerUBN=&BuyerAddress=&BuyerEmail=&Category=B2C&TaxType=1&TaxRate=5&Amt=95&TaxAmt=5&TotalAmt=100&CarrierType=&CarrierNum=&LoveCode=&PrintFlag=Y&ItemName=test&ItemCount=1&ItemUnit=unit&ItemPrice=100&ItemAmt=100&Comment=&CreateStatusTime=&Status=1`;

  // 用 Buffer 確保編碼正確
  const keyBuffer = Buffer.from(hashKey, 'utf8');
  const ivBuffer = Buffer.from(hashIV, 'utf8');
  const dataBuffer = Buffer.from(queryString, 'utf8');

  // 手動 PKCS7 填充到 16 字節邊界
  const blockSize = 16;
  const padLen = blockSize - (dataBuffer.length % blockSize);
  const paddedBuffer = Buffer.concat([dataBuffer, Buffer.alloc(padLen, padLen)]);

  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, ivBuffer);
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(paddedBuffer), cipher.final()]).toString('hex');

  const response = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `MerchantID_=${merchantId}&PostData_=${encrypted}`,
  });
  const result = await response.json();

  return NextResponse.json({
    keyLen: keyBuffer.length,
    ivLen: ivBuffer.length,
    dataLen: dataBuffer.length,
    paddedLen: paddedBuffer.length,
    result
  });
}