import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const EZPAY_URL = 'https://inv.ezpay.com.tw/Api/invoice_invalid';

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
    const supabase = await createClient();
    const body = await request.json();
    const { company_id, invoice_id, invoice_number, invalid_reason } = body;

    if (!company_id || !invoice_number || !invalid_reason) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    // 取得 ezPay 設定
    const { data: settings } = await supabase
      .from('company_ezpay_settings')
      .select('*')
      .eq('company_id', company_id)
      .single();

    if (!settings) {
      return NextResponse.json({ error: '尚未設定發票金鑰' }, { status: 400 });
    }

    const { merchant_id, hash_key, hash_iv } = settings;

    const postData: Record<string, string> = {
      RespondType: 'JSON',
      Version: '1.0',
      TimeStamp: Math.floor(Date.now() / 1000).toString(),
      InvoiceNumber: invoice_number,
      InvalidReason: invalid_reason.substring(0, 6),
    };

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
      // 1. 更新發票狀態
      await supabase
        .from('acct_invoices')
        .update({
          status: 'void',
          void_at: new Date().toISOString(),
          void_reason: invalid_reason,
        })
        .eq('id', invoice_id);

      // 2. 查詢發票關聯的請款單
      const { data: invoice } = await supabase
        .from('acct_invoices')
        .select('billing_request_id, total_amount, buyer_name')
        .eq('id', invoice_id)
        .single();

      if (invoice?.billing_request_id) {
        // 3. 查詢請款單的 transaction_id
        const { data: billing } = await supabase
          .from('acct_billing_requests')
          .select('transaction_id, billing_number')
          .eq('id', invoice.billing_request_id)
          .single();

        // 4. 請款單改回「已發送」狀態
        await supabase
          .from('acct_billing_requests')
          .update({
            status: 'sent',
            paid_at: null,
            paid_amount: null,
            invoice_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoice.billing_request_id);

        // 5. 建立沖銷交易（負數）
        if (billing?.transaction_id) {
          const { data: originalTx } = await supabase
            .from('acct_transactions')
            .select('*')
            .eq('id', billing.transaction_id)
            .single();

          if (originalTx) {
            await supabase
              .from('acct_transactions')
              .insert({
                company_id: originalTx.company_id,
                type: originalTx.type,
                category_id: originalTx.category_id,
                amount: -Math.abs(originalTx.amount),
                description: `【沖銷】發票 ${invoice_number} 作廢 - ${originalTx.description || ''}`,
                transaction_date: new Date().toISOString().split('T')[0],
                account_id: originalTx.account_id,
                customer_id: originalTx.customer_id,
                created_by: originalTx.created_by,
              });
          }
        }
      }

      return NextResponse.json({
        success: true,
        status: result.Status,
        message: '發票作廢成功，已沖銷收入並重置請款單',
      });
    }

    return NextResponse.json({
      success: false,
      status: result.Status,
      message: result.Message,
    });

  } catch (error: any) {
    console.error('Invoice void error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}