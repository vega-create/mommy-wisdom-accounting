/**
 * LINE Messaging API 服務層
 * 用於發送 LINE 訊息、管理群組、處理模板等
 */

const LINE_API_URL = 'https://api.line.me/v2/bot';

// =====================================================
// 類型定義
// =====================================================

export interface LineSettings {
  id: string;
  company_id: string;
  channel_access_token: string | null;
  channel_secret: string | null;
  is_active: boolean;
  auto_notify_invoice_issued: boolean;
  auto_notify_payment_received: boolean;
  auto_notify_payment_received_admin: boolean;
  auto_notify_labor_sign: boolean;
  auto_notify_labor_signed: boolean;
  auto_notify_labor_paid: boolean;
  auto_notify_contract_signed: boolean;
  auto_notify_contract_expiry: boolean;
  auto_notify_payment_due: boolean;
}

export interface LineGroup {
  id: string;
  company_id: string;
  name: string;
  line_group_id: string;
  description: string | null;
  is_active: boolean;
}

export interface LineTemplate {
  id: string;
  company_id: string;
  name: string;
  module: string | null;
  event_type: string | null;
  content: string;
  is_default: boolean;
  is_active: boolean;
}

export interface LineMessage {
  id: string;
  company_id: string;
  template_id: string | null;
  recipient_type: 'customer' | 'group' | 'freelancer' | 'admin';
  recipient_id: string | null;
  line_id: string | null;
  recipient_name: string | null;
  message_content: string;
  trigger_type: 'manual' | 'auto' | 'ai_agent';
  module: string | null;
  reference_type: string | null;
  reference_id: string | null;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SendMessageParams {
  lineId: string;
  message: string;
  accessToken: string;
}

export interface SendMessageResult {
  success: boolean;
  error?: string;
}

export interface TemplateVariables {
  [key: string]: string | number | undefined;
}

// =====================================================
// LINE API 核心功能
// =====================================================

/**
 * 發送 LINE 訊息（Push Message）
 */
export async function sendLineMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const { lineId, message, accessToken } = params;

  if (!accessToken) {
    return { success: false, error: 'LINE Access Token 未設定' };
  }

  if (!lineId) {
    return { success: false, error: 'LINE ID 未提供' };
  }

