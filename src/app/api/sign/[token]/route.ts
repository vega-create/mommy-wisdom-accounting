export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 所得類型名稱
const INCOME_TYPE_NAMES: Record<string, string> = {
  '50': '執行業務所得',
  '9A': '稿費所得',
  '9B': '講演鐘點費',
  '92': '競技競賽獎金',
};

// GET - 透過 token 取得勞報單資料（公開）
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;

    if (!token) {
      return NextResponse.json({ error: '無效的連結' }, { status: 400 });
    }

    // 查詢勞報單
    const { data: report, error } = await supabase
      .from('acct_labor_reports')
      .select(`
        id,
        report_number,
        company_id,
        staff_name,
        id_number,
        income_type_code,
        work_description,
        service_period_start,
        service_period_end,
        gross_amount,
        withholding_tax,
        nhi_premium,
        net_amount,
        status,
        bank_code,
        bank_account,
        freelancer_id
      `)
      .eq('sign_token', token)
      .single();

    if (error || !report) {
      console.error('Report not found:', error);
      return NextResponse.json({ error: '找不到此勞報單，連結可能已失效' }, { status: 404 });
    }

    // 查詢公司名稱
    const { data: company } = await supabase
      .from('acct_companies')
      .select('name, logo_url')
      .eq('id', report.company_id)
      .single();

    // 如果有關聯 freelancer，取得其資料
    let freelancerData = null;
    if (report.freelancer_id) {
      const { data: freelancer } = await supabase
        .from('acct_freelancers')
        .select('id_number, bank_code, bank_account, id_card_front, id_card_back, passbook_image')
        .eq('id', report.freelancer_id)
        .single();
      freelancerData = freelancer;
    }

    return NextResponse.json({
      data: {
        ...report,
        company_name: company?.name || '公司',
        company_logo: company?.logo_url,
        income_type_name: INCOME_TYPE_NAMES[report.income_type_code] || report.income_type_code,
        // 帶入 freelancer 的資料（如果有）
        id_number: report.id_number || freelancerData?.id_number || '',
        bank_code: report.bank_code || freelancerData?.bank_code || '',
        bank_account: report.bank_account || freelancerData?.bank_account || '',
        // 已上傳的文件
        id_card_front: freelancerData?.id_card_front || null,
        id_card_back: freelancerData?.id_card_back || null,
        passbook_image: freelancerData?.passbook_image || null,
      }
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json({ error: '載入失敗' }, { status: 500 });
  }
}

// POST - 提交簽署
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    const body = await request.json();

    const {
      id_number,
      bank_code,
      bank_account,
      signature_image,
      id_card_front,
      id_card_back,
      passbook_image,
    } = body;

    if (!signature_image) {
      return NextResponse.json({ error: '請提供簽名' }, { status: 400 });
    }

    // 查詢勞報單
    const { data: report, error: fetchError } = await supabase
      .from('acct_labor_reports')
      .select('id, status, freelancer_id, company_id, staff_name, gross_amount, net_amount')
      .eq('sign_token', token)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: '找不到勞報單' }, { status: 404 });
    }

    // 允許 draft 和 pending 狀態簽署
    if (!['draft', 'pending'].includes(report.status)) {
      return NextResponse.json({ error: '此勞報單狀態無法簽署' }, { status: 400 });
    }

    // 取得 IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    const signedIp = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';

    // 更新勞報單
    const { error: updateError } = await supabase
      .from('acct_labor_reports')
      .update({
        id_number,
        bank_code,
        bank_account,
        signature_image,
        signed_at: new Date().toISOString(),
        signed_ip: signedIp,
        status: 'signed',
      })
      .eq('id', report.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: '更新失敗' }, { status: 500 });
    }

    // 如果有 freelancer_id，更新 freelancer 的資料
    if (report.freelancer_id) {
      const freelancerUpdate: Record<string, any> = {};
      
      if (id_number) freelancerUpdate.id_number = id_number;
      if (bank_code) freelancerUpdate.bank_code = bank_code;
      if (bank_account) freelancerUpdate.bank_account = bank_account;
      if (id_card_front) freelancerUpdate.id_card_front = id_card_front;
      if (id_card_back) freelancerUpdate.id_card_back = id_card_back;
      if (passbook_image) freelancerUpdate.passbook_image = passbook_image;
      
      if (Object.keys(freelancerUpdate).length > 0) {
        freelancerUpdate.is_complete = !!(id_number && bank_code && bank_account);
        
        await supabase
          .from('acct_freelancers')
          .update(freelancerUpdate)
          .eq('id', report.freelancer_id);
      }
    }

    // 自動建立應付帳款
    try {
      await supabase.from('acct_payables').insert({
        company_id: report.company_id,
        payable_number: `PAY-${report.id.substring(0, 8).toUpperCase()}`,
        vendor_name: report.staff_name,
        amount: report.net_amount,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7天後
        status: 'pending',
        labor_report_id: report.id,
        description: `勞報單簽署 - ${report.staff_name}`,
      });
    } catch (payableError) {
      console.error('Create payable error:', payableError);
      // 不影響簽署流程
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error signing report:', error);
    return NextResponse.json({ error: '簽署失敗' }, { status: 500 });
  }
}
