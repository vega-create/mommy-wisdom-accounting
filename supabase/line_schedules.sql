-- LINE 訊息排程表
-- 支援單次排程和週期性排程

CREATE TABLE IF NOT EXISTS acct_line_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES acct_companies(id),
    
    -- 排程名稱
    name VARCHAR(100) NOT NULL,
    
    -- 發送對象
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('group', 'user')),
    recipient_id VARCHAR(100) NOT NULL,
    recipient_name VARCHAR(100),
    
    -- 訊息內容
    template_id UUID REFERENCES acct_line_templates(id),
    custom_content TEXT,
    variables JSONB DEFAULT '{}',
    
    -- 排程類型
    schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('once', 'daily', 'weekly', 'monthly')),
    
    -- 單次排程：指定發送時間
    scheduled_at TIMESTAMPTZ,
    
    -- 週期排程設定
    -- daily: 每天指定時間
    -- weekly: 每週幾 (0=週日, 1=週一, ..., 6=週六)
    -- monthly: 每月幾號
    schedule_time TIME,          -- 發送時間 (HH:MM)
    schedule_day_of_week INT,    -- 週幾 (0-6)
    schedule_day_of_month INT,   -- 幾號 (1-31)
    
    -- 狀態
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    
    -- 執行記錄
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    run_count INT DEFAULT 0,
    
    -- 時間戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_line_schedules_company ON acct_line_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_line_schedules_status ON acct_line_schedules(status);
CREATE INDEX IF NOT EXISTS idx_line_schedules_next_run ON acct_line_schedules(next_run_at) WHERE status = 'active';

-- RLS
ALTER TABLE acct_line_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company schedules" ON acct_line_schedules
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM acct_user_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own company schedules" ON acct_line_schedules
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM acct_user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'accountant')
        )
    );

-- 排程執行記錄表
CREATE TABLE IF NOT EXISTS acct_line_schedule_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES acct_line_schedules(id) ON DELETE CASCADE,
    
    -- 執行結果
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
    message_id UUID REFERENCES acct_line_messages(id),
    error_message TEXT,
    
    -- 時間戳
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_logs_schedule ON acct_line_schedule_logs(schedule_id);

COMMENT ON TABLE acct_line_schedules IS 'LINE 訊息排程';
COMMENT ON TABLE acct_line_schedule_logs IS 'LINE 排程執行記錄';
