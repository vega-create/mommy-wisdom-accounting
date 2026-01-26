import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

async function sendLineNotification(accessToken: string, groupId: string, message: string) {
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('acct_contracts')
    .select('*, items:acct_contract_items(*)')
    .eq('signature_token', token)
    .gt('signature_token_expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: '連結無效或已過期' }, { status: 404 });
  }

  // 取得公司資訊
  const { data: company } = await supabase
    .from('acct_companies')
    .select('name, tax_id, address, phone, email, logo_url')
    .eq('id', data.company_id)
    .single();

  return NextResponse.json({ ...data, company });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const body = await request.json();
  const { signature, signer_name } = body;

  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // 先取得合約資料
  const { data: contract } = await supabase
    .from('acct_contracts')
    .select('*, customer:acct_customers(*)')
    .eq('signature_token', token)
    .gt('signature_token_expires_at', new Date().toISOString())
    .single();

  if (!contract) {
    return NextResponse.json({ error: '連結無效或已過期' }, { status: 404 });
  }

  // 更新合約狀態
  const { data, error } = await supabase
    .from('acct_contracts')
    .update({
      customer_signature: signature,
      customer_signed_name: signer_name,
      customer_signed_at: new Date().toISOString(),
      customer_signed_ip: ip,
      status: 'signed',
    })
    .eq('signature_token', token)
    .select()
    .single();

  if (error) {
    console.error('Sign error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 自動建立請款單
  let payableId = null;
  try {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (contract.payment_due_days || 30));

    const payableData = {
      company_id: contract.company_id,
      contract_id: contract.id,
      customer_id: contract.customer_id,
      customer_name: contract.customer_name,
      customer_tax_id: contract.customer_tax_id,
      customer_email: contract.customer_email,
      title: `${contract.title} - 請款`,
      description: `合約 ${contract.contract_number} 簽署完成自動建立`,
      amount: contract.subtotal,
      tax_amount: contract.tax_amount,
      total_amount: contract.total_amount,
      status: 'pending',
      due_date: dueDate.toISOString().split('T')[0],
    };

    const { data: payable, error: payableError } = await supabase
      .from('acct_payable_requests')
      .insert(payableData)
      .select()
      .single();

    if (payableError) {
      console.error('建立請款單失敗:', payableError);
    } else {
      payableId = payable?.id;
    }
  } catch (e) {
    console.error('建立請款單異常:', e);
  }

  // 發送 LINE 通知（通知公司合約已簽署）
  try {
    const { data: lineSettings } = await supabase
      .from('acct_line_settings')
      .select('channel_access_token, is_active')
      .eq('company_id', contract.company_id)
      .single();

    if (lineSettings?.channel_access_token && lineSettings?.is_active && contract.customer?.line_group_id) {
      const message = `✅ 合約簽署完成通知\n\n` +
        `合約編號：${contract.contract_number}\n` +
        `客戶：${contract.customer_name}\n` +
        `簽署人：${signer_name}\n` +
        `金額：$${contract.total_amount?.toLocaleString()}\n\n` +
        `已自動建立請款單，請至系統查看。`;

      await sendLineNotification(
        lineSettings.channel_access_token,
        contract.customer.line_group_id,
        message
      );
    }
  } catch (e) {
    console.error('LINE notification error:', e);
  }

  return NextResponse.json({ success: true, payable_id: payableId });
}
