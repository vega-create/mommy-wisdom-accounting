-- =====================================================
-- 智慧媽咪商業管理系統 - 業務模組資料庫結構
-- Phase 2-7 完整設計
-- 版本: v1.0
-- 建立日期: 2026-01-24
-- =====================================================

-- =====================================================
-- Phase 2: 客戶管理擴充
-- =====================================================

-- 擴充客戶表欄位
ALTER TABLE acct_customers ADD COLUMN IF NOT EXISTS customer_type_id UUID REFERENCES acct_customer_types(id);
ALTER TABLE acct_customers ADD COLUMN IF NOT EXISTS line_user_id VARCHAR(100);
ALTER TABLE acct_customers ADD COLUMN IF NOT EXISTS line_display_name VARCHAR(100);
ALTER TABLE acct_customers ADD COLUMN IF NOT EXISTS preferred_title VARCHAR(50);          -- 稱呼: 老闆、經理、王總
ALTER TABLE acct_customers ADD COLUMN IF NOT EXISTS is_vendor BOOLEAN DEFAULT false;      -- 是否為廠商
ALTER TABLE acct_customers ADD COLUMN IF NOT EXISTS vendor_type VARCHAR(20);              -- company, individual
ALTER TABLE acct_customers ADD COLUMN IF NOT EXISTS can_issue_invoice BOOLEAN DEFAULT false; -- 廠商是否會開發票給我們
ALTER TABLE acct_customers ADD COLUMN IF NOT EXISTS billing_contact_name VARCHAR(100);    -- 請款聯絡人
ALTER TABLE acct_customers ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);           -- 請款 Email
ALTER TABLE acct_customers ADD COLUMN IF NOT EXISTS billing_phone VARCHAR(50);            -- 請款電話
ALTER TABLE acct_customers ADD COLUMN IF NOT EXISTS line_notify_enabled BOOLEAN DEFAULT true; -- 是否接收 LINE 通知
ALTER TABLE acct_customers ADD COLUMN IF NOT EXISTS default_payment_terms INT DEFAULT 30; -- 預設付款天數
ALTER TABLE acct_customers ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12,2);           -- 信用額度
ALTER TABLE acct_customers ADD COLUMN IF NOT EXISTS notes TEXT;                           -- 備註

