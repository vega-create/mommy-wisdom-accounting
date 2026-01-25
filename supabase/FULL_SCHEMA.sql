-- =====================================================
-- 智慧媽咪商業管理系統 - 完整資料庫結構
-- Mommy Wisdom Business Management System
-- 
-- 版本: v2.0
-- 建立日期: 2026-01-24
-- 
-- 執行方式：在 Supabase SQL Editor 中一次執行
-- =====================================================

-- =====================================================
-- 🔧 PART 0: 基礎設定
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 自動更新 updated_at 函數
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';


-- =====================================================
-- 🏢 PART 1: 公司與用戶
-- =====================================================

-- 公司表
CREATE TABLE IF NOT EXISTS acct_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  tax_id VARCHAR(20),
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  logo_url TEXT,
  fiscal_year_start INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用戶表
CREATE TABLE IF NOT EXISTS acct_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'accountant', 'pm', 'employee', 'viewer')),
  company_id UUID REFERENCES acct_companies(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用戶-公司關聯表（支援一個用戶多個公司）
CREATE TABLE IF NOT EXISTS acct_user_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES acct_users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES acct_companies(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'accountant', 'pm', 'employee', 'viewer')),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);


-- =====================================================
-- 📊 PART 2: 會計科目
-- =====================================================

-- 會計科目表
CREATE TABLE IF NOT EXISTS acct_chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'cost', 'expense')),
  parent_id UUID REFERENCES acct_chart_of_accounts(id),
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- 預設會計科目 (會在公司建立時自動插入)
CREATE OR REPLACE FUNCTION create_default_chart_of_accounts(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO acct_chart_of_accounts (company_id, code, name, type, is_system) VALUES
  -- 資產類
  (p_company_id, '1100', '現金', 'asset', true),
  (p_company_id, '1110', '銀行存款', 'asset', true),
  (p_company_id, '1120', '零用金', 'asset', true),
  (p_company_id, '1200', '應收帳款', 'asset', true),
  (p_company_id, '1400', '存出保證金', 'asset', true),
  (p_company_id, '1500', '固定資產', 'asset', true),
  -- 負債類
  (p_company_id, '2100', '短期借款', 'liability', true),
  (p_company_id, '2200', '應付帳款', 'liability', true),
  (p_company_id, '2300', '預收款項', 'liability', true),
  -- 權益類
  (p_company_id, '3100', '股本', 'equity', true),
  (p_company_id, '3200', '保留盈餘', 'equity', true),
  -- 收入類
  (p_company_id, '4100', '服務收入', 'revenue', true),
  (p_company_id, '4110', '商品銷售收入', 'revenue', true),
  (p_company_id, '4200', '利息收入', 'revenue', true),
  (p_company_id, '4900', '其他收入', 'revenue', true),
  -- 成本類
  (p_company_id, '5100', '外包成本', 'cost', true),
  (p_company_id, '5110', '進貨成本', 'cost', true),
  (p_company_id, '5120', '原料成本', 'cost', true),
  -- 費用類
  (p_company_id, '6010', '薪資支出', 'expense', true),
  (p_company_id, '6015', '勞務費', 'expense', true),
  (p_company_id, '6020', '勞健保費', 'expense', true),
  (p_company_id, '6030', '獎金支出', 'expense', true),
  (p_company_id, '6040', '旅費', 'expense', true),
  (p_company_id, '6050', '文具用品', 'expense', true),
  (p_company_id, '6060', '郵電費', 'expense', true),
  (p_company_id, '6070', '水電瓦斯', 'expense', true),
  (p_company_id, '6080', '廣告費', 'expense', true),
  (p_company_id, '6090', '佣金支出', 'expense', true),
  (p_company_id, '6100', '租金支出', 'expense', true),
  (p_company_id, '6110', '交際費', 'expense', true),
  (p_company_id, '6120', '修繕費', 'expense', true),
  (p_company_id, '6130', '保險費', 'expense', true),
  (p_company_id, '6140', '手續費', 'expense', true),
  (p_company_id, '6150', '稅捐', 'expense', true),
  (p_company_id, '6160', '規費', 'expense', true),
  (p_company_id, '6170', '折舊費用', 'expense', true),
  (p_company_id, '6180', '攤銷費用', 'expense', true),
  (p_company_id, '6900', '雜項支出', 'expense', true);
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- 🏦 PART 3: 銀行帳戶
-- =====================================================

CREATE TABLE IF NOT EXISTS acct_bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  account_number VARCHAR(50),
  bank_code VARCHAR(10),
  bank_name VARCHAR(255),
  bank_branch VARCHAR(255),
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('cash', 'bank', 'petty_cash', 'credit_card')),
  currency VARCHAR(10) DEFAULT 'TWD',
  initial_balance DECIMAL(15,2) DEFAULT 0,
  current_balance DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- =====================================================
-- 👥 PART 4: 客戶/廠商
-- =====================================================

