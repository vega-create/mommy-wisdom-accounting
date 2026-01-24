-- =====================================================
-- 智慧媽咪商業管理系統 - 分類結構設計
-- Mommy Wisdom Business Management System - Categories
-- 版本: v1.0
-- 建立日期: 2026-01-24
-- =====================================================

-- =====================================================
-- 1. 交易分類 (類似藍途的分類結構)
-- =====================================================

-- 交易大分類
CREATE TABLE IF NOT EXISTS acct_transaction_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    
    -- 分類資訊
    code VARCHAR(10) NOT NULL,              -- 分類代碼: INC, EXP
    name VARCHAR(50) NOT NULL,              -- 分類名稱: 收入, 支出
    type VARCHAR(20) NOT NULL,              -- income, expense, transfer
    icon VARCHAR(50),                       -- 圖示名稱 (for UI)
    color VARCHAR(20),                      -- 顏色代碼 (for UI)
    
    -- 排序與狀態
    sort_order INT DEFAULT 0,
    is_system BOOLEAN DEFAULT false,        -- 系統預設分類
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, code)
);

-- 交易子分類 (對應會計科目)
CREATE TABLE IF NOT EXISTS acct_transaction_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES acct_transaction_categories(id) ON DELETE CASCADE,
    
    -- 子分類資訊
    code VARCHAR(20) NOT NULL,              -- 子分類代碼
    name VARCHAR(100) NOT NULL,             -- 子分類名稱: 旅費/交通費
    description TEXT,                       -- 說明
    
    -- 對應會計科目
    account_code VARCHAR(20),               -- 對應會計科目代碼: 6040
    account_id UUID REFERENCES acct_chart_of_accounts(id),
    
    -- 預設值
    default_tax_type VARCHAR(20),           -- 預設稅別: taxable, zero_rate, exempt
    default_tax_rate DECIMAL(5,2),          -- 預設稅率: 5.00
    
    -- 排序與狀態
    sort_order INT DEFAULT 0,
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- 使用統計
    usage_count INT DEFAULT 0,              -- 使用次數 (用於智慧排序)
    last_used_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, category_id, code)
);

-- =====================================================
-- 2. 預設交易分類資料
-- =====================================================

-- 插入函數：為新公司建立預設分類
CREATE OR REPLACE FUNCTION create_default_transaction_categories(p_company_id UUID)
RETURNS VOID AS $$
DECLARE
    v_income_id UUID;
    v_expense_id UUID;
    v_cost_id UUID;
    v_salary_id UUID;
    v_marketing_id UUID;
    v_office_id UUID;
    v_fee_id UUID;
    v_deposit_id UUID;
    v_asset_id UUID;
    v_other_exp_id UUID;
