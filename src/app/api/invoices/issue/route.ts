import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const EZPAY_URL = 'https://inv.ezpay.com.tw/Api/invoice_issue';
const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

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

function aesDecrypt(data: string, key: string, iv: string): string {
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function sendLineNotification(
  accessToken: string,
  groupId: string,
  message: string
) {
  const response = await fetch(LINE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: 'text', text: message }]
    }),
  });
  return response.ok;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const {
      company_id,
      customer_id,
      buyer_name,
      buyer_email,
      buyer_tax_id,
      category,
      items,
      carrier_type,
      carrier_num,
      love_code,
      print_flag,
      send_line,
    } = body;

    // 統一讀 acct_invoice_settings
    const { data: settings } = await supabase
      .from('acct_invoice_settings')
      .select('*')
      .eq('company_id', company_id)
      .single();

    if (!settings) {
      return NextResponse.json({ error: '尚未設定發票金鑰' }, { status: 400 });
    }

    const { merchant_id, hash_key, hash_iv } = settings;

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

    const transNum = `INV${Date.now()}`;
    const invoiceCategory = category || 'B2C';

    // B2C 沒載具也沒捐贈時，強制印紙本
    let finalPrintFlag = print_flag || 'N';
    if (invoiceCategory === 'B2C' && !carrier_type && !love_code) {
      finalPrintFlag = 'Y';
    }

    const postData: Record<string, string> = {
      RespondType: 'JSON',
      Version: '1.5',
      TimeStamp: Math.floor(Date.now() / 1000).toString(),
      TransNum: transNum,
      MerchantOrderNo: transNum,
      Status: '1',
      Category: invoiceCategory,
      BuyerName: buyer_name,
      BuyerUBN: buyer_tax_id || '',
      BuyerEmail: buyer_email || '',
      PrintFlag: finalPrintFlag,
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

    if (carrier_type && carrier_num) {
      postData.CarrierType = carrier_type;
      postData.CarrierNum = carrier_num;
    }

    if (love_code) {
      postData.LoveCode = love_code;
    }

    const queryString = Object.entries(postData)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
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

    if (result.Status === 'SUCCESS') {
      let invoiceResult;
      try {
        const decryptedResult = aesDecrypt(result.Result, hash_key, hash_iv);
        invoiceResult = JSON.parse(decryptedResult);
      } catch (e) {
        invoiceResult = typeof result.Result === 'string' ? JSON.parse(result.Result) : result.Result;
      }

      const { data: invoice, error: insertError } = await supabase.from('acct_invoices').insert({
        company_id,
        customer_id: customer_id || null,
        invoice_number: invoiceResult.InvoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        buyer_name,
        buyer_tax_id: buyer_tax_id || null,
        buyer_email: buyer_email || null,
        sales_amount: amt,
        tax_amount: taxAmt,
        total_amount: totalAmt,
        status: 'issued',
        ezpay_trans_num: transNum,
        ezpay_invoice_trans_no: invoiceResult.InvoiceTransNo,
        ezpay_random_num: invoiceResult.RandomNum,
        invoice_type: invoiceCategory,
      }).select().single();

      if (insertError) {
        console.error('Insert error:', insertError);
      }

      let lineSent = false;
      if (send_line && customer_id) {
        try {
          const { data: customer } = await supabase
            .from('acct_customers')
            .select('line_group_id, line_group_name, line_notify_enabled')
            .eq('id', customer_id)
            .single();

          if (customer?.line_group_id && customer?.line_notify_enabled) {
            const { data: lineSettings } = await supabase
              .from('acct_line_settings')
              .select('channel_access_token, is_active')
              .eq('company_id', company_id)
              .single();

            if (lineSettings?.channel_access_token && lineSettings?.is_active) {
              const message = `📄 電子發票通知\n\n` +
                `發票號碼：${invoiceResult.InvoiceNumber}\n` +
                `買受人：${buyer_name}\n` +
                `金額：$${totalAmt.toLocaleString()}\n` +
                `開立日期：${new Date().toLocaleDateString('zh-TW')}\n\n` +
                `感謝您的支持！`;

              lineSent = await sendLineNotification(
                lineSettings.channel_access_token,
                customer.line_group_id,
                message
              );

              if (lineSent && invoice?.id) {
                await supabase
                  .from('acct_invoices')
                  .update({ line_sent_at: new Date().toISOString() })
                  .eq('id', invoice.id);
              }
            }
          }
        } catch (lineError) {
          console.error('LINE notification error:', lineError);
        }
      }

      return NextResponse.json({
        success: true,
        status: result.Status,
        message: result.Message,
        result: invoiceResult,
        line_sent: lineSent,
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