CREATE TABLE IF NOT EXISTS acct_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  
  -- 基本資訊
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(100),
  tax_id VARCHAR(20),
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  
  -- 類型
  customer_type VARCHAR(20) NOT NULL CHECK (customer_type IN ('customer', 'vendor', 'both')),
  
  -- 擴充欄位 (Phase 2)
  line_user_id VARCHAR(100),
  line_display_name VARCHAR(100),
  preferred_title VARCHAR(50),
  is_vendor BOOLEAN DEFAULT false,
  vendor_type VARCHAR(20) CHECK (vendor_type IN ('company', 'individual')),
  can_issue_invoice BOOLEAN DEFAULT false,
  billing_contact_name VARCHAR(100),
  billing_email VARCHAR(255),
  billing_phone VARCHAR(50),
  line_notify_enabled BOOLEAN DEFAULT true,
  default_payment_terms INT DEFAULT 30,
  credit_limit DECIMAL(12,2),
  
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- =====================================================
-- 📝 PART 5: 憑證
-- =====================================================

CREATE TABLE IF NOT EXISTS acct_vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  voucher_number VARCHAR(50) NOT NULL,
  voucher_date DATE NOT NULL,
  voucher_type VARCHAR(20) NOT NULL CHECK (voucher_type IN ('receipt', 'payment', 'transfer', 'journal')),
  description TEXT,
  total_debit DECIMAL(15,2) DEFAULT 0,
  total_credit DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'voided')),
  attachments TEXT[],
  created_by UUID REFERENCES acct_users(id),
  approved_by UUID REFERENCES acct_users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, voucher_number)
);

CREATE TABLE IF NOT EXISTS acct_voucher_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_id UUID NOT NULL REFERENCES acct_vouchers(id) ON DELETE CASCADE,
  account_id UUID REFERENCES acct_chart_of_accounts(id),
  description TEXT,
  debit_amount DECIMAL(15,2) DEFAULT 0,
  credit_amount DECIMAL(15,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =====================================================
-- 💰 PART 6: 交易記錄
-- =====================================================

CREATE TABLE IF NOT EXISTS acct_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  
  -- 基本資訊
  transaction_date DATE NOT NULL,
  voucher_date DATE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('income', 'expense', 'transfer')),
  description VARCHAR(500) NOT NULL,
  
  -- 金額
  amount DECIMAL(15,2) NOT NULL,
  net_amount DECIMAL(15,2),
  
  -- 帳戶
  bank_account_id UUID REFERENCES acct_bank_accounts(id),
  from_account_id UUID REFERENCES acct_bank_accounts(id),
  to_account_id UUID REFERENCES acct_bank_accounts(id),
  
  -- 分類
  category_id UUID REFERENCES acct_chart_of_accounts(id),
  subcategory_id UUID,  -- 後面會加 FK
  
  -- 對象
  customer_id UUID REFERENCES acct_customers(id),
  contact_name VARCHAR(100),
  
  -- 交易狀況
  payment_status VARCHAR(20) DEFAULT 'same_day'
    CHECK (payment_status IN ('same_day', 'prepaid', 'pending', 'partial', 'completed')),
  
  -- 手續費
  has_fee BOOLEAN DEFAULT false,
  fee_amount DECIMAL(12,2) DEFAULT 0,
  fee_account_id UUID REFERENCES acct_chart_of_accounts(id),
  
  -- 營業稅
  has_tax BOOLEAN DEFAULT false,
  tax_type VARCHAR(20) DEFAULT 'taxable' CHECK (tax_type IN ('taxable', 'zero_rate', 'exempt')),
  tax_rate DECIMAL(5,2) DEFAULT 5.00,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  
  -- 發票
  invoice_number VARCHAR(50),
  invoice_date DATE,
  
  -- 附件與標籤
  attachments JSONB DEFAULT '[]',
  tags TEXT[],
  notes TEXT,
  
  -- 來源追蹤
  source_type VARCHAR(20),
  source_id UUID,
  
  -- 憑證關聯
  voucher_id UUID REFERENCES acct_vouchers(id),
  
  -- 時間戳
  created_by UUID REFERENCES acct_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- =====================================================
-- 🏷️ PART 7: 分類結構
-- =====================================================

-- 交易大分類
CREATE TABLE IF NOT EXISTS acct_transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL,
  icon VARCHAR(50),
  color VARCHAR(20),
  sort_order INT DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- 交易子分類
CREATE TABLE IF NOT EXISTS acct_transaction_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES acct_transaction_categories(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  account_code VARCHAR(20),
  account_id UUID REFERENCES acct_chart_of_accounts(id),
  default_tax_type VARCHAR(20),
  default_tax_rate DECIMAL(5,2),
  sort_order INT DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, category_id, code)
);

-- FK 會在 PART 14 統一加入

-- 客戶類型
CREATE TABLE IF NOT EXISTS acct_customer_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  is_vendor BOOLEAN DEFAULT false,
  default_payment_terms INT,
  sort_order INT DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- 服務分類
