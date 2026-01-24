'use client';

import Image from 'next/image';
import { 
  Check, X, AlertTriangle, Info, 
  ArrowRight, Download, Upload, Edit, Trash2,
  Bell, Settings, User, Home,
  ChevronRight, ChevronDown,
  MessageSquare, CreditCard, FileText
} from 'lucide-react';

export default function BrandPreviewPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-primary-700 via-brand-primary-600 to-brand-accent-DEFAULT py-16 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-6 mb-6">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center">
              <span className="text-brand-primary-700 font-bold text-2xl">MW</span>
            </div>
            <div className="text-white">
              <h1 className="text-4xl font-bold">智慧媽咪</h1>
              <p className="text-brand-primary-100 text-lg">Brand Design System</p>
            </div>
          </div>
          <p className="text-brand-primary-100 max-w-2xl">
            完整的品牌設計系統規範，基於公司 Logo 提取的標準色彩，確保所有介面元素保持一致的視覺風格。
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-12 space-y-16">
        
        {/* Color Palette */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">🎨 品牌色彩 Brand Colors</h2>
          
          {/* Primary Colors */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">主色系 Primary (基於 Logo)</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
              {[
                { name: '50', color: 'bg-brand-primary-50', hex: '#FEF2F2' },
                { name: '100', color: 'bg-brand-primary-100', hex: '#FEE2E2' },
                { name: '200', color: 'bg-brand-primary-200', hex: '#FECACA' },
                { name: '300', color: 'bg-brand-primary-300', hex: '#FCA5A5' },
                { name: '400', color: 'bg-brand-primary-400', hex: '#EF8997' },
                { name: '500', color: 'bg-brand-primary-500', hex: '#DC2626' },
                { name: '600', color: 'bg-brand-primary-600', hex: '#BF1730' },
                { name: '700', color: 'bg-brand-primary-700', hex: '#A31621', main: true },
                { name: '800', color: 'bg-brand-primary-800', hex: '#931226' },
                { name: '900', color: 'bg-brand-primary-900', hex: '#7F1D1D' },
              ].map((item) => (
                <div key={item.name} className="text-center">
                  <div 
                    className={`${item.color} h-16 rounded-lg shadow-sm ${item.main ? 'ring-2 ring-offset-2 ring-brand-primary-700' : ''}`}
                  />
                  <p className="text-xs font-medium text-gray-600 mt-2">{item.name}</p>
                  <p className="text-[10px] text-gray-400">{item.hex}</p>
                  {item.main && <span className="text-[10px] text-brand-primary-700 font-semibold">主色</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Gradients */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">漸層 Gradients</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="h-24 bg-brand-gradient rounded-lg shadow-brand" />
                <p className="text-sm text-gray-600 mt-2">brand-gradient</p>
                <p className="text-xs text-gray-400">主漸層（模擬 Logo）</p>
              </div>
              <div>
                <div className="h-24 bg-brand-gradient-soft rounded-lg" />
                <p className="text-sm text-gray-600 mt-2">brand-gradient-soft</p>
                <p className="text-xs text-gray-400">柔和背景</p>
              </div>
              <div>
                <div className="h-24 bg-brand-gradient-vertical rounded-lg shadow-sm" />
                <p className="text-sm text-gray-600 mt-2">brand-gradient-vertical</p>
                <p className="text-xs text-gray-400">垂直漸層</p>
              </div>
            </div>
          </div>

          {/* Functional Colors */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">功能色 Functional Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <Check className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-700">Success</p>
                  <p className="text-xs text-green-600">#10B981</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-700">Warning</p>
                  <p className="text-xs text-yellow-600">#F59E0B</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                <X className="w-6 h-6 text-red-600" />
                <div>
                  <p className="font-medium text-red-700">Error</p>
                  <p className="text-xs text-red-600">#EF4444</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-brand-primary-50 rounded-lg border border-brand-primary-200">
                <Info className="w-6 h-6 text-brand-primary-700" />
                <div>
                  <p className="font-medium text-brand-primary-700">Info</p>
                  <p className="text-xs text-brand-primary-600">#A31621</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">🔘 按鈕 Buttons</h2>
          <div className="bg-white rounded-xl p-8 shadow-sm border border-brand-primary-100">
            <div className="space-y-6">
              {/* Primary Buttons */}
              <div>
                <p className="text-sm text-gray-500 mb-3">Primary Buttons</p>
                <div className="flex flex-wrap gap-3">
                  <button className="btn-primary">主要按鈕</button>
                  <button className="btn-primary flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" />
                    帶圖示
                  </button>
                  <button className="btn-primary" disabled>禁用狀態</button>
                </div>
              </div>

              {/* Secondary Buttons */}
              <div>
                <p className="text-sm text-gray-500 mb-3">Secondary Buttons</p>
                <div className="flex flex-wrap gap-3">
                  <button className="btn-secondary">次要按鈕</button>
                  <button className="btn-secondary flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    下載
                  </button>
                </div>
              </div>

              {/* Outline Buttons */}
              <div>
                <p className="text-sm text-gray-500 mb-3">Outline Buttons</p>
                <div className="flex flex-wrap gap-3">
                  <button className="btn-outline">外框按鈕</button>
                  <button className="btn-outline flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    上傳
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div>
                <p className="text-sm text-gray-500 mb-3">Action Buttons</p>
                <div className="flex flex-wrap gap-3">
                  <button className="btn-success flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    確認
                  </button>
                  <button className="btn-danger flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    刪除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Form Elements */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📝 表單元件 Form Elements</h2>
          <div className="bg-white rounded-xl p-8 shadow-sm border border-brand-primary-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="input-label">文字輸入</label>
                <input type="text" className="input-field" placeholder="請輸入內容..." />
              </div>
              <div>
                <label className="input-label">Email 輸入</label>
                <input type="email" className="input-field" placeholder="email@example.com" />
              </div>
              <div>
                <label className="input-label">選擇框</label>
                <select className="input-field">
                  <option>選項一</option>
                  <option>選項二</option>
                  <option>選項三</option>
                </select>
              </div>
              <div>
                <label className="input-label">日期選擇</label>
                <input type="date" className="input-field" />
              </div>
              <div className="md:col-span-2">
                <label className="input-label">多行文字</label>
                <textarea className="input-field" rows={3} placeholder="請輸入詳細說明..." />
              </div>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">🃏 卡片 Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Standard Card */}
            <div className="brand-card p-6">
              <h3 className="font-semibold text-gray-900 mb-2">標準卡片</h3>
              <p className="text-sm text-gray-500 mb-4">這是一個標準的品牌卡片元件，帶有陰影和邊框。</p>
              <button className="btn-primary text-sm">了解更多</button>
            </div>

            {/* Stats Card */}
            <div className="stats-card">
              <p className="text-sm text-gray-500">本月收入</p>
              <p className="stats-value text-brand-primary-700">NT$ 125,000</p>
              <p className="text-xs text-green-600 mt-2">↑ 12.5% 較上月</p>
            </div>

            {/* Brand Stats Card */}
            <div className="stats-card-brand">
              <p className="text-sm text-brand-primary-100">待處理請款</p>
              <p className="text-2xl font-bold">8 筆</p>
              <p className="text-xs text-brand-primary-200 mt-2">總金額 NT$ 450,000</p>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">🏷️ 徽章 Badges</h2>
          <div className="bg-white rounded-xl p-8 shadow-sm border border-brand-primary-100">
            <div className="flex flex-wrap gap-3">
              <span className="badge badge-brand">品牌標籤</span>
              <span className="badge badge-success">已完成</span>
              <span className="badge badge-warning">待處理</span>
              <span className="badge badge-error">已逾期</span>
              <span className="badge badge-info">資訊</span>
              <span className="badge badge-gray">草稿</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-brand-primary-100 text-brand-primary-600 rounded-full">Phase 1</span>
            </div>
          </div>
        </section>

        {/* Navigation */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">🧭 導航 Navigation</h2>
          <div className="bg-white rounded-xl shadow-sm border border-brand-primary-100 w-64">
            <div className="p-3 space-y-1">
              <a className="nav-item active">
                <Home className="w-5 h-5" />
                <span>總覽</span>
              </a>
              <a className="nav-item">
                <MessageSquare className="w-5 h-5" />
                <span className="flex-1">LINE 通知</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-brand-primary-100 text-brand-primary-600 rounded-full">New</span>
              </a>
              <a className="nav-item">
                <CreditCard className="w-5 h-5" />
                <span>請款管理</span>
              </a>
              <a className="nav-item">
                <FileText className="w-5 h-5" />
                <span>電子發票</span>
              </a>
              <a className="nav-item">
                <Settings className="w-5 h-5" />
                <span>系統設定</span>
              </a>
            </div>
          </div>
        </section>

        {/* Table */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📊 表格 Table</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>請款單號</th>
                  <th>客戶名稱</th>
                  <th>金額</th>
                  <th>狀態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium">INV-2026-001</td>
                  <td>ABC 科技有限公司</td>
                  <td className="text-brand-primary-700 font-semibold">NT$ 85,000</td>
                  <td><span className="badge badge-success">已收款</span></td>
                  <td>
                    <button className="text-brand-primary-700 hover:text-brand-primary-600">
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
                <tr>
                  <td className="font-medium">INV-2026-002</td>
                  <td>XYZ 設計工作室</td>
                  <td className="text-brand-primary-700 font-semibold">NT$ 42,000</td>
                  <td><span className="badge badge-warning">待收款</span></td>
                  <td>
                    <button className="text-brand-primary-700 hover:text-brand-primary-600">
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
                <tr>
                  <td className="font-medium">INV-2026-003</td>
                  <td>創意數位股份有限公司</td>
                  <td className="text-brand-primary-700 font-semibold">NT$ 120,000</td>
                  <td><span className="badge badge-error">已逾期</span></td>
                  <td>
                    <button className="text-brand-primary-700 hover:text-brand-primary-600">
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Alerts */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">⚠️ 提示訊息 Alerts</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-brand-primary-50 border border-brand-primary-200 rounded-lg">
              <Info className="w-5 h-5 text-brand-primary-700 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-brand-primary-700">資訊提示</p>
                <p className="text-sm text-brand-primary-600">這是一個品牌色的資訊提示框。</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-700">操作成功</p>
                <p className="text-sm text-green-600">您的資料已成功儲存。</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-700">注意事項</p>
                <p className="text-sm text-yellow-600">請確認所有欄位都已正確填寫。</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-700">錯誤訊息</p>
                <p className="text-sm text-red-600">操作失敗，請稍後再試。</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 border-t border-brand-primary-100">
          <p className="text-brand-primary-700 font-semibold">智慧媽咪國際有限公司</p>
          <p className="text-brand-primary-400 text-sm">Mommy Wisdom International Co.</p>
          <p className="text-gray-400 text-xs mt-2">© 2026 All Rights Reserved</p>
        </footer>
      </div>
    </div>
  );
}
