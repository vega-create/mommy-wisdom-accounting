import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

async function sendLineNotification(accessToken: string, groupId: string, message: string) {
  try {
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
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  // 1. 先查合約
  const { data: contract } = await supabase
    .from('acct_contracts')
    .select('*, items:acct_contract_items(*)')
    .eq('signature_token', token)
    .gt('signature_token_expires_at', new Date().toISOString())
    .single();

  if (contract) {
    const { data: company } = await supabase
      .from('acct_companies')
      .select('name, tax_id, address, phone, email, logo_url')
      .eq('id', contract.company_id)
      .single();

    return NextResponse.json({ type: 'contract', ...contract, company });
  }

  // 2. 再查勞報單
  const { data: labor } = await supabase
    .from('acct_labor_reports')
    .select('*')
    .eq('sign_token', token)
    .in('status', ['pending', 'signed'])
    .single();

  if (labor) {
    const { data: company } = await supabase
      .from('acct_companies')
      .select('name, tax_id')
      .eq('id', labor.company_id)
      .single();

    // 查 freelancer 資料（帶入已有的個人資訊）
    let freelancer = null;
    if (labor.freelancer_id) {
      const { data: f } = await supabase
        .from('acct_freelancers')
        .select('*')
        .eq('id', labor.freelancer_id)
        .single();
      freelancer = f;
    }

    return NextResponse.json({ type: 'labor', ...labor, company, freelancer });
  }

  return NextResponse.json({ error: '連結無效或已過期' }, { status: 404 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const body = await request.json();
  const { type } = body;

  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // ===== 勞報單簽署 =====
  if (type === 'labor') {
    const {
      signature,
      signer_name,
      id_number,
      home_address,
      birthday,
      phone,
      bank_code,
      bank_name,
      bank_account,
      bank_branch,
      bank_account_name,
      id_card_front,
      id_card_back,
      passbook_image,
    } = body;

    const { data: labor } = await supabase
      .from('acct_labor_reports')
      .select('*')
      .eq('sign_token', token)
      .eq('status', 'pending')
      .single();

    if (!labor) {
      return NextResponse.json({ error: '連結無效或已過期' }, { status: 404 });
    }

    // 更新勞報單狀態
    const laborUpdate: Record<string, any> = {
      status: 'signed',
      signature_image: signature,
      signed_at: new Date().toISOString(),
      signed_ip: ip,
    };
    if (id_number) laborUpdate.id_number = id_number;
    if (bank_code) laborUpdate.bank_code = bank_code;
    if (bank_account) laborUpdate.bank_account = bank_account;

    const { error } = await supabase
      .from('acct_labor_reports')
      .update(laborUpdate)
      .eq('sign_token', token);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 更新 freelancer 資料（儲存個人資訊供下次帶入）
    if (labor.freelancer_id) {
      const freelancerUpdate: Record<string, any> = {
        updated_at: new Date().toISOString(),
        is_complete: true,
      };
      if (id_number) freelancerUpdate.id_number = id_number;
      if (home_address) freelancerUpdate.home_address = home_address;
      if (birthday) freelancerUpdate.birthday = birthday;
      if (phone) freelancerUpdate.phone = phone;
      if (bank_code) freelancerUpdate.bank_code = bank_code;
      if (bank_name) freelancerUpdate.bank_name = bank_name;
      if (bank_account) freelancerUpdate.bank_account = bank_account;
      if (bank_branch) freelancerUpdate.bank_branch = bank_branch;
      if (bank_account_name) freelancerUpdate.bank_account_name = bank_account_name;
      if (id_card_front) freelancerUpdate.id_card_front = id_card_front;
      if (id_card_back) freelancerUpdate.id_card_back = id_card_back;
      if (passbook_image) freelancerUpdate.passbook_image = passbook_image;

      await supabase
        .from('acct_freelancers')
        .update(freelancerUpdate)
        .eq('id', labor.freelancer_id);

      // 同步更新 acct_customers
      const { data: freelancer } = await supabase
        .from('acct_freelancers')
        .select('customer_id')
        .eq('id', labor.freelancer_id)
        .single();

      if (freelancer?.customer_id) {
        const customerUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
        if (id_number) customerUpdate.id_number = id_number;
        if (home_address) customerUpdate.home_address = home_address;
        if (birthday) customerUpdate.birth_date = birthday;
        if (phone) customerUpdate.phone = phone;
        if (bank_code) customerUpdate.bank_code = bank_code;
        if (bank_name) customerUpdate.bank_name = bank_name;
        if (bank_account) customerUpdate.bank_account = bank_account;

        await supabase
          .from('acct_customers')
          .update(customerUpdate)
          .eq('id', freelancer.customer_id);
      }
    }

    // 發送 LINE 通知
    try {
      const { data: lineSettings } = await supabase
        .from('acct_line_settings')
        .select('channel_access_token, is_active, admin_group_id')
        .eq('company_id', labor.company_id)
        .single();

      if (lineSettings?.channel_access_token && lineSettings?.is_active && lineSettings?.admin_group_id) {
        const message = `✅ 勞報單簽署完成\n\n` +
          `單號：${labor.report_number}\n` +
          `人員：${labor.staff_name}\n` +
          `金額：$${labor.net_amount?.toLocaleString()}\n` +
          `簽署人：${signer_name}`;

        await sendLineNotification(
          lineSettings.channel_access_token,
          lineSettings.admin_group_id,
          message
        );
      }
    } catch (e) {
      console.error('LINE notification error:', e);
    }

    return NextResponse.json({ success: true });
  }

  // ===== 合約簽署 =====
  const { signature, signer_name, company_stamp } = body;

  const { data: contract } = await supabase
    .from('acct_contracts')
    .select('*, customer:acct_customers(id, name, email, line_group_id, line_group_name)')
    .eq('signature_token', token)
    .gt('signature_token_expires_at', new Date().toISOString())
    .single();

  if (!contract) {
    return NextResponse.json({ error: '連結無效或已過期' }, { status: 404 });
  }

  const { data, error: updateError } = await supabase
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

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  let billingId = null;
  try {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (contract.payment_due_days || 30));

    const { data: numberData } = await supabase
      .rpc('generate_billing_number', { p_company_id: contract.company_id });

    const billing_number = numberData || `BIL${Date.now()}`;
    const customer = contract.customer;

    const { data: billing, error: billingError } = await supabase
      .from('acct_billing_requests')
      .insert({
        company_id: contract.company_id,
        billing_number,
        customer_id: contract.customer_id || null,
        customer_name: contract.customer_name,
        customer_email: contract.customer_email || customer?.email || null,
        customer_line_group_id: customer?.line_group_id || null,
        customer_line_group_name: customer?.line_group_name || null,
        title: `${contract.title}`,
        description: `合約 ${contract.contract_number} 簽署完成`,
        amount: contract.subtotal,
        tax_amount: contract.tax_amount,
        total_amount: contract.total_amount,
        status: 'draft',
        due_date: dueDate.toISOString().split('T')[0],
      })
      .select()
      .single();

    if (!billingError) billingId = billing?.id;
  } catch (e) {
    console.error('建立請款單異常:', e);
  }

  try {
    const { data: lineSettings } = await supabase
      .from('acct_line_settings')
      .select('channel_access_token, is_active, admin_group_id')
      .eq('company_id', contract.company_id)
      .single();

    if (lineSettings?.channel_access_token && lineSettings?.is_active && lineSettings?.admin_group_id) {
      const message = `✅ 合約簽署完成通知\n\n` +
        `合約編號：${contract.contract_number}\n` +
        `客戶：${contract.customer_name}\n` +
        `簽署人：${signer_name}\n` +
        `金額：$${contract.total_amount?.toLocaleString()}\n\n` +
        `已自動建立請款單，請至系統查看。`;

      await sendLineNotification(lineSettings.channel_access_token, lineSettings.admin_group_id, message);
    }
  } catch (e) {
    console.error('LINE notification error:', e);
  }

  return NextResponse.json({ success: true, billing_id: billingId });
}