BEGIN
    -- ===== 收入大分類 =====
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'INC', '收入', 'income', 'TrendingUp', 'green', 1, true)
    RETURNING id INTO v_income_id;
    
    -- 收入子分類
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_income_id, 'INC-SVC', '服務收入', '4100', 1, true),
    (p_company_id, v_income_id, 'INC-SALES', '商品銷售', '4110', 2, true),
    (p_company_id, v_income_id, 'INC-INT', '利息收入', '4200', 3, true),
    (p_company_id, v_income_id, 'INC-OTHER', '其他收入', '4900', 4, true);
    
    -- ===== 支出大分類 =====
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'EXP', '支出', 'expense', 'TrendingDown', 'red', 2, true)
    RETURNING id INTO v_expense_id;
    
    -- ----- 成本・進貨 -----
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'COST', '成本・進貨', 'expense', 'Package', 'orange', 10, true)
    RETURNING id INTO v_cost_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_cost_id, 'COST-OUT', '外包成本', '5100', 1, true),
    (p_company_id, v_cost_id, 'COST-PUR', '進貨成本', '5110', 2, true),
    (p_company_id, v_cost_id, 'COST-MAT', '原料成本', '5120', 3, true);
    
    -- ----- 薪資・人事 -----
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'SAL', '薪資・人事', 'expense', 'Users', 'blue', 11, true)
    RETURNING id INTO v_salary_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_salary_id, 'SAL-PAY', '薪資支出', '6010', 1, true),
    (p_company_id, v_salary_id, 'SAL-INS', '勞健保費', '6020', 2, true),
    (p_company_id, v_salary_id, 'SAL-BON', '獎金支出', '6030', 3, true),
    (p_company_id, v_salary_id, 'SAL-LAB', '勞務費', '6015', 4, true);
    
    -- ----- 業務行銷・差旅 -----
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'MKT', '業務行銷・差旅', 'expense', 'Megaphone', 'purple', 12, true)
    RETURNING id INTO v_marketing_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_marketing_id, 'MKT-TRV', '旅費/交通費', '6040', 1, true),
    (p_company_id, v_marketing_id, 'MKT-TEL', '郵寄/電話費', '6060', 2, true),
    (p_company_id, v_marketing_id, 'MKT-ENT', '交際費', '6110', 3, true),
    (p_company_id, v_marketing_id, 'MKT-AD', '廣告/行銷費', '6080', 4, true),
    (p_company_id, v_marketing_id, 'MKT-COM', '佣金支出', '6090', 5, true);
    
    -- ----- 辦公・行政 -----
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'OFC', '辦公・行政', 'expense', 'Building', 'gray', 13, true)
    RETURNING id INTO v_office_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_office_id, 'OFC-SUP', '文具用品', '6050', 1, true),
    (p_company_id, v_office_id, 'OFC-RNT', '租金支出', '6100', 2, true),
    (p_company_id, v_office_id, 'OFC-UTL', '水電瓦斯', '6070', 3, true),
    (p_company_id, v_office_id, 'OFC-REP', '修繕費', '6120', 4, true),
    (p_company_id, v_office_id, 'OFC-INS', '保險費', '6130', 5, true);
    
    -- ----- 手續費・稅務 -----
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'FEE', '手續費・稅務', 'expense', 'Receipt', 'yellow', 14, true)
    RETURNING id INTO v_fee_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_fee_id, 'FEE-BANK', '銀行手續費', '6140', 1, true),
    (p_company_id, v_fee_id, 'FEE-PAY', '金流手續費', '6141', 2, true),
    (p_company_id, v_fee_id, 'FEE-TAX', '稅捐', '6150', 3, true),
    (p_company_id, v_fee_id, 'FEE-GOV', '規費', '6160', 4, true);
    
    -- ----- 還款・押金 -----
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'DEP', '還款・押金', 'expense', 'Wallet', 'teal', 15, true)
    RETURNING id INTO v_deposit_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_deposit_id, 'DEP-LOAN', '借款還款', '2100', 1, true),
    (p_company_id, v_deposit_id, 'DEP-DEP', '押金支出', '1400', 2, true);
    
    -- ----- 資產設備・折舊 -----
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'AST', '資產設備・折舊', 'expense', 'Monitor', 'indigo', 16, true)
    RETURNING id INTO v_asset_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_asset_id, 'AST-EQP', '設備購置', '1500', 1, true),
    (p_company_id, v_asset_id, 'AST-DEP', '折舊費用', '6170', 2, true),
    (p_company_id, v_asset_id, 'AST-AMT', '攤銷費用', '6180', 3, true);
    
    -- ----- 款項退回 -----
    -- (這個用子分類方式加在收入下)
    
    -- ----- 其他支出 -----
    INSERT INTO acct_transaction_categories (company_id, code, name, type, icon, color, sort_order, is_system)
    VALUES (p_company_id, 'OTH', '其他支出', 'expense', 'MoreHorizontal', 'gray', 99, true)
    RETURNING id INTO v_other_exp_id;
    
    INSERT INTO acct_transaction_subcategories (company_id, category_id, code, name, account_code, sort_order, is_system) VALUES
    (p_company_id, v_other_exp_id, 'OTH-MISC', '雜項支出', '6900', 1, true),
    (p_company_id, v_other_exp_id, 'OTH-LOSS', '損失', '6910', 2, true);
    
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- 3. 客戶/廠商分類
-- =====================================================

