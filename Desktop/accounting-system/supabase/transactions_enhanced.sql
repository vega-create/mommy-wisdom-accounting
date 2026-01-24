-- =====================================================
-- 智慧媽咪商業管理系統 - 交易記錄擴充
-- 模仿藍途的交易建立功能
-- 版本: v1.0
-- 建立日期: 2026-01-24
-- =====================================================

-- =====================================================
-- 1. 擴充交易記錄表欄位
-- =====================================================

-- 交易分類 (關聯新的分類表)
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES acct_transaction_subcategories(id);

-- 交易狀況
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'same_day'
CHECK (payment_status IN ('same_day', 'prepaid', 'pending', 'partial', 'completed'));
-- same_day: 同日付款/收款
-- prepaid: 預付/預收
-- pending: 待付/待收
-- partial: 部分付款/收款
-- completed: 已完成

-- 對象 (已有 customer_id，這裡加說明用欄位)
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS contact_name VARCHAR(100);  -- 對象顯示名稱 (快取)

-- 手續費
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS has_fee BOOLEAN DEFAULT false;
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS fee_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS fee_account_id UUID REFERENCES acct_account_categories(id); -- 手續費科目

-- 營業稅
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS has_tax BOOLEAN DEFAULT false;
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS tax_type VARCHAR(20) DEFAULT 'taxable'
CHECK (tax_type IN ('taxable', 'zero_rate', 'exempt'));
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 5.00;
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) DEFAULT 0;

-- 發票資訊
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50);  -- 發票號碼
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS invoice_date DATE;           -- 發票日期

-- 附件
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';  -- [{name, url, type, size}]

-- 憑證日期 (可與交易日期不同)
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS voucher_date DATE;

-- 淨額 (扣除手續費後)
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS net_amount DECIMAL(15,2);  -- 實際入帳/出帳金額

-- 來源追蹤
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(20);  -- billing, payable, labor, contract, manual
ALTER TABLE acct_transactions 
ADD COLUMN IF NOT EXISTS source_id UUID;           -- 來源單據 ID


-- =====================================================
-- 2. 交易狀況選項表 (可自訂)
-- =====================================================

CREATE TABLE IF NOT EXISTS acct_payment_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id) ON DELETE CASCADE,
    
    code VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- 適用類型
    for_income BOOLEAN DEFAULT true,    -- 適用收款
    for_expense BOOLEAN DEFAULT true,   -- 適用付款
    
    -- 顯示
    color VARCHAR(20),                  -- 顏色代碼
    icon VARCHAR(50),                   -- 圖示
    
    sort_order INT DEFAULT 0,
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, code)
);

-- 預設交易狀況
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


-- =====================================================
-- 3. 建立觸發器：自動計算淨額
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_transaction_net_amount()
RETURNS TRIGGER AS $$
BEGIN
    -- 計算淨額 = 金額 - 手續費
    IF NEW.transaction_type = 'income' THEN
        -- 收入：實收 = 金額 - 手續費
        NEW.net_amount := NEW.amount - COALESCE(NEW.fee_amount, 0);
    ELSIF NEW.transaction_type = 'expense' THEN
        -- 支出：實付 = 金額 + 手續費
        NEW.net_amount := NEW.amount + COALESCE(NEW.fee_amount, 0);
    ELSE
        -- 移轉：淨額 = 金額
        NEW.net_amount := NEW.amount;
    END IF;
    
    -- 如果有營業稅且未包含在金額中
    IF NEW.has_tax AND NEW.tax_amount > 0 THEN
        -- 這裡假設金額已含稅，稅額另計
        NULL;
    END IF;
    
    -- 憑證日期預設為交易日期
    IF NEW.voucher_date IS NULL THEN
        NEW.voucher_date := NEW.transaction_date;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_net_amount ON acct_transactions;
CREATE TRIGGER trigger_calculate_net_amount
    BEFORE INSERT OR UPDATE ON acct_transactions
    FOR EACH ROW
    EXECUTE FUNCTION calculate_transaction_net_amount();


-- =====================================================
-- 4. 建立觸發器：交易後自動更新帳戶餘額
-- =====================================================