-- 公司收款帳戶
CREATE TABLE IF NOT EXISTS acct_payment_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    
    -- 帳戶資訊
    bank_code VARCHAR(10) NOT NULL,         -- 銀行代碼: 009
    bank_name VARCHAR(50) NOT NULL,         -- 銀行名稱: 彰化銀行
    branch_name VARCHAR(50),                -- 分行名稱
    account_number VARCHAR(50) NOT NULL,    -- 帳號
    account_name VARCHAR(100) NOT NULL,     -- 戶名
    
    -- 設定
    is_default BOOLEAN DEFAULT false,       -- 是否為預設收款帳戶
    is_active BOOLEAN DEFAULT true,
    display_on_invoice BOOLEAN DEFAULT true, -- 是否顯示在請款單上
    
    -- 關聯銀行帳戶（帳務用）
    bank_account_id UUID REFERENCES acct_bank_accounts(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_accounts_company ON acct_payment_accounts(company_id);


-- =====================================================
-- Phase 3: 請款收款系統
-- =====================================================

-- 請款單主表
CREATE TABLE IF NOT EXISTS acct_billing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    
    -- 基本資訊
    billing_number VARCHAR(50) NOT NULL,    -- 請款單號: INV-2026-001
    customer_id UUID NOT NULL REFERENCES acct_customers(id),
    
    -- 服務內容 (自由文字，完全可編輯)
    service_description TEXT NOT NULL,      -- 服務說明
    service_category_id UUID REFERENCES acct_service_categories(id),
    service_period_start DATE,              -- 服務期間起
    service_period_end DATE,                -- 服務期間迄
    
    -- 金額
    amount DECIMAL(12,2) NOT NULL,          -- 請款金額
    tax_type VARCHAR(20) DEFAULT 'taxable', -- taxable, zero_rate, exempt
    tax_rate DECIMAL(5,2) DEFAULT 5.00,     -- 稅率
    tax_amount DECIMAL(12,2) DEFAULT 0,     -- 稅額
    total_amount DECIMAL(12,2) NOT NULL,    -- 總金額 (含稅)
    
    -- 收款資訊
    payment_account_id UUID REFERENCES acct_payment_accounts(id),
    due_date DATE,                          -- 付款期限
    
    -- 成本記錄 (選填，內部用)
    has_cost BOOLEAN DEFAULT false,
    cost_amount DECIMAL(12,2),              -- 成本金額
    cost_vendor_id UUID REFERENCES acct_customers(id), -- 外包對象
    cost_vendor_type VARCHAR(20),           -- company, individual
    cost_description TEXT,                  -- 成本說明
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'draft',     -- draft, sent, confirmed, paid, overdue, cancelled
    
    -- 備註與附件
    notes TEXT,                             -- 內部備註
    customer_notes TEXT,                    -- 給客戶的備註
    attachments JSONB DEFAULT '[]',         -- 附件 [{name, url, type}]
    
    -- LINE 通知
    line_sent_at TIMESTAMPTZ,               -- 請款通知發送時間
    line_message_id VARCHAR(100),           -- LINE 訊息 ID
    
    -- 收款確認
    paid_at TIMESTAMPTZ,                    -- 收款時間
    paid_amount DECIMAL(12,2),              -- 實收金額
    paid_account_id UUID REFERENCES acct_bank_accounts(id), -- 收款帳戶
    payment_method_id UUID REFERENCES acct_payment_methods(id),
    payment_reference VARCHAR(100),         -- 付款參考 (轉帳後五碼等)
    
    -- 關聯記錄
    transaction_id UUID REFERENCES acct_transactions(id), -- 自動產生的交易記錄
    invoice_id UUID,                        -- 關聯發票 (Phase 5)
    
    -- 時間戳
    created_by UUID REFERENCES acct_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_requests_company ON acct_billing_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_requests_customer ON acct_billing_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_requests_status ON acct_billing_requests(status);
CREATE INDEX IF NOT EXISTS idx_billing_requests_due_date ON acct_billing_requests(due_date);

-- 請款單號序列
CREATE SEQUENCE IF NOT EXISTS billing_number_seq START 1;


-- =====================================================
-- Phase 4: 成本與應付管理
-- =====================================================

-- 應付款項
CREATE TABLE IF NOT EXISTS acct_payables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    
    -- 基本資訊
    payable_number VARCHAR(50) NOT NULL,    -- 應付單號
    vendor_id UUID NOT NULL REFERENCES acct_customers(id), -- 外包對象
    vendor_type VARCHAR(20) NOT NULL,       -- company, individual
    
    -- 來源
    source_type VARCHAR(20),                -- billing (從請款單產生), manual
    source_id UUID,                         -- 來源單據 ID
    billing_request_id UUID REFERENCES acct_billing_requests(id),
    
    -- 金額
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    
    -- 付款資訊
    due_date DATE,
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'pending',   -- pending, approved, paid, cancelled
    
    -- 公司外包：收到的發票資訊
    vendor_invoice_number VARCHAR(50),      -- 對方發票號碼
    vendor_invoice_date DATE,               -- 對方發票日期
    vendor_invoice_file VARCHAR(500),       -- 發票檔案 URL
    
    -- 個人外包：勞報單關聯
    labor_report_id UUID,                   -- 關聯勞報單 (Phase 6)
    
    -- 付款確認
    paid_at TIMESTAMPTZ,
    paid_amount DECIMAL(12,2),
    paid_account_id UUID REFERENCES acct_bank_accounts(id),
    payment_method_id UUID REFERENCES acct_payment_methods(id),
    payment_reference VARCHAR(100),
    
    -- LINE 通知
    reminder_sent_at TIMESTAMPTZ,           -- 提醒發送時間
    
    -- 關聯記錄
    transaction_id UUID REFERENCES acct_transactions(id),
    
    created_by UUID REFERENCES acct_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payables_company ON acct_payables(company_id);
CREATE INDEX IF NOT EXISTS idx_payables_vendor ON acct_payables(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payables_status ON acct_payables(status);
CREATE INDEX IF NOT EXISTS idx_payables_due_date ON acct_payables(due_date);


-- =====================================================
-- Phase 5: 電子發票整合
-- =====================================================

-- ezPay 設定
CREATE TABLE IF NOT EXISTS acct_invoice_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    
    -- ezPay API 設定
    merchant_id VARCHAR(50),                -- 商店代號
    hash_key VARCHAR(100),                  -- HashKey
    hash_iv VARCHAR(100),                   -- HashIV
    
    -- 環境設定
    is_production BOOLEAN DEFAULT false,    -- 正式環境
    
    -- 發票設定
    default_tax_type VARCHAR(20) DEFAULT 'taxable',
    auto_issue_on_payment BOOLEAN DEFAULT false, -- 收款後自動開票
    auto_notify_customer BOOLEAN DEFAULT true,   -- 開票後自動通知客戶
    
    -- 字軌設定
    current_track VARCHAR(2),               -- 目前字軌
    track_start_number INT,                 -- 起始號碼
    track_end_number INT,                   -- 結束號碼
    track_current_number INT,               -- 目前號碼
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id)
);

