'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import {
  Users,
  UserPlus,
  Shield,
  Building2,
  Check,
  X,
  Trash2,
  Edit2,
} from 'lucide-react';

interface UserWithCompanies {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  user_companies: {
    company_id: string;
    role: string;
    company: {
      id: string;
      name: string;
    };
  }[];
}

const roleLabels: Record<string, { label: string; color: string }> = {
  admin: { label: '管理員', color: 'bg-purple-100 text-purple-700' },
  accountant: { label: '會計', color: 'bg-blue-100 text-blue-700' },
  viewer: { label: '檢視者', color: 'bg-gray-100 text-gray-700' },
};

export default function SettingsPage() {
  const { company, isAdmin } = useAuthStore();
  const [users, setUsers] = useState<UserWithCompanies[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithCompanies | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    role: 'viewer' as 'admin' | 'accountant' | 'viewer',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (company) {
      loadUsers();
    }
  }, [company]);

  const loadUsers = async () => {
    if (!company) return;
    
    setLoading(true);
    
    // 取得所有和此公司關聯的用戶
    const { data, error } = await supabase
      .from('acct_user_companies')
      .select(`
        user_id,
        role,
        user:acct_users(id, email, name, role, is_active, created_at)
      `)
      .eq('company_id', company.id);

    if (!error && data) {
      const formattedUsers = data.map(item => ({
        ...item.user,
        user_companies: [{
          company_id: company.id,
          role: item.role,
          company: company
        }]
      })) as UserWithCompanies[];
      
      setUsers(formattedUsers);
    }
    
    setLoading(false);
  };

  const handleOpenModal = (user?: UserWithCompanies) => {
    if (user) {
      setEditingUser(user);
      const userCompany = user.user_companies.find(uc => uc.company_id === company?.id);
      setFormData({
        email: user.email,
        name: user.name,
        password: '',
        role: (userCompany?.role || 'viewer') as 'admin' | 'accountant' | 'viewer',
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: '',
        name: '',
        password: '',
        role: 'viewer',
      });
    }
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!company) return;

    try {
      if (editingUser) {
        // 更新用戶角色
        const { error } = await supabase
          .from('acct_user_companies')
          .update({ role: formData.role })
          .eq('user_id', editingUser.id)
          .eq('company_id', company.id);

        if (error) throw error;
        
        setSuccess('用戶權限更新成功');
        loadUsers();
      } else {
        // 建立新用戶
        // 1. 建立 Auth 帳號
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: formData.password,
          email_confirm: true,
        });

        if (authError) {
          // 如果無法使用 admin API，嘗試一般註冊
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
          });
          
          if (signUpError) throw signUpError;
          if (!signUpData.user) throw new Error('建立帳號失敗');

          // 2. 建立用戶資料
          const { data: userData, error: userError } = await supabase
            .from('acct_users')
            .insert({
              auth_id: signUpData.user.id,
              email: formData.email,
              name: formData.name,
              role: formData.role,
            })
            .select()
            .single();

          if (userError) throw userError;

          // 3. 建立用戶-公司關聯
          const { error: ucError } = await supabase
            .from('acct_user_companies')
            .insert({
              user_id: userData.id,
              company_id: company.id,
              role: formData.role,
            });

          if (ucError) throw ucError;
        } else if (authData.user) {
          // 使用 admin API 成功
          const { data: userData, error: userError } = await supabase
            .from('acct_users')
            .insert({
              auth_id: authData.user.id,
              email: formData.email,
              name: formData.name,
              role: formData.role,
            })
            .select()
            .single();

          if (userError) throw userError;

          const { error: ucError } = await supabase
            .from('acct_user_companies')
            .insert({
              user_id: userData.id,
              company_id: company.id,
              role: formData.role,
            });

          if (ucError) throw ucError;
        }

        setSuccess('用戶建立成功！已發送確認信到用戶信箱。');
        loadUsers();
      }
      
      setShowModal(false);
    } catch (err: any) {
      setError(err.message || '操作失敗');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!company) return;
    if (!confirm('確定要移除此用戶的存取權限嗎？')) return;

    const { error } = await supabase
      .from('acct_user_companies')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', company.id);

    if (!error) {
      loadUsers();
    }
  };

  if (!isAdmin()) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">您沒有權限存取此頁面</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">系統設定</h1>
          <p className="text-gray-500 mt-1">管理用戶權限與系統設定</p>
        </div>
      </div>

      {/* Company Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{company?.name}</h2>
            <p className="text-sm text-gray-500">統編：{company?.tax_id || '未設定'}</p>
          </div>
        </div>
      </div>

      {/* User Management */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900">用戶管理</h2>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <UserPlus className="w-4 h-4" />
            新增用戶
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">尚無其他用戶</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map(user => {
              const userCompany = user.user_companies.find(uc => uc.company_id === company?.id);
              const roleConfig = roleLabels[userCompany?.role || 'viewer'];
              
              return (
                <div key={user.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleConfig.color}`}>
                      {roleConfig.label}
                    </span>
                    <button
                      onClick={() => handleOpenModal(user)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveUser(user.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Permission Guide */}
      <div className="bg-blue-50 rounded-xl p-4">
        <h3 className="font-medium text-blue-900 mb-2">權限說明</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p><strong>管理員</strong>：完整權限，可管理用戶、修改設定</p>
          <p><strong>會計</strong>：可新增/編輯交易、憑證、客戶等資料</p>
          <p><strong>檢視者</strong>：只能查看資料，無法編輯</p>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingUser ? '編輯用戶權限' : '新增用戶'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {!editingUser && (
                <>
                  <div>
                    <label className="input-label">Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="input-label">姓名 *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="input-label">密碼 *</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      className="input-field"
                      minLength={6}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">至少 6 個字元</p>
                  </div>
                </>
              )}

              <div>
                <label className="input-label">角色權限</label>
                <div className="space-y-2">
                  {(['admin', 'accountant', 'viewer'] as const).map(role => (
                    <label
                      key={role}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        formData.role === role
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={role}
                        checked={formData.role === role}
                        onChange={() => setFormData({ ...formData, role })}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        formData.role === role ? 'border-blue-500' : 'border-gray-300'
                      }`}>
                        {formData.role === role && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{roleLabels[role].label}</p>
                        <p className="text-xs text-gray-500">
                          {role === 'admin' && '完整權限'}
                          {role === 'accountant' && '可編輯資料'}
                          {role === 'viewer' && '只能查看'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  取消
                </button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  {editingUser ? '儲存' : '建立'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
