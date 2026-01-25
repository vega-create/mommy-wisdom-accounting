// 用戶相關類型
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'admin' | 'accountant' | 'viewer';

// 公司相關類型
export interface Company {
  id: string;
  name: string;
  tax_id: string;
  address: string;
  phone: string;
  email: string;
  logo_url?: string;
  fiscal_year_start: number; // 1-12
  created_at: string;
  updated_at: string;
}

// 會計科目類型
export interface AccountCategory {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parent_id?: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  company_id: string;
  created_at: string;
}

export type AccountType = 
  | 'asset'      // 資產
  | 'liability'  // 負債
  | 'equity'     // 權益
  | 'revenue'    // 收入
  | 'cost'       // 成本
  | 'expense';   // 費用

// 銀行/現金帳戶類型
export interface BankAccount {
  id: string;
  name: string;
  account_number?: string;
  bank_name?: string;
  bank_branch?: string;
  account_type: BankAccountType;
  currency: string;
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export type BankAccountType = 
  | 'cash'       // 現金
  | 'bank'       // 銀行戶頭
  | 'petty_cash' // 零用金
  | 'credit_card'; // 信用卡

// 交易記錄類型
export interface Transaction {
  id: string;
  transaction_date: string;
  transaction_type: TransactionType;
  description: string;
  amount: number;
  from_account_id?: string;
  to_account_id?: string;
  bank_account_id?: string;
  category_id?: string;
  customer_id?: string;
  voucher_id?: string;
  tags?: string[];
  notes?: string;
  company_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type TransactionType = 
  | 'income'    // 收入
  | 'expense'   // 支出
  | 'transfer'; // 轉帳

// 憑證類型
export interface Voucher {
  id: string;
  voucher_number: string;
  voucher_date: string;
  voucher_type: VoucherType;
  description: string;
  total_debit: number;
  total_credit: number;
  status: VoucherStatus;
  attachments?: string[];
  company_id: string;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export type VoucherType = 
  | 'receipt'   // 收款憑證
  | 'payment'   // 付款憑證
  | 'transfer'  // 轉帳憑證
  | 'journal';  // 分錄憑證

export type VoucherStatus = 
  | 'draft'     // 草稿
  | 'pending'   // 待審核
  | 'approved'  // 已核准
  | 'rejected'  // 已駁回
  | 'voided';   // 已作廢

// 憑證明細類型
export interface VoucherItem {
  id: string;
  voucher_id: string;
  account_id: string;
  description?: string;
  debit_amount: number;
  credit_amount: number;
  sort_order: number;
  created_at: string;
}

// 客戶/廠商類型
export interface Customer {
  id: string;
  name: string;
  short_name?: string;
  tax_id?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  customer_type: CustomerType;
  notes?: string;
  is_active: boolean;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export type CustomerType = 
  | 'customer'  // 客戶
  | 'vendor'    // 廠商
  | 'both';     // 兩者皆是

// 報表相關類型
export interface BalanceSheetItem {
  account_code: string;
  account_name: string;
  account_type: AccountType;
  balance: number;
}

export interface IncomeStatementItem {
  account_code: string;
  account_name: string;
  account_type: 'revenue' | 'expense';
  amount: number;
}

export interface JournalEntry {
  date: string;
  voucher_number: string;
  description: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface LedgerEntry {
  date: string;
  voucher_number: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

// Dashboard 統計類型
export interface DashboardStats {
  totalAssets: number;
  totalLiabilities: number;
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  cashBalance: number;
  bankBalance: number;
  recentTransactions: Transaction[];
}

// 篩選器類型
export interface DateRangeFilter {
  startDate: string;
  endDate: string;
}

export interface TransactionFilter extends DateRangeFilter {
  transactionType?: TransactionType;
  bankAccountId?: string;
  categoryId?: string;
  searchTerm?: string;
}

// 表單類型
export interface TransactionFormData {
  transaction_date: string;
  transaction_type: TransactionType;
  description: string;
  amount: number;
  from_account_id?: string;
  to_account_id?: string;
  bank_account_id?: string;
  category_id?: string;
  notes?: string;
}

export interface VoucherFormData {
  voucher_date: string;
  voucher_type: VoucherType;
  description: string;
  items: VoucherItemFormData[];
}

export interface VoucherItemFormData {
  account_id: string;
  description?: string;
  debit_amount: number;
  credit_amount: number;
}
