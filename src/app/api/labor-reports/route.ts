export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

// GET - 取得勞報單列表
export async function GET(request: NextRequest) {
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
      .select(`
        *,
        freelancer:acct_freelancers(id, name, is_union_member),
        billing_request:acct_billing_requests(id, billing_number, customer_id)
      `)
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

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching labor reports:', error);
    return NextResponse.json({ error: '取得勞報單失敗' }, { status: 500 });
  }
}

// POST - 新增勞報單
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    // 產生單號
    const reportNumber = await generateReportNumber(company_id);

    // 計算稅務
    const { withholdingTax, nhiPremium, netAmount } = calculateTax(
      gross_amount,
      income_type_code,
      is_union_member
    );

    // 產生簽署 token
    const signToken = uuidv4();
    const signUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://mommy-wisdom-accounting.vercel.app'}/sign/${signToken}`;

    // 決定初始狀態
    const status = send_sign_request ? 'pending' : 'draft';

    const { data, error } = await supabase
      .from('acct_labor_reports')
      .insert({
        company_id,
        report_number: reportNumber,
        freelancer_id: freelancer_id || null,
        staff_type,
        staff_id: staff_id || null,
        staff_name,
        id_number: id_number || null,
        is_union_member,
        income_type_code,
        work_description: work_description || null,
        service_period_start: service_period_start || null,
        service_period_end: service_period_end || null,
        gross_amount,
        withholding_tax: withholdingTax,
        nhi_premium: nhiPremium,
        net_amount: netAmount,
        status,
        sign_token: signToken,
        sign_url: signUrl,
        billing_request_id: billing_request_id || null,
        bank_code: bank_code || null,
        bank_account: bank_account || null,
        created_by: created_by || null,
      })
      .select()
      .single();

    if (error) throw error;

    // 如果要發送簽署請求，記錄發送時間
    if (send_sign_request && data) {
      await supabase
        .from('acct_labor_reports')
        .update({ sign_request_sent_at: new Date().toISOString() })
        .eq('id', data.id);
    }

    return NextResponse.json({ 
      success: true, 
      data,
      sign_url: signUrl,
    });
  } catch (error) {
    console.error('Error creating labor report:', error);
    return NextResponse.json({ error: '新增勞報單失敗' }, { status: 500 });
  }
}