-- 發票主表
CREATE TABLE IF NOT EXISTS acct_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    
    -- 發票資訊
    invoice_number VARCHAR(20),             -- 發票號碼: AB-12345678
    invoice_date DATE NOT NULL,
    
    -- 買受人資訊
    customer_id UUID REFERENCES acct_customers(id),
    buyer_name VARCHAR(100),                -- 買受人名稱
    buyer_tax_id VARCHAR(20),               -- 統一編號 (B2B)
    buyer_email VARCHAR(255),
    buyer_phone VARCHAR(50),
    buyer_address TEXT,
    
    -- 發票類型
    invoice_type_id UUID REFERENCES acct_invoice_types(id),
    invoice_type VARCHAR(20) NOT NULL,      -- B2B, B2C
    tax_type VARCHAR(20) DEFAULT 'taxable',
    
    -- 金額
    sales_amount DECIMAL(12,2) NOT NULL,    -- 銷售額 (未稅)
    tax_amount DECIMAL(12,2) DEFAULT 0,     -- 稅額
    total_amount DECIMAL(12,2) NOT NULL,    -- 總金額
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'draft',     -- draft, issued, void, cancelled
    
    -- 作廢資訊
    void_at TIMESTAMPTZ,
    void_reason TEXT,
    
    -- 來源
    billing_request_id UUID REFERENCES acct_billing_requests(id),
    
    -- ezPay 回應
    ezpay_trans_num VARCHAR(50),            -- ezPay 交易序號
    ezpay_invoice_trans_no VARCHAR(50),     -- ezPay 發票交易序號
    ezpay_random_num VARCHAR(10),           -- 隨機碼
    ezpay_response JSONB,                   -- 完整回應
    
    -- LINE 通知
    line_sent_at TIMESTAMPTZ,
    
    created_by UUID REFERENCES acct_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 發票明細
CREATE TABLE IF NOT EXISTS acct_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES acct_invoices(id) ON DELETE CASCADE,
    
    -- 明細資訊
    item_name VARCHAR(200) NOT NULL,        -- 品名
    quantity DECIMAL(10,2) DEFAULT 1,       -- 數量
    unit VARCHAR(20),                       -- 單位
    unit_price DECIMAL(12,2) NOT NULL,      -- 單價
    amount DECIMAL(12,2) NOT NULL,          -- 金額
    
    -- 備註
    remark TEXT,
    
    sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON acct_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON acct_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON acct_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON acct_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON acct_invoice_items(invoice_id);


-- =====================================================
-- Phase 6: 勞報系統整合
-- =====================================================

