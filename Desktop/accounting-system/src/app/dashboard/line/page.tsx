'use client';

import { useState, useEffect } from 'react';
import { 
  MessageCircle, Settings, Users, FileText, Send, 
  Plus, Edit2, Trash2, Eye, Check, X, RefreshCw,
  AlertCircle, CheckCircle, Clock, ChevronDown
} from 'lucide-react';

// Types
interface LineSettings {
  id?: string;
  channel_access_token: string;
  channel_secret: string;
  is_active: boolean;
  webhook_url?: string;
}

interface LineGroup {
  id: string;
  group_id: string;
  group_name: string;
  group_type: 'group' | 'room' | 'user';
  description?: string;
  is_active: boolean;
  member_count?: number;
}

interface LineTemplate {
  id: string;
  name: string;
  category?: string;
  content: string;
  variables: string[];
  is_active: boolean;
  usage_count: number;
}

interface LineMessage {
  id: string;
  recipient_name: string;
  recipient_type: string;
  content: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sent_at?: string;
  created_at: string;
  error_message?: string;
}

type TabType = 'settings' | 'groups' | 'templates' | 'send' | 'history';

export default function LinePage() {
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  
  // Settings state
  const [settings, setSettings] = useState<LineSettings>({
    channel_access_token: '',
    channel_secret: '',
    is_active: false
  });
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // Groups state
  const [groups, setGroups] = useState<LineGroup[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<LineGroup | null>(null);
  
  // Templates state
  const [templates, setTemplates] = useState<LineTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LineTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<LineTemplate | null>(null);
  
  // Send state
  const [sendForm, setSendForm] = useState({
    recipientType: 'group' as 'group' | 'user',
    recipientId: '',
    templateId: '',
    customMessage: '',
    useTemplate: true
  });
  const [isSending, setIsSending] = useState(false);
  
  // History state
  const [messages, setMessages] = useState<LineMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Mock data for demo
  useEffect(() => {
    // 模擬資料
    setGroups([
      { id: '1', group_id: 'C1234567890', group_name: '智慧媽咪內部群組', group_type: 'group', is_active: true, member_count: 5 },
      { id: '2', group_id: 'C0987654321', group_name: '客戶通知群', group_type: 'group', is_active: true, member_count: 12 },
    ]);
    
    setTemplates([
      { 
        id: '1', 
        name: '請款通知', 
        category: '請款', 
        content: '親愛的 {{customer_name}}，您好：\n\n您的 {{month}} 月份服務費用 NT$ {{amount}} 元已產生，請於 {{due_date}} 前完成付款。\n\n如有疑問，請與我們聯繫。\n\n智慧媽咪國際 敬上',
        variables: ['customer_name', 'month', 'amount', 'due_date'],
        is_active: true,
        usage_count: 45
      },
      { 
        id: '2', 
        name: '收款確認', 
        category: '請款', 
        content: '親愛的 {{customer_name}}，您好：\n\n已收到您的款項 NT$ {{amount}} 元，感謝您的付款！\n\n發票將於近日寄送。\n\n智慧媽咪國際 敬上',
        variables: ['customer_name', 'amount'],
        is_active: true,
        usage_count: 32
      },
      { 
        id: '3', 
        name: '發票開立通知', 
        category: '發票', 
        content: '親愛的 {{customer_name}}，您好：\n\n您的電子發票已開立完成。\n\n發票號碼：{{invoice_number}}\n金額：NT$ {{amount}} 元\n\n智慧媽咪國際 敬上',
        variables: ['customer_name', 'invoice_number', 'amount'],
        is_active: true,
        usage_count: 28
      },
    ]);
    
    setMessages([
      { id: '1', recipient_name: 'ABC 科技', recipient_type: 'user', content: '請款通知已發送', status: 'delivered', sent_at: '2026-01-24 09:30', created_at: '2026-01-24 09:30' },
      { id: '2', recipient_name: '智慧媽咪內部群組', recipient_type: 'group', content: '本月營收報告', status: 'sent', sent_at: '2026-01-23 14:00', created_at: '2026-01-23 14:00' },
      { id: '3', recipient_name: 'XYZ 設計', recipient_type: 'user', content: '收款確認', status: 'failed', created_at: '2026-01-22 11:20', error_message: '用戶已封鎖' },
    ]);
  }, []);

  // Tab content components
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'settings', label: 'API 設定', icon: <Settings className="w-4 h-4" /> },
    { id: 'groups', label: '群組管理', icon: <Users className="w-4 h-4" /> },
    { id: 'templates', label: '模板管理', icon: <FileText className="w-4 h-4" /> },
    { id: 'send', label: '發送訊息', icon: <Send className="w-4 h-4" /> },
    { id: 'history', label: '發送記錄', icon: <Clock className="w-4 h-4" /> },
  ];

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus('idle');
    
    // 模擬 API 測試
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (settings.channel_access_token && settings.channel_secret) {
      setConnectionStatus('success');
    } else {
      setConnectionStatus('error');
    }
    setIsTestingConnection(false);
  };

  const handleSaveSettings = async () => {
    // TODO: 儲存到 Supabase
    alert('設定已儲存！');
  };

  const handleSendMessage = async () => {
    setIsSending(true);
    // TODO: 實際發送
    await new Promise(resolve => setTimeout(resolve, 1000));
    alert('訊息已發送！');
    setIsSending(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> 已送達</span>;
      case 'sent':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700"><Check className="w-3 h-3" /> 已發送</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3" /> 待發送</span>;
      case 'failed':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 text-red-700"><X className="w-3 h-3" /> 失敗</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-brand-primary-600" />
            LINE 通知管理
          </h1>
          <p className="text-gray-500 mt-1">管理 LINE 通知設定、群組、模板與發送記錄</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-primary-600 text-brand-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">LINE Messaging API 設定</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">啟用狀態</span>
                <button
                  onClick={() => setSettings({ ...settings, is_active: !settings.is_active })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.is_active ? 'bg-brand-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Channel Access Token
                </label>
                <input
                  type="password"
                  value={settings.channel_access_token}
                  onChange={(e) => setSettings({ ...settings, channel_access_token: e.target.value })}
                  placeholder="輸入 Channel Access Token"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 focus:border-brand-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  從 LINE Developers Console 取得
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Channel Secret
                </label>
                <input
                  type="password"
                  value={settings.channel_secret}
                  onChange={(e) => setSettings({ ...settings, channel_secret: e.target.value })}
                  placeholder="輸入 Channel Secret"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 focus:border-brand-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Webhook URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.webhook_url || 'https://your-domain.com/api/line/webhook'}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  />
                  <button className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                    複製
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  將此 URL 設定到 LINE Developers Console 的 Webhook URL
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t">
              <button
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
              >
                {isTestingConnection ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                測試連線
              </button>
              
              {connectionStatus === 'success' && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> 連線成功
                </span>
              )}
              {connectionStatus === 'error' && (
                <span className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> 連線失敗，請檢查設定
                </span>
              )}
              
              <div className="flex-1" />
              
              <button
                onClick={handleSaveSettings}
                className="px-6 py-2 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700 transition-colors"
              >
                儲存設定
              </button>
            </div>
          </div>
        )}

        {/* Groups Tab */}
        {activeTab === 'groups' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">LINE 群組管理</h2>
              <button
                onClick={() => { setEditingGroup(null); setShowGroupModal(true); }}
                className="px-4 py-2 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> 新增群組
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">群組名稱</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">類型</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Group ID</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">成員數</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">狀態</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {groups.map((group) => (
                    <tr key={group.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{group.group_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {group.group_type === 'group' ? '群組' : group.group_type === 'room' ? '聊天室' : '個人'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">{group.group_id}</td>
                      <td className="px-4 py-3 text-center text-sm">{group.member_count || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {group.is_active ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">啟用</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">停用</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => { setEditingGroup(group); setShowGroupModal(true); }}
                            className="p-1 text-gray-500 hover:text-brand-primary-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button className="p-1 text-gray-500 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {groups.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>尚未新增任何群組</p>
                <p className="text-sm">點擊「新增群組」開始設定</p>
              </div>
            )}
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">訊息模板管理</h2>
              <button
                onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }}
                className="px-4 py-2 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> 新增模板
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium">{template.name}</h3>
                      {template.category && (
                        <span className="text-xs text-gray-500">{template.category}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">使用 {template.usage_count} 次</span>
                  </div>
                  
                  <p className="text-sm text-gray-600 line-clamp-3 mb-3 whitespace-pre-line">
                    {template.content}
                  </p>
                  
                  {template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {template.variables.map((v) => (
                        <span key={v} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-3 border-t">
                    <span className={`text-xs ${template.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                      {template.is_active ? '● 啟用中' : '○ 已停用'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setPreviewTemplate(template)}
                        className="p-1 text-gray-500 hover:text-brand-primary-600"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { setEditingTemplate(template); setShowTemplateModal(true); }}
                        className="p-1 text-gray-500 hover:text-brand-primary-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-500 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {templates.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>尚未建立任何模板</p>
                <p className="text-sm">點擊「新增模板」開始建立</p>
              </div>
            )}
          </div>
        )}

        {/* Send Tab */}
        {activeTab === 'send' && (
          <div className="p-6 space-y-6">
            <h2 className="text-lg font-semibold">發送 LINE 訊息</h2>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Left: Form */}
              <div className="space-y-4">
                {/* Recipient Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">發送對象</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="recipientType"
                        value="group"
                        checked={sendForm.recipientType === 'group'}
                        onChange={(e) => setSendForm({ ...sendForm, recipientType: 'group', recipientId: '' })}
                        className="text-brand-primary-600"
                      />
                      <span>群組</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="recipientType"
                        value="user"
                        checked={sendForm.recipientType === 'user'}
                        onChange={(e) => setSendForm({ ...sendForm, recipientType: 'user', recipientId: '' })}
                        className="text-brand-primary-600"
                      />
                      <span>個人</span>
                    </label>
                  </div>
                </div>

                {/* Recipient Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {sendForm.recipientType === 'group' ? '選擇群組' : '選擇聯絡人'}
                  </label>
                  <select
                    value={sendForm.recipientId}
                    onChange={(e) => setSendForm({ ...sendForm, recipientId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 focus:border-brand-primary-500"
                  >
                    <option value="">請選擇...</option>
                    {sendForm.recipientType === 'group' ? (
                      groups.filter(g => g.is_active).map((g) => (
                        <option key={g.id} value={g.group_id}>{g.group_name}</option>
                      ))
                    ) : (
                      <option value="user123">王小明</option>
                    )}
                  </select>
                </div>

                {/* Message Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">訊息內容</label>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="messageType"
                        checked={sendForm.useTemplate}
                        onChange={() => setSendForm({ ...sendForm, useTemplate: true })}
                        className="text-brand-primary-600"
                      />
                      <span>使用模板</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="messageType"
                        checked={!sendForm.useTemplate}
                        onChange={() => setSendForm({ ...sendForm, useTemplate: false })}
                        className="text-brand-primary-600"
                      />
                      <span>自訂內容</span>
                    </label>
                  </div>

                  {sendForm.useTemplate ? (
                    <select
                      value={sendForm.templateId}
                      onChange={(e) => setSendForm({ ...sendForm, templateId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 focus:border-brand-primary-500"
                    >
                      <option value="">選擇模板...</option>
                      {templates.filter(t => t.is_active).map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  ) : (
                    <textarea
                      value={sendForm.customMessage}
                      onChange={(e) => setSendForm({ ...sendForm, customMessage: e.target.value })}
                      placeholder="輸入訊息內容..."
                      rows={6}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 focus:border-brand-primary-500"
                    />
                  )}
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={isSending || !sendForm.recipientId || (!sendForm.templateId && !sendForm.customMessage)}
                  className="w-full py-3 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> 發送中...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> 發送訊息
                    </>
                  )}
                </button>
              </div>

              {/* Right: Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">訊息預覽</label>
                <div className="bg-[#7B8D93] rounded-2xl p-4 min-h-[300px]">
                  <div className="bg-[#8DE055] rounded-2xl rounded-tr-sm p-3 max-w-[80%] ml-auto text-sm">
                    {sendForm.useTemplate && sendForm.templateId ? (
                      <p className="whitespace-pre-line">
                        {templates.find(t => t.id === sendForm.templateId)?.content || '請選擇模板'}
                      </p>
                    ) : sendForm.customMessage ? (
                      <p className="whitespace-pre-line">{sendForm.customMessage}</p>
                    ) : (
                      <p className="text-gray-600 italic">訊息預覽將顯示在這裡</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">發送記錄</h2>
              <button className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> 重新整理
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">時間</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">對象</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">類型</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">內容</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {messages.map((msg) => (
                    <tr key={msg.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">{msg.sent_at || msg.created_at}</td>
                      <td className="px-4 py-3 font-medium">{msg.recipient_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {msg.recipient_type === 'group' ? '群組' : '個人'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{msg.content}</td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(msg.status)}
                        {msg.error_message && (
                          <p className="text-xs text-red-500 mt-1">{msg.error_message}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {messages.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>尚無發送記錄</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingGroup ? '編輯群組' : '新增群組'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">群組名稱</label>
                <input
                  type="text"
                  defaultValue={editingGroup?.group_name}
                  placeholder="例：智慧媽咪內部群組"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group ID</label>
                <input
                  type="text"
                  defaultValue={editingGroup?.group_id}
                  placeholder="C1234567890..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">從 LINE 群組設定或 Webhook 取得</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">類型</label>
                <select 
                  defaultValue={editingGroup?.group_type || 'group'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                >
                  <option value="group">群組</option>
                  <option value="room">聊天室</option>
                  <option value="user">個人</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
                <textarea
                  defaultValue={editingGroup?.description}
                  placeholder="選填"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGroupModal(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => { setShowGroupModal(false); }}
                className="flex-1 py-2 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4">
              {editingTemplate ? '編輯模板' : '新增模板'}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">模板名稱</label>
                  <input
                    type="text"
                    defaultValue={editingTemplate?.name}
                    placeholder="例：請款通知"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分類</label>
                  <input
                    type="text"
                    defaultValue={editingTemplate?.category}
                    placeholder="例：請款、發票"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模板內容</label>
                <textarea
                  defaultValue={editingTemplate?.content}
                  placeholder="使用 {{變數名稱}} 來插入動態內容"
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  可用變數：{`{{customer_name}}`}, {`{{amount}}`}, {`{{due_date}}`}, {`{{invoice_number}}`} 等
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => { setShowTemplateModal(false); }}
                className="flex-1 py-2 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{previewTemplate.name}</h3>
              <button onClick={() => setPreviewTemplate(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-[#7B8D93] rounded-2xl p-4">
              <div className="bg-[#8DE055] rounded-2xl rounded-tr-sm p-3 max-w-[90%] ml-auto text-sm whitespace-pre-line">
                {previewTemplate.content}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">可用變數：</p>
              <div className="flex flex-wrap gap-2">
                {previewTemplate.variables.map((v) => (
                  <span key={v} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-mono">
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