CREATE OR REPLACE FUNCTION update_bank_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- 新增交易
    IF TG_OP = 'INSERT' THEN
        IF NEW.transaction_type = 'income' THEN
            -- 收入：增加帳戶餘額
            UPDATE acct_bank_accounts 
            SET current_balance = current_balance + COALESCE(NEW.net_amount, NEW.amount)
            WHERE id = NEW.bank_account_id;
            
        ELSIF NEW.transaction_type = 'expense' THEN
            -- 支出：減少帳戶餘額
            UPDATE acct_bank_accounts 
            SET current_balance = current_balance - COALESCE(NEW.net_amount, NEW.amount)
            WHERE id = NEW.bank_account_id;
            
        ELSIF NEW.transaction_type = 'transfer' THEN
            -- 移轉：從來源帳戶扣除，加入目標帳戶
            UPDATE acct_bank_accounts 
            SET current_balance = current_balance - NEW.amount
            WHERE id = NEW.from_account_id;
            
            UPDATE acct_bank_accounts 
            SET current_balance = current_balance + NEW.amount
            WHERE id = NEW.to_account_id;
        END IF;
        
    -- 刪除交易：反向操作
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.transaction_type = 'income' THEN
            UPDATE acct_bank_accounts 
            SET current_balance = current_balance - COALESCE(OLD.net_amount, OLD.amount)
            WHERE id = OLD.bank_account_id;
            
        ELSIF OLD.transaction_type = 'expense' THEN
            UPDATE acct_bank_accounts 
            SET current_balance = current_balance + COALESCE(OLD.net_amount, OLD.amount)
            WHERE id = OLD.bank_account_id;
            
        ELSIF OLD.transaction_type = 'transfer' THEN
            UPDATE acct_bank_accounts 
            SET current_balance = current_balance + OLD.amount
            WHERE id = OLD.from_account_id;
            
            UPDATE acct_bank_accounts 
            SET current_balance = current_balance - OLD.amount
            WHERE id = OLD.to_account_id;
        END IF;
        
    -- 更新交易：先反向舊的，再套用新的
    ELSIF TG_OP = 'UPDATE' THEN
        -- 反向舊交易
        IF OLD.transaction_type = 'income' THEN
            UPDATE acct_bank_accounts 
            SET current_balance = current_balance - COALESCE(OLD.net_amount, OLD.amount)
            WHERE id = OLD.bank_account_id;
        ELSIF OLD.transaction_type = 'expense' THEN
            UPDATE acct_bank_accounts 
            SET current_balance = current_balance + COALESCE(OLD.net_amount, OLD.amount)
            WHERE id = OLD.bank_account_id;
        ELSIF OLD.transaction_type = 'transfer' THEN
            UPDATE acct_bank_accounts 
            SET current_balance = current_balance + OLD.amount
            WHERE id = OLD.from_account_id;
            UPDATE acct_bank_accounts 
            SET current_balance = current_balance - OLD.amount
            WHERE id = OLD.to_account_id;
        END IF;
        
        -- 套用新交易
        IF NEW.transaction_type = 'income' THEN
            UPDATE acct_bank_accounts 
            SET current_balance = current_balance + COALESCE(NEW.net_amount, NEW.amount)
            WHERE id = NEW.bank_account_id;
        ELSIF NEW.transaction_type = 'expense' THEN
            UPDATE acct_bank_accounts 
            SET current_balance = current_balance - COALESCE(NEW.net_amount, NEW.amount)
            WHERE id = NEW.bank_account_id;
        ELSIF NEW.transaction_type = 'transfer' THEN
            UPDATE acct_bank_accounts 
            SET current_balance = current_balance - NEW.amount
            WHERE id = NEW.from_account_id;
            UPDATE acct_bank_accounts 
            SET current_balance = current_balance + NEW.amount
            WHERE id = NEW.to_account_id;
        END IF;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bank_balance ON acct_transactions;
CREATE TRIGGER trigger_update_bank_balance
    AFTER INSERT OR UPDATE OR DELETE ON acct_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_bank_account_balance();


-- =====================================================
-- 5. 建立觸發器：交易後自動產生會計分錄
-- =====================================================