  try {
    const response = await fetch(`${LINE_API_URL}/message/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: lineId,
        messages: [
          {
            type: 'text',
            text: message,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('LINE API Error:', errorData);
      return { 
        success: false, 
        error: errorData.message || `HTTP ${response.status}: ${response.statusText}` 
      };
    }

    return { success: true };
  } catch (error) {
    console.error('LINE API Exception:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '發送失敗' 
    };
  }
}

/**
 * 發送多則訊息
 */
export async function sendLineMultipleMessages(
  lineId: string,
  messages: string[],
  accessToken: string
): Promise<SendMessageResult> {
  if (!accessToken) {
    return { success: false, error: 'LINE Access Token 未設定' };
  }

  try {
    const response = await fetch(`${LINE_API_URL}/message/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: lineId,
        messages: messages.slice(0, 5).map(text => ({ type: 'text', text })), // LINE 限制最多 5 則
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.message || 'Failed to send messages' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * 測試 LINE API 連線
 */
export async function testLineConnection(accessToken: string): Promise<{
  success: boolean;
  botInfo?: { displayName: string; userId: string };
  error?: string;
}> {
  if (!accessToken) {
    return { success: false, error: 'Access Token 未提供' };
  }

  try {
    const response = await fetch(`${LINE_API_URL}/info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.message || `HTTP ${response.status}` };
    }

    const botInfo = await response.json();
    return { 
      success: true, 
      botInfo: {
        displayName: botInfo.displayName,
        userId: botInfo.userId,
      }
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '連線失敗' };
  }
}

/**
 * 取得用戶資料
 */
export async function getLineUserProfile(
  userId: string, 
  accessToken: string
): Promise<{
  success: boolean;
  profile?: { displayName: string; userId: string; pictureUrl?: string };
  error?: string;
}> {
  try {
    const response = await fetch(`${LINE_API_URL}/profile/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const profile = await response.json();
    return { success: true, profile };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed' };
  }
}

// =====================================================
// 模板處理
// =====================================================

/**
 * 替換模板變數
 * 支援 {{variable}} 格式
 */
export function replaceTemplateVariables(
  template: string,
  variables: TemplateVariables
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value?.toString() || '');
  }

  // 移除未替換的變數
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  return result.trim();
}

/**
 * 提取模板中的變數名稱
 */
export function extractTemplateVariables(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}

// =====================================================
// 通知功能（業務邏輯）
// =====================================================

/**
 * 發送請款通知
 */
export async function sendBillingNotification(params: {
  accessToken: string;
  customerLineId: string;
  template: string;
  variables: {
    customer_title: string;
    customer_name: string;
    billing_period: string;
    service_description: string;
    amount: string;
    due_date: string;
    bank_name: string;
    bank_code: string;
    account_number: string;
    account_name: string;
    custom_notes?: string;
  };
}): Promise<SendMessageResult> {
  const { accessToken, customerLineId, template, variables } = params;
  const message = replaceTemplateVariables(template, variables);
  return sendLineMessage({ lineId: customerLineId, message, accessToken });
}

/**
 * 發送收款確認通知
 */
export async function sendPaymentReceivedNotification(params: {
  accessToken: string;
  customerLineId: string;
  template: string;
  variables: {
    customer_name: string;
    amount: string;
  };
}): Promise<SendMessageResult> {
  const { accessToken, customerLineId, template, variables } = params;
  const message = replaceTemplateVariables(template, variables);
  return sendLineMessage({ lineId: customerLineId, message, accessToken });
}

/**
 * 發送發票通知
 */
export async function sendInvoiceNotification(params: {
  accessToken: string;
  customerLineId: string;
  template: string;
  variables: {
    customer_name: string;
    invoice_number: string;
    amount: string;
  };
}): Promise<SendMessageResult> {
  const { accessToken, customerLineId, template, variables } = params;
  const message = replaceTemplateVariables(template, variables);
  return sendLineMessage({ lineId: customerLineId, message, accessToken });
}

/**
 * 發送勞報單簽署通知
 */
export async function sendLaborSignNotification(params: {
  accessToken: string;
  freelancerLineId: string;
  template: string;
  variables: {
    freelancer_name: string;
    period: string;
    amount: string;
    sign_url: string;
  };
}): Promise<SendMessageResult> {
  const { accessToken, freelancerLineId, template, variables } = params;
  const message = replaceTemplateVariables(template, variables);
  return sendLineMessage({ lineId: freelancerLineId, message, accessToken });
}

/**
 * 發送群組訊息
 */
export async function sendGroupMessage(params: {
  accessToken: string;
  groupId: string;
  message: string;
}): Promise<SendMessageResult> {
  return sendLineMessage({
    lineId: params.groupId,
    message: params.message,
    accessToken: params.accessToken,
  });
}

// =====================================================
// 工具函數
// =====================================================

/**
 * 格式化金額（加入千分位）
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('zh-TW');
}

/**
 * 格式化日期 (MM/DD)
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

/**
 * 格式化日期 (YYYY/MM/DD)
 */
export function formatDateFull(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * 取得期間字串（如「2026年01月」）
 */
export function getPeriodString(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}年${month}月`;
}

// =====================================================
// 預設模板
// =====================================================

export const DEFAULT_TEMPLATES = {
  billing: {
    payment_request: `親愛的{{customer_title}}您好，
這是{{billing_period}}的費用提醒通知。

{{service_description}}
總金額{{amount}}元

請{{due_date}}前匯款至：
{{bank_name}} {{bank_code}}
帳號：{{account_number}}
戶名：{{account_name}}

*發票將於收到款項後3日內提供，感謝您的合作。
{{custom_notes}}`,

    payment_received: `✅ 收款確認

{{customer_name}} 您好，
已收到您的款項 NT${{amount}}，
感謝您的支持！`,

    payment_received_admin: `💰 收款通知

{{customer_name}} 已付款
金額：NT${{amount}}
帳戶：{{bank_account}}`,
  },

  invoice: {
    issued: `📄 發票通知

{{customer_name}} 您好，
發票號碼：{{invoice_number}}
金額：NT${{amount}}
已開立完成。

電子發票已寄至您的信箱。`,

    voided: `❌ 發票作廢通知

{{customer_name}} 您好，
發票 {{invoice_number}} 已作廢。

如有疑問請與我們聯繫。`,
  },

  labor: {
    sign_request: `📋 勞報單簽署

{{freelancer_name}} 您好，
{{period}} 勞報單已建立，
金額：NT${{amount}}

請點擊連結完成簽署：
{{sign_url}}`,

    signed: `✅ 簽署完成

{{freelancer_name}} 您好，
{{period}} 勞報單已簽署完成，
等待公司撥款。`,

    signed_admin: `✅ 簽署通知

{{freelancer_name}} 已完成
{{period}} 勞報單簽署
金額：NT${{amount}}`,

    paid: `💸 匯款通知

{{freelancer_name}} 您好，
{{period}} 報酬 NT${{amount}}
已匯入您的帳戶。`,
  },

  contract: {
    sign_request: `📝 合約簽署

{{customer_name}} 您好，
合約 {{contract_number}} 已建立，

請點擊連結完成簽署：
{{sign_url}}`,

    signed: `✅ 合約生效

{{customer_name}} 您好，
合約 {{contract_number}} 已生效，
感謝您的信任！`,

    signed_admin: `✅ 合約簽署

{{customer_name}} 已簽署合約 {{contract_number}}
金額：NT${{amount}}`,

    expiry_reminder: `📅 合約到期提醒

{{customer_name}} 您好，
合約 {{contract_number}} 將於 {{days}} 天後到期（{{end_date}}）。

如需續約請與我們聯繫。`,

    payment_reminder: `💳 付款提醒

{{customer_name}} 您好，
{{description}} NT${{amount}}
付款日：{{due_date}}

請準時付款，謝謝！`,
  },

  payable: {
    due_reminder: `💳 付款提醒

明天需付款：
對象：{{vendor_name}}
金額：NT${{amount}}
來源：{{source_description}}`,
  },
};
