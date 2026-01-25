-- Phase 3: 請款收款系統
-- 包含請款單、收款帳戶

-- 公司收款帳戶
CREATE TABLE IF NOT EXISTS acct_payment_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id),
    
    bank_code VARCHAR(10) NOT NULL,        -- 銀行代碼
    bank_name VARCHAR(50) NOT NULL,        -- 銀行名稱
    branch_name VARCHAR(50),               -- 分行名稱
    account_number VARCHAR(30) NOT NULL,   -- 帳號
    account_name VARCHAR(100) NOT NULL,    -- 戶名
    
    is_default BOOLEAN DEFAULT false,      -- 是否為預設帳戶
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_accounts_company ON acct_payment_accounts(company_id);

-- 請款單主表
CREATE TABLE IF NOT EXISTS acct_billing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id),
    
    -- 請款單號（自動產生）
    billing_number VARCHAR(20) NOT NULL UNIQUE,
    
    -- 客戶資訊
    customer_id UUID REFERENCES acct_customers(id),
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(100),
    customer_line_id VARCHAR(100),
    
    -- 請款內容
    title VARCHAR(200) NOT NULL,           -- 請款標題
    description TEXT,                       -- 服務說明
    billing_month VARCHAR(10),              -- 請款月份 (例: 2026-01)
    
    -- 金額
    amount DECIMAL(12, 2) NOT NULL,         -- 請款金額
    tax_amount DECIMAL(12, 2) DEFAULT 0,    -- 稅額
    total_amount DECIMAL(12, 2) NOT NULL,   -- 總金額
    
    -- 成本記錄（外包費用）
    cost_amount DECIMAL(12, 2) DEFAULT 0,   -- 成本金額
    cost_vendor_id UUID REFERENCES acct_customers(id), -- 外包廠商
    cost_description TEXT,
    
    -- 收款資訊
    payment_account_id UUID REFERENCES acct_payment_accounts(id),
    due_date DATE NOT NULL,                 -- 付款期限
    
    -- 狀態
    status VARCHAR(20) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    
    -- 通知記錄
    notification_sent_at TIMESTAMPTZ,       -- 請款通知發送時間
    reminder_sent_at TIMESTAMPTZ,           -- 提醒通知發送時間
    
    -- 收款記錄
    paid_at TIMESTAMPTZ,                    -- 實際收款時間
    paid_amount DECIMAL(12, 2),             -- 實際收款金額
    payment_method VARCHAR(50),             -- 付款方式
    payment_note TEXT,                      -- 付款備註
    
    -- 關聯記錄
    transaction_id UUID,                    -- 關聯的交易記錄
    invoice_id UUID,                        -- 關聯的發票
    
    -- 附件
    attachments JSONB DEFAULT '[]',         -- 附件列表
    
    -- 時間戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_billing_company ON acct_billing_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_customer ON acct_billing_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_status ON acct_billing_requests(status);
CREATE INDEX IF NOT EXISTS idx_billing_due_date ON acct_billing_requests(due_date);

-- RLS
ALTER TABLE acct_payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE acct_billing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read payment_accounts" ON acct_payment_accounts
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated manage payment_accounts" ON acct_payment_accounts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read billing" ON acct_billing_requests
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated manage billing" ON acct_billing_requests
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 請款單號序列函數
CREATE OR REPLACE FUNCTION generate_billing_number(p_company_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
    v_year VARCHAR(4);
    v_month VARCHAR(2);
    v_seq INT;
    v_number VARCHAR(20);
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_month := TO_CHAR(NOW(), 'MM');
    
    -- 取得當月序號
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(billing_number FROM 8 FOR 4) AS INT)
    ), 0) + 1
    INTO v_seq
    FROM acct_billing_requests
    WHERE company_id = p_company_id
    AND billing_number LIKE 'BIL' || v_year || v_month || '%';
    
    v_number := 'BIL' || v_year || v_month || LPAD(v_seq::TEXT, 4, '0');
    
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- 插入預設收款帳戶（智慧媽咪）
DO $$
DECLARE
    v_company_id UUID;
BEGIN
    SELECT id INTO v_company_id FROM acct_companies WHERE name LIKE '%智慧媽咪%' LIMIT 1;
    
    IF v_company_id IS NOT NULL THEN
        INSERT INTO acct_payment_accounts (company_id, bank_code, bank_name, branch_name, account_number, account_name, is_default)
        VALUES (
            v_company_id,
            '009',
            '彰化銀行',
            '潭子分行',
            '5765-01-07879-500',
            '智慧媽咪國際有限公司',
            true
        ) ON CONFLICT DO NOTHING;
    END IF;
END $$;

COMMENT ON TABLE acct_payment_accounts IS '公司收款帳戶';
COMMENT ON TABLE acct_billing_requests IS '請款單';
