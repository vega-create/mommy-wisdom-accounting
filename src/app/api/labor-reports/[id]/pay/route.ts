export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';


// POST - 確認付款
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { id } = params;
    const body = await request.json();
    const { 
      paid_account_id,
      payment_reference,
      paid_by,
    } = body;

    // 取得勞報單資料
    const { data: report, error: fetchError } = await supabase
      .from('acct_labor_reports')
      .select('*, company:acct_companies(id, name)')
      .eq('id', id)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: '勞報單不存在' }, { status: 404 });
    }

    if (report.status !== 'signed') {
      return NextResponse.json({ error: '只有已簽名的勞報單可以確認付款' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 1. 更新勞報單狀態
    const { error: updateError } = await supabase
      .from('acct_labor_reports')
      .update({
        status: 'paid',
        paid_at: now,
        paid_account_id: paid_account_id || null,
        payment_reference: payment_reference || null,
        payment_notified_at: now,
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // 2. 產生會計傳票
    const voucherNumber = `V-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    
    const { data: voucher, error: voucherError } = await supabase
      .from('acct_vouchers')
      .insert({
        company_id: report.company_id,
        voucher_number: voucherNumber,
        voucher_date: now.split('T')[0],
        description: `勞報單付款 - ${report.report_number} - ${report.staff_name}`,
        total_amount: report.net_amount,
        status: 'posted',
        created_by: paid_by || null,
        source_type: 'labor_report',
        source_id: id,
      })
      .select()
      .single();

    // 3. 產生交易記錄
    const { data: transaction, error: transError } = await supabase
      .from('acct_transactions')
      .insert({
        company_id: report.company_id,
        transaction_type: 'expense',
        transaction_date: now.split('T')[0],
        amount: report.net_amount,
        description: `勞務費 - ${report.staff_name} - ${report.work_description || report.report_number}`,
        category_id: null,
        bank_account_id: paid_account_id || null,
        payment_status: 'completed',
        created_by: paid_by || null,
      })
      .select()
      .single();

    // 4. 更新勞報單關聯交易記錄
    if (transaction) {
      await supabase
        .from('acct_labor_reports')
        .update({ transaction_id: transaction.id })
        .eq('id', id);
    }

    // 5. 如果有關聯應付帳款，也更新狀態
    if (report.payable_id) {
      await supabase
        .from('acct_payables')
        .update({
          status: 'paid',
          paid_at: now,
          paid_amount: report.net_amount,
        })
        .eq('id', report.payable_id);
    }

    return NextResponse.json({ 
      success: true,
      message: '付款確認成功，會計傳票已自動產生',
      voucher_number: voucher?.voucher_number,
      transaction_id: transaction?.id,
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    return NextResponse.json({ error: '確認付款失敗' }, { status: 500 });
  }
}
