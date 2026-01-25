export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - 取得客戶列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const type = searchParams.get('type'); // customer, vendor, both
    const activeOnly = searchParams.get('active_only') !== 'false';

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    let query = supabase
      .from('acct_customers')
      .select('*')
      .eq('company_id', companyId)
      .order('name');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (type && type !== 'all') {
      if (type === 'customer') {
        query = query.in('customer_type', ['customer', 'both']);
      } else if (type === 'vendor') {
        query = query.in('customer_type', ['vendor', 'both']);
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: '取得客戶失敗' }, { status: 500 });
  }
}

// POST - 新增客戶
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      company_id,
      name,
      short_name,
      tax_id,
      customer_type,
      contact_person,
      phone,
      email,
      address,
      notes,
      is_active,
      // Phase 2 擴充欄位
      line_user_id,
      line_display_name,
      line_group_id,
      line_group_name,
      preferred_title,
      vendor_type,
      can_issue_invoice,
      billing_contact_name,
      billing_email,
      line_notify_enabled,
      payment_terms,
      credit_limit,
    } = body;

    if (!company_id || !name) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('acct_customers')
      .insert({
        company_id,
        name,
        short_name: short_name || null,
        tax_id: tax_id || null,
        customer_type: customer_type || 'customer',
        contact_person: contact_person || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
        is_active: is_active ?? true,
        // Phase 2
        line_user_id: line_user_id || null,
        line_display_name: line_display_name || null,
        line_group_id: line_group_id || null,
        line_group_name: line_group_name || null,
        preferred_title: preferred_title || null,
        vendor_type: vendor_type || 'company',
        can_issue_invoice: can_issue_invoice ?? true,
        billing_contact_name: billing_contact_name || null,
        billing_email: billing_email || null,
        line_notify_enabled: line_notify_enabled ?? true,
        payment_terms: payment_terms || 30,
        credit_limit: credit_limit || 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: '新增客戶失敗' }, { status: 500 });
  }
}

// PUT - 更新客戶
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json();

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const {
      name,
      short_name,
      tax_id,
      customer_type,
      contact_person,
      phone,
      email,
      address,
      notes,
      is_active,
      // Phase 2
      line_user_id,
      line_display_name,
      line_group_id,
      line_group_name,
      preferred_title,
      vendor_type,
      can_issue_invoice,
      billing_contact_name,
      billing_email,
      line_notify_enabled,
      payment_terms,
      credit_limit,
    } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // 基本欄位
    if (name !== undefined) updateData.name = name;
    if (short_name !== undefined) updateData.short_name = short_name || null;
    if (tax_id !== undefined) updateData.tax_id = tax_id || null;
    if (customer_type !== undefined) updateData.customer_type = customer_type;
    if (contact_person !== undefined) updateData.contact_person = contact_person || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (email !== undefined) updateData.email = email || null;
    if (address !== undefined) updateData.address = address || null;
    if (notes !== undefined) updateData.notes = notes || null;
    if (is_active !== undefined) updateData.is_active = is_active;

    // Phase 2 擴充欄位
    if (line_user_id !== undefined) updateData.line_user_id = line_user_id || null;
    if (line_display_name !== undefined) updateData.line_display_name = line_display_name || null;
    if (line_group_id !== undefined) updateData.line_group_id = line_group_id || null;
    if (line_group_name !== undefined) updateData.line_group_name = line_group_name || null;
    if (preferred_title !== undefined) updateData.preferred_title = preferred_title || null;
    if (vendor_type !== undefined) updateData.vendor_type = vendor_type;
    if (can_issue_invoice !== undefined) updateData.can_issue_invoice = can_issue_invoice;
    if (billing_contact_name !== undefined) updateData.billing_contact_name = billing_contact_name || null;
    if (billing_email !== undefined) updateData.billing_email = billing_email || null;
    if (line_notify_enabled !== undefined) updateData.line_notify_enabled = line_notify_enabled;
    if (payment_terms !== undefined) updateData.payment_terms = payment_terms;
    if (credit_limit !== undefined) updateData.credit_limit = credit_limit;

    const { data, error } = await supabase
      .from('acct_customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: '更新客戶失敗' }, { status: 500 });
  }
}

// DELETE - 刪除客戶（軟刪除）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const hard = searchParams.get('hard') === 'true';

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    if (hard) {
      // 硬刪除
      const { error } = await supabase
        .from('acct_customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } else {
      // 軟刪除
      const { error } = await supabase
        .from('acct_customers')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: '刪除客戶失敗' }, { status: 500 });
  }
}
