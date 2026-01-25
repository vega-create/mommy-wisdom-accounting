import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  User, Company, AccountCategory, BankAccount, 
  Transaction, Voucher, VoucherItem, UserRole,
  TransactionType, VoucherType, VoucherStatus,
  BankAccountType, AccountType, Customer, CustomerType
} from '@/types';
import { defaultAccountCategories } from './accounts';

// 初始公司資料
const initialCompanies: Company[] = [
  {
    id: 'company-1',
    name: 'Mommy Wisdom',
    tax_id: '12345678',
    address: '台中市西屯區XX路XX號',
    phone: '04-1234-5678',
    email: 'info@mommywisdom.com.tw',
    fiscal_year_start: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'company-2',
    name: 'Waychai',
    tax_id: '87654321',
    address: '台中市北區YY路YY號',
    phone: '04-8765-4321',
    email: 'info@waychai.com.tw',
    fiscal_year_start: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

// 初始用戶資料
const initialUsers: User[] = [
  {
    id: 'user-1',
    email: 'vega@mommywisdom.com.tw',
    name: 'Vega',
    role: 'admin',
    company_id: 'company-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

// 為公司生成會計科目
function generateAccountCategories(companyId: string): AccountCategory[] {
  return defaultAccountCategories.map((acc, index) => ({
    ...acc,
    id: `account-${companyId}-${index}`,
    company_id: companyId,
    created_at: '2024-01-01T00:00:00Z'
  }));
}

// 初始銀行帳戶
const initialBankAccounts: BankAccount[] = [
  {
    id: 'bank-1',
    name: '公司現金',
    account_type: 'cash',
    currency: 'TWD',
    initial_balance: 50000,
    current_balance: 50000,
    is_active: true,
    company_id: 'company-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'bank-2',
    name: '台新銀行-活存',
    account_number: '2048-01-0012345-6',
    bank_name: '台新國際商業銀行',
    bank_branch: '台中分行',
    account_type: 'bank',
    currency: 'TWD',
    initial_balance: 500000,
    current_balance: 500000,
    is_active: true,
    company_id: 'company-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'bank-3',
    name: '中國信託-公司戶',
    account_number: '822-54012345678',
    bank_name: '中國信託商業銀行',
    bank_branch: '台中分行',
    account_type: 'bank',
    currency: 'TWD',
    initial_balance: 1000000,
    current_balance: 1000000,
    is_active: true,
    company_id: 'company-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'bank-4',
    name: '零用金',
    account_type: 'petty_cash',
    currency: 'TWD',
    initial_balance: 10000,
    current_balance: 10000,
    is_active: true,
    company_id: 'company-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'bank-5',
    name: '公司現金',
    account_type: 'cash',
    currency: 'TWD',
    initial_balance: 30000,
    current_balance: 30000,
    is_active: true,
    company_id: 'company-2',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'bank-6',
    name: '玉山銀行-活存',
    account_number: '808-9876543210',
    bank_name: '玉山商業銀行',
    bank_branch: '北區分行',
    account_type: 'bank',
    currency: 'TWD',
    initial_balance: 200000,
    current_balance: 200000,
    is_active: true,
    company_id: 'company-2',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

// 模擬交易資料
const initialTransactions: Transaction[] = [
  {
    id: 'trans-1',
    transaction_date: '2025-01-15',
    transaction_type: 'income',
    description: '客戶A - 服務收入',
    amount: 50000,
    bank_account_id: 'bank-2',
    category_id: 'account-company-1-51', // 服務收入
    company_id: 'company-1',
    created_by: 'user-1',
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z'
  },
  {
    id: 'trans-2',
    transaction_date: '2025-01-16',
    transaction_type: 'expense',
    description: '辦公室租金 - 1月',
    amount: 25000,
    bank_account_id: 'bank-3',
    category_id: 'account-company-1-68', // 租金支出
    company_id: 'company-1',
    created_by: 'user-1',
    created_at: '2025-01-16T09:00:00Z',
    updated_at: '2025-01-16T09:00:00Z'
  },
  {
    id: 'trans-3',
    transaction_date: '2025-01-17',
    transaction_type: 'expense',
    description: '員工薪資 - 1月',
    amount: 120000,
    bank_account_id: 'bank-3',
    category_id: 'account-company-1-59', // 薪資支出
    company_id: 'company-1',
    created_by: 'user-1',
    created_at: '2025-01-17T14:00:00Z',
    updated_at: '2025-01-17T14:00:00Z'
  },
  {
    id: 'trans-4',
    transaction_date: '2025-01-18',
    transaction_type: 'transfer',
    description: '銀行轉帳至現金',
    amount: 20000,
    from_account_id: 'bank-2',
    to_account_id: 'bank-1',
    company_id: 'company-1',
    created_by: 'user-1',
    created_at: '2025-01-18T11:00:00Z',
    updated_at: '2025-01-18T11:00:00Z'
  },
  {
    id: 'trans-5',
    transaction_date: '2025-01-20',
    transaction_type: 'income',
    description: '客戶B - 產品銷售',
    amount: 80000,
    bank_account_id: 'bank-3',
    category_id: 'account-company-1-50', // 銷貨收入
    company_id: 'company-1',
    created_by: 'user-2',
    created_at: '2025-01-20T15:00:00Z',
    updated_at: '2025-01-20T15:00:00Z'
  }
];

// 模擬憑證資料
const initialVouchers: Voucher[] = [
  {
    id: 'voucher-1',
    voucher_number: '2025-01-0001',
    voucher_date: '2025-01-15',
    voucher_type: 'receipt',
    description: '客戶A - 服務收入',
    total_debit: 50000,
    total_credit: 50000,
    status: 'approved',
    company_id: 'company-1',
    created_by: 'user-1',
    approved_by: 'user-1',
    approved_at: '2025-01-15T10:30:00Z',
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:30:00Z'
  },
  {
    id: 'voucher-2',
    voucher_number: '2025-01-0002',
    voucher_date: '2025-01-16',
    voucher_type: 'payment',
    description: '辦公室租金 - 1月',
    total_debit: 25000,
    total_credit: 25000,
    status: 'approved',
    company_id: 'company-1',
    created_by: 'user-1',
    approved_by: 'user-1',
    approved_at: '2025-01-16T09:30:00Z',
    created_at: '2025-01-16T09:00:00Z',
    updated_at: '2025-01-16T09:30:00Z'
  }
];

const initialVoucherItems: VoucherItem[] = [
  // 憑證1的明細
  {
    id: 'vi-1',
    voucher_id: 'voucher-1',
    account_id: 'account-company-1-2', // 銀行存款
    description: '台新銀行',
    debit_amount: 50000,
    credit_amount: 0,
    sort_order: 1,
    created_at: '2025-01-15T10:00:00Z'
  },
  {
    id: 'vi-2',
    voucher_id: 'voucher-1',
    account_id: 'account-company-1-51', // 服務收入
    description: '客戶A服務費',
    debit_amount: 0,
    credit_amount: 50000,
    sort_order: 2,
    created_at: '2025-01-15T10:00:00Z'
  },
  // 憑證2的明細
  {
    id: 'vi-3',
    voucher_id: 'voucher-2',
    account_id: 'account-company-1-68', // 租金支出
    description: '辦公室租金',
    debit_amount: 25000,
    credit_amount: 0,
    sort_order: 1,
    created_at: '2025-01-16T09:00:00Z'
  },
  {
    id: 'vi-4',
    voucher_id: 'voucher-2',
    account_id: 'account-company-1-2', // 銀行存款
    description: '中國信託',
    debit_amount: 0,
    credit_amount: 25000,
    sort_order: 2,
    created_at: '2025-01-16T09:00:00Z'
  }
];

// 初始客戶資料
const initialCustomers: Customer[] = [
  {
    id: 'customer-1',
    name: '台灣科技股份有限公司',
    short_name: '台灣科技',
    tax_id: '12345678',
    contact_person: '王經理',
    phone: '02-1234-5678',
    email: 'wang@taiwantech.com',
    address: '台北市信義區信義路100號',
    customer_type: 'customer',
    is_active: true,
    company_id: 'company-1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z'
  },
  {
    id: 'customer-2',
    name: '優質辦公用品有限公司',
    short_name: '優質辦公',
    tax_id: '87654321',
    contact_person: '李小姐',
    phone: '04-8765-4321',
    email: 'lee@quality-office.com',
    address: '台中市西屯區台灣大道200號',
    customer_type: 'vendor',
    is_active: true,
    company_id: 'company-1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z'
  },
  {
    id: 'customer-3',
    name: '幸福嬰兒用品店',
    short_name: '幸福嬰兒',
    tax_id: '11223344',
    contact_person: '張老闆',
    phone: '04-1122-3344',
    email: 'happy@babyhappy.com',
    address: '台中市北區三民路50號',
    customer_type: 'both',
    is_active: true,
    company_id: 'company-1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z'
  }
];

// Store 介面定義
interface AccountingStore {
  // 狀態
  currentUser: User | null;
  currentCompany: Company | null;
  companies: Company[];
  users: User[];
  accountCategories: AccountCategory[];
  bankAccounts: BankAccount[];
  transactions: Transaction[];
  vouchers: Voucher[];
  voucherItems: VoucherItem[];
  customers: Customer[];
  isAuthenticated: boolean;
  
  // 認證相關
  login: (username: string, password: string) => boolean;
  logout: () => void;
  switchCompany: (companyId: string) => void;
  
  // 會計科目相關
  getAccountCategories: () => AccountCategory[];
  getAccountById: (id: string) => AccountCategory | undefined;
  addAccountCategory: (account: Omit<AccountCategory, 'id' | 'company_id' | 'created_at'>) => AccountCategory;
  updateAccountCategory: (id: string, updates: Partial<AccountCategory>) => void;
  
  // 銀行帳戶相關
  getBankAccounts: () => BankAccount[];
  getBankAccountById: (id: string) => BankAccount | undefined;
  addBankAccount: (account: Omit<BankAccount, 'id' | 'company_id' | 'created_at' | 'updated_at'>) => BankAccount;
  updateBankAccount: (id: string, updates: Partial<BankAccount>) => void;
  updateBankBalance: (id: string, amount: number, isDeposit: boolean) => void;
  
  // 交易相關
  getTransactions: () => Transaction[];
  getTransactionById: (id: string) => Transaction | undefined;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'company_id' | 'created_by' | 'created_at' | 'updated_at'>) => Transaction;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  
  // 憑證相關
  getVouchers: () => Voucher[];
  getVoucherById: (id: string) => Voucher | undefined;
  addVoucher: (voucher: Omit<Voucher, 'id' | 'voucher_number' | 'company_id' | 'created_by' | 'created_at' | 'updated_at'>, items: Omit<VoucherItem, 'id' | 'voucher_id' | 'created_at'>[]) => Voucher;
  updateVoucher: (id: string, updates: Partial<Voucher>) => void;
  approveVoucher: (id: string) => void;
  rejectVoucher: (id: string) => void;
  voidVoucher: (id: string) => void;
  getVoucherItems: (voucherId: string) => VoucherItem[];
  
  // 客戶相關
  getCustomers: () => Customer[];
  getCustomerById: (id: string) => Customer | undefined;
  addCustomer: (customer: Omit<Customer, 'id' | 'company_id' | 'created_at' | 'updated_at'>) => Customer;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  
  // 報表相關
  getTotalsByAccountType: () => Record<AccountType, number>;
  getCashAndBankTotal: () => { cash: number; bank: number; total: number };
  
  // 生成憑證編號
  generateVoucherNumber: () => string;
}

// 建立 Store
export const useAccountingStore = create<AccountingStore>()(
  persist(
    (set, get) => ({
      // 初始狀態
      currentUser: null,
      currentCompany: null,
      companies: initialCompanies,
      users: initialUsers,
      accountCategories: [
        ...generateAccountCategories('company-1'),
        ...generateAccountCategories('company-2')
      ],
      bankAccounts: initialBankAccounts,
      transactions: initialTransactions,
      vouchers: initialVouchers,
      voucherItems: initialVoucherItems,
      customers: initialCustomers,
      isAuthenticated: false,

      // 登入
      login: (username: string, password: string) => {
        const credentials: Record<string, { password: string; userId: string }> = {
          'vega': { password: 'vega123', userId: 'user-1' }
        };
        
        const cred = credentials[username.toLowerCase()];
        if (cred && cred.password === password) {
          const user = get().users.find(u => u.id === cred.userId);
          const company = get().companies.find(c => c.id === user?.company_id);
          
          if (user && company) {
            set({ 
              currentUser: user, 
              currentCompany: company,
              isAuthenticated: true 
            });
            return true;
          }
        }
        return false;
      },

      // 登出
      logout: () => {
        set({ 
          currentUser: null, 
          currentCompany: null,
          isAuthenticated: false 
        });
      },

      // 切換公司
      switchCompany: (companyId: string) => {
        const company = get().companies.find(c => c.id === companyId);
        if (company) {
          set({ currentCompany: company });
        }
      },

      // 取得會計科目
      getAccountCategories: () => {
        const { currentCompany, accountCategories } = get();
        if (!currentCompany) return [];
        return accountCategories.filter(a => a.company_id === currentCompany.id);
      },

      getAccountById: (id: string) => {
        return get().accountCategories.find(a => a.id === id);
      },

      addAccountCategory: (account) => {
        const { currentCompany, accountCategories } = get();
        if (!currentCompany) throw new Error('請先選擇公司');
        
        const newAccount: AccountCategory = {
          ...account,
          id: `account-${Date.now()}`,
          company_id: currentCompany.id,
          created_at: new Date().toISOString()
        };
        
        set({ accountCategories: [...accountCategories, newAccount] });
        return newAccount;
      },

      updateAccountCategory: (id, updates) => {
        set(state => ({
          accountCategories: state.accountCategories.map(a =>
            a.id === id ? { ...a, ...updates } : a
          )
        }));
      },

      // 銀行帳戶相關
      getBankAccounts: () => {
        const { currentCompany, bankAccounts } = get();
        if (!currentCompany) return [];
        return bankAccounts.filter(b => b.company_id === currentCompany.id);
      },

      getBankAccountById: (id: string) => {
        return get().bankAccounts.find(b => b.id === id);
      },

      addBankAccount: (account) => {
        const { currentCompany, bankAccounts } = get();
        if (!currentCompany) throw new Error('請先選擇公司');
        
        const newAccount: BankAccount = {
          ...account,
          id: `bank-${Date.now()}`,
          company_id: currentCompany.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        set({ bankAccounts: [...bankAccounts, newAccount] });
        return newAccount;
      },

      updateBankAccount: (id, updates) => {
        set(state => ({
          bankAccounts: state.bankAccounts.map(b =>
            b.id === id ? { ...b, ...updates, updated_at: new Date().toISOString() } : b
          )
        }));
      },

      updateBankBalance: (id, amount, isDeposit) => {
        set(state => ({
          bankAccounts: state.bankAccounts.map(b => {
            if (b.id === id) {
              const newBalance = isDeposit 
                ? b.current_balance + amount 
                : b.current_balance - amount;
              return { ...b, current_balance: newBalance, updated_at: new Date().toISOString() };
            }
            return b;
          })
        }));
      },

      // 交易相關
      getTransactions: () => {
        const { currentCompany, transactions } = get();
        if (!currentCompany) return [];
        return transactions
          .filter(t => t.company_id === currentCompany.id)
          .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
      },

      getTransactionById: (id: string) => {
        return get().transactions.find(t => t.id === id);
      },

      addTransaction: (transaction) => {
        const { currentCompany, currentUser, transactions } = get();
        if (!currentCompany || !currentUser) throw new Error('請先登入');
        
        const newTransaction: Transaction = {
          ...transaction,
          id: `trans-${Date.now()}`,
          company_id: currentCompany.id,
          created_by: currentUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // 更新銀行餘額
        const { updateBankBalance } = get();
        if (transaction.transaction_type === 'income' && transaction.bank_account_id) {
          updateBankBalance(transaction.bank_account_id, transaction.amount, true);
        } else if (transaction.transaction_type === 'expense' && transaction.bank_account_id) {
          updateBankBalance(transaction.bank_account_id, transaction.amount, false);
        } else if (transaction.transaction_type === 'transfer') {
          if (transaction.from_account_id) {
            updateBankBalance(transaction.from_account_id, transaction.amount, false);
          }
          if (transaction.to_account_id) {
            updateBankBalance(transaction.to_account_id, transaction.amount, true);
          }
        }
        
        set({ transactions: [...transactions, newTransaction] });
        return newTransaction;
      },

      updateTransaction: (id, updates) => {
        set(state => ({
          transactions: state.transactions.map(t =>
            t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
          )
        }));
      },

      deleteTransaction: (id: string) => {
        set(state => ({
          transactions: state.transactions.filter(t => t.id !== id)
        }));
      },

      // 憑證相關
      getVouchers: () => {
        const { currentCompany, vouchers } = get();
        if (!currentCompany) return [];
        return vouchers
          .filter(v => v.company_id === currentCompany.id)
          .sort((a, b) => new Date(b.voucher_date).getTime() - new Date(a.voucher_date).getTime());
      },

      getVoucherById: (id: string) => {
        return get().vouchers.find(v => v.id === id);
      },

      generateVoucherNumber: () => {
        const { currentCompany, vouchers } = get();
        if (!currentCompany) return '';
        
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const companyVouchers = vouchers.filter(v => 
          v.company_id === currentCompany.id && 
          v.voucher_number.startsWith(`${year}-${month}`)
        );
        const nextNumber = String(companyVouchers.length + 1).padStart(4, '0');
        return `${year}-${month}-${nextNumber}`;
      },

      addVoucher: (voucher, items) => {
        const { currentCompany, currentUser, vouchers, voucherItems, generateVoucherNumber } = get();
        if (!currentCompany || !currentUser) throw new Error('請先登入');
        
        const voucherId = `voucher-${Date.now()}`;
        const newVoucher: Voucher = {
          ...voucher,
          id: voucherId,
          voucher_number: generateVoucherNumber(),
          company_id: currentCompany.id,
          created_by: currentUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const newItems: VoucherItem[] = items.map((item, index) => ({
          ...item,
          id: `vi-${Date.now()}-${index}`,
          voucher_id: voucherId,
          created_at: new Date().toISOString()
        }));
        
        set({ 
          vouchers: [...vouchers, newVoucher],
          voucherItems: [...voucherItems, ...newItems]
        });
        return newVoucher;
      },

      updateVoucher: (id, updates) => {
        set(state => ({
          vouchers: state.vouchers.map(v =>
            v.id === id ? { ...v, ...updates, updated_at: new Date().toISOString() } : v
          )
        }));
      },

      approveVoucher: (id) => {
        const { currentUser } = get();
        if (!currentUser) return;
        
        set(state => ({
          vouchers: state.vouchers.map(v =>
            v.id === id ? { 
              ...v, 
              status: 'approved' as VoucherStatus,
              approved_by: currentUser.id,
              approved_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            } : v
          )
        }));
      },

      rejectVoucher: (id) => {
        set(state => ({
          vouchers: state.vouchers.map(v =>
            v.id === id ? { 
              ...v, 
              status: 'rejected' as VoucherStatus,
              updated_at: new Date().toISOString()
            } : v
          )
        }));
      },

      voidVoucher: (id) => {
        set(state => ({
          vouchers: state.vouchers.map(v =>
            v.id === id ? { 
              ...v, 
              status: 'voided' as VoucherStatus,
              updated_at: new Date().toISOString()
            } : v
          )
        }));
      },

      getVoucherItems: (voucherId: string) => {
        return get().voucherItems
          .filter(vi => vi.voucher_id === voucherId)
          .sort((a, b) => a.sort_order - b.sort_order);
      },

      // 客戶相關
      getCustomers: () => {
        const company = get().currentCompany;
        if (!company) return [];
        return get().customers.filter(c => c.company_id === company.id);
      },

      getCustomerById: (id: string) => {
        return get().customers.find(c => c.id === id);
      },

      addCustomer: (customerData) => {
        const company = get().currentCompany;
        if (!company) throw new Error('No company selected');

        const newCustomer: Customer = {
          ...customerData,
          id: `customer-${Date.now()}`,
          company_id: company.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        set(state => ({
          customers: [...state.customers, newCustomer]
        }));

        return newCustomer;
      },

      updateCustomer: (id, updates) => {
        set(state => ({
          customers: state.customers.map(c =>
            c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
          )
        }));
      },

      deleteCustomer: (id) => {
        set(state => ({
          customers: state.customers.filter(c => c.id !== id)
        }));
      },

      // 報表相關
      getTotalsByAccountType: () => {
        const transactions = get().getTransactions();
        const accounts = get().getAccountCategories();
        
        const totals: Record<AccountType, number> = {
          asset: 0,
          liability: 0,
          equity: 0,
          revenue: 0,
          cost: 0,
          expense: 0
        };
        
        transactions.forEach(t => {
          if (t.category_id) {
            const account = accounts.find(a => a.id === t.category_id);
            if (account) {
              totals[account.type] += t.amount;
            }
          }
        });
        
        return totals;
      },

      getCashAndBankTotal: () => {
        const bankAccounts = get().getBankAccounts();
        
        const cash = bankAccounts
          .filter(b => b.account_type === 'cash' || b.account_type === 'petty_cash')
          .reduce((sum, b) => sum + b.current_balance, 0);
          
        const bank = bankAccounts
          .filter(b => b.account_type === 'bank')
          .reduce((sum, b) => sum + b.current_balance, 0);
          
        return { cash, bank, total: cash + bank };
      }
    }),
    {
      name: 'accounting-storage',
      version: 6,
      migrate: (persistedState, version) => {
        // 版本升級時重置所有資料
        if (version < 6) {
          return {
            companies: initialCompanies,
            users: initialUsers,
            accountCategories: [
              ...generateAccountCategories('company-1'),
              ...generateAccountCategories('company-2')
            ],
            bankAccounts: initialBankAccounts,
            transactions: initialTransactions,
            vouchers: initialVouchers,
            voucherItems: initialVoucherItems,
            customers: initialCustomers
          };
        }
        return persistedState as any;
      },
      partialize: (state) => ({
        // 持久化所有狀態，除了認證相關
        companies: state.companies,
        users: state.users,
        accountCategories: state.accountCategories,
        bankAccounts: state.bankAccounts,
        transactions: state.transactions,
        vouchers: state.vouchers,
        voucherItems: state.voucherItems,
        customers: state.customers
      })
    }
  )
);
