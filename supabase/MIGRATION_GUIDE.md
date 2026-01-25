# 智慧媽咪商業管理系統 - 資料庫遷移指南
## Database Migration Guide

---

## 📁 SQL 檔案清單與執行順序

```
supabase/
├── 1. schema.sql                    # 基礎架構 (公司、用戶、權限)
├── 2. accounting_schema.sql         # 會計模組 (科目、帳戶、交易)
├── 3. categories_schema.sql         # 分類結構 (交易分類、服務分類等) ⭐ NEW
├── 4. transactions_enhanced.sql     # 交易記錄擴充 (手續費、稅額等) ⭐ NEW
├── 5. phase1_line.sql               # Phase 1: LINE 通知基礎
├── 6. business_modules_schema.sql   # Phase 2-7: 業務模組 ⭐ NEW
└── 7. create_admin.sql              # 管理員帳號 (選用)
```

---

## 🚀 執行方式

### 方式一：Supabase Dashboard

1. 登入 Supabase Dashboard
2. 進入 SQL Editor
3. 依序執行上述 SQL 檔案

### 方式二：Supabase CLI

```bash
# 安裝 Supabase CLI
npm install -g supabase

# 連結專案
supabase link --project-ref YOUR_PROJECT_REF

# 執行遷移
supabase db push
```

---

## 📊 資料表總覽

### 基礎架構 (schema.sql)
| 表名 | 說明 |
|------|------|
| acct_companies | 公司 |
| acct_users | 用戶 |
| acct_user_companies | 用戶-公司關聯 |

### 會計模組 (accounting_schema.sql)
| 表名 | 說明 |
|------|------|
| acct_chart_of_accounts | 會計科目 |
| acct_bank_accounts | 銀行帳戶 |
| acct_customers | 客戶/廠商 |
| acct_transactions | 交易記錄 |
| acct_vouchers | 會計憑證 |
| acct_voucher_entries | 憑證分錄 |

### 分類結構 (categories_schema.sql) ⭐ NEW
| 表名 | 說明 |
|------|------|
| acct_transaction_categories | 交易大分類 |
| acct_transaction_subcategories | 交易子分類 (對應會計科目) |
| acct_customer_types | 客戶/廠商類型 |
| acct_service_categories | 服務/商品分類 |
| acct_invoice_types | 發票類型 |
| acct_payment_methods | 付款方式 |
| acct_labor_report_types | 勞報類型 |
| acct_contract_types | 合約類型 |

### LINE 通知 (phase1_line.sql)
| 表名 | 說明 |
|------|------|
| acct_line_settings | LINE Bot 設定 |
| acct_line_groups | LINE 群組 |
| acct_line_templates | 訊息模板 |
| acct_line_messages | 發送記錄 |

### 交易記錄擴充 (transactions_enhanced.sql) ⭐ NEW
| 欄位 | 說明 |
|------|------|
| subcategory_id | 交易分類 (關聯子分類) |
| payment_status | 交易狀況 (同日付款/待付/預付等) |
| has_fee / fee_amount | 手續費開關與金額 |
| has_tax / tax_amount | 營業稅開關與金額 |
| invoice_number | 發票號碼 |
| net_amount | 淨額 (扣除手續費後) |
| attachments | 附件 (JSONB) |

| 表名 | 說明 |
|------|------|
| acct_payment_statuses | 交易狀況選項 |

### 業務模組 (business_modules_schema.sql) ⭐ NEW
| Phase | 表名 | 說明 |
|-------|------|------|
| 2 | acct_payment_accounts | 公司收款帳戶 |
| 3 | acct_billing_requests | 請款單 |
| 4 | acct_payables | 應付款項 |
| 5 | acct_invoice_settings | ezPay 設定 |
| 5 | acct_invoices | 電子發票 |
| 5 | acct_invoice_items | 發票明細 |
| 6 | acct_freelancers | 外包人員 |
| 6 | acct_labor_reports | 勞報單 |
| 7 | acct_quotations | 報價單 |
| 7 | acct_quotation_items | 報價明細 |
| 7 | acct_contracts | 合約 |
| 7 | acct_contract_payments | 付款期程 |

---

## 🎨 分類結構說明

### 交易分類 (類似藍途)