CREATE TABLE IF NOT EXISTS acct_service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  default_price DECIMAL(12,2),
  default_unit VARCHAR(20),
  default_tax_type VARCHAR(20) DEFAULT 'taxable',
  income_account_code VARCHAR(20),
  income_account_id UUID REFERENCES acct_chart_of_accounts(id),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- 發票類型
CREATE TABLE IF NOT EXISTS acct_invoice_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  invoice_type VARCHAR(20) NOT NULL,
  tax_type VARCHAR(20) DEFAULT 'taxable',
  default_tax_rate DECIMAL(5,2) DEFAULT 5.00,
  ezpay_category VARCHAR(10),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- 付款方式
CREATE TABLE IF NOT EXISTS acct_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  default_account_id UUID REFERENCES acct_bank_accounts(id),
  has_fee BOOLEAN DEFAULT false,
  fee_rate DECIMAL(5,2),
  fee_fixed DECIMAL(10,2),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- 勞報類型
CREATE TABLE IF NOT EXISTS acct_labor_report_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  income_type_code VARCHAR(10) NOT NULL,
  withholding_rate DECIMAL(5,2),
  nhi_rate DECIMAL(5,2),
  tax_threshold DECIMAL(10,2),
  nhi_threshold DECIMAL(10,2),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- 合約類型
CREATE TABLE IF NOT EXISTS acct_contract_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  default_duration_months INT,
  default_payment_terms INT,
  auto_renew BOOLEAN DEFAULT false,
  reminder_days_before INT DEFAULT 30,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- 交易狀況
CREATE TABLE IF NOT EXISTS acct_payment_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  for_income BOOLEAN DEFAULT true,
  for_expense BOOLEAN DEFAULT true,
  color VARCHAR(20),
  icon VARCHAR(50),
  sort_order INT DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);


-- =====================================================
-- 📱 PART 8: LINE 通知 (Phase 1)
-- =====================================================

-- LINE 設定
CREATE TABLE IF NOT EXISTS acct_line_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  channel_access_token TEXT,
  channel_secret VARCHAR(100),
  is_active BOOLEAN DEFAULT false,
  webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

-- LINE 群組
CREATE TABLE IF NOT EXISTS acct_line_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  group_id VARCHAR(100) NOT NULL,
  group_name VARCHAR(255) NOT NULL,
  group_type VARCHAR(20) DEFAULT 'group' CHECK (group_type IN ('group', 'room', 'user')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  member_count INT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, group_id)
);

-- LINE 模板
CREATE TABLE IF NOT EXISTS acct_line_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  usage_count INT DEFAULT 0,
  created_by UUID REFERENCES acct_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LINE 發送記錄
CREATE TABLE IF NOT EXISTS acct_line_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  template_id UUID REFERENCES acct_line_templates(id),
  recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('group', 'user', 'multicast')),
  recipient_id VARCHAR(100),
  recipient_name VARCHAR(255),
  message_type VARCHAR(20) DEFAULT 'text',
  content TEXT NOT NULL,
  variables_used JSONB,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  line_message_id VARCHAR(100),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_by UUID REFERENCES acct_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =====================================================
-- 💼 PART 9: 業務模組 (Phase 2-7)
-- =====================================================

-- 公司收款帳戶
CREATE TABLE IF NOT EXISTS acct_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  bank_code VARCHAR(10) NOT NULL,
  bank_name VARCHAR(50) NOT NULL,
  branch_name VARCHAR(50),
  account_number VARCHAR(50) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_on_invoice BOOLEAN DEFAULT true,
  bank_account_id UUID REFERENCES acct_bank_accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 請款單
CREATE TABLE IF NOT EXISTS acct_billing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  billing_number VARCHAR(50) NOT NULL,
  customer_id UUID NOT NULL REFERENCES acct_customers(id),
  service_description TEXT NOT NULL,
  service_category_id UUID REFERENCES acct_service_categories(id),
  service_period_start DATE,
  service_period_end DATE,
  amount DECIMAL(12,2) NOT NULL,
  tax_type VARCHAR(20) DEFAULT 'taxable',
  tax_rate DECIMAL(5,2) DEFAULT 5.00,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  payment_account_id UUID REFERENCES acct_payment_accounts(id),
  due_date DATE,
  has_cost BOOLEAN DEFAULT false,
  cost_amount DECIMAL(12,2),
  cost_vendor_id UUID REFERENCES acct_customers(id),
  cost_vendor_type VARCHAR(20),
  cost_description TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  notes TEXT,
  customer_notes TEXT,
  attachments JSONB DEFAULT '[]',
  line_sent_at TIMESTAMPTZ,
  line_message_id VARCHAR(100),
  paid_at TIMESTAMPTZ,
  paid_amount DECIMAL(12,2),
  paid_account_id UUID REFERENCES acct_bank_accounts(id),
  payment_method_id UUID REFERENCES acct_payment_methods(id),
  payment_reference VARCHAR(100),
  transaction_id UUID REFERENCES acct_transactions(id),
  invoice_id UUID,
  created_by UUID REFERENCES acct_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 應付款項
