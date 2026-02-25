export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('company_id') as string;

    if (!file || !companyId) {
      return NextResponse.json({ error: '缺少檔案或 company_id' }, { status: 400 });
    }

    // 檢查檔案類型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: '不支援的檔案類型，僅支援圖片和 PDF' }, { status: 400 });
    }

    // 檢查檔案大小 (LINE 限制圖片 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '檔案大小不能超過 10MB' }, { status: 400 });
    }

    // 產生唯一檔名
    const ext = file.name.split('.').pop();
    const timestamp = Date.now();
    const fileName = companyId + '/' + timestamp + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;

    // 上傳到 Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from('line-files')
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600'
      });

    if (error) {
      console.error('Upload error:', error);
      return NextResponse.json({ error: '上傳失敗: ' + error.message }, { status: 500 });
    }

    // 取得公開 URL
    const { data: urlData } = supabase.storage
      .from('line-files')
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      data: {
        url: urlData.publicUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        storagePath: fileName
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: '上傳失敗' }, { status: 500 });
  }
}