```
收入 (INC)
├── 服務收入 (INC-SVC) → 4100
├── 商品銷售 (INC-SALES) → 4110
├── 利息收入 (INC-INT) → 4200
└── 其他收入 (INC-OTHER) → 4900

支出 (EXP)
├── 成本・進貨 (COST)
│   ├── 外包成本 → 5100
│   ├── 進貨成本 → 5110
│   └── 原料成本 → 5120
│
├── 薪資・人事 (SAL)
│   ├── 薪資支出 → 6010
│   ├── 勞健保費 → 6020
│   ├── 獎金支出 → 6030
│   └── 勞務費 → 6015
│
├── 業務行銷・差旅 (MKT)
│   ├── 旅費/交通費 → 6040
│   ├── 郵寄/電話費 → 6060
│   ├── 交際費 → 6110
│   ├── 廣告/行銷費 → 6080
│   └── 佣金支出 → 6090
│
├── 辦公・行政 (OFC)
│   ├── 文具用品 → 6050
│   ├── 租金支出 → 6100
│   ├── 水電瓦斯 → 6070
│   ├── 修繕費 → 6120
│   └── 保險費 → 6130
│
├── 手續費・稅務 (FEE)
│   ├── 銀行手續費 → 6140
│   ├── 金流手續費 → 6141
│   ├── 稅捐 → 6150
│   └── 規費 → 6160
│
├── 還款・押金 (DEP)
│   ├── 借款還款 → 2100
│   └── 押金支出 → 1400
│
├── 資產設備・折舊 (AST)
│   ├── 設備購置 → 1500
│   ├── 折舊費用 → 6170
│   └── 攤銷費用 → 6180
│
└── 其他支出 (OTH)
    ├── 雜項支出 → 6900
    └── 損失 → 6910
```

### 客戶/廠商類型

| 代碼 | 名稱 | 說明 |
|------|------|------|
| B2B | B2B 企業客戶 | 付款條件 30 天 |
| B2C | B2C 個人客戶 | 即時付款 |
| GOV | 政府機關 | 付款條件 60 天 |
| VENDOR-CO | 公司外包 | 會開發票給我們 |
| VENDOR-IND | 個人外包 | 產生勞報單 |
| SUPPLIER | 供應商 | 一般進貨 |

### 服務分類

| 代碼 | 名稱 | 預設單位 |
|------|------|---------|
| SVC-SEO | SEO 優化服務 | 月 |
| SVC-ADS | 廣告代操服務 | 月 |
| SVC-WEB | 網站設計開發 | 專案 |
| SVC-DESIGN | 平面設計 | 專案 |
| SVC-CONSULT | 顧問諮詢 | 次 |
| SVC-MAINT | 維護服務 | 月 |
| SVC-OTHER | 其他服務 | 次 |

### 勞報類型 (2025 稅率)

| 代碼 | 名稱 | 預扣稅率 | 二代健保 | 免扣門檻 |
|------|------|---------|---------|---------|
| 50 | 執行業務所得 | 10% | 2.11% | 20,010 |
| 9A | 稿費所得 | 10% | 2.11% | 20,010 |
| 9B | 講演鐘點費 | 10% | 2.11% | 20,010 |
| 92 | 競技競賽獎金 | 10% | 2.11% | 20,010 |

---

## 🔧 自動初始化

當新公司建立時，系統會自動執行 `initialize_company_categories()` 函數，建立所有預設分類。

---

## 🧾 交易建立功能 (類似藍途)

### 交易類型
| 類型 | 說明 | 自動分錄 |
|------|------|---------|
| **收款** | 收入進帳 | 借：銀行 / 貸：收入 |
| **付款** | 支出出帳 | 借：費用 / 貸：銀行 |
| **移轉** | 帳戶間轉帳 | 借：目標帳戶 / 貸：來源帳戶 |

### 交易狀況
| 代碼 | 名稱 | 說明 |
|------|------|------|
| same_day | 同日付款 | 當天完成收付款 |
| prepaid | 預付/預收 | 提前收付款 |
| pending | 待付/待收 | 尚未完成 |
| partial | 部分款項 | 分期收付 |
| completed | 已完成 | 全部完成 |

### 手續費處理
```
收入：實收金額 = 金額 - 手續費
      分錄：借 銀行(實收) / 借 手續費 / 貸 收入

支出：實付金額 = 金額 + 手續費  
      分錄：借 費用 / 借 手續費 / 貸 銀行(實付)
```

### 自動化功能
1. **自動計算淨額** - 交易儲存時自動計算實收/實付金額
2. **自動更新餘額** - 交易後自動更新銀行帳戶餘額
3. **自動產生分錄** - 交易後自動產生會計憑證與分錄

---

## 📝 單號格式

| 類型 | 格式 | 範例 |
|------|------|------|
| 請款單 | INV-YYYY-NNN | INV-2026-001 |
| 應付單 | PAY-YYYY-NNN | PAY-2026-001 |
| 勞報單 | LR-YYYY-NNN | LR-2026-001 |
| 報價單 | QT-YYYY-NNN | QT-2026-001 |
| 合約 | CT-YYYY-NNN | CT-2026-001 |

---

## ⚠️ 注意事項

1. **執行順序很重要** - 必須按照上述順序執行
2. **外鍵依賴** - 某些表依賴其他表，不可跳過
3. **RLS 已啟用** - 所有表都有行級安全政策
4. **觸發器已設定** - 新公司會自動初始化分類

---

**智慧媽咪國際有限公司 © 2026**
*Mommy Wisdom International Co.*
