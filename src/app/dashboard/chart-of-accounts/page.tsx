'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { defaultAccountCategories } from '@/data/accounts';
import { 
  BookOpen, ChevronDown, ChevronRight, 
  Wallet, Building2, Users, TrendingUp, DollarSign, Receipt
} from 'lucide-react';
import { AccountType, AccountCategory } from '@/types';

const accountTypeLabels: Record<AccountType, string> = {
  asset: '資產',
  liability: '負債',
  equity: '權益',
  revenue: '收入',
  cost: '成本',
  expense: '費用',
};

const accountTypeColors: Record<AccountType, string> = {
  asset: 'bg-blue-100 text-blue-700',
  liability: 'bg-red-100 text-red-700',
  equity: 'bg-purple-100 text-purple-700',
  revenue: 'bg-green-100 text-green-700',
  cost: 'bg-orange-100 text-orange-700',
  expense: 'bg-yellow-100 text-yellow-700',
};

const accountTypeIcons: Record<AccountType, React.ReactNode> = {
  asset: <Wallet className="w-5 h-5" />,
  liability: <Building2 className="w-5 h-5" />,
  equity: <Users className="w-5 h-5" />,
  revenue: <TrendingUp className="w-5 h-5" />,
  cost: <DollarSign className="w-5 h-5" />,
  expense: <Receipt className="w-5 h-5" />,
};

type BaseAccount = Omit<AccountCategory, 'id' | 'company_id' | 'created_at'>;

interface GroupedAccounts {
  [key: string]: {
    type: AccountType;
    accounts: BaseAccount[];
    subGroups: {
      [subKey: string]: BaseAccount[];
    };
  };
}

