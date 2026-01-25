-- =====================================================
-- Phase 2: 客戶管理擴充
-- 新增 LINE 通知、請款設定、外包分類相關欄位
-- =====================================================

-- 擴充 acct_customers 表
ALTER TABLE acct_customers
ADD COLUMN IF NOT EXISTS line_user_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS line_display_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS preferred_title VARCHAR(50),
ADD COLUMN IF NOT EXISTS vendor_type VARCHAR(20) DEFAULT 'company',
ADD COLUMN IF NOT EXISTS can_issue_invoice BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS billing_contact_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS billing_email VARCHAR(100),
ADD COLUMN IF NOT EXISTS line_notify_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS payment_terms INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(15,2) DEFAULT 0;

-- 新增約束
ALTER TABLE acct_customers
ADD CONSTRAINT IF NOT EXISTS chk_vendor_type CHECK (vendor_type IN ('company', 'individual'));

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_customers_line_user ON acct_customers(line_user_id) WHERE line_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_vendor_type ON acct_customers(vendor_type) WHERE customer_type IN ('vendor', 'both');
CREATE INDEX IF NOT EXISTS idx_customers_line_notify ON acct_customers(line_notify_enabled) WHERE line_notify_enabled = true;

-- 欄位說明
COMMENT ON COLUMN acct_customers.line_user_id IS 'LINE User ID，用於發送 LINE 通知';
COMMENT ON COLUMN acct_customers.line_display_name IS 'LINE 顯示名稱';
COMMENT ON COLUMN acct_customers.preferred_title IS '稱呼（如：王總、李經理）';
COMMENT ON COLUMN acct_customers.vendor_type IS '廠商類型：company=公司, individual=個人';
COMMENT ON COLUMN acct_customers.can_issue_invoice IS '廠商是否會開發票給我們';
COMMENT ON COLUMN acct_customers.billing_contact_name IS '請款聯絡人';
COMMENT ON COLUMN acct_customers.billing_email IS '請款 Email';
COMMENT ON COLUMN acct_customers.line_notify_enabled IS '是否啟用 LINE 通知';
COMMENT ON COLUMN acct_customers.payment_terms IS '付款條件（天數）';
COMMENT ON COLUMN acct_customers.credit_limit IS '信用額度（0=無限制）';

-- =====================================================
-- 公司收款帳戶表
-- 用於請款通知顯示收款資訊
-- =====================================================
CREATE TABLE IF NOT EXISTS acct_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  
  -- 帳戶資訊
  bank_code VARCHAR(10) NOT NULL,
  bank_name VARCHAR(50) NOT NULL,
  branch_name VARCHAR(50),
  account_number VARCHAR(30) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  
  -- 設定
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_payment_accounts_company ON acct_payment_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_default ON acct_payment_accounts(company_id, is_default) WHERE is_default = true;

-- 更新時間觸發器
DROP TRIGGER IF EXISTS update_payment_accounts_updated_at ON acct_payment_accounts;
CREATE TRIGGER update_payment_accounts_updated_at
  BEFORE UPDATE ON acct_payment_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE acct_payment_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_accounts_select ON acct_payment_accounts;
CREATE POLICY payment_accounts_select ON acct_payment_accounts FOR SELECT
  USING (company_id IN (SELECT company_id FROM acct_user_companies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS payment_accounts_insert ON acct_payment_accounts;
CREATE POLICY payment_accounts_insert ON acct_payment_accounts FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM acct_user_companies WHERE user_id = auth.uid() AND role IN ('admin', 'accountant')));

DROP POLICY IF EXISTS payment_accounts_update ON acct_payment_accounts;
CREATE POLICY payment_accounts_update ON acct_payment_accounts FOR UPDATE
  USING (company_id IN (SELECT company_id FROM acct_user_companies WHERE user_id = auth.uid() AND role IN ('admin', 'accountant')));

DROP POLICY IF EXISTS payment_accounts_delete ON acct_payment_accounts;
CREATE POLICY payment_accounts_delete ON acct_payment_accounts FOR DELETE
  USING (company_id IN (SELECT company_id FROM acct_user_companies WHERE user_id = auth.uid() AND role = 'admin'));

-- 表說明
COMMENT ON TABLE acct_payment_accounts IS '公司收款帳戶，用於請款通知時顯示收款資訊';

-- =====================================================
-- 預設收款帳戶（智慧媽咪）
-- =====================================================
INSERT INTO acct_payment_accounts (company_id, bank_code, bank_name, branch_name, account_number, account_name, is_default)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '500', '彰化銀行', '中港分行', '5765-01-009935-00', '智慧媽咪國際有限公司', true)
ON CONFLICT DO NOTHING;

SELECT 'Phase 2 客戶管理擴充完成！' AS status;
