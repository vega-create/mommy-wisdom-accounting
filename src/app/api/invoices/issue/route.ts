import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// 正式環境
const EZPAY_URL = 'https://inv.ezpay.com.tw/Api/invoice_issue';

function aesEncrypt(data: string, key: string, iv: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function aesDecrypt(data: string, key: string, iv: string): string {
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const {
      company_id,
      buyer_name,
      buyer_email,
      buyer_tax_id,
      invoice_type: category,
      items,
      carrier_type,
      carrier_num,
      love_code,
      print_flag,
    } = body;

    // 取得發票設定
    const { data: settings } = await supabase
      .from('company_ezpay_settings')
      .select('*')
      .eq('company_id', company_id)
      .single();

    if (!settings) {
      return NextResponse.json({ error: '尚未設定發票金鑰' }, { status: 400 });
    }

    const { merchant_id, hash_key, hash_iv } = settings;

    // 計算金額
    let amt = 0;
    const itemNames: string[] = [];
    const itemCounts: string[] = [];
    const itemUnits: string[] = [];
    const itemPrices: string[] = [];
    const itemAmts: string[] = [];

    items.forEach((item: any) => {
      amt += item.amount;
      itemNames.push(item.name);
      itemCounts.push(String(item.count || 1));
      itemUnits.push(item.unit || '式');
      itemPrices.push(String(item.price));
      itemAmts.push(String(item.amount));
    });

    const taxAmt = Math.round(amt * 0.05);
    const totalAmt = amt + taxAmt;

    const now = new Date();
    const transNum = `INV${Date.now()}`;

    const postData: Record<string, string> = {
      RespondType: 'JSON',
      Version: '1.5',
      TimeStamp: Math.floor(now.getTime() / 1000).toString(),
      TransNum: transNum,
      MerchantOrderNo: transNum,
      Status: '1',
      Category: category || 'B2C',
      BuyerName: buyer_name,
      BuyerEmail: buyer_email || '',
      PrintFlag: print_flag || 'Y',
      TaxType: '1',
      TaxRate: '5',
      Amt: String(amt),
      TaxAmt: String(taxAmt),
      TotalAmt: String(totalAmt),
      ItemName: itemNames.join('|'),
      ItemCount: itemCounts.join('|'),
      ItemUnit: itemUnits.join('|'),
      ItemPrice: itemPrices.join('|'),
      ItemAmt: itemAmts.join('|'),
    };

    // B2B 需要統編
    if (category === 'B2B' && buyer_tax_id) {
      postData.BuyerUBN = buyer_tax_id;
    }

    // 載具
    if (carrier_type && carrier_num) {
      postData.CarrierType = carrier_type;
      postData.CarrierNum = carrier_num;
    }

    // 捐贈
    if (love_code) {
      postData.LoveCode = love_code;
    }

    const queryString = Object.entries(postData)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const encrypted = aesEncrypt(queryString, hash_key, hash_iv);

    const formData = new URLSearchParams();
    formData.append('MerchantID_', merchant_id);
    formData.append('PostData_', encrypted);

    const response = await fetch(EZPAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const result = await response.json();

    // 儲存發票記錄
    if (result.Status === 'SUCCESS') {
      // 解密回傳資料
      const decryptedResult = aesDecrypt(result.Result, hash_key, hash_iv);
      const invoiceResult = JSON.parse(decryptedResult);

      await supabase.from('acct_invoices').insert({
        company_id,
        invoice_number: invoiceResult.InvoiceNumber,
        invoice_date: invoiceResult.CreateTime,
        buyer_name,
        buyer_tax_id,
        sales_amount: amt,
        tax_amount: taxAmt,
        total_amount: totalAmt,
        status: 'issued',
        ezpay_trans_num: transNum,
        invoice_type: category,
      });

      return NextResponse.json({
        success: true,
        status: result.Status,
        message: result.Message,
        result: invoiceResult,
      });
    }

    return NextResponse.json({
      success: false,
      status: result.Status,
      message: result.Message,
      result: null,
    });

  } catch (error: any) {
    console.error('Invoice issue error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}