-- 外包人員
CREATE TABLE IF NOT EXISTS acct_freelancers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    
    -- 基本資訊
    name VARCHAR(100) NOT NULL,
    english_name VARCHAR(100),
    id_number VARCHAR(20),                  -- 身分證字號
    birthday DATE,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    
    -- LINE 資訊
    line_user_id VARCHAR(100),
    line_display_name VARCHAR(100),
    
    -- 銀行資訊
    bank_code VARCHAR(10),
    bank_name VARCHAR(50),
    bank_account VARCHAR(50),
    bank_account_name VARCHAR(100),
    
    -- 勞報設定
    default_labor_type_id UUID REFERENCES acct_labor_report_types(id),
    
    -- 文件
    id_card_front VARCHAR(500),             -- 身分證正面
    id_card_back VARCHAR(500),              -- 身分證反面
    passbook_image VARCHAR(500),            -- 存摺封面
    
    -- 狀態
    is_active BOOLEAN DEFAULT true,
    is_complete BOOLEAN DEFAULT false,      -- 資料是否完整
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 勞報單
CREATE TABLE IF NOT EXISTS acct_labor_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    
    -- 基本資訊
    report_number VARCHAR(50) NOT NULL,     -- 勞報單號
    freelancer_id UUID NOT NULL REFERENCES acct_freelancers(id),
    
    -- 勞報類型
    labor_type_id UUID NOT NULL REFERENCES acct_labor_report_types(id),
    income_type_code VARCHAR(10) NOT NULL,  -- 所得類別代碼
    
    -- 服務內容
    service_period_start DATE,
    service_period_end DATE,
    work_description TEXT NOT NULL,
    
    -- 金額計算
    gross_amount DECIMAL(12,2) NOT NULL,    -- 實付金額 (到手)
    withholding_tax DECIMAL(12,2) DEFAULT 0, -- 預扣所得稅
    nhi_premium DECIMAL(12,2) DEFAULT 0,    -- 二代健保
    total_income DECIMAL(12,2) NOT NULL,    -- 申報所得 (毛額)
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'draft',     -- draft, pending_sign, signed, paid, cancelled
    
    -- 簽署
    sign_token VARCHAR(100),                -- 簽署 Token
    sign_url VARCHAR(500),                  -- 簽署連結
    signed_at TIMESTAMPTZ,                  -- 簽署時間
    signature_image VARCHAR(500),           -- 簽名圖片
    signed_ip VARCHAR(50),                  -- 簽署 IP
    
    -- LINE 通知
    sign_request_sent_at TIMESTAMPTZ,       -- 簽署請求發送時間
    sign_complete_notified_at TIMESTAMPTZ,  -- 簽署完成通知時間
    payment_notified_at TIMESTAMPTZ,        -- 匯款通知時間
    
    -- 付款
    paid_at TIMESTAMPTZ,
    paid_account_id UUID REFERENCES acct_bank_accounts(id),
    payment_reference VARCHAR(100),
    
    -- 來源
    payable_id UUID REFERENCES acct_payables(id),
    
    -- 關聯記錄
    transaction_id UUID REFERENCES acct_transactions(id),
    
    created_by UUID REFERENCES acct_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freelancers_company ON acct_freelancers(company_id);
