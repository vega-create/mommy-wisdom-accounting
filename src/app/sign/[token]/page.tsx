'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

const incomeTypeNames: Record<string, string> = {
  '50': '執行業務所得',
  '9A': '稿費/講演鐘點費',
  '9B': '稿費/講演鐘點費',
};

const formatAmount = (n: number) => new Intl.NumberFormat('zh-TW').format(n || 0);

export default function SignPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<any>(null);
  const [docType, setDocType] = useState<'contract' | 'labor' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);

  // 個人資料表單
  const [form, setForm] = useState({
    signer_name: '',
    id_number: '',
    home_address: '',
    birthday: '',
    phone: '',
    bank_code: '',
    bank_name: '',
    bank_account: '',
    bank_branch: '',
    bank_account_name: '',
  });

  // 圖片上傳
  const [idCardFront, setIdCardFront] = useState<string>('');
  const [idCardBack, setIdCardBack] = useState<string>('');
  const [passbookImage, setPassbookImage] = useState<string>('');

  // 是否已有完整資料
  const [isComplete, setIsComplete] = useState(false);

  // 簽名
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // 合約用
  const [stampFile, setStampFile] = useState<string>('');

  useEffect(() => { fetchData(); }, [token]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/sign/${token}`);
      const result = await res.json();
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
        setDocType(result.type || 'contract');
        if (result.status === 'signed') setSigned(true);

        // 帶入 freelancer 資料
        if (result.type === 'labor') {
          const f = result.freelancer;
          setForm(prev => ({
            ...prev,
            signer_name: result.staff_name || '',
            id_number: f?.id_number || result.id_number || '',
            home_address: f?.home_address || '',
            birthday: f?.birthday || '',
            phone: f?.phone || '',
            bank_code: f?.bank_code || result.bank_code || '',
            bank_name: f?.bank_name || '',
            bank_account: f?.bank_account || result.bank_account || '',
            bank_branch: f?.bank_branch || '',
            bank_account_name: f?.bank_account_name || result.staff_name || '',
          }));
          if (f?.id_card_front) setIdCardFront(f.id_card_front);
          if (f?.id_card_back) setIdCardBack(f.id_card_back);
          if (f?.passbook_image) setPassbookImage(f.passbook_image);
          if (f?.is_complete) setIsComplete(true);
        }
      }
    } catch (e) {
      setError('無法載入資料');
    }
    setLoading(false);
  };

  // Canvas 簽名
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // 設定實際解析度
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  useEffect(() => {
    if (data && !signed) {
      setTimeout(initCanvas, 100);
    }
  }, [data, signed]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    return { x, y };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) setSignatureDataUrl(canvas.toDataURL());
  };

  const clearSignature = () => { initCanvas(); setSignatureDataUrl(''); };

  // 圖片上傳處理
  const handleImageUpload = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('檔案不可超過 5MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setter(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setStampFile(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // 送出
  const handleSubmit = async () => {
    if (docType === 'labor') {
      if (!form.signer_name.trim()) { alert('請輸入姓名'); return; }
      if (!form.id_number.trim()) { alert('請輸入身分證字號'); return; }
      if (!signatureDataUrl) { alert('請簽名'); return; }
      if (!isComplete) {
        if (!idCardFront) { alert('請上傳身分證正面'); return; }
        if (!idCardBack) { alert('請上傳身分證反面'); return; }
        if (!form.bank_code.trim() || !form.bank_account.trim()) { alert('請填寫銀行資料'); return; }
      }
    } else {
      if (!form.signer_name.trim()) { alert('請輸入簽署人姓名'); return; }
      if (!signatureDataUrl) { alert('請簽名'); return; }
    }

    setSigning(true);
    try {
      const payload: any = {
        type: docType,
        signature: signatureDataUrl,
        signer_name: form.signer_name,
      };

      if (docType === 'labor') {
        payload.id_number = form.id_number;
        payload.home_address = form.home_address;
        payload.birthday = form.birthday;
        payload.phone = form.phone;
        payload.bank_code = form.bank_code;
        payload.bank_name = form.bank_name;
        payload.bank_account = form.bank_account;
        payload.bank_branch = form.bank_branch;
        payload.bank_account_name = form.bank_account_name;
        if (idCardFront && !isComplete) payload.id_card_front = idCardFront;
        if (idCardBack && !isComplete) payload.id_card_back = idCardBack;
        if (passbookImage && !isComplete) payload.passbook_image = passbookImage;
      } else {
        payload.company_stamp = stampFile;
      }

      const res = await fetch(`/api/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) setSigned(true);
      else alert(result.error || '簽署失敗');
    } catch {
      alert('簽署失敗，請稍後再試');
    }
    setSigning(false);
  };

  // ===== Loading / Error =====
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-200 border-t-red-700 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">載入中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-red-700 font-medium text-lg">{error}</p>
          <p className="text-gray-500 text-sm mt-2">請確認連結是否正確，或聯繫發送方</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ===== 勞報單簽署 =====
  if (docType === 'labor') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#A31621] to-[#BF1730] text-white">
          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold">勞務報酬確認單</h1>
                <p className="text-red-200 text-sm">{data.company?.name}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-red-200 mt-4">
              <span>單號：{data.report_number}</span>
              <span>
                {data.service_period_start} ~ {data.service_period_end}
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* 已簽署 */}
          {signed ? (
            <div className="bg-white rounded-2xl shadow-sm border border-green-200 p-8 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-green-700 mb-2">簽署完成</h2>
              <p className="text-gray-500">感謝您的確認，款項將於作業完成後匯入您的帳戶</p>
              {data.signed_at && (
                <p className="text-sm text-gray-400 mt-4">
                  簽署時間：{new Date(data.signed_at).toLocaleString('zh-TW')}
                </p>
              )}
            </div>
          ) : (
            <>
              {/* 金額摘要卡片 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-[#A31621] to-[#BF1730] px-6 py-4">
                  <h2 className="text-white font-semibold">金額明細</h2>
                </div>
                <div className="p-6 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">應稅所得</span>
                    <span className="text-lg font-bold">${formatAmount(data.gross_amount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">扣繳稅額 (10%)</span>
                    <span className="text-red-600">-${formatAmount(data.withholding_tax)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">
                      二代健保 (2.11%)
                      {data.is_union_member && <span className="text-green-600 ml-1">免扣</span>}
                    </span>
                    <span className="text-orange-600">
                      {data.is_union_member ? '免扣' : `-$${formatAmount(data.nhi_premium)}`}
                    </span>
                  </div>
                  <div className="border-t-2 border-[#A31621]/20 pt-3 flex justify-between items-center">
                    <span className="font-semibold text-gray-900">實付金額</span>
                    <span className="text-2xl font-bold text-[#A31621]">${formatAmount(data.net_amount)}</span>
                  </div>
                </div>
              </div>

              {/* 服務內容 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-[#A31621] rounded-full" />
                  服務內容
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 block">所得類別</span>
                    <span className="font-medium">{data.income_type_code} - {incomeTypeNames[data.income_type_code] || '其他'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">服務期間</span>
                    <span className="font-medium">{data.service_period_start} ~ {data.service_period_end}</span>
                  </div>
                </div>
                {data.work_description && (
                  <div className="mt-4 bg-gray-50 p-3 rounded-lg text-sm text-gray-700">
                    {data.work_description}
                  </div>
                )}
              </div>

              {/* 個人資料 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-[#A31621] rounded-full" />
                  個人資料
                </h3>
                {isComplete && (
                  <p className="text-xs text-green-600 mb-4">✓ 已有資料，如需修改可直接更新</p>
                )}
                {!isComplete && (
                  <p className="text-xs text-gray-500 mb-4">首次簽署請填寫以下資料，下次將自動帶入</p>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
                      <input
                        type="text" value={form.signer_name}
                        onChange={e => setForm({ ...form, signer_name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#A31621]/20 focus:border-[#A31621] outline-none"
                        placeholder="請輸入姓名"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">身分證字號 *</label>
                      <input
                        type="text" value={form.id_number}
                        onChange={e => setForm({ ...form, id_number: e.target.value.toUpperCase() })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#A31621]/20 focus:border-[#A31621] outline-none"
                        placeholder="A123456789" maxLength={10}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">出生日期</label>
                      <input
                        type="date" value={form.birthday}
                        onChange={e => setForm({ ...form, birthday: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#A31621]/20 focus:border-[#A31621] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">電話</label>
                      <input
                        type="tel" value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#A31621]/20 focus:border-[#A31621] outline-none"
                        placeholder="0912-345-678"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">戶籍地址</label>
                    <input
                      type="text" value={form.home_address}
                      onChange={e => setForm({ ...form, home_address: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#A31621]/20 focus:border-[#A31621] outline-none"
                      placeholder="戶籍地址（扣繳憑單用）"
                    />
                  </div>
                </div>
              </div>

              {/* 證件上傳 */}
              {!isComplete && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-[#A31621] rounded-full" />
                    證件上傳
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">請上傳清晰的證件照片，僅供報稅使用</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 身分證正面 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">身分證正面 *</label>
                      <label className="block border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-[#A31621]/40 hover:bg-red-50/30 transition-colors">
                        {idCardFront ? (
                          <img src={idCardFront} alt="身分證正面" className="max-h-28 mx-auto rounded" />
                        ) : (
                          <div className="py-4">
                            <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-sm text-gray-500">點擊上傳</p>
                          </div>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload(setIdCardFront)} />
                      </label>
                    </div>

                    {/* 身分證反面 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">身分證反面 *</label>
                      <label className="block border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-[#A31621]/40 hover:bg-red-50/30 transition-colors">
                        {idCardBack ? (
                          <img src={idCardBack} alt="身分證反面" className="max-h-28 mx-auto rounded" />
                        ) : (
                          <div className="py-4">
                            <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-sm text-gray-500">點擊上傳</p>
                          </div>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload(setIdCardBack)} />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* 銀行資料 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-[#A31621] rounded-full" />
                  匯款帳戶
                </h3>
                <p className="text-xs text-gray-500 mb-4">請確認匯款資訊正確，款項將匯入此帳戶</p>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">銀行代碼 *</label>
                      <input
                        type="text" value={form.bank_code}
                        onChange={e => setForm({ ...form, bank_code: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#A31621]/20 focus:border-[#A31621] outline-none"
                        placeholder="例：004"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">銀行名稱</label>
                      <input
                        type="text" value={form.bank_name}
                        onChange={e => setForm({ ...form, bank_name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#A31621]/20 focus:border-[#A31621] outline-none"
                        placeholder="例：台灣銀行"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">分行名稱</label>
                      <input
                        type="text" value={form.bank_branch}
                        onChange={e => setForm({ ...form, bank_branch: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#A31621]/20 focus:border-[#A31621] outline-none"
                        placeholder="例：忠孝分行"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">帳號 *</label>
                      <input
                        type="text" value={form.bank_account}
                        onChange={e => setForm({ ...form, bank_account: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-[#A31621]/20 focus:border-[#A31621] outline-none"
                        placeholder="帳號"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">戶名</label>
                    <input
                      type="text" value={form.bank_account_name}
                      onChange={e => setForm({ ...form, bank_account_name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#A31621]/20 focus:border-[#A31621] outline-none"
                      placeholder="帳戶名稱"
                    />
                  </div>

                  {/* 存摺上傳 */}
                  {!isComplete && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">存摺封面（選填）</label>
                      <label className="block border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-[#A31621]/40 hover:bg-red-50/30 transition-colors">
                        {passbookImage ? (
                          <img src={passbookImage} alt="存摺" className="max-h-28 mx-auto rounded" />
                        ) : (
                          <div className="py-2">
                            <svg className="w-6 h-6 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-sm text-gray-500">點擊上傳存摺封面</p>
                          </div>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload(setPassbookImage)} />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* 簽名 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-[#A31621] rounded-full" />
                  簽署確認
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  本人確認以上勞務報酬內容無誤，同意依上述金額領取報酬
                </p>

                <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    className="w-full cursor-crosshair touch-none"
                    style={{ height: '160px' }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-400">請在上方區域簽名</p>
                  <button onClick={clearSignature} className="text-sm text-[#A31621] hover:underline">
                    清除重簽
                  </button>
                </div>
              </div>

              {/* 送出按鈕 */}
              <button
                onClick={handleSubmit}
                disabled={signing}
                className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg disabled:opacity-50 transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #A31621 0%, #BF1730 50%, #EF8997 100%)' }}
              >
                {signing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    簽署中...
                  </span>
                ) : '確認簽署'}
              </button>

              <p className="text-center text-xs text-gray-400 pb-8">
                簽署後將記錄您的 IP 位址與時間，作為電子簽章之證明
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ===== 合約簽署頁面（原本） =====
  const contract = data;

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto bg-white shadow-lg print:shadow-none">
        <div className="p-8 border-b-2 border-gray-800">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">服務合約書</h1>
            <p className="text-gray-600">Contract Agreement</p>
          </div>
          <div className="flex justify-between mt-6 text-sm">
            <div>合約編號：{contract.contract_number}</div>
            <div>日期：{contract.contract_date}</div>
          </div>
        </div>

        <div className="p-8 grid grid-cols-2 gap-8 border-b">
          <div>
            <h3 className="font-bold text-lg mb-3 border-b pb-2">甲方（委託方）</h3>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-500">公司名稱：</span>{contract.customer_name}</p>
              {contract.customer_tax_id && <p><span className="text-gray-500">統一編號：</span>{contract.customer_tax_id}</p>}
              {contract.contact_person && <p><span className="text-gray-500">聯絡人：</span>{contract.contact_person}</p>}
              {contract.customer_phone && <p><span className="text-gray-500">電話：</span>{contract.customer_phone}</p>}
              {contract.customer_email && <p><span className="text-gray-500">Email：</span>{contract.customer_email}</p>}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-3 border-b pb-2">乙方（服務方）</h3>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-500">公司名稱：</span>{contract.company?.name}</p>
              {contract.company?.tax_id && <p><span className="text-gray-500">統一編號：</span>{contract.company?.tax_id}</p>}
              {contract.company?.phone && <p><span className="text-gray-500">電話：</span>{contract.company?.phone}</p>}
              {contract.company?.email && <p><span className="text-gray-500">Email：</span>{contract.company?.email}</p>}
            </div>
          </div>
        </div>

        <div className="p-8 border-b">
          <h3 className="font-bold text-lg mb-4">壹、合約標的</h3>
          <p className="mb-4 font-medium">{contract.title}</p>
          {contract.description && <p className="text-gray-700 whitespace-pre-wrap">{contract.description}</p>}
        </div>

        <div className="p-8 border-b">
          <h3 className="font-bold text-lg mb-4">貳、服務項目與費用</h3>
          <table className="w-full border-collapse border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">項目名稱</th>
                <th className="border p-2 text-center w-20">數量</th>
                <th className="border p-2 text-center w-16">單位</th>
                <th className="border p-2 text-right w-28">單價</th>
                <th className="border p-2 text-right w-28">小計</th>
              </tr>
            </thead>
            <tbody>
              {contract.items?.map((item: any, i: number) => (
                <tr key={i}>
                  <td className="border p-2">{item.item_name}</td>
                  <td className="border p-2 text-center">{item.quantity}</td>
                  <td className="border p-2 text-center">{item.unit}</td>
                  <td className="border p-2 text-right">${item.unit_price?.toLocaleString()}</td>
                  <td className="border p-2 text-right">${item.amount?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="border p-2 text-right font-medium">小計</td>
                <td className="border p-2 text-right">${contract.subtotal?.toLocaleString()}</td>
              </tr>
              <tr>
                <td colSpan={4} className="border p-2 text-right font-medium">稅額 (5%)</td>
                <td className="border p-2 text-right">${contract.tax_amount?.toLocaleString()}</td>
              </tr>
              <tr className="bg-gray-50">
                <td colSpan={4} className="border p-2 text-right font-bold">合計金額</td>
                <td className="border p-2 text-right font-bold text-lg">${contract.total_amount?.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {contract.payment_terms && (
          <div className="p-8 border-b">
            <h3 className="font-bold text-lg mb-4">參、付款條件</h3>
            <p className="whitespace-pre-wrap">{contract.payment_terms}</p>
          </div>
        )}

        {contract.terms_and_conditions && (
          <div className="p-8 border-b">
            <h3 className="font-bold text-lg mb-4">肆、條款與條件</h3>
            <p className="whitespace-pre-wrap text-sm">{contract.terms_and_conditions}</p>
          </div>
        )}

        {(contract.start_date || contract.end_date) && (
          <div className="p-8 border-b">
            <h3 className="font-bold text-lg mb-4">伍、合約期間</h3>
            <p>自 {contract.start_date || '___'} 起至 {contract.end_date || '___'} 止</p>
          </div>
        )}

        <div className="p-8">
          <h3 className="font-bold text-lg mb-6">簽署欄</h3>
          <div className="grid grid-cols-2 gap-8">
            <div className="border-2 p-4 rounded-lg">
              <h4 className="font-bold mb-4 text-center">甲方（委託方）</h4>
              {signed ? (
                <div className="text-center">
                  <p className="text-green-600 font-bold mb-2">✓ 已簽署</p>
                  <p className="text-sm">簽署人：{contract.customer_signed_name}</p>
                  <p className="text-sm text-gray-500">{new Date(contract.customer_signed_at).toLocaleString()}</p>
                  {contract.customer_signature && <img src={contract.customer_signature} alt="簽名" className="mx-auto mt-2 max-h-20 border" />}
                </div>
              ) : (
                <div className="print:hidden">
                  <div className="mb-4">
                    <label className="block text-sm mb-1">簽署人姓名 *</label>
                    <input type="text" value={form.signer_name} onChange={e => setForm({ ...form, signer_name: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="請輸入姓名" />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm mb-1">簽名 *</label>
                    <canvas ref={canvasRef} className="border rounded bg-white cursor-crosshair w-full" style={{ height: '100px' }}
                      onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                    <button onClick={clearSignature} className="text-sm text-blue-600 hover:underline mt-1">清除重簽</button>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm mb-1">公司大小章（選填）</label>
                    <input type="file" accept="image/*" onChange={handleStampUpload} className="text-sm" />
                    {stampFile && <img src={stampFile} alt="公司章" className="mt-2 max-h-16 border" />}
                  </div>
                  <button onClick={handleSubmit} disabled={signing} className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
                    {signing ? '簽署中...' : '確認簽署'}
                  </button>
                </div>
              )}
            </div>
            <div className="border-2 p-4 rounded-lg">
              <h4 className="font-bold mb-4 text-center">乙方（服務方）</h4>
              <div className="text-center">
                <p className="font-medium">{contract.company?.name}</p>
                {contract.company?.logo_url && <img src={contract.company.logo_url} alt="公司章" className="mx-auto mt-2 max-h-20" />}
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 border-t flex gap-4 print:hidden">
          <button onClick={() => window.print()} className="flex-1 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50">
            🖨️ 列印合約 / 下載 PDF
          </button>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>
    </div>
  );
}