-- 客戶類型
CREATE TABLE IF NOT EXISTS acct_customer_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    
    code VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- 預設行為
    is_vendor BOOLEAN DEFAULT false,        -- 是否為廠商（可作為外包對象）
    default_payment_terms INT,              -- 預設付款天數
    
    sort_order INT DEFAULT 0,
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, code)
);

-- 預設客戶類型
CREATE OR REPLACE FUNCTION create_default_customer_types(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO acct_customer_types (company_id, code, name, is_vendor, default_payment_terms, sort_order, is_system) VALUES
    -- 客戶類型
    (p_company_id, 'B2B', 'B2B 企業客戶', false, 30, 1, true),
    (p_company_id, 'B2C', 'B2C 個人客戶', false, 0, 2, true),
    (p_company_id, 'GOV', '政府機關', false, 60, 3, true),
    
    -- 廠商類型
    (p_company_id, 'VENDOR-CO', '公司外包', true, 30, 10, true),
    (p_company_id, 'VENDOR-IND', '個人外包', true, 7, 11, true),
    (p_company_id, 'SUPPLIER', '供應商', true, 30, 12, true);
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- 4. 服務/商品分類 (用於請款單)
-- =====================================================

CREATE TABLE IF NOT EXISTS acct_service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- 預設設定
    default_price DECIMAL(12,2),            -- 預設價格
    default_unit VARCHAR(20),               -- 預設單位: 次, 月, 專案
    default_tax_type VARCHAR(20) DEFAULT 'taxable',
    
    -- 對應收入科目
    income_account_code VARCHAR(20),
    income_account_id UUID REFERENCES acct_chart_of_accounts(id),
    
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, code)
);

-- 預設服務分類
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


-- =====================================================
-- 5. 發票分類
-- =====================================================

CREATE TABLE IF NOT EXISTS acct_invoice_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    
    code VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- 發票設定
    invoice_type VARCHAR(20) NOT NULL,      -- B2B, B2C, exempt
    tax_type VARCHAR(20) DEFAULT 'taxable', -- taxable, zero_rate, exempt
    default_tax_rate DECIMAL(5,2) DEFAULT 5.00,
    
    -- ezPay 對應
    ezpay_category VARCHAR(10),             -- ezPay 類別代碼
    
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, code)
);

-- 預設發票類型
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


-- =====================================================
-- 6. 付款方式
-- =====================================================

CREATE TABLE IF NOT EXISTS acct_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    
    code VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- 對應帳戶
    default_account_id UUID REFERENCES acct_bank_accounts(id),
    
    -- 設定
    has_fee BOOLEAN DEFAULT false,          -- 是否有手續費
    fee_rate DECIMAL(5,2),                  -- 手續費率
    fee_fixed DECIMAL(10,2),                -- 固定手續費
    
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, code)
);

-- 預設付款方式
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


-- =====================================================
-- 7. 勞報單分類
-- =====================================================

CREATE TABLE IF NOT EXISTS acct_labor_report_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    
    code VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- 稅務設定
    income_type_code VARCHAR(10) NOT NULL,  -- 所得類別: 50 執行業務, 9A 稿費, 9B 講演鐘點費
    withholding_rate DECIMAL(5,2),          -- 預扣稅率
    nhi_rate DECIMAL(5,2),                  -- 二代健保費率
    
    -- 免稅門檻
    tax_threshold DECIMAL(10,2),            -- 單次給付未達此金額免扣稅
    nhi_threshold DECIMAL(10,2),            -- 單次給付未達此金額免扣二代健保
    
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, code)
);

-- 預設勞報類型 (2025 年稅率)
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


-- =====================================================
-- 8. 合約類型
-- =====================================================

