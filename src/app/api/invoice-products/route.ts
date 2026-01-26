import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const company_id = searchParams.get('company_id');

        if (!company_id) {
            return NextResponse.json({ error: '缺少 company_id' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('acct_invoice_products')
            .select('*')
            .eq('company_id', company_id)
            .eq('is_active', true)
            .order('use_count', { ascending: false })
            .order('sort_order', { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { company_id, name, unit, default_price } = body;

        if (!company_id || !name) {
            return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
        }

        const { data: existing } = await supabase
            .from('acct_invoice_products')
            .select('id, use_count')
            .eq('company_id', company_id)
            .eq('name', name)
            .single();

        if (existing) {
            const { data, error } = await supabase
                .from('acct_invoice_products')
                .update({
                    use_count: (existing.use_count || 0) + 1,
                    last_used_at: new Date().toISOString(),
                    ...(default_price && { default_price }),
                })
                .eq('id', existing.id)
                .select()
                .single();

            return NextResponse.json({ success: true, data, existed: true });
        }

        const { data, error } = await supabase
            .from('acct_invoice_products')
            .insert({
                company_id,
                name: name.trim(),
                unit: unit || '式',
                default_price: default_price || null,
                use_count: 1,
                last_used_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: '缺少 id' }, { status: 400 });
        }

        const { data: current } = await supabase
            .from('acct_invoice_products')
            .select('use_count')
            .eq('id', id)
            .single();

        const { data, error } = await supabase
            .from('acct_invoice_products')
            .update({
                use_count: (current?.use_count || 0) + 1,
                last_used_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
    }
}