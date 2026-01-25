import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

// 發送 LINE 訊息
async function sendLineMessage(accessToken: string, to: string, text: string) {
  try {
    const response = await fetch(LINE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to,
        messages: [{ type: 'text', text }]
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// 產生應付單號
async function generatePayableNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  const { data } = await supabase
    .from('acct_payable_requests')
    .select('payable_number')
    .eq('company_id', companyId)
    .like('payable_number', `PAY${year}${month}%`)
    .order('payable_number', { ascending: false })
    .limit(1);
  
  let seq = 1;
  if (data && data.length > 0) {
    const lastNum = data[0].payable_number;
    seq = parseInt(lastNum.slice(-4)) + 1;
  }
  
  return `PAY${year}${month}${String(seq).padStart(4, '0')}`;
}

// GET - 取得勞報單資料（用於簽署頁面）
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;

    const { data: report, error } = await supabase
      .from('acct_labor_reports')
      .select(`
        *,
        company:acct_companies(name)
      `)
      .eq('signature_token', token)
      .single();

    if (error || !report) {
      return NextResponse.json({ error: '簽署連結無效或已過期' }, { status: 404 });
    }

    return NextResponse.json({ data: report });
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json({ error: '載入失敗' }, { status: 500 });
  }
}

// POST - 提交簽名
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    const body = await request.json();
    const { signature } = body;

    if (!signature) {
      return NextResponse.json({ error: '缺少簽名資料' }, { status: 400 });
    }

    // 取得勞報單
    const { data: report, error: reportError } = await supabase
      .from('acct_labor_reports')
      .select(`
        *,
        staff:acct_customers(line_user_id, line_group_id, is_internal)
      `)
      .eq('signature_token', token)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: '簽署連結無效' }, { status: 404 });
    }

    if (report.status === 'signed' || report.status === 'paid') {
      return NextResponse.json({ error: '此勞報單已簽署' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    // 更新勞報單狀態
    const { error: updateError } = await supabase
      .from('acct_labor_reports')
      .update({
        status: 'signed',
        signed_at: now,
        signed_ip: ip,
        // 簽名圖片可以存到 storage，這裡先存 base64
        updated_at: now
      })
      .eq('id', report.id);

    if (updateError) {
      console.error('Update report error:', updateError);
      return NextResponse.json({ error: '更新失敗' }, { status: 500 });
    }

    // 建立應付款項
    let payableId = null;
    try {
      const payableNumber = await generatePayableNumber(report.company_id);
      
      const { data: payable, error: payableError } = await supabase
        .from('acct_payable_requests')
        .insert({
          company_id: report.company_id,
          payable_number: payableNumber,
          vendor_id: report.staff_id,
          vendor_name: report.staff_name,
          vendor_type: 'individual',
          title: report.service_description,
          description: `勞報單：${report.report_number}`,
          amount: report.net_amount,
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'pending',
          source_type: 'labor',
          labor_report_id: report.id
        })
        .select()
        .single();

      if (!payableError && payable) {
        payableId = payable.id;

        // 更新勞報單的應付關聯
        await supabase
          .from('acct_labor_reports')
          .update({ payable_id: payable.id })
          .eq('id', report.id);
      }
    } catch (payableErr) {
      console.error('Create payable error:', payableErr);
    }

    // 發送通知給管理員
    try {
      const { data: lineSettings } = await supabase
        .from('acct_line_settings')
        .select('channel_access_token, admin_group_id')
        .eq('company_id', report.company_id)
        .eq('is_active', true)
        .single();

      if (lineSettings?.channel_access_token && lineSettings?.admin_group_id) {
        const message = `✅ 勞報單簽署完成

📋 單號：${report.report_number}
👤 人員：${report.staff_name}
💰 實付：NT$ ${report.net_amount.toLocaleString()}

已建立應付款項，請至系統確認付款。`;

        await sendLineMessage(
          lineSettings.channel_access_token,
          lineSettings.admin_group_id,
          message
        );
      }
    } catch (notifyErr) {
      console.error('Notify error:', notifyErr);
    }

    return NextResponse.json({ 
      success: true, 
      message: '簽署完成',
      payable_id: payableId
    });

  } catch (error) {
    console.error('Error submitting signature:', error);
    return NextResponse.json({ error: '簽署失敗' }, { status: 500 });
  }
}