export default function ChartOfAccountsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const url_type = searchParams.get('type') || 'all';

  // 更新 URL 參數
  const updateURL = (filterType: string) => {
    const params = new URLSearchParams();
    if (filterType) params.set('type', filterType);
    router.replace(`/dashboard/chart-of-accounts?${params.toString()}`, { scroll: false });
  };


  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<AccountType | 'all'>(url_type as AccountType | 'all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['1', '2', '3', '4', '5', '6']));
  const [expandedSubGroups, setExpandedSubGroups] = useState<Set<string>>(new Set());

  // 篩選科目
  const filteredAccounts = useMemo(() => {
    return defaultAccountCategories.filter(account => {
      const matchesSearch = 
        account.code.includes(searchTerm) ||
        account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (account.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesType = filterType === 'all' || account.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [searchTerm, filterType]);

  // 將科目按大類和子類分組
  const groupedAccounts = useMemo(() => {
    const groups: GroupedAccounts = {};
    
    filteredAccounts.forEach(account => {
      const mainCode = account.code.charAt(0); // 取第一碼作為大類
      const subCode = account.code.substring(0, 2); // 取前兩碼作為子類
      
      if (!groups[mainCode]) {
        groups[mainCode] = {
          type: account.type,
          accounts: [],
          subGroups: {},
        };
      }
      
      // 如果是兩位數的科目，作為子類標題
      if (account.code.length === 2) {
        if (!groups[mainCode].subGroups[subCode]) {
          groups[mainCode].subGroups[subCode] = [];
        }
      } else {
        // 四位數的科目歸入對應子類
        if (!groups[mainCode].subGroups[subCode]) {
          groups[mainCode].subGroups[subCode] = [];
        }
        groups[mainCode].subGroups[subCode].push(account);
      }
      
      groups[mainCode].accounts.push(account);
    });
    
    return groups;
  }, [filteredAccounts]);

  // 取得大類名稱
  const getMainGroupName = (code: string): string => {
    const names: Record<string, string> = {
      '1': '資產',
      '2': '負債',
      '3': '權益',
      '4': '收入',
      '5': '成本',
      '6': '費用',
    };
    return names[code] || '其他';
  };

  // 取得子類名稱
  const getSubGroupName = (code: string): string => {
    const account = defaultAccountCategories.find(a => a.code === code);
    return account?.name || code;
  };

  const toggleGroup = (code: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleSubGroup = (code: string) => {
    const newExpanded = new Set(expandedSubGroups);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedSubGroups(newExpanded);
  };

  // 統計各類科目數量
  const stats = useMemo(() => {
    const counts: Record<AccountType, number> = {
      asset: 0,
      liability: 0,
      equity: 0,
      revenue: 0,
      cost: 0,
      expense: 0,
    };
    defaultAccountCategories.forEach(account => {
      counts[account.type]++;
    });
    return counts;
  }, []);

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">會計科目表</h1>
        <p className="text-sm text-gray-500 mt-1">依據台灣商業會計法規定的標準會計科目分類</p>
      </div>

      {/* 科目類型統計 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {Object.entries(accountTypeLabels).map(([type, label]) => (
          <button
            key={type}
            onClick={() => { setFilterType(filterType === type ? 'all' : type as AccountType); updateURL(filterType === type ? 'all' : type as AccountType); }}
            className={`stats-card cursor-pointer transition-all ${
              filterType === type ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${accountTypeColors[type as AccountType]}`}>
                {accountTypeIcons[type as AccountType]}
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-lg font-bold">{stats[type as AccountType]}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* 搜尋區 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜尋科目代碼、名稱或說明..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as AccountType | 'all')}
            className="input-field w-40"
          >
            <option value="all">所有類型</option>
            {Object.entries(accountTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}類</option>
            ))}
          </select>
        </div>
      </div>

      {/* 科目表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {Object.keys(groupedAccounts).length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">找不到符合條件的科目</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {Object.entries(groupedAccounts)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([mainCode, group]) => (
                <div key={mainCode}>
                  {/* 大類標題 */}
                  <button
                    onClick={() => toggleGroup(mainCode)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {expandedGroups.has(mainCode) ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                      <span className={`px-2 py-1 rounded text-sm font-medium ${accountTypeColors[group.type]}`}>
                        {mainCode}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {getMainGroupName(mainCode)}類
                      </span>
                      <span className="text-sm text-gray-500">
                        ({group.accounts.length} 個科目)
                      </span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs ${accountTypeColors[group.type]}`}>
                      {accountTypeLabels[group.type]}
                    </div>
                  </button>

                  {/* 展開的科目列表 */}
                  {expandedGroups.has(mainCode) && (
                    <div className="divide-y divide-gray-100">
                      {Object.entries(group.subGroups)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([subCode, accounts]) => (
                          <div key={subCode}>
                            {/* 子類標題 */}
                            <button
                              onClick={() => toggleSubGroup(subCode)}
                              className="w-full px-4 py-2 pl-12 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                            >
                              {expandedSubGroups.has(subCode) ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
                              <span className="font-mono text-sm text-blue-600">{subCode}</span>
                              <span className="font-medium text-gray-700">
                                {getSubGroupName(subCode)}
                              </span>
                              <span className="text-xs text-gray-400">
                                ({accounts.length} 個科目)
                              </span>
                            </button>

                            {/* 子類下的科目 */}
                            {expandedSubGroups.has(subCode) && accounts.length > 0 && (
                              <div className="bg-gray-50/50">
                                {accounts.map((account) => (
                                  <div
                                    key={account.code}
                                    className="px-4 py-2 pl-20 flex items-center justify-between hover:bg-gray-100 transition-colors border-l-2 border-gray-200 ml-12"
                                  >
                                    <div className="flex items-center gap-4">
                                      <span className="font-mono text-sm text-gray-600 w-16">
                                        {account.code}
                                      </span>
                                      <span className="text-gray-900">{account.name}</span>
                                    </div>
                                    {account.description && (
                                      <span className="text-sm text-gray-500 hidden md:block">
                                        {account.description}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* 說明 */}
      <div className="bg-blue-50 rounded-xl p-4">
        <h3 className="font-semibold text-blue-900 mb-2">科目編碼說明</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-blue-800">
          <div>
            <span className="font-mono font-bold">1xxx</span> - 資產類
          </div>
          <div>
            <span className="font-mono font-bold">2xxx</span> - 負債類
          </div>
          <div>
            <span className="font-mono font-bold">3xxx</span> - 權益類
          </div>
          <div>
            <span className="font-mono font-bold">4xxx</span> - 收入類
          </div>
          <div>
            <span className="font-mono font-bold">5xxx</span> - 成本類
          </div>
          <div>
            <span className="font-mono font-bold">6xxx</span> - 費用類
          </div>
        </div>
      </div>
    </div>
  );
}
