import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  const merchantId = '347148408';
  const hashKey = 'vwhgNY7Roo7IgpITd7FcXy8g0t3QwEuL';
  const hashIV = 'Pb7Pegcr7o4sOXKC';

  const timestamp = Math.floor(Date.now() / 1000);

  const postData = new URLSearchParams();
  postData.append('RespondType', 'JSON');
  postData.append('Version', '1.4');
  postData.append('TimeStamp', String(timestamp));
  postData.append('TransNum', '');
  postData.append('MerchantOrderNo', 'T' + timestamp);
  postData.append('BuyerName', '測試');
  postData.append('BuyerUBN', '');
  postData.append('BuyerAddress', '');
  postData.append('BuyerEmail', '');
  postData.append('Category', 'B2C');
  postData.append('TaxType', '1');
  postData.append('TaxRate', '5');
  postData.append('Amt', '95');
  postData.append('TaxAmt', '5');
  postData.append('TotalAmt', '100');
  postData.append('CarrierType', '');
  postData.append('CarrierNum', '');
  postData.append('LoveCode', '');
  postData.append('PrintFlag', 'Y');
  postData.append('ItemName', '測試商品');
  postData.append('ItemCount', '1');
  postData.append('ItemUnit', '式');
  postData.append('ItemPrice', '100');
  postData.append('ItemAmt', '100');
  postData.append('Comment', '');
  postData.append('CreateStatusTime', '');
  postData.append('Status', '1');

  const queryString = postData.toString();

  const cipher = crypto.createCipheriv('aes-256-cbc', hashKey, hashIV);
  let encrypted = cipher.update(queryString, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const response = await fetch('https://inv.ezpay.com.tw/Api/invoice_issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `MerchantID_=${merchantId}&PostData_=${encrypted}`,
  });
  const result = await response.json();

  return NextResponse.json({ queryString: queryString.substring(0, 200), result });
}