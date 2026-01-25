-- =====================================================
-- Phase 1: LINE 核心基礎 - 資料庫表
-- =====================================================

-- =====================================================
-- 1. LINE 設定表（每公司一組）
-- =====================================================
CREATE TABLE IF NOT EXISTS acct_line_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES acct_companies(id) ON DELETE CASCADE,
  channel_access_token TEXT,
  channel_secret TEXT,
  is_active BOOLEAN DEFAULT true,
  -- 自動通知開關（未來各模組使用）
  auto_notify_invoice_issued BOOLEAN DEFAULT true,
  auto_notify_invoice_voided BOOLEAN DEFAULT true,
  auto_notify_payment_received BOOLEAN DEFAULT true,
  auto_notify_payment_received_admin BOOLEAN DEFAULT true,
  auto_notify_labor_sign BOOLEAN DEFAULT true,
  auto_notify_labor_signed BOOLEAN DEFAULT true,
  auto_notify_labor_paid BOOLEAN DEFAULT true,
  auto_notify_contract_signed BOOLEAN DEFAULT true,
  auto_notify_contract_expiry BOOLEAN DEFAULT true,
  auto_notify_payment_due BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

-- =====================================================
-- 2. LINE 群組表
-- =====================================================
CREATE TABLE IF NOT EXISTS acct_line_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES acct_companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  line_group_id VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. LINE 訊息模板表
-- =====================================================
CREATE TABLE IF NOT EXISTS acct_line_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES acct_companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  module VARCHAR(50),              -- 'billing', 'invoice', 'labor', 'contract', 'general'
  event_type VARCHAR(50),          -- 'payment_request', 'issued', 'signed', etc.
  content TEXT NOT NULL,           -- 支援 {{變數}}
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. LINE 發送記錄表
-- =====================================================
CREATE TABLE IF NOT EXISTS acct_line_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES acct_companies(id) ON DELETE CASCADE,
  template_id UUID REFERENCES acct_line_templates(id) ON DELETE SET NULL,
  recipient_type VARCHAR(20) NOT NULL,  -- 'customer', 'group', 'freelancer', 'admin'
  recipient_id UUID,                     -- customer_id, group_id, etc.
  line_id VARCHAR(50),                   -- 實際的 LINE User/Group ID
  recipient_name VARCHAR(100),
  message_content TEXT NOT NULL,
  trigger_type VARCHAR(20) DEFAULT 'manual',  -- 'manual', 'auto', 'ai_agent'
  module VARCHAR(50),                    -- 來源模組
  reference_type VARCHAR(50),            -- 'billing_request', 'invoice', etc.
  reference_id UUID,
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'sent', 'failed'
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES acct_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. 客戶表擴充欄位（LINE 相關）
-- =====================================================
-- 檢查並添加欄位
DO $$ 
BEGIN
  -- line_user_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'acct_customers' AND column_name = 'line_user_id') THEN
    ALTER TABLE acct_customers ADD COLUMN line_user_id VARCHAR(50);
  END IF;
  
  -- line_display_name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'acct_customers' AND column_name = 'line_display_name') THEN
    ALTER TABLE acct_customers ADD COLUMN line_display_name VARCHAR(100);
  END IF;
  
  -- line_notify_enabled
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'acct_customers' AND column_name = 'line_notify_enabled') THEN
    ALTER TABLE acct_customers ADD COLUMN line_notify_enabled BOOLEAN DEFAULT true;
  END IF;
  
  -- preferred_title (稱呼)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'acct_customers' AND column_name = 'preferred_title') THEN
    ALTER TABLE acct_customers ADD COLUMN preferred_title VARCHAR(50);
  END IF;
  
  -- vendor_type (外包類型)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'acct_customers' AND column_name = 'vendor_type') THEN
    ALTER TABLE acct_customers ADD COLUMN vendor_type VARCHAR(20);
  END IF;
  
  -- can_issue_invoice (外包公司是否會開發票)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'acct_customers' AND column_name = 'can_issue_invoice') THEN
    ALTER TABLE acct_customers ADD COLUMN can_issue_invoice BOOLEAN DEFAULT false;
  END IF;
  
  -- billing_contact_name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'acct_customers' AND column_name = 'billing_contact_name') THEN
    ALTER TABLE acct_customers ADD COLUMN billing_contact_name VARCHAR(100);
  END IF;
  
  -- billing_email
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'acct_customers' AND column_name = 'billing_email') THEN
    ALTER TABLE acct_customers ADD COLUMN billing_email VARCHAR(255);
  END IF;
END $$;

-- =====================================================
-- 6. 公司收款帳戶表
-- =====================================================
CREATE TABLE IF NOT EXISTS acct_payment_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES acct_companies(id) ON DELETE CASCADE,
  bank_code VARCHAR(10) NOT NULL,
  bank_name VARCHAR(50) NOT NULL,
  branch_name VARCHAR(50),
  account_number VARCHAR(30) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 索引
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_line_settings_company ON acct_line_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_line_groups_company ON acct_line_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_line_templates_company ON acct_line_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_line_templates_module ON acct_line_templates(module);
CREATE INDEX IF NOT EXISTS idx_line_messages_company ON acct_line_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_line_messages_status ON acct_line_messages(status);
CREATE INDEX IF NOT EXISTS idx_line_messages_sent_at ON acct_line_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_company ON acct_payment_accounts(company_id);

