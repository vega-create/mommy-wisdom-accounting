'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { Users, UserPlus, Shield, Building2, Check, X, Trash2, Edit2, Upload, Save } from 'lucide-react';

interface UserWithCompanies {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  user_companies: { company_id: string; role: string; company: { id: string; name: string; }; }[];
}

interface CompanySettings {
  name: string;
  tax_id: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
  stamp_url: string;
  bank_name: string;
  bank_account: string;
  bank_account_name: string;
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
  const [formData, setFormData] = useState({ email: '', name: '', password: '', role: 'viewer' as 'admin' | 'accountant' | 'viewer' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 公司設定
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: '', tax_id: '', address: '', phone: '', email: '', logo_url: '', stamp_url: '', bank_name: '', bank_account: '', bank_account_name: ''
  });
  const [savingCompany, setSavingCompany] = useState(false);
  const [companySuccess, setCompanySuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'company' | 'users'>('company');

  useEffect(() => {
    if (company) {
      loadUsers();
      loadCompanySettings();
    }
  }, [company]);

  const loadCompanySettings = async () => {
    if (!company) return;
    const { data } = await supabase.from('acct_companies').select('*').eq('id', company.id).single();
    if (data) {
      setCompanySettings({
        name: data.name || '',
        tax_id: data.tax_id || '',
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        logo_url: data.logo_url || '',
        stamp_url: data.stamp_url || '',
        bank_name: data.bank_name || '',
        bank_account: data.bank_account || '',
        bank_account_name: data.bank_account_name || '',
      });
    }
  };

  const handleSaveCompany = async () => {
    if (!company) return;
    setSavingCompany(true);
    setCompanySuccess('');
    
    const { error } = await supabase
      .from('acct_companies')
      .update({
        name: companySettings.name,
        tax_id: companySettings.tax_id,
        address: companySettings.address,
        phone: companySettings.phone,
        email: companySettings.email,
        logo_url: companySettings.logo_url,
        stamp_url: companySettings.stamp_url,
        bank_name: companySettings.bank_name,
        bank_account: companySettings.bank_account,
        bank_account_name: companySettings.bank_account_name,
      })
      .eq('id', company.id);

    setSavingCompany(false);
    if (!error) setCompanySuccess('公司資料已儲存');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo_url' | 'stamp_url') => {
    const file = e.target.files?.[0];
    if (!file || !company) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${company.id}/${field}-${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('company-assets')
      .upload(fileName, file, { upsert: true });

    if (!error && data) {
      const { data: urlData } = supabase.storage.from('company-assets').getPublicUrl(data.path);
      setCompanySettings({ ...companySettings, [field]: urlData.publicUrl });
    } else {
      // 如果 storage 不存在，用 base64
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCompanySettings({ ...companySettings, [field]: ev.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const loadUsers = async () => {
    if (!company) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('acct_user_companies')
      .select(`user_id, role, user:acct_users(id, email, name, role, is_active, created_at)`)
      .eq('company_id', company.id);

    if (!error && data) {
      const formattedUsers: UserWithCompanies[] = data.map((item: any) => ({
        id: item.user?.id || '', email: item.user?.email || '', name: item.user?.name || '',
        role: item.user?.role || 'viewer', is_active: item.user?.is_active ?? true,
        created_at: item.user?.created_at || '',
        user_companies: [{ company_id: company.id, role: item.role, company: company }]
      }));
      setUsers(formattedUsers);
    }
    setLoading(false);
  };

  const handleOpenModal = (user?: UserWithCompanies) => {
    if (user) {
      setEditingUser(user);
      const userCompany = user.user_companies.find(uc => uc.company_id === company?.id);
      setFormData({ email: user.email, name: user.name, password: '', role: (userCompany?.role || 'viewer') as any });
    } else {
      setEditingUser(null);
      setFormData({ email: '', name: '', password: '', role: 'viewer' });
    }
    setError(''); setSuccess(''); setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!company) return;

    try {
      if (editingUser) {
        const { error } = await supabase.from('acct_user_companies').update({ role: formData.role }).eq('user_id', editingUser.id).eq('company_id', company.id);
        if (error) throw error;
        setSuccess('用戶權限更新成功');
        loadUsers();
      } else {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email: formData.email, password: formData.password });
        if (signUpError) throw signUpError;
        if (!signUpData.user) throw new Error('建立帳號失敗');

        const { data: userData, error: userError } = await supabase.from('acct_users').insert({ auth_id: signUpData.user.id, email: formData.email, name: formData.name, role: formData.role }).select().single();
        if (userError) throw userError;

        const { error: ucError } = await supabase.from('acct_user_companies').insert({ user_id: userData.id, company_id: company.id, role: formData.role });
        if (ucError) throw ucError;

        setSuccess('用戶建立成功！');
        loadUsers();
      }
      setShowModal(false);
    } catch (err: any) {
      setError(err.message || '操作失敗');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!company || !confirm('確定要移除此用戶的存取權限嗎？')) return;
    const { error } = await supabase.from('acct_user_companies').delete().eq('user_id', userId).eq('company_id', company.id);
    if (!error) loadUsers();
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">系統設定</h1>
        <p className="text-gray-500 mt-1">管理公司資料與用戶權限</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button onClick={() => setActiveTab('company')} className={`pb-3 px-1 font-medium ${activeTab === 'company' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}>
          公司資料
        </button>
        <button onClick={() => setActiveTab('users')} className={`pb-3 px-1 font-medium ${activeTab === 'users' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}>
          用戶管理
        </button>
      </div>

      {activeTab === 'company' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">公司資料設定</h2>
              <p className="text-sm text-gray-500">這些資料會顯示在合約、報價單等文件上</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">公司名稱</label>
              <input type="text" value={companySettings.name} onChange={(e) => setCompanySettings({ ...companySettings, name: e.target.value })} className="w-full border rounded-lg px-4 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">統一編號</label>
              <input type="text" value={companySettings.tax_id} onChange={(e) => setCompanySettings({ ...companySettings, tax_id: e.target.value })} className="w-full border rounded-lg px-4 py-2" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">公司地址</label>
              <input type="text" value={companySettings.address} onChange={(e) => setCompanySettings({ ...companySettings, address: e.target.value })} className="w-full border rounded-lg px-4 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電話</label>
              <input type="text" value={companySettings.phone} onChange={(e) => setCompanySettings({ ...companySettings, phone: e.target.value })} className="w-full border rounded-lg px-4 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={companySettings.email} onChange={(e) => setCompanySettings({ ...companySettings, email: e.target.value })} className="w-full border rounded-lg px-4 py-2" />
            </div>
          </div>

          <hr className="my-6" />

          <h3 className="font-semibold mb-4">銀行帳戶資訊</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">銀行名稱</label>
              <input type="text" value={companySettings.bank_name} onChange={(e) => setCompanySettings({ ...companySettings, bank_name: e.target.value })} className="w-full border rounded-lg px-4 py-2" placeholder="例：彰化銀行" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">帳號</label>
              <input type="text" value={companySettings.bank_account} onChange={(e) => setCompanySettings({ ...companySettings, bank_account: e.target.value })} className="w-full border rounded-lg px-4 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">戶名</label>
              <input type="text" value={companySettings.bank_account_name} onChange={(e) => setCompanySettings({ ...companySettings, bank_account_name: e.target.value })} className="w-full border rounded-lg px-4 py-2" />
            </div>
          </div>

          <hr className="my-6" />

          <h3 className="font-semibold mb-4">公司章與 Logo</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">公司 Logo</label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                {companySettings.logo_url ? (
                  <div>
                    <img src={companySettings.logo_url} alt="Logo" className="max-h-24 mx-auto mb-2" />
                    <button onClick={() => setCompanySettings({ ...companySettings, logo_url: '' })} className="text-sm text-red-600 hover:underline">移除</button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <span className="text-sm text-gray-500">點擊上傳 Logo</span>
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo_url')} className="hidden" />
                  </label>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">公司大小章</label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                {companySettings.stamp_url ? (
                  <div>
                    <img src={companySettings.stamp_url} alt="公司章" className="max-h-24 mx-auto mb-2" />
                    <button onClick={() => setCompanySettings({ ...companySettings, stamp_url: '' })} className="text-sm text-red-600 hover:underline">移除</button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <span className="text-sm text-gray-500">點擊上傳大小章圖片</span>
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'stamp_url')} className="hidden" />
                  </label>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">建議使用透明背景的 PNG 圖片</p>
            </div>
          </div>

          {companySuccess && <div className="mt-4 bg-green-50 text-green-600 px-4 py-2 rounded-lg text-sm">{companySuccess}</div>}

          <div className="mt-6">
            <button onClick={handleSaveCompany} disabled={savingCompany} className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-2">
              <Save className="w-4 h-4" />
              {savingCompany ? '儲存中...' : '儲存公司資料'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <>
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-500" />
                <h2 className="font-semibold text-gray-900">用戶管理</h2>
              </div>
              <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2 text-sm">
                <UserPlus className="w-4 h-4" />
                新增用戶
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center"><Users className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">尚無其他用戶</p></div>
            ) : (
              <div className="divide-y divide-gray-100">
                {users.map(user => {
                  const userCompany = user.user_companies.find(uc => uc.company_id === company?.id);
                  const roleConfig = roleLabels[userCompany?.role || 'viewer'];
                  return (
                    <div key={user.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">{user.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleConfig.color}`}>{roleConfig.label}</span>
                        <button onClick={() => handleOpenModal(user)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleRemoveUser(user.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-blue-50 rounded-xl p-4">
            <h3 className="font-medium text-blue-900 mb-2">權限說明</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p><strong>管理員</strong>：完整權限，可管理用戶、修改設定</p>
              <p><strong>會計</strong>：可新增/編輯交易、憑證、客戶等資料</p>
              <p><strong>檢視者</strong>：只能查看資料，無法編輯</p>
            </div>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{editingUser ? '編輯用戶權限' : '新增用戶'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {!editingUser && (
                <>
                  <div><label className="block text-sm font-medium mb-1">Email *</label><input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full border rounded-lg px-4 py-2" required /></div>
                  <div><label className="block text-sm font-medium mb-1">姓名 *</label><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border rounded-lg px-4 py-2" required /></div>
                  <div><label className="block text-sm font-medium mb-1">密碼 *</label><input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full border rounded-lg px-4 py-2" minLength={6} required /><p className="text-xs text-gray-500 mt-1">至少 6 個字元</p></div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium mb-2">角色權限</label>
                <div className="space-y-2">
                  {(['admin', 'accountant', 'viewer'] as const).map(role => (
                    <label key={role} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${formData.role === role ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                      <input type="radio" name="role" value={role} checked={formData.role === role} onChange={() => setFormData({ ...formData, role })} className="sr-only" />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.role === role ? 'border-red-500' : 'border-gray-300'}`}>
                        {formData.role === role && <div className="w-2 h-2 bg-red-500 rounded-full" />}
                      </div>
                      <div>
                        <p className="font-medium">{roleLabels[role].label}</p>
                        <p className="text-xs text-gray-500">{role === 'admin' && '完整權限'}{role === 'accountant' && '可編輯資料'}{role === 'viewer' && '只能查看'}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {error && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{error}</div>}
              {success && <div className="bg-green-50 text-green-600 px-4 py-2 rounded-lg text-sm">{success}</div>}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">取消</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center gap-2"><Check className="w-4 h-4" />{editingUser ? '儲存' : '建立'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