CREATE OR REPLACE FUNCTION auto_generate_voucher_entries()
RETURNS TRIGGER AS $$
DECLARE
    v_voucher_id UUID;
    v_voucher_number VARCHAR(50);
    v_year VARCHAR(4);
    v_seq INT;
    v_bank_account_code VARCHAR(20);
    v_category_code VARCHAR(20);
    v_fee_account_code VARCHAR(20) := '6140';  -- 預設銀行手續費科目
BEGIN
    -- 只有新增或金額變更時才產生憑證
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.amount != NEW.amount) THEN
        
        -- 取得年份和序號
        v_year := TO_CHAR(NEW.transaction_date, 'YYYY');
        SELECT COALESCE(MAX(
            CAST(SUBSTRING(voucher_number FROM v_year || '-(\d+)') AS INT)
        ), 0) + 1
        INTO v_seq
        FROM acct_vouchers
        WHERE company_id = NEW.company_id
        AND voucher_number LIKE v_year || '-%';
        
        v_voucher_number := v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
        
        -- 建立憑證
        INSERT INTO acct_vouchers (
            company_id, voucher_number, voucher_date, voucher_type, 
            description, status, created_by
        ) VALUES (
            NEW.company_id,
            v_voucher_number,
            COALESCE(NEW.voucher_date, NEW.transaction_date),
            CASE NEW.transaction_type 
                WHEN 'income' THEN 'receipt'
                WHEN 'expense' THEN 'payment'
                ELSE 'transfer'
            END,
            NEW.description,
            'approved',
            NEW.created_by
        ) RETURNING id INTO v_voucher_id;
        
        -- 取得銀行帳戶對應的會計科目
        SELECT COALESCE(
            (SELECT code FROM acct_account_categories WHERE id = ba.id),
            CASE ba.account_type
                WHEN 'cash' THEN '1100'
                WHEN 'bank' THEN '1110'
                WHEN 'petty_cash' THEN '1120'
                ELSE '1110'
            END
        )
        INTO v_bank_account_code
        FROM acct_bank_accounts ba
        WHERE ba.id = COALESCE(NEW.bank_account_id, NEW.from_account_id);
        
        -- 取得分類對應的會計科目
        IF NEW.subcategory_id IS NOT NULL THEN
            SELECT account_code INTO v_category_code
            FROM acct_transaction_subcategories
            WHERE id = NEW.subcategory_id;
        ELSIF NEW.category_id IS NOT NULL THEN
            SELECT code INTO v_category_code
            FROM acct_account_categories
            WHERE id = NEW.category_id;
        END IF;
        
        -- 產生分錄
        IF NEW.transaction_type = 'income' THEN
            -- 收入分錄: 借：銀行存款 / 貸：收入
            -- 借方：銀行
            INSERT INTO acct_voucher_items (voucher_id, account_id, description, debit_amount, credit_amount, sort_order)
            SELECT v_voucher_id, id, '收款 - ' || NEW.description, 
                   COALESCE(NEW.net_amount, NEW.amount), 0, 1
            FROM acct_account_categories 
            WHERE company_id = NEW.company_id AND code = v_bank_account_code
            LIMIT 1;
            
            -- 貸方：收入
            INSERT INTO acct_voucher_items (voucher_id, account_id, description, debit_amount, credit_amount, sort_order)
            SELECT v_voucher_id, id, NEW.description, 
                   0, NEW.amount, 2
            FROM acct_account_categories 
            WHERE company_id = NEW.company_id AND code = COALESCE(v_category_code, '4100')
            LIMIT 1;
            
            -- 如果有手續費
            IF NEW.has_fee AND NEW.fee_amount > 0 THEN
                INSERT INTO acct_voucher_items (voucher_id, account_id, description, debit_amount, credit_amount, sort_order)
                SELECT v_voucher_id, id, '手續費', 
                       NEW.fee_amount, 0, 3
                FROM acct_account_categories 
                WHERE company_id = NEW.company_id AND code = v_fee_account_code
                LIMIT 1;
            END IF;
            
        ELSIF NEW.transaction_type = 'expense' THEN
            -- 支出分錄: 借：費用 / 貸：銀行存款
            -- 借方：費用
            INSERT INTO acct_voucher_items (voucher_id, account_id, description, debit_amount, credit_amount, sort_order)
            SELECT v_voucher_id, id, NEW.description, 
                   NEW.amount, 0, 1
            FROM acct_account_categories 
            WHERE company_id = NEW.company_id AND code = COALESCE(v_category_code, '6900')
            LIMIT 1;
            
            -- 如果有手續費
            IF NEW.has_fee AND NEW.fee_amount > 0 THEN
                INSERT INTO acct_voucher_items (voucher_id, account_id, description, debit_amount, credit_amount, sort_order)
                SELECT v_voucher_id, id, '手續費', 
                       NEW.fee_amount, 0, 2
                FROM acct_account_categories 
                WHERE company_id = NEW.company_id AND code = v_fee_account_code
                LIMIT 1;
            END IF;
            
            -- 貸方：銀行
            INSERT INTO acct_voucher_items (voucher_id, account_id, description, debit_amount, credit_amount, sort_order)
            SELECT v_voucher_id, id, '付款 - ' || NEW.description, 
                   0, COALESCE(NEW.net_amount, NEW.amount), 3
            FROM acct_account_categories 
            WHERE company_id = NEW.company_id AND code = v_bank_account_code
            LIMIT 1;
            
        ELSIF NEW.transaction_type = 'transfer' THEN
            -- 移轉分錄: 借：目標帳戶 / 貸：來源帳戶
            -- 借方：目標帳戶
            INSERT INTO acct_voucher_items (voucher_id, account_id, description, debit_amount, credit_amount, sort_order)
            SELECT v_voucher_id, 
                   (SELECT id FROM acct_account_categories WHERE company_id = NEW.company_id AND code = '1110' LIMIT 1),
                   '轉入 - ' || NEW.description, 
                   NEW.amount, 0, 1;
            
            -- 貸方：來源帳戶
            INSERT INTO acct_voucher_items (voucher_id, account_id, description, debit_amount, credit_amount, sort_order)
            SELECT v_voucher_id, 
                   (SELECT id FROM acct_account_categories WHERE company_id = NEW.company_id AND code = v_bank_account_code LIMIT 1),
                   '轉出 - ' || NEW.description, 
                   0, NEW.amount, 2;
        END IF;
        
        -- 更新憑證總額
        UPDATE acct_vouchers 
        SET total_debit = (SELECT COALESCE(SUM(debit_amount), 0) FROM acct_voucher_items WHERE voucher_id = v_voucher_id),
            total_credit = (SELECT COALESCE(SUM(credit_amount), 0) FROM acct_voucher_items WHERE voucher_id = v_voucher_id)
        WHERE id = v_voucher_id;
        
        -- 更新交易的憑證關聯
        NEW.voucher_id := v_voucher_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 注意：這個觸發器要在計算淨額之後執行
