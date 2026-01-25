import { create } from 'zustand';
import { supabase, DbUser, DbCompany, DbUserCompany, UserRole } from '@/lib/supabase';

interface AuthState {
  user: DbUser | null;
  company: DbCompany | null;
  userCompanies: (DbUserCompany & { company: DbCompany })[];
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  loadUser: () => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;

  canEdit: () => boolean;
  canApprove: () => boolean;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  company: null,
  userCompanies: [],
  isLoading: true,
  isAuthenticated: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        set({ error: authError.message, isLoading: false });
        return false;
      }

      if (!authData.user) {
        set({ error: '登入失敗', isLoading: false });
        return false;
      }

      const { data: userData, error: userError } = await supabase
        .from('acct_users')
        .select('*')
        .eq('auth_id', authData.user.id)
        .single();

      if (userError || !userData) {
        set({ error: '找不到用戶資料', isLoading: false });
        return false;
      }

      const { data: userCompaniesData } = await supabase
        .from('acct_user_companies')
        .select(`
          *,
          company:acct_companies(*)
        `)
        .eq('user_id', userData.id);

      const userCompanies = userCompaniesData || [];

      // 優先使用 localStorage 記憶的公司
      let currentCompany: DbCompany | null = null;
      const savedCompanyId = typeof window !== 'undefined' ? localStorage.getItem('selectedCompanyId') : null;
      const savedCompany = savedCompanyId ? userCompanies.find(uc => uc.company_id === savedCompanyId) : null;

      if (savedCompany) {
        currentCompany = savedCompany.company;
      } else {
        const defaultCompany = userCompanies.find(uc => uc.is_default);
        if (defaultCompany) {
          currentCompany = defaultCompany.company;
        } else if (userCompanies.length > 0) {
          currentCompany = userCompanies[0].company;
        }
      }

      set({
        user: userData,
        company: currentCompany,
        userCompanies,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (err: any) {
      set({ error: err.message || '登入時發生錯誤', isLoading: false });
      return false;
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    // 登出時清除記憶的公司
    if (typeof window !== 'undefined') {
      localStorage.removeItem('selectedCompanyId');
    }
    set({
      user: null,
      company: null,
      userCompanies: [],
      isAuthenticated: false,
      error: null,
    });
  },

  register: async (email: string, password: string, name: string) => {
    set({ isLoading: true, error: null });

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        set({ error: authError.message, isLoading: false });
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        set({ error: '註冊失敗', isLoading: false });
        return { success: false, error: '註冊失敗' };
      }

      const { data: userData, error: userError } = await supabase
        .from('acct_users')
        .insert({
          auth_id: authData.user.id,
          email,
          name,
          role: 'viewer',
        })
        .select()
        .single();

      if (userError) {
        set({ error: userError.message, isLoading: false });
        return { success: false, error: userError.message };
      }

      set({ isLoading: false });
      return { success: true };
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return { success: false, error: err.message };
    }
  },

  loadUser: async () => {
    set({ isLoading: true });

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      const { data: userData } = await supabase
        .from('acct_users')
        .select('*')
        .eq('auth_id', session.user.id)
        .single();

      if (!userData) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      const { data: userCompaniesData } = await supabase
        .from('acct_user_companies')
        .select(`
          *,
          company:acct_companies(*)
        `)
        .eq('user_id', userData.id);

      const userCompanies = userCompaniesData || [];

      // 優先使用 localStorage 記憶的公司
      let currentCompany: DbCompany | null = null;
      const savedCompanyId = typeof window !== 'undefined' ? localStorage.getItem('selectedCompanyId') : null;
      const savedCompany = savedCompanyId ? userCompanies.find(uc => uc.company_id === savedCompanyId) : null;

      if (savedCompany) {
        currentCompany = savedCompany.company;
      } else {
        const defaultCompany = userCompanies.find(uc => uc.is_default);
        if (defaultCompany) {
          currentCompany = defaultCompany.company;
        } else if (userCompanies.length > 0) {
          currentCompany = userCompanies[0].company;
        }
      }

      set({
        user: userData,
        company: currentCompany,
        userCompanies,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  switchCompany: async (companyId: string) => {
    const { userCompanies } = get();
    const targetCompany = userCompanies.find(uc => uc.company_id === companyId);

    if (targetCompany) {
      set({ company: targetCompany.company });
      // 記住選擇的公司
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedCompanyId', companyId);
      }
    }
  },

  canEdit: () => {
    const { user, userCompanies, company } = get();
    if (!user || !company) return false;

    const userCompany = userCompanies.find(uc => uc.company_id === company.id);
    return userCompany?.role === 'admin' || userCompany?.role === 'accountant';
  },

  canApprove: () => {
    const { user, userCompanies, company } = get();
    if (!user || !company) return false;

    const userCompany = userCompanies.find(uc => uc.company_id === company.id);
    return userCompany?.role === 'admin';
  },

  isAdmin: () => {
    const { user, userCompanies, company } = get();
    if (!user || !company) return false;

    const userCompany = userCompanies.find(uc => uc.company_id === company.id);
    return userCompany?.role === 'admin';
  },
}));