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
    const customerType = searchParams.get('customer_type');
    const search = searchParams.get('search');

    if (!companyId) {
      return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
    }

    let query = supabase
      .from('acct_customers')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (customerType) {
      if (customerType === 'customer') {
        query = query.in('customer_type', ['customer', 'both']);
      } else if (customerType === 'vendor') {
        query = query.in('customer_type', ['vendor', 'both']);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    let result = data || [];
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(c =>
        c.name?.toLowerCase().includes(searchLower) ||
        c.short_name?.toLowerCase().includes(searchLower) ||
        c.tax_id?.includes(search) ||
        c.contact_person?.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: '取得客戶失敗' }, { status: 500 });
  }
}

// POST - 新增客戶
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Creating customer:', body);

    const {
      company_id,
      name,
      short_name,
      tax_id,
      customer_type = 'customer',
      contact_person,
      phone,
      email,
      address,
      notes,
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
      bank_code,
      bank_name,
      bank_account,
    } = body;

    if (!company_id || !name) {
      return NextResponse.json({ error: '缺少必要欄位 (company_id, name)' }, { status: 400 });
    }

    const insertData: Record<string, any> = {
      company_id,
      name,
      customer_type,
      is_active: true,
    };

    // 可選欄位
    if (short_name) insertData.short_name = short_name;
    if (tax_id) insertData.tax_id = tax_id;
    if (contact_person) insertData.contact_person = contact_person;
    if (phone) insertData.phone = phone;
    if (email) insertData.email = email;
    if (address) insertData.address = address;
    if (notes) insertData.notes = notes;
    if (line_user_id) insertData.line_user_id = line_user_id;
    if (line_display_name) insertData.line_display_name = line_display_name;
    if (line_group_id) insertData.line_group_id = line_group_id;
    if (line_group_name) insertData.line_group_name = line_group_name;
    if (preferred_title) insertData.preferred_title = preferred_title;
    if (vendor_type) insertData.vendor_type = vendor_type;
    if (can_issue_invoice !== undefined) insertData.can_issue_invoice = can_issue_invoice;
    if (billing_contact_name) insertData.billing_contact_name = billing_contact_name;
    if (billing_email) insertData.billing_email = billing_email;
    if (line_notify_enabled !== undefined) insertData.line_notify_enabled = line_notify_enabled;
    if (payment_terms) insertData.payment_terms = payment_terms;
    if (credit_limit) insertData.credit_limit = credit_limit;
    if (bank_code) insertData.bank_code = bank_code;
    if (bank_name) insertData.bank_name = bank_name;
    if (bank_account) insertData.bank_account = bank_account;

    const { data, error } = await supabase
      .from('acct_customers')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json({ error: `新增失敗: ${error.message}` }, { status: 500 });
    }

    // 如果是廠商且為個人（外部個人或內部人員），同步到 freelancers
    if ((customer_type === 'vendor' || customer_type === 'both') && 
        (vendor_type === 'individual' || vendor_type === 'internal')) {
      try {
        const freelancerData: Record<string, any> = {
          company_id,
          name,
          phone,
          email,
          address,
          line_user_id,
          line_display_name,
          bank_code,
          bank_account,
          is_active: true,
          customer_id: data.id,
        };

        const { data: freelancer, error: freelancerError } = await supabase
          .from('acct_freelancers')
          .insert(freelancerData)
          .select()
          .single();

        if (freelancer && !freelancerError) {
          // 更新 customer 的 freelancer_id
          await supabase
            .from('acct_customers')
            .update({ freelancer_id: freelancer.id })
            .eq('id', data.id);
          
          console.log('Synced to freelancer:', freelancer.id);
        }
      } catch (syncError) {
        console.error('Error syncing to freelancer:', syncError);
      }
    }

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

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    const allowedFields = [
      'name', 'short_name', 'tax_id', 'customer_type', 'contact_person',
      'phone', 'email', 'address', 'notes', 'is_active',
      'line_user_id', 'line_display_name', 'line_group_id', 'line_group_name',
      'preferred_title', 'vendor_type', 'can_issue_invoice',
      'billing_contact_name', 'billing_email', 'line_notify_enabled',
      'payment_terms', 'credit_limit', 'bank_code', 'bank_name', 'bank_account',
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    const { data, error } = await supabase
      .from('acct_customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Database update error:', error);
      return NextResponse.json({ error: `更新失敗: ${error.message}` }, { status: 500 });
    }

    // 如果有關聯的 freelancer，同步更新
    if (data.freelancer_id) {
      const freelancerUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
      if (body.name) freelancerUpdate.name = body.name;
      if (body.phone) freelancerUpdate.phone = body.phone;
      if (body.email) freelancerUpdate.email = body.email;
      if (body.address) freelancerUpdate.address = body.address;
      if (body.line_user_id) freelancerUpdate.line_user_id = body.line_user_id;
      if (body.line_display_name) freelancerUpdate.line_display_name = body.line_display_name;
      if (body.bank_code) freelancerUpdate.bank_code = body.bank_code;
      if (body.bank_account) freelancerUpdate.bank_account = body.bank_account;

      await supabase
        .from('acct_freelancers')
        .update(freelancerUpdate)
        .eq('id', data.freelancer_id);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: '更新客戶失敗' }, { status: 500 });
  }
}

// DELETE - 刪除客戶
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('acct_customers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: '刪除客戶失敗' }, { status: 500 });
  }
}
