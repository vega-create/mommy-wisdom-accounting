// lib/ezpay.ts
// ezPay 電子發票 API 串接
// 加密方式與 /api/invoices/issue/route.ts 一致（標準 PKCS7 填充）

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
  name: string;
  count: number;
  unit: string;
  price: number;
  amount: number;
  taxType?: '1' | '2' | '3';
}

// 開立發票參數
export interface IssueInvoiceParams {
  orderNumber: string;
  invoiceType: 'B2B' | 'B2C';
  buyerName: string;
  buyerTaxId?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerAddress?: string;
  carrierType?: '' | '0' | '1' | '2';
  carrierNum?: string;
  loveCode?: string;
  items: InvoiceItem[];
  taxType?: '1' | '2' | '3';
  comment?: string;
}

// 開立發票回傳
export interface IssueInvoiceResult {
  success: boolean;
  invoiceNumber?: string;
  invoiceDate?: string;
  randomNum?: string;
  transNum?: string;
  message?: string;
  rawResponse?: any;
}

// 作廢發票參數
export interface InvalidInvoiceParams {
  invoiceNumber: string;
  invalidReason: string;
}

/**
 * 模擬 PHP http_build_query
 * URL 編碼所有值
 */
function httpBuildQuery(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([key, value]) => {
      const encoded = encodeURIComponent(String(value))
        .replace(/%20/g, '+');
      return `${key}=${encoded}`;
    })
    .join('&');
}

/**
 * AES-256-CBC 加密（標準 PKCS7 填充）
 * 與 /api/invoices/issue/route.ts 一致
 */
function aesEncrypt(data: string, key: string, iv: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

/**
 * AES-256-CBC 解密（標準 PKCS7 填充）
 */
function aesDecrypt(data: string, key: string, iv: string): string {
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
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

  // 稅額計算
  const taxType = params.taxType || '1';
  const taxRate = taxType === '1' ? 0.05 : 0;
  const totalAmount = params.items.reduce((sum, item) => sum + item.amount, 0);
  const salesAmount = Math.round(totalAmount / (1 + taxRate));
  const taxAmount = totalAmount - salesAmount;

  // 組合商品資訊
  const itemName = params.items.map(i => i.name).join('|');
  const itemCount = params.items.map(i => i.count).join('|');
  const itemUnit = params.items.map(i => i.unit || '式').join('|');
  const itemPrice = params.items.map(i => i.price).join('|');
  const itemAmount = params.items.map(i => i.amount).join('|');

  // 建立 PostData 參數
  const postData: Record<string, string | number> = {
    RespondType: 'JSON',
    Version: '1.5',
    TimeStamp: timestamp,
    TransNum: '',
    MerchantOrderNo: params.orderNumber,
    Status: '1',
    CreateStatusTime: '',
    Category: params.invoiceType,
    BuyerName: params.buyerName,
    BuyerUBN: params.buyerTaxId || '',
    BuyerAddress: params.buyerAddress || '',
    BuyerEmail: params.buyerEmail || '',
    BuyerPhone: params.buyerPhone || '',
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

  // 使用 http_build_query 風格組建字串
  const postDataString = httpBuildQuery(postData);

  console.log('=== ezPay 開立發票 ===');
  console.log('環境:', config.isProduction ? '正式' : '測試');
  console.log('URL:', urls.issue);
  console.log('商店代號:', config.merchantId);
  console.log('HashKey 長度:', config.hashKey.length);
  console.log('HashIV 長度:', config.hashIV.length);
  console.log('PostData (前200字):', postDataString.substring(0, 200));

  // AES 加密
  const encryptedData = aesEncrypt(postDataString, config.hashKey, config.hashIV);
  console.log('加密後 (前100字):', encryptedData.substring(0, 100));

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
    console.log('ezPay 回應:', JSON.stringify(result, null, 2));

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
        message: `${result.Status}: ${result.Message || '開立失敗'}`,
        rawResponse: result,
      };
    }
  } catch (error) {
    console.error('ezPay 錯誤:', error);
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

  const postDataString = httpBuildQuery(postData);
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
    console.log('ezPay 作廢回應:', JSON.stringify(result, null, 2));

    if (result.Status === 'SUCCESS') {
      return {
        success: true,
        message: '作廢成功',
        rawResponse: result,
      };
    } else {
      return {
        success: false,
        message: `${result.Status}: ${result.Message || '作廢失敗'}`,
        rawResponse: result,
      };
    }
  } catch (error) {
    console.error('ezPay 作廢錯誤:', error);
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
    startDate?: string;
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
    SearchType: params.invoiceNumber ? '0' : '1',
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

  const postDataString = httpBuildQuery(postData);
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
    console.log('ezPay 查詢回應:', JSON.stringify(result, null, 2));

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
        message: `${result.Status}: ${result.Message || '查詢失敗'}`,
        rawResponse: result,
      };
    }
  } catch (error) {
    console.error('ezPay 查詢錯誤:', error);
    return {
      success: false,
      message: `API 錯誤: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
