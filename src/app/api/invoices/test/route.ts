import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const EZPAY_TEST_URL = 'https://cinv.ezpay.com.tw/Api/invoice_issue';

function addPadding(data: string): string {
  const blockSize = 32;
  const len = data.length;
  const pad = blockSize - (len % blockSize);
  return data + String.fromCharCode(pad).repeat(pad);
}

function aesEncrypt(data: string, key: string, iv: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  cipher.setAutoPadding(false);
  const padded = addPadding(data);
  let encrypted = cipher.update(padded, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { merchant_id, hash_key, hash_iv } = body;

    const now = new Date();
    const transNum = `T${Date.now()}`;
    
    // 必填欄位
    const postData: Record<string, string> = {
      RespondType: 'JSON',
      Version: '1.5',
      TimeStamp: Math.floor(now.getTime() / 1000).toString(),
      TransNum: transNum,
      MerchantOrderNo: transNum,
      Status: '1',
      Category: 'B2C',
      BuyerName: '測試買家',
      BuyerEmail: 'test@example.com',
      PrintFlag: 'Y',
      TaxType: '1',
      TaxRate: '5',
      Amt: '100',
      TaxAmt: '5',
      TotalAmt: '105',
      ItemName: '測試商品',
      ItemCount: '1',
      ItemUnit: '個',
      ItemPrice: '100',
      ItemAmt: '100',
    };

    const queryString = Object.entries(postData)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    const encrypted = aesEncrypt(queryString, hash_key, hash_iv);

    const formData = new URLSearchParams();
    formData.append('MerchantID_', merchant_id);
    formData.append('PostData_', encrypted);

    const response = await fetch(EZPAY_TEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const result = await response.json();

    return NextResponse.json({
      success: result.Status === 'SUCCESS',
      status: result.Status,
      message: result.Message,
      result: result.Result,
      debug: { merchant_id, transNum, queryString: queryString.substring(0, 100) }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
