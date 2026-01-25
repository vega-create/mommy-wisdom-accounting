// lib/ezpay.ts
// ezPay 電子發票 API 串接

import crypto from 'crypto';

// API URLs
const EZPAY_URLS = {
  test: {
    issue: 'https://cinv.ezpay.com.tw/Api/invoice_issue',
    invalid: 'https://cinv.ezpay.com.tw/Api/invoice_invalid',
    search: 'https://cinv.ezpay.com.tw/Api/invoice_search',
  },
  production: {
    issue: 'https://inv.ezpay.com.tw/Api/invoice_issue',
    invalid: 'https://inv.ezpay.com.tw/Api/invoice_invalid',
    search: 'https://inv.ezpay.com.tw/Api/invoice_search',
  },
};

// ezPay 設定介面
export interface EzPayConfig {
  merchantId: string;
  hashKey: string;
  hashIV: string;
  isProduction: boolean;
}

// 發票項目介面
export interface InvoiceItem {
  name: string;      // 品名
  count: number;     // 數量
  unit: string;      // 單位
  price: number;     // 單價
  amount: number;    // 金額 (price * count)
  taxType?: '1' | '2' | '3'; // 1:應稅, 2:零稅率, 3:免稅
}

// 開立發票參數
export interface IssueInvoiceParams {
  orderNumber: string;        // 訂單編號
  invoiceType: 'B2B' | 'B2C'; // 發票類型

  // 買受人資訊
  buyerName: string;
  buyerTaxId?: string;        // 統編 (B2B 必填)
  buyerEmail?: string;
  buyerPhone?: string;
  buyerAddress?: string;

  // 載具 (B2C)
  carrierType?: '' | '0' | '1' | '2'; // 空:無, 0:手機條碼, 1:自然人憑證, 2:ezPay載具
  carrierNum?: string;

  // 捐贈
  loveCode?: string;          // 愛心碼

  // 發票內容
  items: InvoiceItem[];
  taxType?: '1' | '2' | '3';  // 1:應稅, 2:零稅率, 3:免稅
  comment?: string;           // 備註
}

// 開立發票回傳
export interface IssueInvoiceResult {
  success: boolean;
  invoiceNumber?: string;     // 發票號碼
  invoiceDate?: string;       // 開票日期
  randomNum?: string;         // 隨機碼
  transNum?: string;          // ezPay 交易序號
  message?: string;
  rawResponse?: any;
}

// 作廢發票參數
export interface InvalidInvoiceParams {
  invoiceNumber: string;      // 發票號碼
  invalidReason: string;      // 作廢原因
}

// AES 加密
function aesEncrypt(data: string, key: string, iv: string): string {
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(key, 'utf8'),
    Buffer.from(iv, 'utf8')
  );
  cipher.setAutoPadding(true);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// AES 解密
function aesDecrypt(data: string, key: string, iv: string): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(key, 'utf8'),
    Buffer.from(iv, 'utf8')
  );
  decipher.setAutoPadding(true);
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// 組建交易資料字串
function buildPostDataString(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
}

/**
 * 開立發票
 */
