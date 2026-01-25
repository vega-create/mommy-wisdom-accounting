import { AccountCategory, AccountType } from '@/types';

// 台灣標準會計科目表（參考商業會計法）
export const defaultAccountCategories: Omit<AccountCategory, 'id' | 'company_id' | 'created_at'>[] = [
  // ============================================
  // 1xxx 資產類
  // ============================================
  // 11xx 流動資產
  { code: '1100', name: '流動資產', type: 'asset', description: '流動資產總類', is_system: true, is_active: true },
  { code: '1101', name: '現金', type: 'asset', description: '庫存現金', is_system: true, is_active: true },
  { code: '1102', name: '零用金', type: 'asset', description: '零用金', is_system: true, is_active: true },
  { code: '1103', name: '銀行存款', type: 'asset', description: '銀行活期及定期存款', is_system: true, is_active: true },
  { code: '1110', name: '應收帳款', type: 'asset', description: '銷貨產生之應收款項', is_system: true, is_active: true },
  { code: '1111', name: '應收票據', type: 'asset', description: '因營業收入而收取之票據', is_system: true, is_active: true },
  { code: '1120', name: '其他應收款', type: 'asset', description: '非營業產生之應收款項', is_system: true, is_active: true },
  { code: '1130', name: '預付款項', type: 'asset', description: '預付貨款及費用', is_system: true, is_active: true },
  { code: '1140', name: '存貨', type: 'asset', description: '商品存貨', is_system: true, is_active: true },
  
  // 12xx 非流動資產
  { code: '1200', name: '非流動資產', type: 'asset', description: '非流動資產總類', is_system: true, is_active: true },
  { code: '1210', name: '不動產、廠房及設備', type: 'asset', description: '固定資產', is_system: true, is_active: true },
  { code: '1211', name: '土地', type: 'asset', description: '土地', is_system: true, is_active: true },
  { code: '1212', name: '房屋及建築', type: 'asset', description: '房屋及建築物', is_system: true, is_active: true },
  { code: '1213', name: '機器設備', type: 'asset', description: '機器及設備', is_system: true, is_active: true },
  { code: '1214', name: '運輸設備', type: 'asset', description: '車輛等運輸設備', is_system: true, is_active: true },
  { code: '1215', name: '辦公設備', type: 'asset', description: '辦公傢俱及設備', is_system: true, is_active: true },
  { code: '1216', name: '累計折舊', type: 'asset', description: '累計折舊（減項）', is_system: true, is_active: true },
  { code: '1220', name: '無形資產', type: 'asset', description: '商標權、專利權等', is_system: true, is_active: true },

  // ============================================
  // 2xxx 負債類
  // ============================================
  // 21xx 流動負債
  { code: '2100', name: '流動負債', type: 'liability', description: '流動負債總類', is_system: true, is_active: true },
  { code: '2101', name: '短期借款', type: 'liability', description: '一年內到期之借款', is_system: true, is_active: true },
  { code: '2110', name: '應付帳款', type: 'liability', description: '進貨產生之應付款項', is_system: true, is_active: true },
  { code: '2111', name: '應付票據', type: 'liability', description: '因進貨而開立之票據', is_system: true, is_active: true },
  { code: '2120', name: '其他應付款', type: 'liability', description: '非營業產生之應付款項', is_system: true, is_active: true },
  { code: '2130', name: '預收款項', type: 'liability', description: '預收貨款', is_system: true, is_active: true },
  { code: '2140', name: '應付薪資', type: 'liability', description: '應付員工薪資', is_system: true, is_active: true },
  { code: '2150', name: '應付稅捐', type: 'liability', description: '應付營業稅、所得稅等', is_system: true, is_active: true },
  { code: '2151', name: '應付營業稅', type: 'liability', description: '應付銷項稅額', is_system: true, is_active: true },
  { code: '2160', name: '應付費用', type: 'liability', description: '已發生未支付之費用', is_system: true, is_active: true },

  // 22xx 非流動負債
  { code: '2200', name: '非流動負債', type: 'liability', description: '非流動負債總類', is_system: true, is_active: true },
  { code: '2201', name: '長期借款', type: 'liability', description: '一年以上到期之借款', is_system: true, is_active: true },

  // ============================================
  // 3xxx 權益類
  // ============================================
  { code: '3100', name: '股本', type: 'equity', description: '股東投入之資本', is_system: true, is_active: true },
  { code: '3101', name: '普通股股本', type: 'equity', description: '普通股股本', is_system: true, is_active: true },
  { code: '3200', name: '資本公積', type: 'equity', description: '股本溢價等', is_system: true, is_active: true },
  { code: '3300', name: '保留盈餘', type: 'equity', description: '累積盈餘', is_system: true, is_active: true },
  { code: '3301', name: '法定盈餘公積', type: 'equity', description: '法定提撥之盈餘', is_system: true, is_active: true },
  { code: '3302', name: '未分配盈餘', type: 'equity', description: '尚未分配之盈餘', is_system: true, is_active: true },
  { code: '3400', name: '本期損益', type: 'equity', description: '本期淨利或淨損', is_system: true, is_active: true },

  // ============================================
  // 4xxx 收入類
  // ============================================
  { code: '4100', name: '營業收入', type: 'revenue', description: '營業收入總類', is_system: true, is_active: true },
  { code: '4101', name: '銷貨收入', type: 'revenue', description: '商品銷售收入', is_system: true, is_active: true },
  { code: '4102', name: '服務收入', type: 'revenue', description: '提供服務之收入', is_system: true, is_active: true },
  { code: '4103', name: '佣金收入', type: 'revenue', description: '佣金及代理收入', is_system: true, is_active: true },
  { code: '4110', name: '銷貨退回', type: 'revenue', description: '銷貨退回（減項）', is_system: true, is_active: true },
  { code: '4111', name: '銷貨折讓', type: 'revenue', description: '銷貨折讓（減項）', is_system: true, is_active: true },
  
  { code: '4200', name: '營業外收入', type: 'revenue', description: '營業外收入總類', is_system: true, is_active: true },
  { code: '4201', name: '利息收入', type: 'revenue', description: '銀行利息收入', is_system: true, is_active: true },
  { code: '4202', name: '租金收入', type: 'revenue', description: '出租資產之收入', is_system: true, is_active: true },
  { code: '4203', name: '股利收入', type: 'revenue', description: '投資股利收入', is_system: true, is_active: true },
  { code: '4204', name: '處分資產利益', type: 'revenue', description: '出售資產之利益', is_system: true, is_active: true },
  { code: '4209', name: '其他收入', type: 'revenue', description: '其他營業外收入', is_system: true, is_active: true },

  // ============================================
  // 5xxx 成本類（視為費用）
  // ============================================
  { code: '5100', name: '營業成本', type: 'expense', description: '營業成本總類', is_system: true, is_active: true },
  { code: '5101', name: '銷貨成本', type: 'expense', description: '商品銷售成本', is_system: true, is_active: true },
  { code: '5102', name: '進貨', type: 'expense', description: '商品進貨', is_system: true, is_active: true },
  { code: '5103', name: '進貨退出', type: 'expense', description: '進貨退出（減項）', is_system: true, is_active: true },
  { code: '5104', name: '進貨折讓', type: 'expense', description: '進貨折讓（減項）', is_system: true, is_active: true },

  // ============================================
  // 6xxx 費用類
  // ============================================
  { code: '6100', name: '營業費用', type: 'expense', description: '營業費用總類', is_system: true, is_active: true },
  { code: '6101', name: '薪資支出', type: 'expense', description: '員工薪資', is_system: true, is_active: true },
  { code: '6102', name: '勞健保費', type: 'expense', description: '勞保、健保雇主負擔', is_system: true, is_active: true },
  { code: '6103', name: '退休金', type: 'expense', description: '退休金提撥', is_system: true, is_active: true },
  { code: '6104', name: '伙食費', type: 'expense', description: '員工伙食費', is_system: true, is_active: true },
  { code: '6105', name: '加班費', type: 'expense', description: '員工加班費', is_system: true, is_active: true },
  { code: '6106', name: '獎金', type: 'expense', description: '年終獎金等', is_system: true, is_active: true },
  
  { code: '6110', name: '租金支出', type: 'expense', description: '辦公室租金', is_system: true, is_active: true },
  { code: '6111', name: '水電瓦斯費', type: 'expense', description: '水電瓦斯費用', is_system: true, is_active: true },
  { code: '6112', name: '電話費', type: 'expense', description: '電話及網路費', is_system: true, is_active: true },
  { code: '6113', name: '郵電費', type: 'expense', description: '郵資及快遞費', is_system: true, is_active: true },
  
  { code: '6120', name: '文具用品', type: 'expense', description: '辦公文具用品', is_system: true, is_active: true },
  { code: '6121', name: '消耗品', type: 'expense', description: '辦公消耗品', is_system: true, is_active: true },
  { code: '6122', name: '修繕費', type: 'expense', description: '設備維修費用', is_system: true, is_active: true },
  
  { code: '6130', name: '保險費', type: 'expense', description: '商業保險費', is_system: true, is_active: true },
  { code: '6131', name: '稅捐', type: 'expense', description: '營業稅以外之稅捐', is_system: true, is_active: true },
  { code: '6132', name: '規費', type: 'expense', description: '政府規費', is_system: true, is_active: true },
  
  { code: '6140', name: '廣告費', type: 'expense', description: '廣告宣傳費', is_system: true, is_active: true },
  { code: '6141', name: '推銷費', type: 'expense', description: '業務推銷費', is_system: true, is_active: true },
  { code: '6142', name: '交際費', type: 'expense', description: '業務交際費', is_system: true, is_active: true },
  
  { code: '6150', name: '旅費', type: 'expense', description: '出差旅費', is_system: true, is_active: true },
  { code: '6151', name: '運費', type: 'expense', description: '貨物運費', is_system: true, is_active: true },
  { code: '6152', name: '油料費', type: 'expense', description: '車輛油料費', is_system: true, is_active: true },
  
  { code: '6160', name: '折舊', type: 'expense', description: '固定資產折舊', is_system: true, is_active: true },
  { code: '6161', name: '攤銷', type: 'expense', description: '無形資產攤銷', is_system: true, is_active: true },
  
  { code: '6170', name: '專業服務費', type: 'expense', description: '會計師、律師等', is_system: true, is_active: true },
  { code: '6171', name: '外包費', type: 'expense', description: '外包勞務費', is_system: true, is_active: true },
  { code: '6172', name: '勞務費', type: 'expense', description: '臨時人員勞務費', is_system: true, is_active: true },
  
  { code: '6180', name: '銀行手續費', type: 'expense', description: '銀行手續費', is_system: true, is_active: true },
  { code: '6181', name: '利息支出', type: 'expense', description: '借款利息', is_system: true, is_active: true },
  
  { code: '6190', name: '雜項支出', type: 'expense', description: '其他雜項費用', is_system: true, is_active: true },
  { code: '6191', name: '書報費', type: 'expense', description: '書籍報章費', is_system: true, is_active: true },
  { code: '6192', name: '訓練費', type: 'expense', description: '員工訓練費', is_system: true, is_active: true },
  { code: '6193', name: '捐贈', type: 'expense', description: '捐贈支出', is_system: true, is_active: true },

  // 營業外費用
  { code: '6200', name: '營業外費用', type: 'expense', description: '營業外費用總類', is_system: true, is_active: true },
  { code: '6201', name: '處分資產損失', type: 'expense', description: '出售資產之損失', is_system: true, is_active: true },
  { code: '6209', name: '其他損失', type: 'expense', description: '其他營業外損失', is_system: true, is_active: true },

  // 所得稅
  { code: '6300', name: '所得稅費用', type: 'expense', description: '營利事業所得稅', is_system: true, is_active: true },
];

// 依類型取得科目
export function getAccountsByType(type: AccountType) {
  return defaultAccountCategories.filter(acc => acc.type === type);
}

// 取得科目類型中文名稱
export function getAccountTypeName(type: AccountType): string {
  const names: Record<AccountType, string> = {
    asset: '資產',
    liability: '負債',
    equity: '權益',
    revenue: '收入',
    cost: '成本',
    expense: '費用'
  };
  return names[type];
}

// 取得科目類型顏色
export function getAccountTypeColor(type: AccountType): string {
  const colors: Record<AccountType, string> = {
    asset: 'text-blue-600 bg-blue-50',
    liability: 'text-red-600 bg-red-50',
    equity: 'text-purple-600 bg-purple-50',
    revenue: 'text-green-600 bg-green-50',
    cost: 'text-yellow-600 bg-yellow-50',
    expense: 'text-orange-600 bg-orange-50'
  };
  return colors[type];
}
