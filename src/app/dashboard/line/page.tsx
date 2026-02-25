'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import {
  MessageCircle, Settings, Users, FileText, Send,
  Plus, Edit2, Trash2, Eye, Check, X, RefreshCw,
  AlertCircle, CheckCircle, Clock, ChevronDown,
  Calendar, Play, Pause, Paperclip, Image, FileText as FileTextIcon
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

interface LineSchedule {
  id: string;
  name: string;
  recipient_type: string;
  recipient_id: string;
  recipient_name?: string;
  template_id?: string;
  template?: { id: string; name: string };
  custom_content?: string;
  variables?: Record<string, string>;
  schedule_type: 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'twice_monthly' | 'yearly';
  scheduled_at?: string;
  schedule_time?: string;
  schedule_day_of_week?: number;
  schedule_day_of_month?: number;
  schedule_day_of_month_2?: number;
  schedule_month?: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  next_run_at?: string;
  last_run_at?: string;
  run_count: number;
}

type TabType = 'settings' | 'groups' | 'templates' | 'send' | 'schedules' | 'history';

// ========== 解析模板中的變數 ==========
const extractVariables = (content: string): string[] => {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  return variables;
};

export default function LinePage() {
  const { company } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabFromUrl = searchParams.get('tab') as TabType;
  const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl || 'settings');

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.replace(`/dashboard/line?tab=${tab}`, { scroll: false });
  };

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
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({
    group_name: '',
    group_id: '',
    group_type: 'group' as 'group' | 'room' | 'user',
    description: ''
  });

  // Templates state
  const [templates, setTemplates] = useState<LineTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LineTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<LineTemplate | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    category: '',
    content: ''
  });

  // Send state
  const [sendForm, setSendForm] = useState({
    recipientType: 'group' as 'group' | 'user',
    selectedGroupIds: [] as string[],
    recipientId: '',
    recipientName: '',
    templateId: '',
    customMessage: '',
    useTemplate: true
  });
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{url: string; fileName: string; fileType: string; fileSize: number}[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // History state
  const [messages, setMessages] = useState<LineMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

  // Schedule state
  const [schedules, setSchedules] = useState<LineSchedule[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<LineSchedule | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    recipient_type: 'group' as 'group' | 'user',
    recipient_id: '',
    recipient_name: '',
    template_id: '',
    custom_content: '',
    use_template: true,
    schedule_type: 'once' as 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'twice_monthly' | 'yearly',
    scheduled_at: '',
    schedule_time: '09:00',
    schedule_day_of_week: 1,
    schedule_day_of_month: 1,
    schedule_day_of_month_2: 15,
    schedule_month: 1
  });
  const [scheduleVariables, setScheduleVariables] = useState<Record<string, string>>({});

  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // ========== 載入設定 ==========
  const handleLoadSettings = async () => {
    if (!company?.id) return;
    try {
      const response = await fetch(`/api/line/settings?company_id=${company.id}`);
      const result = await response.json();
      if (result.data) {
        setSettings({
          id: result.data.id,
          channel_access_token: result.data.has_token ? '********** (已設定)' : '',
          channel_secret: result.data.has_secret ? '***** (已設定)' : '',
          is_active: result.data.is_active || false,
          webhook_url: result.data.webhook_url || 'https://mommy-wisdom-accounting.vercel.app/api/line/webhook'
        });
      }
    } catch (error) {
      console.error('Error loading LINE settings:', error);
    }
  };

  // ========== 模板管理函數 ==========
  const handleLoadTemplates = async () => {
    if (!company?.id) return;
    setIsLoadingTemplates(true);
    try {
      const response = await fetch(`/api/line/templates?company_id=${company.id}`);
      const result = await response.json();
      if (Array.isArray(result)) {
        setTemplates(result);
      } else if (result.data) {
        setTemplates(result.data);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const openAddTemplateModal = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: '', category: '', content: '' });
    setShowTemplateModal(true);
  };

  const openEditTemplateModal = (template: LineTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      category: template.category || '',
      content: template.content
    });
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!company?.id) return;
    if (!templateForm.name || !templateForm.content) {
      alert('請填寫模板名稱和內容');
      return;
    }
    setIsSavingTemplate(true);
    try {
      const url = '/api/line/templates';
      const method = editingTemplate ? 'PUT' : 'POST';

      // ✅ 自動解析模板中的變數
      const variables = extractVariables(templateForm.content);

      const body = editingTemplate
        ? { id: editingTemplate.id, ...templateForm, variables }
        : { company_id: company.id, ...templateForm, variables };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();

      if (result.success || result.data || result.id) {
        setShowTemplateModal(false);
        handleLoadTemplates();
        alert(editingTemplate ? '模板已更新！' : '模板已新增！');
      } else {
        alert(result.error || '儲存失敗');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('儲存失敗');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('確定要刪除此模板？')) return;
    try {
      const response = await fetch(`/api/line/templates?id=${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        handleLoadTemplates();
      } else {
        alert(result.error || '刪除失敗');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('刪除失敗');
    }
  };

  // ========== 群組管理函數 ==========
  const handleLoadGroups = async () => {
    if (!company?.id) return;
    setIsLoadingGroups(true);
    try {
      const response = await fetch(`/api/line/groups?company_id=${company.id}`);
      const result = await response.json();
      if (Array.isArray(result)) {
        setGroups(result);
      } else if (result.data) {
        setGroups(result.data);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const openAddGroupModal = () => {
    setEditingGroup(null);
    setGroupForm({ group_name: '', group_id: '', group_type: 'group', description: '' });
    setShowGroupModal(true);
  };

  const openEditGroupModal = (group: LineGroup) => {
    setEditingGroup(group);
    setGroupForm({
      group_name: group.group_name,
      group_id: group.group_id,
      group_type: group.group_type,
      description: group.description || ''
    });
    setShowGroupModal(true);
  };

  const handleSaveGroup = async () => {
    if (!company?.id) return;
    if (!groupForm.group_name || !groupForm.group_id) {
      alert('請填寫群組名稱和 Group ID');
      return;
    }
    setIsSavingGroup(true);
    try {
      const url = '/api/line/groups';
      const method = editingGroup ? 'PUT' : 'POST';
      const body = editingGroup
        ? { id: editingGroup.id, ...groupForm }
        : { company_id: company.id, ...groupForm };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();

      if (result.success || result.data || result.id) {
        setShowGroupModal(false);
        handleLoadGroups();
        alert(editingGroup ? '群組已更新！' : '群組已新增！');
      } else {
        alert(result.error || '儲存失敗');
      }
    } catch (error) {
      console.error('Error saving group:', error);
      alert('儲存失敗');
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('確定要刪除此群組？')) return;
    try {
      const response = await fetch(`/api/line/groups?id=${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        handleLoadGroups();
      } else {
        alert(result.error || '刪除失敗');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('刪除失敗');
    }
  };

  // ========== 排程管理函數 ==========
  const handleLoadSchedules = async () => {
    if (!company?.id) return;
    setIsLoadingSchedules(true);
    try {
      const response = await fetch(`/api/line/schedules?company_id=${company.id}`);
      const result = await response.json();
      if (Array.isArray(result)) {
        setSchedules(result);
      } else if (result.data) {
        setSchedules(result.data);
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
    } finally {
      setIsLoadingSchedules(false);
    }
  };

  const openAddScheduleModal = () => {
    setEditingSchedule(null);
    setScheduleForm({
      name: '',
      recipient_type: 'group',
      recipient_id: '',
      recipient_name: '',
      template_id: '',
      custom_content: '',
      use_template: true,
      schedule_type: 'once',
      scheduled_at: '',
      schedule_time: '09:00',
      schedule_day_of_week: 1,
      schedule_day_of_month: 1,
      schedule_day_of_month_2: 15,
      schedule_month: 1
    });
    setScheduleVariables({});
    setShowScheduleModal(true);
  };

  const openEditScheduleModal = (schedule: LineSchedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      name: schedule.name,
      recipient_type: schedule.recipient_type as 'group' | 'user',
      recipient_id: schedule.recipient_id,
      recipient_name: schedule.recipient_name || '',
      template_id: schedule.template_id || '',
      custom_content: schedule.custom_content || '',
      use_template: !!schedule.template_id,
      schedule_type: schedule.schedule_type,
      scheduled_at: schedule.scheduled_at || '',
      schedule_time: schedule.schedule_time || '09:00',
      schedule_day_of_week: schedule.schedule_day_of_week || 1,
      schedule_day_of_month: schedule.schedule_day_of_month || 1,
      schedule_day_of_month_2: schedule.schedule_day_of_month_2 || 15,
      schedule_month: schedule.schedule_month || 1
    });
    // ✅ 載入已儲存的變數
    if (schedule.variables && typeof schedule.variables === 'object') {
      setScheduleVariables(schedule.variables);
    } else {
      setScheduleVariables({});
    }
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async () => {
    if (!company?.id) return;
    if (!scheduleForm.name || !scheduleForm.recipient_id) {
      alert('請填寫排程名稱和發送對象');
      return;
    }
    if (scheduleForm.schedule_type === 'once' && !scheduleForm.scheduled_at) {
      alert('請選擇發送時間');
      return;
    }
    setIsSavingSchedule(true);
    try {
      const url = '/api/line/schedules';
      const method = editingSchedule ? 'PUT' : 'POST';

      const needsDayOfWeek = ['weekly', 'biweekly'].includes(scheduleForm.schedule_type);
      const needsDayOfMonth = ['monthly', 'twice_monthly', 'yearly'].includes(scheduleForm.schedule_type);
      const needsDayOfMonth2 = scheduleForm.schedule_type === 'twice_monthly';
      const needsMonth = scheduleForm.schedule_type === 'yearly';

      const body = {
        ...(editingSchedule ? { id: editingSchedule.id } : { company_id: company.id }),
        name: scheduleForm.name,
        recipient_type: scheduleForm.recipient_type,
        recipient_id: scheduleForm.recipient_id,
        recipient_name: scheduleForm.recipient_name,
        template_id: scheduleForm.use_template ? scheduleForm.template_id : null,
        custom_content: scheduleForm.use_template ? null : scheduleForm.custom_content,
        variables: scheduleForm.use_template ? scheduleVariables : {},
        schedule_type: scheduleForm.schedule_type,
        scheduled_at: scheduleForm.schedule_type === 'once' ? scheduleForm.scheduled_at : null,
        schedule_time: scheduleForm.schedule_type !== 'once' ? scheduleForm.schedule_time : null,
        schedule_day_of_week: needsDayOfWeek ? scheduleForm.schedule_day_of_week : null,
        schedule_day_of_month: needsDayOfMonth ? scheduleForm.schedule_day_of_month : null,
        schedule_day_of_month_2: needsDayOfMonth2 ? scheduleForm.schedule_day_of_month_2 : null,
        schedule_month: needsMonth ? scheduleForm.schedule_month : null
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();

      if (result.success || result.data || result.id) {
        setShowScheduleModal(false);
        handleLoadSchedules();
        setScheduleVariables({});
        alert(editingSchedule ? '排程已更新！' : '排程已新增！');
      } else {
        alert(result.error || '儲存失敗');
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('儲存失敗');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleToggleSchedule = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      const response = await fetch('/api/line/schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
      const result = await response.json();
      if (result.success) {
        handleLoadSchedules();
      } else {
        alert(result.error || '更新失敗');
      }
    } catch (error) {
      console.error('Error toggling schedule:', error);
      alert('更新失敗');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('確定要刪除此排程？')) return;
    try {
      const response = await fetch(`/api/line/schedules?id=${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        handleLoadSchedules();
      } else {
        alert(result.error || '刪除失敗');
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('刪除失敗');
    }
  };

  // ========== 發送訊息函數 ==========
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !company?.id) return;
    setIsUploading(true);
    try {
      const newFiles = [];
      for (const file of Array.from(e.target.files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('company_id', company.id);
        const res = await fetch('/api/line/upload', { method: 'POST', body: formData });
        const result = await res.json();
        if (result.success) {
          newFiles.push(result.data);
        } else {
          alert('上傳失敗: ' + (result.error || file.name));
        }
      }
      setUploadedFiles(prev => [...prev, ...newFiles]);
    } catch (err) {
      console.error('Upload error:', err);
      alert('上傳失敗');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if (!company?.id) return;

    if (sendForm.recipientType === 'group' && sendForm.selectedGroupIds.length === 0) {
      alert('請至少選擇一個群組');
      return;
    }
    if (sendForm.recipientType === 'user' && !sendForm.recipientId) {
      alert('請輸入 LINE User ID');
      return;
    }

    let messageContent: string;
    if (sendForm.useTemplate) {
      const selectedTemplate = templates.find(t => t.id === sendForm.templateId);
      if (!selectedTemplate?.content) {
        alert('請選擇模板');
        return;
      }
      messageContent = replaceTemplateVariables(selectedTemplate.content, templateVariables);
    } else {
      messageContent = sendForm.customMessage;
    }

    if (!messageContent) {
      alert('請選擇模板或輸入訊息內容');
      return;
    }

    setIsSending(true);
    setSendSuccess(false);
    try {
      const isMultiGroup = sendForm.recipientType === 'group' && sendForm.selectedGroupIds.length > 0;
      const response = await fetch('/api/line/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          recipient_type: isMultiGroup ? 'multi_group' : sendForm.recipientType,
          recipient_ids: isMultiGroup ? sendForm.selectedGroupIds : undefined,
          recipient_id: !isMultiGroup ? sendForm.recipientId : undefined,
          recipient_name: sendForm.recipientName,
          template_id: sendForm.useTemplate ? sendForm.templateId : null,
          content: messageContent,
          variables: sendForm.useTemplate ? templateVariables : null,
          attachments: uploadedFiles.length > 0 ? uploadedFiles : undefined
        })
      });
      const result = await response.json();

      if (result.success) {
        setSendSuccess(true);
        if (result.results) {
          const total = result.results.length;
          const ok = result.results.filter((r) => r.success).length;
          const fail = total - ok;
          alert(fail > 0 ? `發送完成！成功 ${ok} 個群組，失敗 ${fail} 個` : `訊息已成功發送至 ${ok} 個群組！`);
        } else {
          alert('訊息已發送！');
        }
        setSendForm({
          ...sendForm,
          selectedGroupIds: [],
          recipientId: '',
          recipientName: '',
          templateId: '',
          customMessage: ''
        });
        setTemplateVariables({});
        setUploadedFiles([]);
      } else {
        alert(result.error || '發送失敗');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('發送失敗');
    } finally {
      setIsSending(false);
    }
  };
  // ========== 發送記錄 ==========
  const handleLoadMessages = async () => {
    if (!company?.id) return;
    setIsLoadingMessages(true);
    try {
      const response = await fetch(`/api/line/send?company_id=${company.id}`);
      const result = await response.json();
      if (result.data) {
        setMessages(result.data.map((m: any) => ({
          id: m.id,
          recipient_name: m.recipient_name || m.group_name || '未知',
          recipient_type: m.recipient_type || 'user',
          content: m.content || m.message_content || '',
          status: m.status || 'sent',
          sent_at: m.sent_at ? new Date(m.sent_at).toLocaleString('zh-TW') : null,
          created_at: m.created_at ? new Date(m.created_at).toLocaleString('zh-TW') : '',
          error_message: m.error_message
        })));
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleDeleteMessage = async (id: string) => {
    try {
      const response = await fetch(`/api/line/send?id=${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        setMessages(messages.filter(m => m.id !== id));
      } else {
        alert(result.error || '刪除失敗');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('刪除失敗');
    }
    setDeletingMessageId(null);
  };

  // ========== 設定相關 ==========
  const handleTestConnection = async () => {
    if (!company?.id) return;
    setIsTestingConnection(true);
    setConnectionStatus('idle');

    try {
      const response = await fetch('/api/line/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.id })
      });
      const result = await response.json();

      if (result.success) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('error');
        if (result.error) {
          alert(`連線失敗：${result.error}`);
        }
      }
    } catch (error) {
      console.error('Test connection error:', error);
      setConnectionStatus('error');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!company?.id) return;
    setIsSavingSettings(true);
    try {
      const response = await fetch('/api/line/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          channel_access_token: settings.channel_access_token,
          channel_secret: settings.channel_secret,
          is_active: settings.is_active,
          webhook_url: 'https://mommy-wisdom-accounting.vercel.app/api/line/webhook'
        })
      });
      const result = await response.json();
      if (result.success || result.data) {
        alert('設定已儲存！');
      } else {
        alert(result.error || '儲存失敗');
      }
    } catch (error) {
      console.error('Error saving LINE settings:', error);
      alert('儲存失敗');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // ========== Effects ==========
  useEffect(() => {
    if (company?.id) {
      handleLoadSettings();
    }
  }, [company?.id]);

  useEffect(() => {
    if (activeTab === 'templates' && company?.id) {
      handleLoadTemplates();
    }
  }, [activeTab, company?.id]);

  useEffect(() => {
    if (activeTab === 'send' && company?.id) {
      handleLoadGroups();
      handleLoadTemplates();
    }
  }, [activeTab, company?.id]);

  useEffect(() => {
    if (activeTab === 'groups' && company?.id) {
      handleLoadGroups();
    }
  }, [activeTab, company?.id]);

  useEffect(() => {
    if (activeTab === 'schedules' && company?.id) {
      handleLoadSchedules();
      handleLoadGroups();
      handleLoadTemplates();
    }
  }, [activeTab, company?.id]);

  useEffect(() => {
    if (activeTab === 'history' && company?.id) {
      handleLoadMessages();
    }
  }, [activeTab, company?.id]);

  // ========== Helpers ==========
  const getVariablePlaceholder = (varName: string): string => {
    const placeholders: Record<string, string> = {
      customer_name: '例：王小明',
      name: '例：王小明',
      month: '例：1',
      amount: '例：10000',
      due_date: '例：2026/02/15',
      invoice_number: '例：AB12345678',
      sign_url: '簽署連結',
      deadline: '例：2026/02/10',
      date: '例：2026/01/24',
      bank_account: '例：012-123456789',
      title: '標題',
      content: '內容'
    };
    return placeholders[varName] || `輸入 ${varName}`;
  };

  const replaceTemplateVariables = (content: string, variables: Record<string, string>): string => {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`);
    }
    return result;
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

  // 取得模板的變數（優先使用資料庫的，若沒有則即時解析）
  const getTemplateVariables = (template: LineTemplate): string[] => {
    if (template.variables && template.variables.length > 0) {
      return template.variables;
    }
    // 如果資料庫沒有變數，即時從內容解析
    return extractVariables(template.content);
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'settings', label: 'API 設定', icon: <Settings className="w-4 h-4" /> },
    { id: 'groups', label: '群組管理', icon: <Users className="w-4 h-4" /> },
    { id: 'templates', label: '模板管理', icon: <FileText className="w-4 h-4" /> },
    { id: 'send', label: '發送訊息', icon: <Send className="w-4 h-4" /> },
    { id: 'schedules', label: '排程發送', icon: <Calendar className="w-4 h-4" /> },
    { id: 'history', label: '發送記錄', icon: <Clock className="w-4 h-4" /> },
  ];

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
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
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
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.is_active ? 'bg-brand-primary-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel Access Token</label>
                <input
                  type="password"
                  value={settings.channel_access_token}
                  onChange={(e) => setSettings({ ...settings, channel_access_token: e.target.value })}
                  placeholder="輸入 Channel Access Token"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 focus:border-brand-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">從 LINE Developers Console 取得</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel Secret</label>
                <input
                  type="password"
                  value={settings.channel_secret}
                  onChange={(e) => setSettings({ ...settings, channel_secret: e.target.value })}
                  placeholder="輸入 Channel Secret"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 focus:border-brand-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value="https://mommy-wisdom-accounting.vercel.app/api/line/webhook"
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('https://mommy-wisdom-accounting.vercel.app/api/line/webhook');
                      alert('已複製到剪貼簿！');
                    }}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    複製
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">將此 URL 設定到 LINE Developers Console 的 Webhook URL</p>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t">
              <button
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isTestingConnection ? 'animate-spin' : ''}`} />
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
                disabled={isSavingSettings}
                className="px-6 py-2 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingSettings && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isSavingSettings ? '儲存中...' : '儲存設定'}
              </button>
            </div>
          </div>
        )}

        {/* Groups Tab */}
        {activeTab === 'groups' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">LINE 群組管理</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleLoadGroups}
                  disabled={isLoadingGroups}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingGroups ? 'animate-spin' : ''}`} />
                  重新整理
                </button>
                <button
                  onClick={openAddGroupModal}
                  className="px-4 py-2 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> 新增群組
                </button>
              </div>
            </div>

            {isLoadingGroups ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-brand-primary-500" />
                <p className="text-gray-500">載入中...</p>
              </div>
            ) : groups.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">群組名稱</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">類型</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Group ID</th>
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
                        <td className="px-4 py-3 text-sm text-gray-500 font-mono text-xs">{group.group_id}</td>
                        <td className="px-4 py-3 text-center">
                          {group.is_active ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">啟用</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">停用</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openEditGroupModal(group)} className="p-1 text-gray-500 hover:text-brand-primary-600" title="編輯">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteGroup(group.id)} className="p-1 text-gray-500 hover:text-red-600" title="刪除">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>尚未新增任何群組</p>
                <p className="text-sm mt-1">在 LINE 群組輸入 <code className="bg-gray-100 px-2 py-1 rounded">groupid</code> 可取得群組 ID</p>
              </div>
            )}
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">訊息模板管理</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleLoadTemplates}
                  disabled={isLoadingTemplates}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingTemplates ? 'animate-spin' : ''}`} />
                  重新整理
                </button>
                <button
                  onClick={openAddTemplateModal}
                  className="px-4 py-2 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> 新增模板
                </button>
              </div>
            </div>

            {isLoadingTemplates ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-brand-primary-500" />
                <p className="text-gray-500">載入中...</p>
              </div>
            ) : templates.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => {
                  const templateVars = getTemplateVariables(template);
                  return (
                    <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-medium">{template.name}</h3>
                          {template.category && <span className="text-xs text-gray-500">{template.category}</span>}
                        </div>
                        <span className="text-xs text-gray-400">使用 {template.usage_count || 0} 次</span>
                      </div>

                      <p className="text-sm text-gray-600 line-clamp-3 mb-3 whitespace-pre-line">{template.content}</p>

                      {templateVars.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {templateVars.map((v) => (
                            <span key={v} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{`{{${v}}}`}</span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t">
                        <span className={`text-xs ${template.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                          {template.is_active ? '● 啟用中' : '○ 已停用'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setPreviewTemplate(template)} className="p-1 text-gray-500 hover:text-brand-primary-600" title="預覽">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEditTemplateModal(template)} className="p-1 text-gray-500 hover:text-brand-primary-600" title="編輯">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteTemplate(template.id)} className="p-1 text-gray-500 hover:text-red-600" title="刪除">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
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
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">發送對象</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="recipientType"
                        value="group"
                        checked={sendForm.recipientType === 'group'}
                        onChange={() => setSendForm({ ...sendForm, recipientType: 'group', recipientId: '' })}
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
                        onChange={() => setSendForm({ ...sendForm, recipientType: 'user', recipientId: '' })}
                        className="text-brand-primary-600"
                      />
                      <span>個人</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {sendForm.recipientType === 'group' ? '選擇群組（可多選）' : '輸入 LINE User ID'}
                  </label>
                  {sendForm.recipientType === 'group' ? (
                    <div>
                      <div className="flex gap-2 mb-2">
                        <button type="button" onClick={() => setSendForm({ ...sendForm, selectedGroupIds: groups.filter(g => g.is_active).map(g => g.group_id) })} className="text-xs text-blue-600 hover:text-blue-800 underline">全選</button>
                        <button type="button" onClick={() => setSendForm({ ...sendForm, selectedGroupIds: [] })} className="text-xs text-gray-500 hover:text-gray-700 underline">取消全選</button>
                        {sendForm.selectedGroupIds.length > 0 && <span className="text-xs text-green-600 ml-auto">已選 {sendForm.selectedGroupIds.length} 個群組</span>}
                      </div>
                      <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1 bg-white">
                        {groups.filter(g => g.is_active).length === 0 ? (
                          <p className="text-sm text-gray-400 p-2">尚無群組，請先新增</p>
                        ) : groups.filter(g => g.is_active).map(group => (
                          <label key={group.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${sendForm.selectedGroupIds.includes(group.group_id) ? 'bg-blue-50 border border-blue-200' : ''}`}>
                            <input type="checkbox" checked={sendForm.selectedGroupIds.includes(group.group_id)} onChange={(e) => { const id = group.group_id; if (e.target.checked) { setSendForm({ ...sendForm, selectedGroupIds: [...sendForm.selectedGroupIds, id] }); } else { setSendForm({ ...sendForm, selectedGroupIds: sendForm.selectedGroupIds.filter((gid) => gid !== id) }); } }} className="rounded text-blue-600 w-4 h-4" />
                            <span className="text-sm font-medium">{group.group_name}</span>
                            {group.description && <span className="text-xs text-gray-400 ml-auto">{group.description}</span>}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={sendForm.recipientId}
                      onChange={(e) => setSendForm({ ...sendForm, recipientId: e.target.value })}
                      placeholder="輸入 LINE User ID (U...)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 font-mono"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">訊息內容</label>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={sendForm.useTemplate}
                        onChange={() => setSendForm({ ...sendForm, useTemplate: true })}
                        className="text-brand-primary-600"
                      />
                      <span>使用模板</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={!sendForm.useTemplate}
                        onChange={() => setSendForm({ ...sendForm, useTemplate: false })}
                        className="text-brand-primary-600"
                      />
                      <span>自訂內容</span>
                    </label>
                  </div>

                  {sendForm.useTemplate ? (
                    <>
                      <select
                        value={sendForm.templateId}
                        onChange={(e) => {
                          setSendForm({ ...sendForm, templateId: e.target.value });
                          const selectedTemplate = templates.find(t => t.id === e.target.value);
                          if (selectedTemplate) {
                            const vars = getTemplateVariables(selectedTemplate);
                            const varsObj: Record<string, string> = {};
                            vars.forEach(v => { varsObj[v] = ''; });
                            setTemplateVariables(varsObj);
                          } else {
                            setTemplateVariables({});
                          }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                      >
                        <option value="">選擇模板...</option>
                        {templates.filter(t => t.is_active).map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>

                      {sendForm.templateId && (() => {
                        const selectedTemplate = templates.find(t => t.id === sendForm.templateId);
                        if (!selectedTemplate) return null;
                        const vars = getTemplateVariables(selectedTemplate);
                        if (vars.length === 0) return null;
                        return (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-3">
                            <p className="text-sm font-medium text-gray-700">填入模板變數：</p>
                            {vars.map((varName) => (
                              <div key={varName}>
                                <label className="block text-xs text-gray-500 mb-1">{`{{${varName}}}`}</label>
                                <input
                                  type="text"
                                  value={templateVariables[varName] || ''}
                                  onChange={(e) => setTemplateVariables({ ...templateVariables, [varName]: e.target.value })}
                                  placeholder={getVariablePlaceholder(varName)}
                                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                                />
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <textarea
                      value={sendForm.customMessage}
                      onChange={(e) => setSendForm({ ...sendForm, customMessage: e.target.value })}
                      placeholder="輸入訊息內容..."
                      rows={6}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                    />
                  )}
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={isSending || isUploading || (sendForm.recipientType === 'group' ? sendForm.selectedGroupIds.length === 0 : !sendForm.recipientId) || (!sendForm.templateId && !sendForm.customMessage && uploadedFiles.length === 0)}
                  className="w-full py-3 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSending ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> 發送中...</>
                  ) : (
                    <><Send className="w-4 h-4" /> {sendForm.recipientType === 'group' && sendForm.selectedGroupIds.length > 0 ? `發送至 ${sendForm.selectedGroupIds.length} 個群組` : '發送訊息'}</>
                  )}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">訊息預覽</label>
                <div className="bg-[#7B8D93] rounded-2xl p-4 min-h-[300px]">
                  <div className="bg-[#8DE055] rounded-2xl rounded-tr-sm p-3 max-w-[80%] ml-auto text-sm">
                    {sendForm.useTemplate && sendForm.templateId ? (
                      <p className="whitespace-pre-line">
                        {replaceTemplateVariables(
                          templates.find(t => t.id === sendForm.templateId)?.content || '請選擇模板',
                          templateVariables
                        )}
                      </p>
                    ) : sendForm.customMessage ? (
                      <p className="whitespace-pre-line">{sendForm.customMessage}</p>
                    ) : (
                      <p className="text-gray-600 italic">{uploadedFiles.length > 0 ? '(' + uploadedFiles.length + ' 個附件)' : '訊息預覽將顯示在這裡'}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Schedules Tab */}
        {activeTab === 'schedules' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">排程發送</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleLoadSchedules}
                  disabled={isLoadingSchedules}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingSchedules ? 'animate-spin' : ''}`} />
                  重新整理
                </button>
                <button
                  onClick={openAddScheduleModal}
                  className="px-4 py-2 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> 新增排程
                </button>
              </div>
            </div>

            {isLoadingSchedules ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-brand-primary-500" />
                <p className="text-gray-500">載入中...</p>
              </div>
            ) : schedules.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">排程名稱</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">發送對象</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">排程類型</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">下次執行</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">執行次數</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">狀態</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {schedules.map((schedule) => (
                      <tr key={schedule.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{schedule.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{schedule.recipient_name || schedule.recipient_id}</td>
                        <td className="px-4 py-3 text-sm">
                          {schedule.schedule_type === 'once' && <span className="text-blue-600">單次</span>}
                          {schedule.schedule_type === 'daily' && <span className="text-green-600">每日 {schedule.schedule_time}</span>}
                          {schedule.schedule_type === 'weekly' && (
                            <span className="text-purple-600">每週{['日', '一', '二', '三', '四', '五', '六'][schedule.schedule_day_of_week || 0]} {schedule.schedule_time}</span>
                          )}
                          {schedule.schedule_type === 'biweekly' && (
                            <span className="text-indigo-600">每兩週{['日', '一', '二', '三', '四', '五', '六'][schedule.schedule_day_of_week || 0]} {schedule.schedule_time}</span>
                          )}
                          {schedule.schedule_type === 'monthly' && (
                            <span className="text-orange-600">每月 {schedule.schedule_day_of_month} 日 {schedule.schedule_time}</span>
                          )}
                          {schedule.schedule_type === 'twice_monthly' && (
                            <span className="text-pink-600">每月 {schedule.schedule_day_of_month}、{schedule.schedule_day_of_month_2} 日 {schedule.schedule_time}</span>
                          )}
                          {schedule.schedule_type === 'yearly' && (
                            <span className="text-red-600">每年 {schedule.schedule_month}/{schedule.schedule_day_of_month} {schedule.schedule_time}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {schedule.next_run_at ? new Date(schedule.next_run_at).toLocaleString('zh-TW') : '-'}
                        </td>
                        <td className="px-4 py-3 text-center text-sm">{schedule.run_count || 0}</td>
                        <td className="px-4 py-3 text-center">
                          {schedule.status === 'active' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">啟用中</span>}
                          {schedule.status === 'paused' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">已暫停</span>}
                          {schedule.status === 'completed' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">已完成</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {schedule.status !== 'completed' && (
                              <button
                                onClick={() => handleToggleSchedule(schedule.id, schedule.status)}
                                className={`p-1 ${schedule.status === 'active' ? 'text-yellow-500 hover:text-yellow-600' : 'text-green-500 hover:text-green-600'}`}
                                title={schedule.status === 'active' ? '暫停' : '啟用'}
                              >
                                {schedule.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </button>
                            )}
                            <button onClick={() => openEditScheduleModal(schedule)} className="p-1 text-gray-500 hover:text-brand-primary-600" title="編輯">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteSchedule(schedule.id)} className="p-1 text-gray-500 hover:text-red-600" title="刪除">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>尚未建立任何排程</p>
                <p className="text-sm mt-1">點擊「新增排程」設定自動發送</p>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">發送記錄</h2>
              <button
                onClick={handleLoadMessages}
                disabled={isLoadingMessages}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingMessages ? 'animate-spin' : ''}`} /> 重新整理
              </button>
            </div>

            {isLoadingMessages ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-brand-primary-500" />
                <p className="text-gray-500">載入中...</p>
              </div>
            ) : messages.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">時間</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">對象</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">類型</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">內容</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">狀態</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {messages.map((msg) => (
                      <tr key={msg.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{msg.sent_at || msg.created_at}</td>
                        <td className="px-4 py-3 font-medium">{msg.recipient_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{msg.recipient_type === 'group' ? '群組' : '個人'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{msg.content}</td>
                        <td className="px-4 py-3 text-center">
                          {getStatusBadge(msg.status)}
                          {msg.error_message && <p className="text-xs text-red-500 mt-1">{msg.error_message}</p>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {deletingMessageId === msg.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleDeleteMessage(msg.id)} className="p-1.5 bg-red-500 text-white rounded hover:bg-red-600" title="確認刪除">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setDeletingMessageId(null)} className="p-1.5 bg-gray-300 text-gray-700 rounded hover:bg-gray-400" title="取消">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setDeletingMessageId(msg.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="刪除">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
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
            <h3 className="text-lg font-semibold mb-4">{editingGroup ? '編輯群組' : '新增群組'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">群組名稱 *</label>
                <input
                  type="text"
                  value={groupForm.group_name}
                  onChange={(e) => setGroupForm({ ...groupForm, group_name: e.target.value })}
                  placeholder="例：智慧媽咪內部群組"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group ID *</label>
                <input
                  type="text"
                  value={groupForm.group_id}
                  onChange={(e) => setGroupForm({ ...groupForm, group_id: e.target.value })}
                  placeholder="C1234567890..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">在 LINE 群組輸入 <code className="bg-gray-100 px-1 rounded">groupid</code> 可取得</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">類型</label>
                <select
                  value={groupForm.group_type}
                  onChange={(e) => setGroupForm({ ...groupForm, group_type: e.target.value as 'group' | 'room' | 'user' })}
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
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  placeholder="選填"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowGroupModal(false)} disabled={isSavingGroup} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">取消</button>
              <button onClick={handleSaveGroup} disabled={isSavingGroup} className="flex-1 py-2 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {isSavingGroup && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isSavingGroup ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4">{editingTemplate ? '編輯模板' : '新增模板'}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">模板名稱 *</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="例：請款通知"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分類</label>
                  <input
                    type="text"
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                    placeholder="例：請款、發票"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模板內容 *</label>
                <textarea
                  value={templateForm.content}
                  onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                  placeholder="使用 {{變數名稱}} 來插入動態內容"
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">可用變數：{`{{customer_name}}`}, {`{{amount}}`}, {`{{due_date}}`}, {`{{invoice_number}}`} 等</p>
              </div>

              {/* 即時預覽解析出的變數 */}
              {templateForm.content && extractVariables(templateForm.content).length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-2">偵測到的變數：</p>
                  <div className="flex flex-wrap gap-2">
                    {extractVariables(templateForm.content).map((v) => (
                      <span key={v} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-mono">{`{{${v}}}`}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowTemplateModal(false)} disabled={isSavingTemplate} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">取消</button>
              <button onClick={handleSaveTemplate} disabled={isSavingTemplate} className="flex-1 py-2 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {isSavingTemplate && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isSavingTemplate ? '儲存中...' : '儲存'}
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
              <button onClick={() => setPreviewTemplate(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-[#7B8D93] rounded-2xl p-4">
              <div className="bg-[#8DE055] rounded-2xl rounded-tr-sm p-3 max-w-[90%] ml-auto text-sm whitespace-pre-line">{previewTemplate.content}</div>
            </div>
            {(() => {
              const vars = getTemplateVariables(previewTemplate);
              if (vars.length === 0) return null;
              return (
                <div className="mt-4">
                  <p className="text-sm text-gray-500 mb-2">可用變數：</p>
                  <div className="flex flex-wrap gap-2">
                    {vars.map((v) => (
                      <span key={v} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-mono">{`{{${v}}}`}</span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editingSchedule ? '編輯排程' : '新增排程'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">排程名稱 *</label>
                <input
                  type="text"
                  value={scheduleForm.name}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                  placeholder="例：每月請款通知"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">發送對象 *</label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={scheduleForm.recipient_type === 'group'} onChange={() => setScheduleForm({ ...scheduleForm, recipient_type: 'group', recipient_id: '', recipient_name: '' })} className="text-brand-primary-600" />
                    <span>群組</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={scheduleForm.recipient_type === 'user'} onChange={() => setScheduleForm({ ...scheduleForm, recipient_type: 'user', recipient_id: '', recipient_name: '' })} className="text-brand-primary-600" />
                    <span>個人</span>
                  </label>
                </div>
                {scheduleForm.recipient_type === 'group' ? (
                  <select
                    value={scheduleForm.recipient_id}
                    onChange={(e) => {
                      const selectedGroup = groups.find(g => g.group_id === e.target.value);
                      setScheduleForm({ ...scheduleForm, recipient_id: e.target.value, recipient_name: selectedGroup?.group_name || '' });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                  >
                    <option value="">請選擇群組...</option>
                    {groups.filter(g => g.is_active).map((g) => (
                      <option key={g.id} value={g.group_id}>{g.group_name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={scheduleForm.recipient_id}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, recipient_id: e.target.value })}
                    placeholder="輸入 LINE User ID (U...)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500 font-mono"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">訊息內容 *</label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={scheduleForm.use_template} onChange={() => setScheduleForm({ ...scheduleForm, use_template: true })} className="text-brand-primary-600" />
                    <span>使用模板</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={!scheduleForm.use_template} onChange={() => setScheduleForm({ ...scheduleForm, use_template: false })} className="text-brand-primary-600" />
                    <span>自訂內容</span>
                  </label>
                </div>
                {scheduleForm.use_template ? (
                  <>
                    <select
                      value={scheduleForm.template_id}
                      onChange={(e) => {
                        setScheduleForm({ ...scheduleForm, template_id: e.target.value });
                        const selectedTemplate = templates.find(t => t.id === e.target.value);
                        if (selectedTemplate) {
                          const vars = getTemplateVariables(selectedTemplate);
                          const varsObj: Record<string, string> = {};
                          vars.forEach(v => { varsObj[v] = ''; });
                          setScheduleVariables(varsObj);
                        } else {
                          setScheduleVariables({});
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                    >
                      <option value="">選擇模板...</option>
                      {templates.filter(t => t.is_active).map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>

                    {scheduleForm.template_id && (() => {
                      const selectedTemplate = templates.find(t => t.id === scheduleForm.template_id);
                      if (!selectedTemplate) return null;
                      const vars = getTemplateVariables(selectedTemplate);
                      if (vars.length === 0) return null;
                      return (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-3">
                          <p className="text-sm font-medium text-gray-700">填入模板變數：</p>
                          <p className="text-xs text-gray-500">提示：週期排程的變數值會在每次發送時使用相同值</p>
                          {vars.map((varName) => (
                            <div key={varName}>
                              <label className="block text-xs text-gray-500 mb-1">{`{{${varName}}}`}</label>
                              <input
                                type="text"
                                value={scheduleVariables[varName] || ''}
                                onChange={(e) => setScheduleVariables({ ...scheduleVariables, [varName]: e.target.value })}
                                placeholder={getVariablePlaceholder(varName)}
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <textarea
                    value={scheduleForm.custom_content}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, custom_content: e.target.value })}
                    placeholder="輸入訊息內容..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">排程類型 *</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'once', label: '單次' },
                    { value: 'daily', label: '每日' },
                    { value: 'weekly', label: '每週' },
                    { value: 'biweekly', label: '每兩週' },
                    { value: 'monthly', label: '每月' },
                    { value: 'twice_monthly', label: '每月2次' },
                    { value: 'yearly', label: '每年' }
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setScheduleForm({ ...scheduleForm, schedule_type: type.value as any })}
                      className={`px-3 py-2 rounded-lg border text-sm ${scheduleForm.schedule_type === type.value ? 'bg-brand-primary-600 text-white border-brand-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {scheduleForm.schedule_type === 'once' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">發送時間 *</label>
                  <input type="datetime-local" value={scheduleForm.scheduled_at} onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_at: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500" />
                </div>
              )}

              {scheduleForm.schedule_type === 'daily' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">每日發送時間</label>
                  <input type="time" value={scheduleForm.schedule_time} onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_time: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500" />
                </div>
              )}

              {(scheduleForm.schedule_type === 'weekly' || scheduleForm.schedule_type === 'biweekly') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{scheduleForm.schedule_type === 'weekly' ? '每週幾' : '每兩週的週幾'}</label>
                    <select value={scheduleForm.schedule_day_of_week} onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_day_of_week: parseInt(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500">
                      <option value={0}>週日</option>
                      <option value={1}>週一</option>
                      <option value={2}>週二</option>
                      <option value={3}>週三</option>
                      <option value={4}>週四</option>
                      <option value={5}>週五</option>
                      <option value={6}>週六</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">發送時間</label>
                    <input type="time" value={scheduleForm.schedule_time} onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_time: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500" />
                  </div>
                </div>
              )}

              {scheduleForm.schedule_type === 'monthly' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">每月幾號</label>
                    <select value={scheduleForm.schedule_day_of_month} onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_day_of_month: parseInt(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (<option key={day} value={day}>{day} 日</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">發送時間</label>
                    <input type="time" value={scheduleForm.schedule_time} onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_time: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500" />
                  </div>
                </div>
              )}

              {scheduleForm.schedule_type === 'twice_monthly' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">第一個日期</label>
                      <select value={scheduleForm.schedule_day_of_month} onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_day_of_month: parseInt(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (<option key={day} value={day}>{day} 日</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">第二個日期</label>
                      <select value={scheduleForm.schedule_day_of_month_2} onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_day_of_month_2: parseInt(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (<option key={day} value={day}>{day} 日</option>))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">發送時間</label>
                    <input type="time" value={scheduleForm.schedule_time} onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_time: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500" />
                  </div>
                </div>
              )}

              {scheduleForm.schedule_type === 'yearly' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">月份</label>
                      <select value={scheduleForm.schedule_month} onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_month: parseInt(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (<option key={month} value={month}>{month} 月</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                      <select value={scheduleForm.schedule_day_of_month} onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_day_of_month: parseInt(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (<option key={day} value={day}>{day} 日</option>))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">發送時間</label>
                    <input type="time" value={scheduleForm.schedule_time} onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_time: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary-500" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowScheduleModal(false)} disabled={isSavingSchedule} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">取消</button>
              <button onClick={handleSaveSchedule} disabled={isSavingSchedule} className="flex-1 py-2 bg-brand-primary-600 text-white rounded-lg hover:bg-brand-primary-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {isSavingSchedule && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isSavingSchedule ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}