CREATE TABLE IF NOT EXISTS acct_payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  payable_number VARCHAR(50) NOT NULL,
  vendor_id UUID NOT NULL REFERENCES acct_customers(id),
  vendor_type VARCHAR(20) NOT NULL,
  source_type VARCHAR(20),
  source_id UUID,
  billing_request_id UUID REFERENCES acct_billing_requests(id),
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  due_date DATE,
  status VARCHAR(20) DEFAULT 'pending',
  vendor_invoice_number VARCHAR(50),
  vendor_invoice_date DATE,
  vendor_invoice_file VARCHAR(500),
  labor_report_id UUID,
  paid_at TIMESTAMPTZ,
  paid_amount DECIMAL(12,2),
  paid_account_id UUID REFERENCES acct_bank_accounts(id),
  payment_method_id UUID REFERENCES acct_payment_methods(id),
  payment_reference VARCHAR(100),
  reminder_sent_at TIMESTAMPTZ,
  transaction_id UUID REFERENCES acct_transactions(id),
  created_by UUID REFERENCES acct_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 電子發票設定
CREATE TABLE IF NOT EXISTS acct_invoice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  merchant_id VARCHAR(50),
  hash_key VARCHAR(100),
  hash_iv VARCHAR(100),
  is_production BOOLEAN DEFAULT false,
  default_tax_type VARCHAR(20) DEFAULT 'taxable',
  auto_issue_on_payment BOOLEAN DEFAULT false,
  auto_notify_customer BOOLEAN DEFAULT true,
  current_track VARCHAR(2),
  track_start_number INT,
  track_end_number INT,
  track_current_number INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

-- 電子發票
CREATE TABLE IF NOT EXISTS acct_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  invoice_number VARCHAR(20),
  invoice_date DATE NOT NULL,
  customer_id UUID REFERENCES acct_customers(id),
  buyer_name VARCHAR(100),
  buyer_tax_id VARCHAR(20),
  buyer_email VARCHAR(255),
  buyer_phone VARCHAR(50),
  buyer_address TEXT,
  invoice_type_id UUID REFERENCES acct_invoice_types(id),
  invoice_type VARCHAR(20) NOT NULL,
  tax_type VARCHAR(20) DEFAULT 'taxable',
  sales_amount DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  void_at TIMESTAMPTZ,
  void_reason TEXT,
  billing_request_id UUID REFERENCES acct_billing_requests(id),
  ezpay_trans_num VARCHAR(50),
  ezpay_invoice_trans_no VARCHAR(50),
  ezpay_random_num VARCHAR(10),
  ezpay_response JSONB,
  line_sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES acct_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 發票明細
CREATE TABLE IF NOT EXISTS acct_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES acct_invoices(id) ON DELETE CASCADE,
  item_name VARCHAR(200) NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit VARCHAR(20),
  unit_price DECIMAL(12,2) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  remark TEXT,
  sort_order INT DEFAULT 0
);

-- 外包人員
CREATE TABLE IF NOT EXISTS acct_freelancers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  english_name VARCHAR(100),
  id_number VARCHAR(20),
  birthday DATE,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  line_user_id VARCHAR(100),
  line_display_name VARCHAR(100),
  bank_code VARCHAR(10),
  bank_name VARCHAR(50),
  bank_account VARCHAR(50),
  bank_account_name VARCHAR(100),
  default_labor_type_id UUID REFERENCES acct_labor_report_types(id),
  id_card_front VARCHAR(500),
  id_card_back VARCHAR(500),
  passbook_image VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  is_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 勞報單
CREATE TABLE IF NOT EXISTS acct_labor_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  report_number VARCHAR(50) NOT NULL,
  freelancer_id UUID NOT NULL REFERENCES acct_freelancers(id),
  labor_type_id UUID NOT NULL REFERENCES acct_labor_report_types(id),
  income_type_code VARCHAR(10) NOT NULL,
  service_period_start DATE,
  service_period_end DATE,
  work_description TEXT NOT NULL,
  gross_amount DECIMAL(12,2) NOT NULL,
  withholding_tax DECIMAL(12,2) DEFAULT 0,
  nhi_premium DECIMAL(12,2) DEFAULT 0,
  total_income DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  sign_token VARCHAR(100),
  sign_url VARCHAR(500),
  signed_at TIMESTAMPTZ,
  signature_image VARCHAR(500),
  signed_ip VARCHAR(50),
  sign_request_sent_at TIMESTAMPTZ,
  sign_complete_notified_at TIMESTAMPTZ,
  payment_notified_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  paid_account_id UUID REFERENCES acct_bank_accounts(id),
  payment_reference VARCHAR(100),
  payable_id UUID REFERENCES acct_payables(id),
  transaction_id UUID REFERENCES acct_transactions(id),
  created_by UUID REFERENCES acct_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK 會在 PART 14 統一加入

