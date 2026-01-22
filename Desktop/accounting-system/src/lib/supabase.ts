import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 類型定義
export type UserRole = 'admin' | 'accountant' | 'viewer';

export interface DbUser {
  id: string;
  auth_id: string;
  email: string;
  name: string;
  role: UserRole;
  company_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbCompany {
  id: string;
  name: string;
  tax_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  fiscal_year_start: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbUserCompany {
  id: string;
  user_id: string;
  company_id: string;
  role: UserRole;
  is_default: boolean;
  created_at: string;
}