CREATE TABLE IF NOT EXISTS acct_contract_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    
    code VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- 預設設定
    default_duration_months INT,            -- 預設合約期間（月）
    default_payment_terms INT,              -- 預設付款天數
    auto_renew BOOLEAN DEFAULT false,       -- 是否自動續約
    
    -- 提醒設定
    reminder_days_before INT DEFAULT 30,    -- 到期前幾天提醒
    
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, code)
);

-- 預設合約類型
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


-- =====================================================
-- 9. 統一初始化函數
-- =====================================================

CREATE OR REPLACE FUNCTION initialize_company_categories(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
    -- 建立所有預設分類
    PERFORM create_default_transaction_categories(p_company_id);
    PERFORM create_default_customer_types(p_company_id);
    PERFORM create_default_service_categories(p_company_id);
    PERFORM create_default_invoice_types(p_company_id);
    PERFORM create_default_payment_methods(p_company_id);
    PERFORM create_default_labor_report_types(p_company_id);
    PERFORM create_default_contract_types(p_company_id);
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- 10. 觸發器：新公司自動建立分類
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_initialize_company_categories()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM initialize_company_categories(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 在建立公司後自動初始化分類
DROP TRIGGER IF EXISTS after_company_insert_categories ON acct_companies;
CREATE TRIGGER after_company_insert_categories
    AFTER INSERT ON acct_companies
    FOR EACH ROW
    EXECUTE FUNCTION trigger_initialize_company_categories();


-- =====================================================
-- 11. 索引
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_transaction_categories_company ON acct_transaction_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_transaction_subcategories_category ON acct_transaction_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_transaction_subcategories_account ON acct_transaction_subcategories(account_code);
CREATE INDEX IF NOT EXISTS idx_customer_types_company ON acct_customer_types(company_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_company ON acct_service_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_types_company ON acct_invoice_types(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_company ON acct_payment_methods(company_id);
CREATE INDEX IF NOT EXISTS idx_labor_report_types_company ON acct_labor_report_types(company_id);
CREATE INDEX IF NOT EXISTS idx_contract_types_company ON acct_contract_types(company_id);


-- =====================================================
-- 12. RLS 政策
-- =====================================================

ALTER TABLE acct_transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_transaction_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_customer_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_invoice_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_labor_report_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_contract_types ENABLE ROW LEVEL SECURITY;

-- 為所有分類表建立 RLS 政策
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN 
        SELECT unnest(ARRAY[
            'acct_transaction_categories',
            'acct_transaction_subcategories', 
            'acct_customer_types',
            'acct_service_categories',
            'acct_invoice_types',
            'acct_payment_methods',
            'acct_labor_report_types',
            'acct_contract_types'
        ])
    LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS %I_select ON %I;
            CREATE POLICY %I_select ON %I FOR SELECT
                USING (company_id IN (
                    SELECT company_id FROM acct_user_companies 
                    WHERE user_id = auth.uid()
                ));
        ', table_name, table_name, table_name, table_name);
        
        EXECUTE format('
            DROP POLICY IF EXISTS %I_insert ON %I;
            CREATE POLICY %I_insert ON %I FOR INSERT
                WITH CHECK (company_id IN (
                    SELECT company_id FROM acct_user_companies 
                    WHERE user_id = auth.uid() AND role IN (''admin'', ''accountant'')
                ));
        ', table_name, table_name, table_name, table_name);
        
        EXECUTE format('
            DROP POLICY IF EXISTS %I_update ON %I;
            CREATE POLICY %I_update ON %I FOR UPDATE
                USING (company_id IN (
                    SELECT company_id FROM acct_user_companies 
                    WHERE user_id = auth.uid() AND role IN (''admin'', ''accountant'')
                ));
        ', table_name, table_name, table_name, table_name);
        
        EXECUTE format('
            DROP POLICY IF EXISTS %I_delete ON %I;
            CREATE POLICY %I_delete ON %I FOR DELETE
                USING (company_id IN (
                    SELECT company_id FROM acct_user_companies 
                    WHERE user_id = auth.uid() AND role = ''admin''
                ) AND is_system = false);
        ', table_name, table_name, table_name, table_name);
    END LOOP;
END $$;
