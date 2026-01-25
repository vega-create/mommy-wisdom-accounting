export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 使用 service role 繞過 RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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
    console.log('Sign GET - token:', token);

    if (!token) {
      return NextResponse.json({ error: '無效的連結' }, { status: 400 });
    }

    // 查詢勞報單
    const { data: report, error } = await supabase
      .from('acct_labor_reports')
      .select('*')
      .eq('sign_token', token)
      .single();

    console.log('Sign GET - report:', report, 'error:', error);

    if (error || !report) {
      return NextResponse.json({ error: '找不到此勞報單，連結可能已失效' }, { status: 404 });
    }

    // 查詢公司名稱
    const { data: company } = await supabase
      .from('acct_companies')
      .select('name, logo_url')
      .eq('id', report.company_id)
      .single();

    return NextResponse.json({
      data: {
        id: report.id,
        report_number: report.report_number,
        company_name: company?.name || '公司',
        company_logo: company?.logo_url,
        staff_name: report.staff_name,
        id_number: report.id_number || '',
        income_type_code: report.income_type_code,
        income_type_name: INCOME_TYPE_NAMES[report.income_type_code] || report.income_type_code,
        work_description: report.work_description,
        service_period_start: report.service_period_start,
        service_period_end: report.service_period_end,
        gross_amount: report.gross_amount,
        withholding_tax: report.withholding_tax || 0,
        nhi_premium: report.nhi_premium || 0,
        net_amount: report.net_amount || report.gross_amount,
        status: report.status,
        bank_code: report.bank_code || '',
        bank_account: report.bank_account || '',
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
    console.log('Sign POST - token:', token, 'body keys:', Object.keys(body));

    const {
      id_number,
      bank_code,
      bank_account,
      signature_image,
    } = body;

    if (!signature_image) {
      return NextResponse.json({ error: '請提供簽名' }, { status: 400 });
    }

    // 查詢勞報單
    const { data: report, error: fetchError } = await supabase
      .from('acct_labor_reports')
      .select('id, status, company_id, staff_name, net_amount')
      .eq('sign_token', token)
      .single();

    console.log('Sign POST - found report:', report, 'error:', fetchError);

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
    const updateData: Record<string, any> = {
      signature_image,
      signed_at: new Date().toISOString(),
      signed_ip: signedIp,
      status: 'signed',
      updated_at: new Date().toISOString(),
    };

    if (id_number) updateData.id_number = id_number;
    if (bank_code) updateData.bank_code = bank_code;
    if (bank_account) updateData.bank_account = bank_account;

    console.log('Sign POST - updating with:', Object.keys(updateData));

    const { error: updateError } = await supabase
      .from('acct_labor_reports')
      .update(updateData)
      .eq('id', report.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: `更新失敗: ${updateError.message}` }, { status: 500 });
    }

    console.log('Sign POST - update successful');

    // 自動建立應付帳款
    try {
      const payableNumber = `PAY-${Date.now().toString(36).toUpperCase()}`;
      await supabase.from('acct_payables').insert({
        company_id: report.company_id,
        payable_number: payableNumber,
        vendor_type: 'individual',
        source_type: 'labor_report',
        source_id: report.id,
        labor_report_id: report.id,
        description: `勞報單 - ${report.staff_name}`,
        amount: report.net_amount,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
      });
      console.log('Sign POST - payable created');
    } catch (payableError) {
      console.error('Create payable error (non-critical):', payableError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error signing report:', error);
    return NextResponse.json({ error: '簽署失敗' }, { status: 500 });
  }
}
