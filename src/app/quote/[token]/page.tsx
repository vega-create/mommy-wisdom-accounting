import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

export default async function QuoteViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: quotation } = await supabase
    .from('acct_quotations')
    .select('*, items:acct_quotation_items(*)')
    .eq('confirmation_token', token)
    .single();

  if (!quotation) return notFound();

  const isExpired = quotation.confirmation_token_expires_at && 
    new Date(quotation.confirmation_token_expires_at) < new Date();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#A31621] to-[#BF1730] text-white p-6">
            <h1 className="text-2xl font-bold">報價單</h1>
            <p className="text-red-200 mt-1">{quotation.quotation_number}</p>
          </div>

          {isExpired && (
            <div className="bg-red-50 border-b border-red-200 p-4 text-red-700 text-center">
              此報價單連結已過期
            </div>
          )}

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* 客戶資訊 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">客戶名稱</p>
                <p className="font-medium">{quotation.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">報價日期</p>
                <p className="font-medium">{quotation.quotation_date}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">有效期限</p>
                <p className="font-medium">{quotation.valid_until || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">聯絡人</p>
                <p className="font-medium">{quotation.contact_person || '-'}</p>
              </div>
            </div>

            {/* 主旨 */}
            <div>
              <p className="text-sm text-gray-500">主旨</p>
              <p className="font-medium text-lg">{quotation.title}</p>
            </div>

            {/* 明細 */}
            <div>
              <p className="text-sm text-gray-500 mb-2">報價明細</p>
              <table className="w-full border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 border-b">品項</th>
                    <th className="text-center p-3 border-b">數量</th>
                    <th className="text-right p-3 border-b">單價</th>
                    <th className="text-right p-3 border-b">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items?.map((item: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="p-3">{item.description}</td>
                      <td className="p-3 text-center">{item.quantity} {item.unit}</td>
                      <td className="p-3 text-right">${item.unit_price?.toLocaleString()}</td>
                      <td className="p-3 text-right">${item.amount?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 金額 */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">小計</span>
                <span>${quotation.subtotal?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">稅額 ({quotation.tax_rate || 5}%)</span>
                <span>${quotation.tax_amount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xl font-bold">
                <span>總計</span>
                <span className="text-[#A31621]">${quotation.total_amount?.toLocaleString()}</span>
              </div>
            </div>

            {/* 備註 */}
            {quotation.notes && (
              <div>
                <p className="text-sm text-gray-500">備註</p>
                <p className="whitespace-pre-wrap">{quotation.notes}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 p-6 text-center text-sm text-gray-500">
            如有任何問題，請與我們聯繫
          </div>
        </div>
      </div>
    </div>
  );
}
