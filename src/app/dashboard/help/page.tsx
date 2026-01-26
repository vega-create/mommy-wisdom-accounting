'use client';

import { useState } from 'react';
import { 
  FileText, Users, Receipt, Send, CreditCard, Building, 
  Settings, Calendar, Bell, ArrowRight, CheckCircle, Workflow,
  BookOpen, Banknote, FileSignature, BarChart3
} from 'lucide-react';

const modules = [
  {
    id: 'customers',
    name: '客戶/廠商管理',
    icon: <Users className="w-6 h-6" />,
    description: '管理所有客戶與廠商資料，支援 LINE 群組關聯，實現自動通知功能。',
    features: [
      '客戶類型：客戶(customer)、廠商(vendor)、兩者皆是(both)',
      '可設定 LINE 群組 ID，用於自動發送通知',
      '記錄聯絡人、電話、Email、統編等資訊',
      '支援內部/外部廠商區分'
    ],
    relations: ['報價單→合約→請款單會自動帶入客戶資料', '應付管理會關聯廠商資料']
  },
  {
    id: 'quotations',
    name: '報價單管理',
    icon: <FileText className="w-6 h-6" />,
    description: '建立報價單，可產生客戶查看連結，報價確認後可轉換為合約。',
    features: [
      '支援多項目明細（品名、數量、單價）',
      '自動計算小計、稅額、總金額',
      '產生報價單連結供客戶線上查看',
      '狀態管理：草稿→已發送→已接受→已轉合約'
    ],
    workflow: ['建立報價單', '產生連結發送給客戶', '客戶確認後轉為合約'],
    relations: ['可轉換為合約', '關聯客戶資料']
  },
  {
    id: 'contracts',
    name: '合約管理',
    icon: <FileSignature className="w-6 h-6" />,
    description: '管理合約簽署流程，支援線上簽名、自動建立請款單。',
    features: [
      '合約內容：標的、條款、付款條件',
      '支援項目明細（與報價單相同格式）',
      '產生簽署連結，客戶可線上簽名',
      '簽署完成自動建立請款單',
      '自動發送 LINE 通知給管理群組'
    ],
    workflow: ['建立合約', '產生簽署連結', '發送 LINE 通知給客戶', '客戶簽署', '自動建立請款單', '通知管理群組'],
    relations: ['可從報價單轉換', '簽署後自動建立請款單', '關聯客戶 LINE 群組']
  },
  {
    id: 'billing',
    name: '請款單管理',
    icon: <Receipt className="w-6 h-6" />,
    description: '管理應收帳款，發送請款通知，確認收款後自動記帳。',
    features: [
      '支援手動建立或合約簽署自動建立',
      '可設定成本資訊（外包廠商、成本金額）',
      '發送 LINE 請款通知給客戶群組',
      '確認收款後自動建立交易記錄',
      '如有成本，自動建立應付款項'
    ],
    workflow: ['建立請款單', '發送 LINE 通知', '客戶付款', '確認收款', '自動記帳', '如有成本→建立應付'],
    relations: ['可從合約自動建立', '確認收款→建立交易記錄', '有成本→建立應付款項']
  },
  {
    id: 'payables',
    name: '應付管理',
    icon: <Banknote className="w-6 h-6" />,
    description: '追蹤應付帳款，管理外包成本，到期提醒。',
    features: [
      '記錄應付廠商、金額、到期日',
      '可從請款單收款時自動建立',
      '狀態管理：待付款、已付款、逾期',
      '付款後建立支出交易記錄'
    ],
    workflow: ['建立應付款項', '到期提醒', '確認付款', '自動記帳'],
    relations: ['可從請款單成本自動建立', '付款→建立交易記錄']
  },
  {
    id: 'invoices',
    name: '電子發票',
    icon: <FileText className="w-6 h-6" />,
    description: '串接 ezPay 開立電子發票，支援 B2B/B2C。',
    features: [
      '支援 B2B（有統編）、B2C（無統編）',
      '自動計算稅額',
      '開立後發送 LINE 通知',
      '支援作廢功能'
    ],
    relations: ['可關聯請款單', '開立後發送 LINE 通知']
  },
  {
    id: 'transactions',
    name: '記帳管理',
    icon: <CreditCard className="w-6 h-6" />,
    description: '記錄所有收入支出，支援多銀行帳戶。',
    features: [
      '收入/支出/轉帳類型',
      '關聯銀行帳戶',
      '可從請款單收款、應付付款自動建立',
      '報表統計功能'
    ],
    relations: ['請款單確認收款→自動建立', '應付確認付款→自動建立']
  },
  {
    id: 'accounts',
    name: '銀行帳戶',
    icon: <Building className="w-6 h-6" />,
    description: '管理公司銀行帳戶，用於收付款記錄。',
    features: [
      '記錄銀行名稱、分行、帳號',
      '設定預設帳戶',
      '用於請款單收款帳戶資訊'
    ],
    relations: ['交易記錄關聯帳戶', '請款單顯示收款帳戶']
  },
  {
    id: 'line',
    name: 'LINE 通知',
    icon: <Send className="w-6 h-6" />,
    description: '透過 LINE 發送各種業務通知。',
    features: [
      '發送請款通知給客戶群組',
      '合約簽署完成通知管理群組',
      '收款確認通知',
      '支援訊息模板',
      '排程發送功能'
    ],
    relations: ['請款單→發送請款通知', '合約簽署→通知管理群', '收款確認→通知客戶']
  },
  {
    id: 'project-quotes',
    name: '專案成本報價',
    icon: <BarChart3 className="w-6 h-6" />,
    description: '記錄客戶報價與成本，追蹤專案狀態與毛利。',
    features: [
      '記錄客戶、品項、製作單位',
      '成本價與報價對照',
      '自動計算毛利',
      '狀態追蹤：討論中/進行中/結案',
      '匯出 CSV 報表'
    ]
  }
];

