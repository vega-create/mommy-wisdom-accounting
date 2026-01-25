export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - 透過 token 取得勞報單資料（公開，無需登入）
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    const { data, error } = await supabase
      .from('acct_labor_reports')
      .select(`
        id,
        report_number,
        company_id,
        staff_name,
        id_number,
        is_union_member,
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
        company:acct_companies(id, name, logo_url)
      `)
      .eq('sign_token', token)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: '勞報單不存在或連結已失效' }, { status: 404 });
    }

    // 加入所得類型名稱
    const incomeTypeNames: Record<string, string> = {
      '50': '執行業務所得',
      '9A': '稿費所得',
      '9B': '講演鐘點費',
      '92': '競技競賽獎金',
    };

    const responseData = {
      ...data,
      income_type_name: incomeTypeNames[data.income_type_code] || data.income_type_code,
      company_name: data.company?.name,
      company_logo: data.company?.logo_url,
    };

    // 移除不需要公開的欄位
    delete (responseData as any).company;

    return NextResponse.json({ data: responseData });
  } catch (error) {
    console.error('Error fetching sign data:', error);
    return NextResponse.json({ error: '取得資料失敗' }, { status: 500 });
  }
}

// POST - 提交簽署
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const body = await request.json();
    const {
      id_number,
      bank_code,
      bank_account,
      signature_image,
    } = body;

    if (!signature_image) {
      return NextResponse.json({ error: '請提供簽名' }, { status: 400 });
    }

    // 取得勞報單
    const { data: report, error: fetchError } = await supabase
      .from('acct_labor_reports')
      .select('id, status, company_id, staff_name, net_amount, freelancer_id')
      .eq('sign_token', token)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: '勞報單不存在或連結已失效' }, { status: 404 });
    }

    if (report.status !== 'pending') {
      return NextResponse.json({ 
        error: report.status === 'signed' ? '此勞報單已簽署' : '此勞報單狀態無法簽署' 
      }, { status: 400 });
    }

    // 取得簽署者 IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    const signedIp = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';

    const now = new Date().toISOString();

    // 更新勞報單
    const { error: updateError } = await supabase
      .from('acct_labor_reports')
      .update({
        status: 'signed',
        id_number: id_number || undefined,
        bank_code: bank_code || undefined,
        bank_account: bank_account || undefined,
        signature_image,
        signed_at: now,
        signed_ip: signedIp,
        sign_complete_notified_at: now,
      })
      .eq('id', report.id);

    if (updateError) throw updateError;

    // 自動建立應付帳款
    const payableNumber = `PAY-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    
    const { data: payable } = await supabase
      .from('acct_payables')
      .insert({
        company_id: report.company_id,
        payable_number: payableNumber,
        vendor_id: report.freelancer_id,
        vendor_name: report.staff_name,
        amount: report.net_amount,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7天後
        status: 'pending',
        description: `勞報單 - ${report.staff_name}`,
        source_type: 'labor_report',
        source_id: report.id,
      })
      .select()
      .single();

    // 更新勞報單關聯應付帳款
    if (payable) {
      await supabase
        .from('acct_labor_reports')
        .update({ payable_id: payable.id })
        .eq('id', report.id);
    }

    // TODO: 發送 LINE 通知給建立者
    // const { data: creator } = await supabase
    //   .from('acct_users')
    //   .select('line_user_id')
    //   .eq('id', report.created_by)
    //   .single();
    // if (creator?.line_user_id) {
    //   await sendLineNotification(creator.line_user_id, '勞報單已簽署完成...');
    // }

    return NextResponse.json({ 
      success: true,
      message: '簽署完成',
    });
  } catch (error) {
    console.error('Error submitting signature:', error);
    return NextResponse.json({ error: '簽署失敗' }, { status: 500 });
  }
}
