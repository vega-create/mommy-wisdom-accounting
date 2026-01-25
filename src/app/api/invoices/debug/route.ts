import { NextResponse } from 'next/server';
import crypto from 'crypto';

function addPadding(str: string, blocksize: number = 32): string {
  const len = Buffer.byteLength(str, 'utf8');
  const pad = blocksize - (len % blocksize);
  return str + String.fromCharCode(pad).repeat(pad);
}

function httpBuildQuery(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value)).replace(/%20/g, '+')}`)
    .join('&');
}

export async function GET() {
  // 用智慧媽咪的金鑰測試
  const merchantId = '347148408';
  const hashKey = 'vwhgNY7Roo7IgpITd7FcXy8g0t3QwEuL';
  const hashIV = 'Pb7Pegcr7o4sOXKC';
  
  const timestamp = Math.floor(Date.now() / 1000);
  const orderNo = 'DEBUG' + timestamp;
  
  const postData = {
    RespondType: 'JSON',
    Version: '1.5',
    TimeStamp: timestamp,
    TransNum: '',
    MerchantOrderNo: orderNo,
    Status: '1',
    CreateStatusTime: '',
    Category: 'B2C',
    BuyerName: '測試',
    BuyerUBN: '',
    BuyerAddress: '',
    BuyerEmail: '',
    BuyerPhone: '',
    CarrierType: '',
    CarrierNum: '',
    LoveCode: '',
    PrintFlag: 'Y',
    TaxType: '1',
    TaxRate: 5,
    Amt: 95,
    TaxAmt: 5,
    TotalAmt: 100,
    ItemName: '測試商品',
    ItemCount: '1',
    ItemUnit: '式',
    ItemPrice: '100',
    ItemAmt: '100',
    Comment: '',
  };
  
  const queryString = httpBuildQuery(postData);
  const padded = addPadding(queryString, 32);
  
  const cipher = crypto.createCipheriv('aes-256-cbc', hashKey, hashIV);
  cipher.setAutoPadding(false);
  let encrypted = cipher.update(padded, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // 實際發送到 ezPay
  try {
    const formBody = `MerchantID_=${merchantId}&PostData_=${encrypted}`;
    
    const response = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    });
    
    const result = await response.json();
    
    return NextResponse.json({
      debug: {
        merchantId,
        keyLength: hashKey.length,
        ivLength: hashIV.length,
        queryStringPreview: queryString.substring(0, 200),
        queryStringLength: queryString.length,
        paddedLength: Buffer.byteLength(padded, 'utf8'),
        encryptedPreview: encrypted.substring(0, 100),
      },
      ezpayResponse: result
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) });
  }
}