-- 報價單
CREATE TABLE IF NOT EXISTS acct_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  quotation_number VARCHAR(50) NOT NULL,
  customer_id UUID NOT NULL REFERENCES acct_customers(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  subtotal DECIMAL(12,2) NOT NULL,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  valid_until DATE,
  status VARCHAR(20) DEFAULT 'draft',
  line_sent_at TIMESTAMPTZ,
  converted_to_contract_id UUID,
  converted_at TIMESTAMPTZ,
  created_by UUID REFERENCES acct_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 報價單明細
CREATE TABLE IF NOT EXISTS acct_quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES acct_quotations(id) ON DELETE CASCADE,
  service_category_id UUID REFERENCES acct_service_categories(id),
  item_name VARCHAR(200) NOT NULL,
  description TEXT,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit VARCHAR(20),
  unit_price DECIMAL(12,2) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  sort_order INT DEFAULT 0
);

-- 合約
CREATE TABLE IF NOT EXISTS acct_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
  contract_number VARCHAR(50) NOT NULL,
  customer_id UUID NOT NULL REFERENCES acct_customers(id),
  contract_type_id UUID REFERENCES acct_contract_types(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  terms TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  auto_renew BOOLEAN DEFAULT false,
  total_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  sign_token VARCHAR(100),
  sign_url VARCHAR(500),
  signed_at TIMESTAMPTZ,
  signature_image VARCHAR(500),
  signed_ip VARCHAR(50),
  sign_request_sent_at TIMESTAMPTZ,
  sign_complete_notified_at TIMESTAMPTZ,
  expiry_reminder_sent_at TIMESTAMPTZ,
  quotation_id UUID REFERENCES acct_quotations(id),
  created_by UUID REFERENCES acct_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK 會在 PART 14 統一加入

-- 合約付款期程
CREATE TABLE IF NOT EXISTS acct_contract_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES acct_contracts(id) ON DELETE CASCADE,
  payment_number INT NOT NULL,
  description VARCHAR(200),
  amount DECIMAL(12,2) NOT NULL,
  percentage DECIMAL(5,2),
  due_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  billing_request_id UUID REFERENCES acct_billing_requests(id),
  invoice_id UUID REFERENCES acct_invoices(id),
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- =====================================================
-- 🔧 PART 10: 預設資料初始化函數
-- =====================================================

-- 建立預設交易分類
CREATE OR REPLACE FUNCTION create_default_transaction_categories(p_company_id UUID)
RETURNS VOID AS $$
DECLARE
    v_income_id UUID;
    v_cost_id UUID;
    v_salary_id UUID;
    v_marketing_id UUID;
    v_office_id UUID;
    v_fee_id UUID;
    v_deposit_id UUID;
    v_asset_id UUID;
    v_other_id UUID;
BEGIN
    -- 收入
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'INC', '收入', 'income', 'TrendingUp', 'green', 1, true)
    RETURNING id INTO v_income_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_income_id, 'INC-SVC', '服務收入', '4100', 1, true),
    (p_company_id, v_income_id, 'INC-SALES', '商品銷售', '4110', 2, true),
    (p_company_id, v_income_id, 'INC-INT', '利息收入', '4200', 3, true),
    (p_company_id, v_income_id, 'INC-OTHER', '其他收入', '4900', 4, true);
    
    -- 成本・進貨
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'COST', '成本・進貨', 'expense', 'Package', 'orange', 10, true)
    RETURNING id INTO v_cost_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_cost_id, 'COST-OUT', '外包成本', '5100', 1, true),
    (p_company_id, v_cost_id, 'COST-PUR', '進貨成本', '5110', 2, true),
    (p_company_id, v_cost_id, 'COST-MAT', '原料成本', '5120', 3, true);
    
    -- 薪資・人事
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'SAL', '薪資・人事', 'expense', 'Users', 'blue', 11, true)
    RETURNING id INTO v_salary_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_salary_id, 'SAL-PAY', '薪資支出', '6010', 1, true),
    (p_company_id, v_salary_id, 'SAL-INS', '勞健保費', '6020', 2, true),
    (p_company_id, v_salary_id, 'SAL-BON', '獎金支出', '6030', 3, true),
    (p_company_id, v_salary_id, 'SAL-LAB', '勞務費', '6015', 4, true);
    
    -- 業務行銷・差旅
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'MKT', '業務行銷・差旅', 'expense', 'Megaphone', 'purple', 12, true)
    RETURNING id INTO v_marketing_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_marketing_id, 'MKT-TRV', '旅費/交通費', '6040', 1, true),
    (p_company_id, v_marketing_id, 'MKT-TEL', '郵寄/電話費', '6060', 2, true),
    (p_company_id, v_marketing_id, 'MKT-ENT', '交際費', '6110', 3, true),
    (p_company_id, v_marketing_id, 'MKT-AD', '廣告/行銷費', '6080', 4, true),
    (p_company_id, v_marketing_id, 'MKT-COM', '佣金支出', '6090', 5, true);
    
    -- 辦公・行政
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'OFC', '辦公・行政', 'expense', 'Building', 'gray', 13, true)
    RETURNING id INTO v_office_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_office_id, 'OFC-SUP', '文具用品', '6050', 1, true),
    (p_company_id, v_office_id, 'OFC-RNT', '租金支出', '6100', 2, true),
    (p_company_id, v_office_id, 'OFC-UTL', '水電瓦斯', '6070', 3, true),
    (p_company_id, v_office_id, 'OFC-REP', '修繕費', '6120', 4, true),
    (p_company_id, v_office_id, 'OFC-INS', '保險費', '6130', 5, true);
    
    -- 手續費・稅務
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'FEE', '手續費・稅務', 'expense', 'Receipt', 'yellow', 14, true)
    RETURNING id INTO v_fee_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_fee_id, 'FEE-BANK', '銀行手續費', '6140', 1, true),
    (p_company_id, v_fee_id, 'FEE-PAY', '金流手續費', '6140', 2, true),
    (p_company_id, v_fee_id, 'FEE-TAX', '稅捐', '6150', 3, true),
    (p_company_id, v_fee_id, 'FEE-GOV', '規費', '6160', 4, true);
    
    -- 還款・押金
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'DEP', '還款・押金', 'expense', 'Wallet', 'teal', 15, true)
    RETURNING id INTO v_deposit_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_deposit_id, 'DEP-LOAN', '借款還款', '2100', 1, true),
    (p_company_id, v_deposit_id, 'DEP-DEP', '押金支出', '1400', 2, true);
    
    -- 資產設備・折舊
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'AST', '資產設備・折舊', 'expense', 'Monitor', 'indigo', 16, true)
    RETURNING id INTO v_asset_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_asset_id, 'AST-EQP', '設備購置', '1500', 1, true),
    (p_company_id, v_asset_id, 'AST-DEP', '折舊費用', '6170', 2, true),
    (p_company_id, v_asset_id, 'AST-AMT', '攤銷費用', '6180', 3, true);
    
    -- 其他支出
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'OTH', '其他支出', 'expense', 'MoreHorizontal', 'gray', 99, true)
    RETURNING id INTO v_other_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_other_id, 'OTH-MISC', '雜項支出', '6900', 1, true);
