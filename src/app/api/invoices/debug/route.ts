import { NextResponse } from 'next/server';
import crypto from 'crypto';

// 試試標準 16 字節塊
function addPadding16(str: string): string {
  const len = Buffer.byteLength(str, 'utf8');
  const pad = 16 - (len % 16);
  return str + String.fromCharCode(pad).repeat(pad);
}

// 32 字節塊
function addPadding32(str: string): string {
  const len = Buffer.byteLength(str, 'utf8');
  const pad = 32 - (len % 32);
  return str + String.fromCharCode(pad).repeat(pad);
}

function httpBuildQuery(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value)).replace(/%20/g, '+')}`)
    .join('&');
}

async function testEncryption(padded: string, hashKey: string, hashIV: string, merchantId: string) {
  const cipher = crypto.createCipheriv('aes-256-cbc', hashKey, hashIV);
  cipher.setAutoPadding(false);
  let encrypted = cipher.update(padded, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const response = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `MerchantID_=${merchantId}&PostData_=${encrypted}`,
  });
  return response.json();
}

export async function GET() {
  const merchantId = '347148408';
  const hashKey = 'vwhgNY7Roo7IgpITd7FcXy8g0t3QwEuL';
  const hashIV = 'Pb7Pegcr7o4sOXKC';
  
  const timestamp = Math.floor(Date.now() / 1000);
  const postData = {
    RespondType: 'JSON',
    Version: '1.5',
    TimeStamp: timestamp,
    TransNum: '',
    MerchantOrderNo: 'TEST' + timestamp,
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
  
  // 測試兩種填充方式
  const padded16 = addPadding16(queryString);
  const padded32 = addPadding32(queryString);
  
  // 也測試 Node.js 自動填充
  const cipherAuto = crypto.createCipheriv('aes-256-cbc', hashKey, hashIV);
  let encryptedAuto = cipherAuto.update(queryString, 'utf8', 'hex');
  encryptedAuto += cipherAuto.final('hex');
  
  const responseAuto = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `MerchantID_=${merchantId}&PostData_=${encryptedAuto}`,
  });
  const resultAuto = await responseAuto.json();
  
  const result16 = await testEncryption(padded16, hashKey, hashIV, merchantId);
  const result32 = await testEncryption(padded32, hashKey, hashIV, merchantId);
  
  return NextResponse.json({
    queryLength: queryString.length,
    test_auto_padding: resultAuto,
    test_16byte_block: result16,
    test_32byte_block: result32,
  });
}