DROP TRIGGER IF EXISTS trigger_auto_voucher ON acct_transactions;
CREATE TRIGGER trigger_auto_voucher
    BEFORE INSERT OR UPDATE ON acct_transactions
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_voucher_entries();


-- =====================================================
-- 6. 索引優化
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_transactions_subcategory ON acct_transactions(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON acct_transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_source ON acct_transactions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON acct_transactions(invoice_number);
CREATE INDEX IF NOT EXISTS idx_payment_statuses_company ON acct_payment_statuses(company_id);


-- =====================================================
-- 7. RLS 政策
-- =====================================================

ALTER TABLE acct_payment_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY acct_payment_statuses_select ON acct_payment_statuses FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM acct_user_companies 
        WHERE user_id = auth.uid()
    ));

CREATE POLICY acct_payment_statuses_all ON acct_payment_statuses FOR ALL
    USING (company_id IN (
        SELECT company_id FROM acct_user_companies 
        WHERE user_id = auth.uid() AND role IN ('admin', 'accountant')
    ));


-- =====================================================
-- 8. 更新初始化函數
-- =====================================================

-- 在 initialize_company_categories 中加入 payment_statuses
CREATE OR REPLACE FUNCTION initialize_company_all(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM initialize_company_categories(p_company_id);
    PERFORM create_default_payment_statuses(p_company_id);
END;
$$ LANGUAGE plpgsql;