export async function issueInvoice(
  config: EzPayConfig,
  params: IssueInvoiceParams
): Promise<IssueInvoiceResult> {
  const urls = config.isProduction ? EZPAY_URLS.production : EZPAY_URLS.test;
  const timestamp = Math.floor(Date.now() / 1000);

  // 計算金額
  const taxType = params.taxType || '1';
  const taxRate = taxType === '1' ? 0.05 : 0;

  // 計算總金額（含稅）
  const totalAmount = params.items.reduce((sum, item) => sum + item.amount, 0);

  // 計算未稅金額和稅額
  const salesAmount = Math.round(totalAmount / (1 + taxRate));
  const taxAmount = totalAmount - salesAmount;

  // 建立品項字串（用 | 分隔）
  const itemName = params.items.map(i => i.name).join('|');
  const itemCount = params.items.map(i => i.count).join('|');
  const itemUnit = params.items.map(i => i.unit || '式').join('|');
  const itemPrice = params.items.map(i => i.price).join('|');
  const itemAmount = params.items.map(i => i.amount).join('|');

  // 組建交易資料
  const postData: Record<string, string | number> = {
    RespondType: 'JSON',
    Version: '1.5',
    TimeStamp: timestamp,
    TransNum: '',
    MerchantOrderNo: params.orderNumber,
    Status: '1', // 1:立即開立
    CreateStatusTime: '',
    Category: params.invoiceType,
    BuyerName: params.buyerName,
    BuyerUBN: params.buyerTaxId || '',
    BuyerEmail: params.buyerEmail || '',
    BuyerPhone: params.buyerPhone || '',
    BuyerAddress: params.buyerAddress || '',
    CarrierType: params.carrierType || '',
    CarrierNum: params.carrierNum || '',
    LoveCode: params.loveCode || '',
    PrintFlag: params.invoiceType === 'B2B' ? 'Y' : 'N',
    TaxType: taxType,
    TaxRate: taxType === '1' ? 5 : 0,
    Amt: salesAmount,
    TaxAmt: taxAmount,
    TotalAmt: totalAmount,
    ItemName: itemName,
    ItemCount: itemCount,
    ItemUnit: itemUnit,
    ItemPrice: itemPrice,
    ItemAmt: itemAmount,
    Comment: params.comment || '',
  };

  // 加密
  const postDataString = buildPostDataString(postData);
  const encryptedData = aesEncrypt(postDataString, config.hashKey, config.hashIV);

  // 發送請求
  try {
    const formData = new URLSearchParams({
      MerchantID_: config.merchantId,
      PostData_: encryptedData,
    });

    const response = await fetch(urls.issue, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const result = await response.json();
    console.log('ezPay issue response:', result);

    if (result.Status === 'SUCCESS') {
      // 解密回傳資料
      const decryptedData = aesDecrypt(result.Result, config.hashKey, config.hashIV);
      const invoiceData = JSON.parse(decryptedData);

      return {
        success: true,
        invoiceNumber: invoiceData.InvoiceNumber,
        invoiceDate: invoiceData.CreateTime,
        randomNum: invoiceData.RandomNum,
        transNum: invoiceData.InvoiceTransNo,
        message: '開立成功',
        rawResponse: invoiceData,
      };
    } else {
      return {
        success: false,
        message: result.Message || '開立失敗',
        rawResponse: result,
      };
    }
  } catch (error) {
    console.error('ezPay issue error:', error);
    return {
      success: false,
      message: `API 錯誤: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 作廢發票
 */
export async function invalidInvoice(
  config: EzPayConfig,
  params: InvalidInvoiceParams
): Promise<{
  success: boolean;
  message?: string;
  rawResponse?: any;
}> {
  const urls = config.isProduction ? EZPAY_URLS.production : EZPAY_URLS.test;
  const timestamp = Math.floor(Date.now() / 1000);

  const postData: Record<string, string | number> = {
    RespondType: 'JSON',
    Version: '1.0',
    TimeStamp: timestamp,
    InvoiceNumber: params.invoiceNumber,
    InvalidReason: params.invalidReason,
  };

  const postDataString = buildPostDataString(postData);
  const encryptedData = aesEncrypt(postDataString, config.hashKey, config.hashIV);

  try {
    const formData = new URLSearchParams({
      MerchantID_: config.merchantId,
      PostData_: encryptedData,
    });

    const response = await fetch(urls.invalid, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const result = await response.json();
    console.log('ezPay invalid response:', result);

    if (result.Status === 'SUCCESS') {
      return {
        success: true,
        message: '作廢成功',
        rawResponse: result,
      };
    } else {
      return {
        success: false,
        message: result.Message || '作廢失敗',
        rawResponse: result,
      };
    }
  } catch (error) {
    console.error('ezPay invalid error:', error);
    return {
      success: false,
      message: `API 錯誤: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 查詢發票
 */
export async function searchInvoice(
  config: EzPayConfig,
  params: {
    invoiceNumber?: string;
    orderNumber?: string;
    startDate?: string; // YYYY-MM-DD
    endDate?: string;
  }
): Promise<{
  success: boolean;
  invoices?: any[];
  message?: string;
  rawResponse?: any;
}> {
  const urls = config.isProduction ? EZPAY_URLS.production : EZPAY_URLS.test;
  const timestamp = Math.floor(Date.now() / 1000);

  const postData: Record<string, string | number> = {
    RespondType: 'JSON',
    Version: '1.3',
    TimeStamp: timestamp,
    SearchType: params.invoiceNumber ? '0' : '1', // 0:發票號碼, 1:商店訂單編號
    InvoiceNumber: params.invoiceNumber || '',
    MerchantOrderNo: params.orderNumber || '',
    TotalAmt: 0,
  };

  if (params.startDate) {
    postData.BeginDate = params.startDate.replace(/-/g, '/');
  }
  if (params.endDate) {
    postData.EndDate = params.endDate.replace(/-/g, '/');
  }

  const postDataString = buildPostDataString(postData);
  const encryptedData = aesEncrypt(postDataString, config.hashKey, config.hashIV);

  try {
    const formData = new URLSearchParams({
      MerchantID_: config.merchantId,
      PostData_: encryptedData,
    });

    const response = await fetch(urls.search, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const result = await response.json();
    console.log('ezPay search response:', result);

    if (result.Status === 'SUCCESS') {
      const decryptedData = aesDecrypt(result.Result, config.hashKey, config.hashIV);
      const searchResult = JSON.parse(decryptedData);

      return {
        success: true,
        invoices: Array.isArray(searchResult) ? searchResult : [searchResult],
        message: '查詢成功',
        rawResponse: searchResult,
      };
    } else {
      return {
        success: false,
        message: result.Message || '查詢失敗',
        rawResponse: result,
      };
    }
  } catch (error) {
    console.error('ezPay search error:', error);
    return {
      success: false,
      message: `API 錯誤: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
