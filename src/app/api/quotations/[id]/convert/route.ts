import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST - 報價單轉合約
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '未登入' }, { status: 401 });
  }

  // 呼叫轉換函數
  const { data, error } = await supabase
    .rpc('convert_quotation_to_contract', {
      p_quotation_id: id,
      p_user_id: user.id,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contract_id: data });
}
