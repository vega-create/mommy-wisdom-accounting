export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 透過 payment_account_id 查詢對應的 bank_account_id
async function resolveBankAccountId(supabase: any, companyId: string, paymentAccountId: string | null): Promise<string | null> {
  if (!paymentAccountId) return null;
  try {
    const { data: paymentAcct } = await supabase
      .from('acct_payment_accounts')
      .select('account_number')
      .eq('id', paymentAccountId)
      .single();

    if (paymentAcct) {
      const { data: bankAcct } = await supabase
        .from('acct_bank_accounts')
        .select('id')
        .eq('company_id', companyId)
        .eq('account_number', paymentAcct.account_number)
        .single();

      if (bankAcct) return bankAcct.id;
    }
  } catch (e) {
    console.error('查詢 bank_account_id 失敗:', e);
  }
  return null;
}

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

    if (report.status === 'paid') {
      return NextResponse.json({ error: '此勞報單已付款' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // 查詢對應的 bank_account_id
    const actualBankAccountId = await resolveBankAccountId(supabase, report.company_id, paid_account_id);

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
    
    const { data: voucher } = await supabase
      .from('acct_vouchers')
      .insert({
        company_id: report.company_id,
        voucher_number: voucherNumber,
        voucher_date: today,
        description: `勞報單付款 - ${report.report_number} - ${report.staff_name}`,
        total_amount: report.net_amount,
        status: 'posted',
        created_by: paid_by || null,
        source_type: 'labor_report',
        source_id: id,
      })
      .select()
      .single();

    // 3. 查詢預設費用科目
    const { data: expenseCat } = await supabase
      .from('acct_account_categories')
      .select('id')
      .eq('company_id', report.company_id)
      .eq('code', '5100')
      .single();

    // 4. 產生交易記錄（支出）
    const { data: transaction } = await supabase
      .from('acct_transactions')
      .insert({
        company_id: report.company_id,
        transaction_type: 'expense',
        transaction_date: today,
        amount: report.net_amount,
        description: `勞務費 - ${report.staff_name} - ${report.work_description || report.report_number}`,
        category_id: expenseCat?.id || null,
        bank_account_id: actualBankAccountId,
        payment_status: 'completed',
        created_by: paid_by || null,
      })
      .select()
      .single();

    // 5. 更新勞報單關聯交易記錄
    if (transaction) {
      await supabase
        .from('acct_labor_reports')
        .update({ transaction_id: transaction.id })
        .eq('id', id);
    }

    // 6. 同步更新應付帳款狀態（acct_payable_requests）
    if (report.payable_id) {
      await supabase
        .from('acct_payable_requests')
        .update({
          status: 'paid',
          paid_at: now,
          paid_amount: report.net_amount,
          transaction_id: transaction?.id || null,
          updated_at: now,
        })
        .eq('id', report.payable_id);
    } else {
      // 如果沒有 payable_id，用 labor_report_id 查找
      const { data: payable } = await supabase
        .from('acct_payable_requests')
        .select('id')
        .eq('labor_report_id', id)
        .single();

      if (payable) {
        await supabase
          .from('acct_payable_requests')
          .update({
            status: 'paid',
            paid_at: now,
            paid_amount: report.net_amount,
            transaction_id: transaction?.id || null,
            updated_at: now,
          })
          .eq('id', payable.id);

        // 回寫 payable_id
        await supabase
          .from('acct_labor_reports')
          .update({ payable_id: payable.id })
          .eq('id', id);
      }
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
