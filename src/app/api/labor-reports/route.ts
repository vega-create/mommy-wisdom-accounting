export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';


// 2025 稅務計算常數
const NHI_RATE = 0.0211; // 二代健保費率
const NHI_THRESHOLD = 20010; // 起扣點

// 所得類型稅率
const INCOME_TAX_RATES: Record<string, number> = {
  '50': 0.10,  // 執行業務所得
  '9A': 0.10,  // 稿費所得
  '9B': 0.10,  // 講演鐘點費
  '92': 0.10,  // 競技競賽獎金
};

// 計算稅務
function calculateTax(grossAmount: number, incomeTypeCode: string, isUnionMember: boolean) {
  let withholdingTax = 0;
  let nhiPremium = 0;

  // 扣繳稅額（9A, 9B 全年 18 萬內免稅，這裡簡化處理）
  const taxRate = INCOME_TAX_RATES[incomeTypeCode] || 0.10;
  if (!['9A', '9B'].includes(incomeTypeCode)) {
    withholdingTax = Math.round(grossAmount * taxRate);
  }

  // 二代健保（工會成員免扣）
  if (!isUnionMember && grossAmount >= NHI_THRESHOLD) {
    nhiPremium = Math.round(grossAmount * NHI_RATE);
  }

  const netAmount = grossAmount - withholdingTax - nhiPremium;

  return { withholdingTax, nhiPremium, netAmount };
}

// 產生勞報單號
async function generateReportNumber(companyId: string): Promise<string> {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const prefix = `LR-${year}-`;

  const { data } = await supabase
    .from('acct_labor_reports')
    .select('report_number')
    .eq('company_id', companyId)
    .like('report_number', `${prefix}%`)
    .order('report_number', { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (data && data.length > 0) {
    const lastNumber = parseInt(data[0].report_number.replace(prefix, ''), 10);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

// 產生簽署 token（使用 crypto 而非 uuid）
function generateSignToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// GET - 取得勞報單列表
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const status = searchParams.get('status');
    const staffType = searchParams.get('staff_type');
    const freelancerId = searchParams.get('freelancer_id');
    const billingRequestId = searchParams.get('billing_request_id');

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    let query = supabase
      .from('acct_labor_reports')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (staffType && staffType !== 'all') {
      query = query.eq('staff_type', staffType);
    }

    if (freelancerId) {
      query = query.eq('freelancer_id', freelancerId);
    }

    if (billingRequestId) {
      query = query.eq('billing_request_id', billingRequestId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching labor reports:', error);
    return NextResponse.json({ error: '取得勞報單失敗' }, { status: 500 });
  }
}

// POST - 新增勞報單
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  try {
    const body = await request.json();
    console.log('Received body:', body);

    const {
      company_id,
      freelancer_id,
      staff_type = 'external',
      staff_id,
      staff_name,
      id_number,
      is_union_member = false,
      income_type_code = '50',
      work_description,
      service_period_start,
      service_period_end,
      gross_amount,
      billing_request_id,
      bank_code,
      bank_account,
      created_by,
      send_sign_request = false,
    } = body;

    if (!company_id || !staff_name || !gross_amount) {
      return NextResponse.json({ error: '缺少必要欄位: company_id, staff_name, gross_amount' }, { status: 400 });
    }

    // 產生單號
    const reportNumber = await generateReportNumber(company_id);
    console.log('Generated report number:', reportNumber);

    // 計算稅務
    const { withholdingTax, nhiPremium, netAmount } = calculateTax(
      gross_amount,
      income_type_code,
      is_union_member
    );
    console.log('Tax calculation:', { withholdingTax, nhiPremium, netAmount });

    // 產生簽署 token
    const signToken = generateSignToken();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mommy-wisdom-accounting.vercel.app';
    const signUrl = `${baseUrl}/sign/${signToken}`;

    // 決定初始狀態
    const status = send_sign_request ? 'pending' : 'draft';

    // 準備插入資料
    const insertData: Record<string, any> = {
      company_id,
      report_number: reportNumber,
      staff_type,
      staff_name,
      income_type_code,
      gross_amount,
      withholding_tax: withholdingTax,
      nhi_premium: nhiPremium,
      net_amount: netAmount,
      total_income: gross_amount,
      status,
      sign_token: signToken,
      sign_url: signUrl,
    };

    // 可選欄位
    if (freelancer_id) insertData.freelancer_id = freelancer_id;
    if (staff_id) insertData.staff_id = staff_id;
    if (id_number) insertData.id_number = id_number;
    if (work_description) insertData.work_description = work_description;
    if (service_period_start) insertData.service_period_start = service_period_start;
    if (service_period_end) insertData.service_period_end = service_period_end;
    if (billing_request_id) insertData.billing_request_id = billing_request_id;
    if (bank_code) insertData.bank_code = bank_code;
    if (bank_account) insertData.bank_account = bank_account;
    if (created_by) insertData.created_by = created_by;
    insertData.is_union_member = is_union_member;

    console.log('Insert data:', insertData);

    const { data, error } = await supabase
      .from('acct_labor_reports')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json({ error: `資料庫錯誤: ${error.message}` }, { status: 500 });
    }

    // 如果要發送簽署請求，記錄發送時間
    if (send_sign_request && data) {
      await supabase
        .from('acct_labor_reports')
        .update({ sign_request_sent_at: new Date().toISOString() })
        .eq('id', data.id);
    }

    // 自動建立應付帳款
    if (data) {
      try {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const payableNumber = `PAY${year}${month}${Date.now().toString().slice(-4)}`;

        await supabase
          .from('acct_payable_requests')
          .insert({
            company_id,
            payable_number: payableNumber,
            vendor_id: null,
            vendor_name: staff_name,
            vendor_type: 'individual',
            title: `勞務費 - ${staff_name}`,
            description: `勞報單 ${reportNumber}${work_description ? ' - ' + work_description : ''}`,
            amount: netAmount,
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'pending',
            labor_report_id: data.id,
            created_by: created_by || null,
          });

        // 更新勞報單的 payable_id
        const { data: payable } = await supabase
          .from('acct_payable_requests')
          .select('id')
          .eq('labor_report_id', data.id)
          .single();

        if (payable) {
          await supabase
            .from('acct_labor_reports')
            .update({ payable_id: payable.id })
            .eq('id', data.id);
        }
      } catch (e) {
        console.error('自動建立應付帳款失敗:', e);
      }
    }

    return NextResponse.json({
      success: true,
      data,
      sign_url: signUrl,
    });
  } catch (error) {
    console.error('Error creating labor report:', error);
    return NextResponse.json({
      error: `新增勞報單失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
    }, { status: 500 });
  }
}
