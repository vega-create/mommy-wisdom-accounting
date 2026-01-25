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
    const customerType = searchParams.get('customer_type'); // customer, vendor, both
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

    // 搜尋過濾
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
      // Phase 2 擴充
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
      // 外包人員連動
      is_vendor,
      sync_to_freelancer,
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
    
    // Phase 2 擴充
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
    if (is_vendor !== undefined) insertData.is_vendor = is_vendor;

    const { data, error } = await supabase
      .from('acct_customers')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json({ error: `新增失敗: ${error.message}` }, { status: 500 });
    }

    // 如果是廠商（個人），同步建立外包人員
    if (sync_to_freelancer && (customer_type === 'vendor' || customer_type === 'both') && vendor_type === 'individual') {
      try {
        await supabase.from('acct_freelancers').insert({
          company_id,
          name,
          phone,
          email,
          address,
          line_user_id,
          line_display_name,
          is_active: true,
          // 關聯到客戶
          customer_id: data.id,
        });
      } catch (freelancerError) {
        console.error('Error syncing to freelancer:', freelancerError);
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

    console.log('Updating customer:', id, body);

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // 允許更新的欄位
    const allowedFields = [
      'name', 'short_name', 'tax_id', 'customer_type', 'contact_person',
      'phone', 'email', 'address', 'notes', 'is_active',
      'line_user_id', 'line_display_name', 'line_group_id', 'line_group_name',
      'preferred_title', 'vendor_type', 'can_issue_invoice',
      'billing_contact_name', 'billing_email', 'line_notify_enabled',
      'payment_terms', 'credit_limit', 'is_vendor',
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
      const { error } = await supabase
        .from('acct_customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } else {
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
