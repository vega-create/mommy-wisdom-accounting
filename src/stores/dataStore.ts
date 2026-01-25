import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from './authStore';

// Types
export interface BankAccount {
  id: string;
  company_id: string;
  name: string;
  account_number: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  account_type: 'cash' | 'bank' | 'petty_cash' | 'credit_card';
  currency: string;
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  short_name: string | null;
  tax_id: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  customer_type: 'customer' | 'vendor' | 'both';
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountCategory {
  id: string;
  company_id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'cost' | 'expense';
  parent_id: string | null;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  company_id: string;
  transaction_date: string;
  transaction_type: 'income' | 'expense' | 'transfer';
  description: string;
  amount: number;
  bank_account_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  customer_id: string | null;
  voucher_id: string | null;
  tags: string[] | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Voucher {
  id: string;
  company_id: string;
  voucher_number: string;
  voucher_date: string;
  voucher_type: 'receipt' | 'payment' | 'transfer' | 'journal';
  description: string | null;
  total_debit: number;
  total_credit: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'voided';
  attachments: string[] | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoucherItem {
  id: string;
  voucher_id: string;
  account_id: string | null;
  description: string | null;
  debit_amount: number;
  credit_amount: number;
  sort_order: number;
  created_at: string;
}

interface DataState {
  // Data
  bankAccounts: BankAccount[];
  customers: Customer[];
  accountCategories: AccountCategory[];
  transactions: Transaction[];
  vouchers: Voucher[];
  voucherItems: VoucherItem[];

  // Loading states
  isLoading: boolean;

  // Actions
  loadAll: () => Promise<void>;

  // Bank Accounts
  loadBankAccounts: () => Promise<void>;
  addBankAccount: (data: Omit<BankAccount, 'id' | 'company_id' | 'created_at' | 'updated_at'>) => Promise<BankAccount | null>;
  updateBankAccount: (id: string, data: Partial<BankAccount>) => Promise<void>;
  deleteBankAccount: (id: string) => Promise<void>;

  // Customers
  loadCustomers: () => Promise<void>;
  addCustomer: (data: Omit<Customer, 'id' | 'company_id' | 'created_at' | 'updated_at'>) => Promise<Customer | null>;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;

  // Account Categories
  loadAccountCategories: () => Promise<void>;
  addAccountCategory: (data: Omit<AccountCategory, 'id' | 'company_id' | 'created_at'>) => Promise<AccountCategory | null>;

  // Transactions
  loadTransactions: () => Promise<void>;
  addTransaction: (data: Omit<Transaction, 'id' | 'company_id' | 'created_by' | 'created_at' | 'updated_at'>) => Promise<Transaction | null>;
  updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  // Vouchers
  loadVouchers: () => Promise<void>;
  addVoucher: (voucher: Omit<Voucher, 'id' | 'voucher_number' | 'company_id' | 'created_by' | 'created_at' | 'updated_at'>, items: Omit<VoucherItem, 'id' | 'voucher_id' | 'created_at'>[]) => Promise<Voucher | null>;
  updateVoucher: (id: string, data: Partial<Voucher>) => Promise<void>;
  approveVoucher: (id: string) => Promise<void>;
  rejectVoucher: (id: string) => Promise<void>;
  loadVoucherItems: (voucherId: string) => Promise<VoucherItem[]>;
}

export const useDataStore = create<DataState>((set, get) => ({
  bankAccounts: [],
  customers: [],
  accountCategories: [],
  transactions: [],
  vouchers: [],
  voucherItems: [],
  isLoading: false,

  loadAll: async () => {
    set({ isLoading: true });
    await Promise.all([
      get().loadBankAccounts(),
      get().loadCustomers(),
      get().loadAccountCategories(),
      get().loadTransactions(),
      get().loadVouchers(),
    ]);
    set({ isLoading: false });
  },

  // Bank Accounts
  loadBankAccounts: async () => {
    const company = useAuthStore.getState().company;
    if (!company) return;

    const { data } = await supabase
      .from('acct_bank_accounts')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: true });

    set({ bankAccounts: data || [] });
  },

  addBankAccount: async (data) => {
    const company = useAuthStore.getState().company;
    if (!company) return null;

    const { data: newAccount, error } = await supabase
      .from('acct_bank_accounts')
      .insert({
        ...data,
        company_id: company.id,
      })
      .select()
      .single();

    if (!error && newAccount) {
      set(state => ({ bankAccounts: [...state.bankAccounts, newAccount] }));
      return newAccount;
    }
    return null;
  },

  updateBankAccount: async (id, data) => {
    const { error } = await supabase
      .from('acct_bank_accounts')
      .update(data)
      .eq('id', id);

    if (!error) {
      set(state => ({
        bankAccounts: state.bankAccounts.map(b =>
          b.id === id ? { ...b, ...data } : b
        )
      }));
    }
  },

  deleteBankAccount: async (id) => {
    const { error } = await supabase
      .from('acct_bank_accounts')
      .delete()
      .eq('id', id);

    if (!error) {
      set(state => ({
        bankAccounts: state.bankAccounts.filter(b => b.id !== id)
      }));
    }
  },

  // Customers
  loadCustomers: async () => {
    const company = useAuthStore.getState().company;
    if (!company) return;

    const { data } = await supabase
      .from('acct_customers')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: true });

    set({ customers: data || [] });
  },

  addCustomer: async (data) => {
    const company = useAuthStore.getState().company;
    if (!company) return null;

    const { data: newCustomer, error } = await supabase
      .from('acct_customers')
      .insert({
        ...data,
        company_id: company.id,
      })
      .select()
      .single();

    if (!error && newCustomer) {
      set(state => ({ customers: [...state.customers, newCustomer] }));
      return newCustomer;
    }
    return null;
  },

  updateCustomer: async (id, data) => {
    const { error } = await supabase
      .from('acct_customers')
      .update(data)
      .eq('id', id);

    if (!error) {
      set(state => ({
        customers: state.customers.map(c =>
          c.id === id ? { ...c, ...data } : c
        )
      }));
    }
  },

  deleteCustomer: async (id) => {
    const { error } = await supabase
      .from('acct_customers')
      .delete()
      .eq('id', id);

    if (!error) {
      set(state => ({
        customers: state.customers.filter(c => c.id !== id)
      }));
    }
  },

  // Account Categories
  loadAccountCategories: async () => {
    const company = useAuthStore.getState().company;
    if (!company) return;

    const { data } = await supabase
      .from('acct_account_categories')
      .select('*')
      .eq('company_id', company.id)
      .order('code', { ascending: true });

    set({ accountCategories: data || [] });
  },

  addAccountCategory: async (data) => {
    const company = useAuthStore.getState().company;
    if (!company) return null;

    const { data: newCategory, error } = await supabase
      .from('acct_account_categories')
      .insert({
        ...data,
        company_id: company.id,
      })
      .select()
      .single();

    if (!error && newCategory) {
      set(state => ({ accountCategories: [...state.accountCategories, newCategory] }));
      return newCategory;
    }
    return null;
  },

  // Transactions
  loadTransactions: async () => {
    const company = useAuthStore.getState().company;
    if (!company) return;

    const { data } = await supabase
      .from('acct_transactions')
      .select('*')
      .eq('company_id', company.id)
      .order('transaction_date', { ascending: false });

    set({ transactions: data || [] });
  },

  addTransaction: async (data) => {
    const company = useAuthStore.getState().company;
    const user = useAuthStore.getState().user;
    if (!company || !user) return null;

    // 重要：清理空字串為 null，避免 UUID 欄位錯誤
    const { data: newTransaction, error } = await supabase
      .from('acct_transactions')
      .insert({
        transaction_date: data.transaction_date,
        transaction_type: data.transaction_type,
        description: data.description,
        amount: data.amount,
        bank_account_id: data.bank_account_id || null,
        from_account_id: data.from_account_id || null,
        to_account_id: data.to_account_id || null,
        category_id: data.category_id || null,
        customer_id: data.customer_id || null,
        voucher_id: data.voucher_id || null,
        notes: data.notes || null,
        tags: data.tags || null,
        company_id: company.id,
        created_by: user.id,
      })
      .select()
      .single();

    if (!error && newTransaction) {
      set(state => ({ transactions: [newTransaction, ...state.transactions] }));

      // 更新帳戶餘額
      if (data.transaction_type === 'income' && data.bank_account_id) {
        const account = get().bankAccounts.find(b => b.id === data.bank_account_id);
        if (account) {
          await get().updateBankAccount(data.bank_account_id, {
            current_balance: account.current_balance + data.amount
          });
        }
      } else if (data.transaction_type === 'expense' && data.bank_account_id) {
        const account = get().bankAccounts.find(b => b.id === data.bank_account_id);
        if (account) {
          await get().updateBankAccount(data.bank_account_id, {
            current_balance: account.current_balance - data.amount
          });
        }
      } else if (data.transaction_type === 'transfer' && data.from_account_id && data.to_account_id) {
        const fromAccount = get().bankAccounts.find(b => b.id === data.from_account_id);
        const toAccount = get().bankAccounts.find(b => b.id === data.to_account_id);
        if (fromAccount) {
          await get().updateBankAccount(data.from_account_id, {
            current_balance: fromAccount.current_balance - data.amount
          });
        }
        if (toAccount) {
          await get().updateBankAccount(data.to_account_id, {
            current_balance: toAccount.current_balance + data.amount
          });
        }
      }

      return newTransaction;
    }
    return null;
  },

  updateTransaction: async (id, data) => {
    const { error } = await supabase
      .from('acct_transactions')
      .update(data)
      .eq('id', id);

    if (!error) {
      set(state => ({
        transactions: state.transactions.map(t =>
          t.id === id ? { ...t, ...data } : t
        )
      }));
    }
  },

  deleteTransaction: async (id) => {
    const { error } = await supabase
      .from('acct_transactions')
      .delete()
      .eq('id', id);

    if (!error) {
      set(state => ({
        transactions: state.transactions.filter(t => t.id !== id)
      }));
    }
  },

  // Vouchers
  loadVouchers: async () => {
    const company = useAuthStore.getState().company;
    if (!company) return;

    const { data } = await supabase
      .from('acct_vouchers')
      .select('*')
      .eq('company_id', company.id)
      .order('voucher_date', { ascending: false });

    set({ vouchers: data || [] });
  },

  addVoucher: async (voucherData, items) => {
    const company = useAuthStore.getState().company;
    const user = useAuthStore.getState().user;
    if (!company || !user) return null;

    // 產生憑證編號
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('acct_vouchers')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company.id)
      .like('voucher_number', `${year}-%`);

    const voucherNumber = `${year}-${String((count || 0) + 1).padStart(4, '0')}`;

    const { data: newVoucher, error } = await supabase
      .from('acct_vouchers')
      .insert({
        ...voucherData,
        voucher_number: voucherNumber,
        company_id: company.id,
        created_by: user.id,
      })
      .select()
      .single();

    if (!error && newVoucher) {
      // 新增憑證明細
      const voucherItems = items.map((item, index) => ({
        ...item,
        voucher_id: newVoucher.id,
        sort_order: index + 1,
      }));

      await supabase.from('acct_voucher_items').insert(voucherItems);

      set(state => ({ vouchers: [newVoucher, ...state.vouchers] }));
      return newVoucher;
    }
    return null;
  },

  updateVoucher: async (id, data) => {
    const { error } = await supabase
      .from('acct_vouchers')
      .update(data)
      .eq('id', id);

    if (!error) {
      set(state => ({
        vouchers: state.vouchers.map(v =>
          v.id === id ? { ...v, ...data } : v
        )
      }));
    }
  },

  approveVoucher: async (id) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    await get().updateVoucher(id, {
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    });
  },

  rejectVoucher: async (id) => {
    await get().updateVoucher(id, { status: 'rejected' });
  },

  loadVoucherItems: async (voucherId) => {
    const { data } = await supabase
      .from('acct_voucher_items')
      .select('*')
      .eq('voucher_id', voucherId)
      .order('sort_order', { ascending: true });

    const items = data || [];
    set({ voucherItems: items });
    return items;
  },
}));