export default function HelpPage() {
  const [selectedModule, setSelectedModule] = useState<string>('overview');

  const currentModule = modules.find(m => m.id === selectedModule);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">系統說明</h1>
        <p className="text-gray-500 mt-1">了解各功能模組的使用方式與關聯</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h3 className="font-semibold mb-3">功能模組</h3>
            <nav className="space-y-1">
              <button
                onClick={() => setSelectedModule('overview')}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 ${selectedModule === 'overview' ? 'bg-brand-primary-50 text-brand-primary-600' : 'hover:bg-gray-50'}`}
              >
                <Workflow className="w-5 h-5" /> 系統總覽
              </button>
              {modules.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedModule(m.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 ${selectedModule === m.id ? 'bg-brand-primary-50 text-brand-primary-600' : 'hover:bg-gray-50'}`}
                >
                  {m.icon} {m.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="lg:col-span-3">
          {selectedModule === 'overview' ? (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-bold mb-4">🏗️ 系統架構</h2>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex gap-4 flex-wrap justify-center">
                      <div className="bg-blue-100 px-4 py-2 rounded-lg text-center">
                        <p className="font-semibold">客戶/廠商</p>
                        <p className="text-xs text-gray-500">基礎資料</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 rotate-90" />
                    <div className="flex gap-4 flex-wrap justify-center">
                      <div className="bg-yellow-100 px-4 py-2 rounded-lg text-center">
                        <p className="font-semibold">報價單</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                      <div className="bg-orange-100 px-4 py-2 rounded-lg text-center">
                        <p className="font-semibold">合約</p>
                        <p className="text-xs text-gray-500">線上簽署</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                      <div className="bg-green-100 px-4 py-2 rounded-lg text-center">
                        <p className="font-semibold">請款單</p>
                        <p className="text-xs text-gray-500">自動建立</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 rotate-90" />
                    <div className="flex gap-8 flex-wrap justify-center">
                      <div className="bg-purple-100 px-4 py-2 rounded-lg text-center">
                        <p className="font-semibold">電子發票</p>
                        <p className="text-xs text-gray-500">ezPay</p>
                      </div>
                      <div className="bg-red-100 px-4 py-2 rounded-lg text-center">
                        <p className="font-semibold">應付款項</p>
                        <p className="text-xs text-gray-500">外包成本</p>
                      </div>
                      <div className="bg-teal-100 px-4 py-2 rounded-lg text-center">
                        <p className="font-semibold">記帳</p>
                        <p className="text-xs text-gray-500">收支記錄</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-bold mb-4">📋 主要業務流程</h2>
                <div className="space-y-4">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h3 className="font-semibold">1. 客戶簽約流程</h3>
                    <p className="text-sm text-gray-600 mt-1">報價單 → 合約（線上簽署）→ 請款單（自動建立）→ 收款確認 → 記帳</p>
                  </div>
                  <div className="border-l-4 border-green-500 pl-4">
                    <h3 className="font-semibold">2. 請款通知流程</h3>
                    <p className="text-sm text-gray-600 mt-1">建立請款單 → 發送 LINE 通知 → 客戶付款 → 確認收款 → 自動記帳</p>
                  </div>
                  <div className="border-l-4 border-orange-500 pl-4">
                    <h3 className="font-semibold">3. 外包成本流程</h3>
                    <p className="text-sm text-gray-600 mt-1">請款單設定成本 → 收款確認 → 自動建立應付款項 → 付款給廠商</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-bold mb-4">📱 LINE 通知時機</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold text-blue-600">發送給客戶群組</h4>
                    <ul className="mt-2 text-sm space-y-1">
                      <li>• 合約簽署連結通知</li>
                      <li>• 請款通知</li>
                      <li>• 收款確認通知</li>
                      <li>• 發票開立通知</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold text-green-600">發送給管理群組</h4>
                    <ul className="mt-2 text-sm space-y-1">
                      <li>• 合約簽署完成通知</li>
                      <li>• 請款單自動建立通知</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : currentModule ? (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-brand-primary-50 rounded-lg text-brand-primary-600">{currentModule.icon}</div>
                <div>
                  <h2 className="text-xl font-bold">{currentModule.name}</h2>
                  <p className="text-gray-600">{currentModule.description}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" /> 功能特點
                  </h3>
                  <ul className="space-y-2">
                    {currentModule.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-brand-primary-500 mt-1">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {currentModule.workflow && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Workflow className="w-5 h-5 text-blue-500" /> 操作流程
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {currentModule.workflow.map((step, i) => (
                        <span key={i} className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">{step}</span>
                          {i < currentModule.workflow!.length - 1 && <ArrowRight className="w-4 h-4 text-gray-400" />}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {currentModule.relations && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-purple-500" /> 關聯模組
                    </h3>
                    <ul className="space-y-2">
                      {currentModule.relations.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-purple-500 mt-1">→</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
