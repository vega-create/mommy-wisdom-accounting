-- =====================================================
-- 建立初始管理員帳號
-- 執行前請先在 Supabase Authentication 建立帳號
-- =====================================================

-- 步驟 1: 先到 Supabase Dashboard -> Authentication -> Users
-- 點擊 "Add user" -> "Create new user"
-- Email: vega@mommywisdom.com (或你想要的 email)
-- Password: 設定密碼
-- 勾選 "Auto Confirm User"
-- 記下產生的 User UID

-- 步驟 2: 用該 UID 替換下面的 'YOUR_AUTH_USER_ID'
-- 然後執行這個 SQL

-- 建立用戶資料 (替換 YOUR_AUTH_USER_ID 為實際的 Auth User ID)
INSERT INTO acct_users (auth_id, email, name, role, is_active)
VALUES (
  'YOUR_AUTH_USER_ID',  -- 從 Supabase Auth 複製的 User UID
  'vega@mommywisdom.com',  -- 你的 email
  'Vega',  -- 你的名字
  'admin',
  true
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role;

-- 取得剛建立的用戶 ID
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM acct_users WHERE email = 'vega@mommywisdom.com';
  
  -- 關聯到智慧媽咪公司（管理員）
  INSERT INTO acct_user_companies (user_id, company_id, role, is_default)
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000001',  -- 智慧媽咪國際股份有限公司
    'admin',
    true
  )
  ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'admin';
  
  -- 關聯到薇佳工作室（管理員）
  INSERT INTO acct_user_companies (user_id, company_id, role, is_default)
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000002',  -- 薇佳工作室
    'admin',
    false
  )
  ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'admin';
END $$;

-- 驗證
SELECT 
  u.name,
  u.email,
  u.role,
  c.name as company_name,
  uc.role as company_role
FROM acct_users u
JOIN acct_user_companies uc ON u.id = uc.user_id
JOIN acct_companies c ON uc.company_id = c.id
WHERE u.email = 'vega@mommywisdom.com';