CREATE INDEX IF NOT EXISTS idx_labor_reports_company ON acct_labor_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_labor_reports_freelancer ON acct_labor_reports(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_labor_reports_status ON acct_labor_reports(status);

-- 更新 payables 的 labor_report_id 關聯
ALTER TABLE acct_payables ADD CONSTRAINT fk_payables_labor_report 
    FOREIGN KEY (labor_report_id) REFERENCES acct_labor_reports(id);


-- =====================================================
-- Phase 7: 報價合約系統
-- =====================================================

-- 報價單
CREATE TABLE IF NOT EXISTS acct_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    
    -- 基本資訊
    quotation_number VARCHAR(50) NOT NULL,
    customer_id UUID NOT NULL REFERENCES acct_customers(id),
    
    -- 報價資訊
    title VARCHAR(200) NOT NULL,            -- 報價標題
    description TEXT,                       -- 報價說明
    
    -- 金額
    subtotal DECIMAL(12,2) NOT NULL,        -- 小計
    discount_amount DECIMAL(12,2) DEFAULT 0, -- 折扣
    tax_amount DECIMAL(12,2) DEFAULT 0,     -- 稅額
    total_amount DECIMAL(12,2) NOT NULL,    -- 總金額
    
    -- 有效期
    valid_until DATE,
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'draft',     -- draft, sent, accepted, rejected, expired, converted
    
    -- LINE 通知
    line_sent_at TIMESTAMPTZ,
    
    -- 轉換為合約
    converted_to_contract_id UUID,          -- 轉換後的合約 ID
    converted_at TIMESTAMPTZ,
    
    created_by UUID REFERENCES acct_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 報價單明細
CREATE TABLE IF NOT EXISTS acct_quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES acct_quotations(id) ON DELETE CASCADE,
    
    -- 明細資訊
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
    
    -- 基本資訊
    contract_number VARCHAR(50) NOT NULL,
    customer_id UUID NOT NULL REFERENCES acct_customers(id),
    
    -- 合約類型
    contract_type_id UUID REFERENCES acct_contract_types(id),
    
    -- 合約資訊
    title VARCHAR(200) NOT NULL,
    description TEXT,
    terms TEXT,                             -- 合約條款
    
    -- 期間
    start_date DATE NOT NULL,
    end_date DATE,
    auto_renew BOOLEAN DEFAULT false,
    
    -- 金額
    total_amount DECIMAL(12,2) NOT NULL,
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'draft',     -- draft, pending_sign, active, completed, terminated
    
    -- 簽署
    sign_token VARCHAR(100),
    sign_url VARCHAR(500),
    signed_at TIMESTAMPTZ,
    signature_image VARCHAR(500),
    signed_ip VARCHAR(50),
    
    -- LINE 通知
    sign_request_sent_at TIMESTAMPTZ,
    sign_complete_notified_at TIMESTAMPTZ,
    expiry_reminder_sent_at TIMESTAMPTZ,
    
    -- 來源
    quotation_id UUID REFERENCES acct_quotations(id),
    
    created_by UUID REFERENCES acct_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 合約付款期程
CREATE TABLE IF NOT EXISTS acct_contract_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES acct_contracts(id) ON DELETE CASCADE,
    
    -- 期程資訊
    payment_number INT NOT NULL,            -- 第幾期
    description VARCHAR(200),               -- 期程說明: 第一期款、尾款
    
    -- 金額
    amount DECIMAL(12,2) NOT NULL,
    percentage DECIMAL(5,2),                -- 佔總金額比例
    
    -- 預定日期
    due_date DATE NOT NULL,
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'pending',   -- pending, invoiced, paid
    
    -- 關聯
    billing_request_id UUID REFERENCES acct_billing_requests(id),
    invoice_id UUID REFERENCES acct_invoices(id),
    
    -- LINE 通知
    reminder_sent_at TIMESTAMPTZ,           -- 付款提醒發送時間
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 更新報價單的合約關聯
ALTER TABLE acct_quotations ADD CONSTRAINT fk_quotations_contract 
    FOREIGN KEY (converted_to_contract_id) REFERENCES acct_contracts(id);

CREATE INDEX IF NOT EXISTS idx_quotations_company ON acct_quotations(company_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON acct_quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON acct_quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON acct_quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_contracts_company ON acct_contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_customer ON acct_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON acct_contracts(status);
CREATE INDEX IF NOT EXISTS idx_contract_payments_contract ON acct_contract_payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_payments_due_date ON acct_contract_payments(due_date);


-- =====================================================
-- RLS 政策
-- =====================================================

ALTER TABLE acct_payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_billing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_invoice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_freelancers ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_labor_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_contract_payments ENABLE ROW LEVEL SECURITY;

-- 為所有業務表建立 RLS 政策 (簡化版)
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN 
        SELECT unnest(ARRAY[
            'acct_payment_accounts',
            'acct_billing_requests',
            'acct_payables',
            'acct_invoice_settings',
            'acct_invoices',
            'acct_freelancers',
            'acct_labor_reports',
            'acct_quotations',
            'acct_contracts'
        ])
    LOOP
        -- SELECT: 公司成員可查看
        EXECUTE format('
            DROP POLICY IF EXISTS %I_select ON %I;
            CREATE POLICY %I_select ON %I FOR SELECT
                USING (company_id IN (
                    SELECT company_id FROM acct_user_companies 
                    WHERE user_id = auth.uid()
                ));
        ', table_name, table_name, table_name, table_name);
        
        -- INSERT: admin, accountant, pm 可新增
        EXECUTE format('
            DROP POLICY IF EXISTS %I_insert ON %I;
            CREATE POLICY %I_insert ON %I FOR INSERT
                WITH CHECK (company_id IN (
                    SELECT company_id FROM acct_user_companies 
                    WHERE user_id = auth.uid() AND role IN (''admin'', ''accountant'', ''pm'')
                ));
        ', table_name, table_name, table_name, table_name);
        
        -- UPDATE: admin, accountant, pm 可更新
        EXECUTE format('
            DROP POLICY IF EXISTS %I_update ON %I;
            CREATE POLICY %I_update ON %I FOR UPDATE
                USING (company_id IN (
                    SELECT company_id FROM acct_user_companies 
                    WHERE user_id = auth.uid() AND role IN (''admin'', ''accountant'', ''pm'')
                ));
        ', table_name, table_name, table_name, table_name);
        
        -- DELETE: 僅 admin 可刪除
        EXECUTE format('
            DROP POLICY IF EXISTS %I_delete ON %I;
            CREATE POLICY %I_delete ON %I FOR DELETE
                USING (company_id IN (
                    SELECT company_id FROM acct_user_companies 
                    WHERE user_id = auth.uid() AND role = ''admin''
                ));
        ', table_name, table_name, table_name, table_name);
    END LOOP;
END $$;

-- 明細表的 RLS (透過主表關聯)
CREATE POLICY acct_invoice_items_select ON acct_invoice_items FOR SELECT
    USING (invoice_id IN (SELECT id FROM acct_invoices));
CREATE POLICY acct_invoice_items_all ON acct_invoice_items FOR ALL
    USING (invoice_id IN (SELECT id FROM acct_invoices));

CREATE POLICY acct_quotation_items_select ON acct_quotation_items FOR SELECT
    USING (quotation_id IN (SELECT id FROM acct_quotations));
CREATE POLICY acct_quotation_items_all ON acct_quotation_items FOR ALL
    USING (quotation_id IN (SELECT id FROM acct_quotations));

CREATE POLICY acct_contract_payments_select ON acct_contract_payments FOR SELECT
    USING (contract_id IN (SELECT id FROM acct_contracts));
CREATE POLICY acct_contract_payments_all ON acct_contract_payments FOR ALL
    USING (contract_id IN (SELECT id FROM acct_contracts));


-- =====================================================
-- 輔助函數
-- =====================================================

-- 產生請款單號
CREATE OR REPLACE FUNCTION generate_billing_number(p_company_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR(4);
    v_seq INT;
    v_number VARCHAR(50);
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(billing_number FROM 'INV-' || v_year || '-(\d+)') AS INT)
    ), 0) + 1
    INTO v_seq
    FROM acct_billing_requests
    WHERE company_id = p_company_id
    AND billing_number LIKE 'INV-' || v_year || '-%';
    
    v_number := 'INV-' || v_year || '-' || LPAD(v_seq::TEXT, 3, '0');
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- 產生應付單號
CREATE OR REPLACE FUNCTION generate_payable_number(p_company_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR(4);
    v_seq INT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(payable_number FROM 'PAY-' || v_year || '-(\d+)') AS INT)
    ), 0) + 1
    INTO v_seq
    FROM acct_payables
    WHERE company_id = p_company_id
    AND payable_number LIKE 'PAY-' || v_year || '-%';
    
    RETURN 'PAY-' || v_year || '-' || LPAD(v_seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 產生勞報單號
CREATE OR REPLACE FUNCTION generate_labor_report_number(p_company_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR(4);
    v_seq INT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(report_number FROM 'LR-' || v_year || '-(\d+)') AS INT)
    ), 0) + 1
    INTO v_seq
    FROM acct_labor_reports
    WHERE company_id = p_company_id
    AND report_number LIKE 'LR-' || v_year || '-%';
    
    RETURN 'LR-' || v_year || '-' || LPAD(v_seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 產生報價單號
CREATE OR REPLACE FUNCTION generate_quotation_number(p_company_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR(4);
    v_seq INT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(quotation_number FROM 'QT-' || v_year || '-(\d+)') AS INT)
    ), 0) + 1
    INTO v_seq
    FROM acct_quotations
    WHERE company_id = p_company_id
    AND quotation_number LIKE 'QT-' || v_year || '-%';
    
    RETURN 'QT-' || v_year || '-' || LPAD(v_seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 產生合約編號
CREATE OR REPLACE FUNCTION generate_contract_number(p_company_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR(4);
    v_seq INT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(contract_number FROM 'CT-' || v_year || '-(\d+)') AS INT)
    ), 0) + 1
    INTO v_seq
    FROM acct_contracts
    WHERE company_id = p_company_id
    AND contract_number LIKE 'CT-' || v_year || '-%';
    
    RETURN 'CT-' || v_year || '-' || LPAD(v_seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;
