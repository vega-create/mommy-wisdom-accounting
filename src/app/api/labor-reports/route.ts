import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - 取得勞報單列表（從原有勞報單系統讀取）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const status = searchParams.get('status');

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    // 透過統編或公司名稱找到對應的原勞報單系統公司 ID
    const { data: acctCompany } = await supabase
      .from('acct_companies')
      .select('tax_id, name, short_name')
      .eq('id', companyId)
      .single();

    if (!acctCompany) {
      return NextResponse.json({ data: [] });
    }

    // 從 companies 表找到對應的公司
    let laborCompanyId = null;
    
    if (acctCompany.tax_id) {
      const { data: laborCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('tax_id', acctCompany.tax_id)
        .single();
      laborCompanyId = laborCompany?.id;
    }

    // 如果透過統編找不到，嘗試用公司名稱
    if (!laborCompanyId) {
      const { data: laborCompany } = await supabase
        .from('companies')
        .select('id')
        .or(`name.ilike.%${acctCompany.short_name || acctCompany.name}%`)
        .limit(1)
        .single();
      laborCompanyId = laborCompany?.id;
    }

    if (!laborCompanyId) {
      return NextResponse.json({ data: [] });
    }

    // 從原勞報單系統讀取資料
    let query = supabase
      .from('labor_reports')
      .select(`
        id,
        report_number,
        payee_name,
        payee_id_number,
        payee_bank_name,
        payee_bank_account,
        description,
        period_start,
        period_end,
        payment_date,
        gross_amount,
        income_tax,
        health_insurance,
        net_amount,
        income_type,
        status,
        sign_token,
        signature_data,
        signed_at,
        paid_at,
        paid_amount,
        acct_payable_id,
        created_at,
        updated_at,
        contact:labor_contacts(
          id,
          name,
          is_union_member
        )
      `)
      .eq('company_id', laborCompanyId)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Labor reports GET error:', error);
      return NextResponse.json({ error: `取得勞報單失敗: ${error.message}` }, { status: 500 });
    }

    // 轉換欄位名稱以符合會計系統前端
    const transformedData = (data || []).map(report => ({
      id: report.id,
      report_number: report.report_number,
      staff_id: report.contact?.id,
      staff_name: report.payee_name,
      staff_type: 'external',  // 勞報單都是外部
      id_number: report.payee_id_number,
      service_date: report.payment_date,
      service_description: report.description,
      gross_amount: report.gross_amount,
      tax_amount: report.income_tax,
      health_insurance: report.health_insurance,
      net_amount: report.net_amount,
      income_type: report.income_type,
      status: report.status,
      signature_url: report.sign_token ? `/sign/${report.sign_token}` : null,
      signed_at: report.signed_at,
      paid_at: report.paid_at,
      paid_amount: report.paid_amount,
      payable_id: report.acct_payable_id,
      is_union_member: report.contact?.is_union_member,
      created_at: report.created_at
    }));

    return NextResponse.json({ data: transformedData });
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
      staff_id,
      staff_name,
      staff_type,
      id_number,
      service_date,
      service_description,
      gross_amount,
      tax_amount,
      health_insurance,
      net_amount,
      billing_request_id
    } = body;

    if (!company_id || !staff_name || !gross_amount || !service_description) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    const report_number = await generateReportNumber(company_id);

    const { data, error } = await supabase
      .from('acct_labor_reports')
      .insert({
        company_id,
        report_number,
        staff_id,
        staff_name,
        staff_type: staff_type || 'external',
        id_number,
        service_date,
        service_description,
        gross_amount,
        tax_amount: tax_amount || 0,
        health_insurance: health_insurance || 0,
        net_amount,
        billing_request_id,
        status: 'draft'
      })
      .select()
      .single();

    if (error) {
      console.error('Labor report insert error:', error);
      return NextResponse.json({ error: `新增勞報單失敗: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating labor report:', error);
    return NextResponse.json({ error: '新增勞報單失敗' }, { status: 500 });
  }
}

// PUT - 更新勞報單
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('acct_labor_reports')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Labor report update error:', error);
      return NextResponse.json({ error: `更新勞報單失敗: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating labor report:', error);
    return NextResponse.json({ error: '更新勞報單失敗' }, { status: 500 });
  }
}

// DELETE - 刪除勞報單
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('acct_labor_reports')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Labor report delete error:', error);
      return NextResponse.json({ error: `刪除勞報單失敗: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting labor report:', error);
    return NextResponse.json({ error: '刪除勞報單失敗' }, { status: 500 });
  }
}