-- =====================================================
-- RLS 政策
-- =====================================================
ALTER TABLE acct_line_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_line_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_line_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_line_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_payment_accounts ENABLE ROW LEVEL SECURITY;

-- LINE 設定
CREATE POLICY "Users can view company line settings" ON acct_line_settings
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Admins can manage line settings" ON acct_line_settings
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
      AND role = 'admin'
    )
  );

-- LINE 群組
CREATE POLICY "Users can view company line groups" ON acct_line_groups
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Admins can manage line groups" ON acct_line_groups
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
      AND role IN ('admin', 'accountant')
    )
  );

-- LINE 模板
CREATE POLICY "Users can view company line templates" ON acct_line_templates
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Admins can manage line templates" ON acct_line_templates
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
      AND role IN ('admin', 'accountant')
    )
  );

-- LINE 訊息記錄
CREATE POLICY "Users can view company line messages" ON acct_line_messages
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Accountants can manage line messages" ON acct_line_messages
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
      AND role IN ('admin', 'accountant')
    )
  );

-- 收款帳戶
CREATE POLICY "Users can view company payment accounts" ON acct_payment_accounts
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Admins can manage payment accounts" ON acct_payment_accounts
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
      AND role = 'admin'
    )
  );

-- =====================================================
-- 觸發器
-- =====================================================
CREATE TRIGGER update_acct_line_settings_updated_at BEFORE UPDATE ON acct_line_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_acct_line_groups_updated_at BEFORE UPDATE ON acct_line_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_acct_line_templates_updated_at BEFORE UPDATE ON acct_line_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_acct_payment_accounts_updated_at BEFORE UPDATE ON acct_payment_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 預設模板
-- =====================================================
INSERT INTO acct_line_templates (company_id, name, module, event_type, content, is_default) VALUES
-- 智慧媽咪
('00000000-0000-0000-0000-000000000001', '標準請款通知', 'billing', 'payment_request', 
'親愛的{{customer_title}}您好，
這是{{billing_period}}的費用提醒通知。

{{service_description}}
總金額{{amount}}元

請{{due_date}}前匯款至：
{{bank_name}} {{bank_code}}
帳號：{{account_number}}
戶名：{{account_name}}

*發票將於收到款項後3日內提供，感謝您的合作。
{{custom_notes}}', true),

('00000000-0000-0000-0000-000000000001', '收款確認通知', 'billing', 'payment_received', 
'✅ 收款確認

{{customer_name}} 您好，
已收到您的款項 NT${{amount}}，
感謝您的支持！', true),

('00000000-0000-0000-0000-000000000001', '收款通知（管理員）', 'billing', 'payment_received_admin', 
'💰 收款通知

{{customer_name}} 已付款
金額：NT${{amount}}
帳戶：{{bank_account}}', true),

('00000000-0000-0000-0000-000000000001', '發票開立通知', 'invoice', 'issued', 
'📄 發票通知

{{customer_name}} 您好，
發票號碼：{{invoice_number}}
金額：NT${{amount}}
已開立完成。

電子發票已寄至您的信箱。', true),

('00000000-0000-0000-0000-000000000001', '勞報單簽署請求', 'labor', 'sign_request', 
'📋 勞報單簽署

{{freelancer_name}} 您好，
{{period}} 勞報單已建立，
金額：NT${{amount}}

請點擊連結完成簽署：
{{sign_url}}', true),

('00000000-0000-0000-0000-000000000001', '勞報單簽署完成', 'labor', 'signed', 
'✅ 簽署完成

{{freelancer_name}} 您好，
{{period}} 勞報單已簽署完成，
等待公司撥款。', true),

('00000000-0000-0000-0000-000000000001', '匯款完成通知', 'labor', 'paid', 
'💸 匯款通知

{{freelancer_name}} 您好，
{{period}} 報酬 NT${{amount}}
已匯入您的帳戶。', true),

('00000000-0000-0000-0000-000000000001', '合約簽署請求', 'contract', 'sign_request', 
'📝 合約簽署

{{customer_name}} 您好，
合約 {{contract_number}} 已建立，

請點擊連結完成簽署：
{{sign_url}}', true),

('00000000-0000-0000-0000-000000000001', '合約到期提醒', 'contract', 'expiry_reminder', 
'📅 合約到期提醒

{{customer_name}} 您好，
合約 {{contract_number}} 將於 {{days}} 天後到期（{{end_date}}）。

如需續約請與我們聯繫。', true),

-- 薇佳工作室（複製一份）
('00000000-0000-0000-0000-000000000002', '標準請款通知', 'billing', 'payment_request', 
'親愛的{{customer_title}}您好，
這是{{billing_period}}的費用提醒通知。

{{service_description}}
總金額{{amount}}元

請{{due_date}}前匯款至：
{{bank_name}} {{bank_code}}
帳號：{{account_number}}
戶名：{{account_name}}

*發票將於收到款項後3日內提供，感謝您的合作。
{{custom_notes}}', true),

('00000000-0000-0000-0000-000000000002', '收款確認通知', 'billing', 'payment_received', 
'✅ 收款確認

{{customer_name}} 您好，
已收到您的款項 NT${{amount}}，
感謝您的支持！', true)

ON CONFLICT DO NOTHING;

-- =====================================================
-- 完成！
-- =====================================================
SELECT 'Phase 1: LINE 核心基礎資料表建立完成！' AS status;
