-- =====================================================
-- Mommy Wisdom 會計系統 - Supabase Schema
-- 所有表格使用 acct_ 前綴避免與現有表格衝突
-- =====================================================

-- 啟用 UUID 擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. 公司表
-- =====================================================
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

-- =====================================================
-- 2. 用戶表
-- =====================================================
CREATE TABLE IF NOT EXISTS acct_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'accountant', 'viewer')),
  company_id UUID REFERENCES acct_companies(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. 用戶-公司關聯表（支援一個用戶多個公司）
-- =====================================================
CREATE TABLE IF NOT EXISTS acct_user_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES acct_users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES acct_companies(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'accountant', 'viewer')),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- =====================================================
-- 4. 會計科目表
-- =====================================================
CREATE TABLE IF NOT EXISTS acct_account_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES acct_companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'cost', 'expense')),
  parent_id UUID REFERENCES acct_account_categories(id),
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- =====================================================
-- 5. 銀行/現金帳戶表
-- =====================================================
CREATE TABLE IF NOT EXISTS acct_bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES acct_companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  account_number VARCHAR(50),
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
-- 6. 客戶/廠商表
-- =====================================================
CREATE TABLE IF NOT EXISTS acct_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES acct_companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(100),
  tax_id VARCHAR(20),
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  customer_type VARCHAR(20) NOT NULL CHECK (customer_type IN ('customer', 'vendor', 'both')),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. 交易記錄表
-- =====================================================
CREATE TABLE IF NOT EXISTS acct_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES acct_companies(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('income', 'expense', 'transfer')),
  description VARCHAR(500) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  bank_account_id UUID REFERENCES acct_bank_accounts(id),
  from_account_id UUID REFERENCES acct_bank_accounts(id),
  to_account_id UUID REFERENCES acct_bank_accounts(id),
  category_id UUID REFERENCES acct_account_categories(id),
  customer_id UUID REFERENCES acct_customers(id),
  voucher_id UUID,
  tags TEXT[],
  notes TEXT,
  created_by UUID REFERENCES acct_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. 憑證表
-- =====================================================
CREATE TABLE IF NOT EXISTS acct_vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES acct_companies(id) ON DELETE CASCADE,
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

-- =====================================================
-- 9. 憑證明細表
-- =====================================================
CREATE TABLE IF NOT EXISTS acct_voucher_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_id UUID REFERENCES acct_vouchers(id) ON DELETE CASCADE,
  account_id UUID REFERENCES acct_account_categories(id),
  description TEXT,
  debit_amount DECIMAL(15,2) DEFAULT 0,
  credit_amount DECIMAL(15,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 10. 更新 voucher_id 外鍵
-- =====================================================
ALTER TABLE acct_transactions 
  ADD CONSTRAINT fk_transaction_voucher 
  FOREIGN KEY (voucher_id) REFERENCES acct_vouchers(id) ON DELETE SET NULL;

-- =====================================================
-- 索引優化
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_acct_transactions_company ON acct_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_transactions_date ON acct_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_acct_transactions_type ON acct_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_acct_vouchers_company ON acct_vouchers(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_vouchers_date ON acct_vouchers(voucher_date);
CREATE INDEX IF NOT EXISTS idx_acct_customers_company ON acct_customers(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_bank_accounts_company ON acct_bank_accounts(company_id);

-- =====================================================
-- Row Level Security (RLS) 政策
-- =====================================================

-- 啟用 RLS
ALTER TABLE acct_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_account_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_voucher_items ENABLE ROW LEVEL SECURITY;

-- 用戶表政策
CREATE POLICY "Users can view own profile" ON acct_users
  FOR SELECT USING (auth.uid() = auth_id);

CREATE POLICY "Users can update own profile" ON acct_users
  FOR UPDATE USING (auth.uid() = auth_id);

-- 用戶-公司關聯政策
CREATE POLICY "Users can view own company associations" ON acct_user_companies
  FOR SELECT USING (
    user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
  );

-- 公司政策：用戶只能看到自己關聯的公司
CREATE POLICY "Users can view associated companies" ON acct_companies
  FOR SELECT USING (
    id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
    )
  );

-- 管理員可以更新公司資料
CREATE POLICY "Admins can update companies" ON acct_companies
  FOR UPDATE USING (
    id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
      AND role = 'admin'
    )
  );

-- 通用的公司資料存取政策（用於其他表）
-- 會計科目
CREATE POLICY "Users can view company account categories" ON acct_account_categories
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Accountants can manage account categories" ON acct_account_categories
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
      AND role IN ('admin', 'accountant')
    )
  );

-- 銀行帳戶
CREATE POLICY "Users can view company bank accounts" ON acct_bank_accounts
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Accountants can manage bank accounts" ON acct_bank_accounts
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
      AND role IN ('admin', 'accountant')
    )
  );

-- 客戶/廠商
CREATE POLICY "Users can view company customers" ON acct_customers
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Accountants can manage customers" ON acct_customers
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
      AND role IN ('admin', 'accountant')
    )
  );

-- 交易記錄
CREATE POLICY "Users can view company transactions" ON acct_transactions
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Accountants can manage transactions" ON acct_transactions
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
      AND role IN ('admin', 'accountant')
    )
  );

-- 憑證
CREATE POLICY "Users can view company vouchers" ON acct_vouchers
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Accountants can manage vouchers" ON acct_vouchers
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM acct_user_companies 
      WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
      AND role IN ('admin', 'accountant')
    )
  );

-- 憑證明細
CREATE POLICY "Users can view voucher items" ON acct_voucher_items
  FOR SELECT USING (
    voucher_id IN (
      SELECT id FROM acct_vouchers WHERE company_id IN (
        SELECT company_id FROM acct_user_companies 
        WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
      )
    )
  );

CREATE POLICY "Accountants can manage voucher items" ON acct_voucher_items
  FOR ALL USING (
    voucher_id IN (
      SELECT id FROM acct_vouchers WHERE company_id IN (
        SELECT company_id FROM acct_user_companies 
        WHERE user_id IN (SELECT id FROM acct_users WHERE auth_id = auth.uid())
        AND role IN ('admin', 'accountant')
      )
    )
  );

-- =====================================================
-- 預設資料：插入初始公司
-- =====================================================
INSERT INTO acct_companies (id, name, tax_id, address, phone, email) VALUES
  ('00000000-0000-0000-0000-000000000001', '智慧媽咪國際股份有限公司', '12345678', '台中市', '', 'contact@mommywisdom.com'),
  ('00000000-0000-0000-0000-000000000002', '薇佳工作室', '87654321', '台中市', '', 'contact@weijia.com')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 函數：自動更新 updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 觸發器
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
-- 完成！
-- =====================================================
SELECT 'Mommy Wisdom 會計系統資料表建立完成！' AS status;