END;
$$ LANGUAGE plpgsql;

-- 建立預設客戶類型
CREATE OR REPLACE FUNCTION create_default_customer_types(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO acct_customer_types (company_id, code, name, is_vendor, default_payment_terms, sort_order, is_system) VALUES
    (p_company_id, 'B2B', 'B2B 企業客戶', false, 30, 1, true),
    (p_company_id, 'B2C', 'B2C 個人客戶', false, 0, 2, true),
    (p_company_id, 'GOV', '政府機關', false, 60, 3, true),
    (p_company_id, 'VENDOR-CO', '公司外包', true, 30, 10, true),
    (p_company_id, 'VENDOR-IND', '個人外包', true, 7, 11, true),
    (p_company_id, 'SUPPLIER', '供應商', true, 30, 12, true);
END;
$$ LANGUAGE plpgsql;

-- 建立預設服務分類
CREATE OR REPLACE FUNCTION create_default_service_categories(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO acct_service_categories (company_id, code, name, default_unit, income_account_code, sort_order) VALUES
    (p_company_id, 'SVC-SEO', 'SEO 優化服務', '月', '4100', 1),
    (p_company_id, 'SVC-ADS', '廣告代操服務', '月', '4100', 2),
    (p_company_id, 'SVC-WEB', '網站設計開發', '專案', '4100', 3),
    (p_company_id, 'SVC-DESIGN', '平面設計', '專案', '4100', 4),
    (p_company_id, 'SVC-CONSULT', '顧問諮詢', '次', '4100', 5),
    (p_company_id, 'SVC-MAINT', '維護服務', '月', '4100', 6),
    (p_company_id, 'SVC-OTHER', '其他服務', '次', '4100', 99);
END;
$$ LANGUAGE plpgsql;

-- 建立預設發票類型
CREATE OR REPLACE FUNCTION create_default_invoice_types(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO acct_invoice_types (company_id, code, name, invoice_type, tax_type, default_tax_rate, sort_order) VALUES
    (p_company_id, 'B2B-TAX', 'B2B 應稅發票', 'B2B', 'taxable', 5.00, 1),
    (p_company_id, 'B2B-ZERO', 'B2B 零稅率發票', 'B2B', 'zero_rate', 0.00, 2),
    (p_company_id, 'B2C-TAX', 'B2C 應稅發票', 'B2C', 'taxable', 5.00, 3),
    (p_company_id, 'B2C-ZERO', 'B2C 零稅率發票', 'B2C', 'zero_rate', 0.00, 4),
    (p_company_id, 'EXEMPT', '免稅發票', 'B2C', 'exempt', 0.00, 5);
END;
$$ LANGUAGE plpgsql;

-- 建立預設付款方式
CREATE OR REPLACE FUNCTION create_default_payment_methods(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO acct_payment_methods (company_id, code, name, has_fee, sort_order) VALUES
    (p_company_id, 'BANK', '銀行轉帳', false, 1),
    (p_company_id, 'CASH', '現金', false, 2),
    (p_company_id, 'CHECK', '支票', false, 3),
    (p_company_id, 'CREDIT', '信用卡', true, 4),
    (p_company_id, 'ECPAY', '綠界支付', true, 5),
    (p_company_id, 'LINEPAY', 'LINE Pay', true, 6);
END;
$$ LANGUAGE plpgsql;

-- 建立預設勞報類型
CREATE OR REPLACE FUNCTION create_default_labor_report_types(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO acct_labor_report_types (company_id, code, name, income_type_code, withholding_rate, nhi_rate, tax_threshold, nhi_threshold, sort_order) VALUES
    (p_company_id, '50', '執行業務所得', '50', 10.00, 2.11, 20010, 20000, 1),
    (p_company_id, '9A', '稿費所得', '9A', 10.00, 2.11, 20010, 20000, 2),
    (p_company_id, '9B', '講演鐘點費', '9B', 10.00, 2.11, 20010, 20000, 3),
    (p_company_id, '92', '競技競賽獎金', '92', 10.00, 2.11, 20010, 20000, 4);
END;
$$ LANGUAGE plpgsql;

-- 建立預設合約類型
CREATE OR REPLACE FUNCTION create_default_contract_types(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO acct_contract_types (company_id, code, name, default_duration_months, default_payment_terms, auto_renew, reminder_days_before, sort_order) VALUES
    (p_company_id, 'MONTHLY', '月約服務', 1, 7, true, 7, 1),
    (p_company_id, 'QUARTERLY', '季約服務', 3, 14, true, 14, 2),
    (p_company_id, 'YEARLY', '年約服務', 12, 30, false, 30, 3),
    (p_company_id, 'PROJECT', '專案合約', NULL, 14, false, 7, 4),
    (p_company_id, 'RETAINER', '顧問合約', 12, 7, true, 30, 5);
END;
$$ LANGUAGE plpgsql;

-- 建立預設交易狀況
CREATE OR REPLACE FUNCTION create_default_payment_statuses(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO acct_payment_statuses (company_id, code, name, for_income, for_expense, color, sort_order, is_system) VALUES
    (p_company_id, 'same_day', '同日付款', true, true, 'green', 1, true),
    (p_company_id, 'prepaid', '預付/預收', true, true, 'blue', 2, true),
    (p_company_id, 'pending', '待付/待收', true, true, 'yellow', 3, true),
    (p_company_id, 'partial', '部分款項', true, true, 'orange', 4, true),
    (p_company_id, 'completed', '已完成', true, true, 'gray', 5, true);
END;
$$ LANGUAGE plpgsql;

-- 統一初始化函數
CREATE OR REPLACE FUNCTION initialize_company_all(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM create_default_chart_of_accounts(p_company_id);
    PERFORM create_default_transaction_categories(p_company_id);
    PERFORM create_default_customer_types(p_company_id);
    PERFORM create_default_service_categories(p_company_id);
    PERFORM create_default_invoice_types(p_company_id);
    PERFORM create_default_payment_methods(p_company_id);
    PERFORM create_default_labor_report_types(p_company_id);
    PERFORM create_default_contract_types(p_company_id);
    PERFORM create_default_payment_statuses(p_company_id);
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- 🔄 PART 11: 觸發器
-- =====================================================

-- 新公司自動初始化
CREATE OR REPLACE FUNCTION trigger_initialize_company()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM initialize_company_all(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_company_insert ON acct_companies;
CREATE TRIGGER after_company_insert
    AFTER INSERT ON acct_companies
    FOR EACH ROW
    EXECUTE FUNCTION trigger_initialize_company();

-- 自動更新 updated_at
CREATE TRIGGER update_acct_companies_updated_at BEFORE UPDATE ON acct_companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_acct_users_updated_at BEFORE UPDATE ON acct_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_acct_bank_accounts_updated_at BEFORE UPDATE ON acct_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_acct_customers_updated_at BEFORE UPDATE ON acct_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_acct_transactions_updated_at BEFORE UPDATE ON acct_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_acct_vouchers_updated_at BEFORE UPDATE ON acct_vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- 📇 PART 12: 索引
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_acct_users_auth ON acct_users(auth_id);
CREATE INDEX IF NOT EXISTS idx_acct_user_companies_user ON acct_user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_acct_user_companies_company ON acct_user_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_chart_company ON acct_chart_of_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_bank_accounts_company ON acct_bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_customers_company ON acct_customers(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_transactions_company ON acct_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_transactions_date ON acct_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_acct_transactions_type ON acct_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_acct_vouchers_company ON acct_vouchers(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_vouchers_date ON acct_vouchers(voucher_date);
CREATE INDEX IF NOT EXISTS idx_acct_voucher_items_voucher ON acct_voucher_items(voucher_id);
CREATE INDEX IF NOT EXISTS idx_acct_line_messages_company ON acct_line_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_billing_company ON acct_billing_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_billing_customer ON acct_billing_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_acct_billing_status ON acct_billing_requests(status);
CREATE INDEX IF NOT EXISTS idx_acct_payables_company ON acct_payables(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_invoices_company ON acct_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_freelancers_company ON acct_freelancers(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_labor_reports_company ON acct_labor_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_quotations_company ON acct_quotations(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_contracts_company ON acct_contracts(company_id);


-- =====================================================
-- 🔒 PART 13: RLS 政策
-- =====================================================

-- 啟用 RLS
ALTER TABLE acct_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_voucher_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_transaction_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_line_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_line_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_line_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_line_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_billing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_freelancers ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_labor_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_contracts ENABLE ROW LEVEL SECURITY;

-- 用戶表政策
CREATE POLICY "Users can view own profile" ON acct_users
  FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY "Users can update own profile" ON acct_users
  FOR UPDATE USING (auth.uid() = auth_id);

-- 用戶-公司關聯
CREATE POLICY "Users can view own company associations" ON acct_user_companies
  FOR SELECT USING (user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid()));

-- 公司政策
CREATE POLICY "Users can view associated companies" ON acct_companies
  FOR SELECT USING (
    id IN (SELECT company_id FROM acct_user_companies 
           WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid()))
  );

-- 通用公司資料政策 (用於大多數表)
-- 這裡用一個簡化的方式：讓 auth.uid() 對應的用戶可以看到其公司的資料
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'acct_chart_of_accounts', 'acct_bank_accounts', 'acct_customers',
        'acct_transactions', 'acct_vouchers', 'acct_transaction_categories',
        'acct_transaction_subcategories', 'acct_line_settings', 'acct_line_groups',
        'acct_line_templates', 'acct_line_messages', 'acct_billing_requests',
        'acct_payables', 'acct_invoices', 'acct_freelancers', 'acct_labor_reports',
        'acct_quotations', 'acct_contracts'
    ])
    LOOP
        EXECUTE format('
            CREATE POLICY %I_company_select ON %I FOR SELECT
            USING (company_id IN (
                SELECT company_id FROM acct_user_companies 
                WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
            ));
        ', t || '_sel', t);
        
        EXECUTE format('
            CREATE POLICY %I_company_all ON %I FOR ALL
            USING (company_id IN (
                SELECT company_id FROM acct_user_companies 
                WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
                AND role IN (''admin'', ''accountant'', ''pm'')
            ));
        ', t || '_all', t);
    END LOOP;
END $$;

-- 憑證明細
CREATE POLICY "voucher_items_select" ON acct_voucher_items FOR SELECT
    USING (voucher_id IN (SELECT id FROM acct_vouchers));
CREATE POLICY "voucher_items_all" ON acct_voucher_items FOR ALL
    USING (voucher_id IN (SELECT id FROM acct_vouchers));


-- =====================================================
-- 🔗 PART 14: 外鍵約束 (延遲添加)
-- =====================================================

-- 交易記錄 -> 子分類
ALTER TABLE acct_transactions 
  ADD CONSTRAINT fk_transactions_subcategory 
  FOREIGN KEY (subcategory_id) REFERENCES acct_transaction_subcategories(id);

-- 應付款項 -> 勞報單
ALTER TABLE acct_payables 
  ADD CONSTRAINT fk_payables_labor_report 
  FOREIGN KEY (labor_report_id) REFERENCES acct_labor_reports(id);

-- 報價單 -> 合約
ALTER TABLE acct_quotations 
  ADD CONSTRAINT fk_quotations_contract 
  FOREIGN KEY (converted_to_contract_id) REFERENCES acct_contracts(id);


-- =====================================================
-- 🏢 PART 15: 插入預設公司
-- =====================================================

INSERT INTO acct_companies (id, name, tax_id, address, email) VALUES
  ('00000000-0000-0000-0000-000000000001', '智慧媽咪國際有限公司', '12345678', '台中市', 'contact@mommywisdom.com'),
  ('00000000-0000-0000-0000-000000000002', '薇佳工作室', '87654321', '台中市', 'contact@weijia.com')
ON CONFLICT DO NOTHING;


-- =====================================================
-- ✅ PART 16: 完成！
-- =====================================================

SELECT '智慧媽咪商業管理系統資料庫建立完成！' AS status;
