# 智慧媽咪 品牌設計系統
## Mommy Wisdom Brand Design System

---

## 1. 品牌色彩 Brand Colors

### 主色系 Primary Colors (基於 Logo)

| 名稱 | HEX | RGB | 用途 |
|------|-----|-----|------|
| **Primary 700** | `#A31621` | rgb(163, 22, 33) | 主按鈕、重要標題、Logo 主色 |
| **Primary 600** | `#BF1730` | rgb(191, 23, 48) | Hover 狀態、次要按鈕 |
| **Primary 800** | `#931226` | rgb(147, 18, 38) | Active 狀態、深色強調 |
| **Primary 400** | `#EF8997` | rgb(239, 137, 151) | Logo 淺粉紅、漸層過渡 |
| **Primary 200** | `#FECACA` | rgb(254, 202, 202) | 邊框、分隔線 |
| **Primary 100** | `#FEE2E2` | rgb(254, 226, 226) | 淺色背景、卡片 |
| **Primary 50** | `#FEF2F2` | rgb(254, 242, 242) | 極淺背景、Hover 背景 |

### 漸層 Gradients

```css
/* 品牌主漸層 - 模擬 Logo 效果 */
background: linear-gradient(135deg, #A31621 0%, #BF1730 50%, #EF8997 100%);

/* 柔和背景漸層 */
background: linear-gradient(135deg, #FEE2E2 0%, #FFF5F5 100%);

/* 垂直漸層 */
background: linear-gradient(180deg, #A31621 0%, #EF8997 100%);
```

### 功能色 Functional Colors

| 名稱 | HEX | 用途 |
|------|-----|------|
| Success | `#10B981` | 成功、收入、正數 |
| Warning | `#F59E0B` | 警告、待處理 |
| Error | `#EF4444` | 錯誤、支出、負數 |
| Info | `#A31621` | 資訊提示（使用主色） |

### 中性色 Neutral Colors

| 名稱 | HEX | 用途 |
|------|-----|------|
| Foreground | `#171717` | 主要文字 |
| Gray 700 | `#374151` | 次要文字 |
| Gray 500 | `#6B7280` | 輔助文字 |
| Gray 300 | `#D1D5DB` | 邊框 |
| Background | `#FFFFFF` | 主背景 |

---

## 2. 排版 Typography

### 字體 Font Family

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### 標題 Headings

| 等級 | 大小 | 粗細 | 用途 |
|------|------|------|------|
| H1 | 2rem (32px) | Bold (700) | 頁面主標題 |
| H2 | 1.5rem (24px) | Semi-Bold (600) | 區塊標題 |
| H3 | 1.25rem (20px) | Semi-Bold (600) | 卡片標題 |
| H4 | 1rem (16px) | Medium (500) | 小標題 |

### 內文 Body Text

| 類型 | 大小 | 行高 | 用途 |
|------|------|------|------|
| Body Large | 1rem (16px) | 1.5 | 主要內文 |
| Body | 0.875rem (14px) | 1.5 | 一般內文 |
| Body Small | 0.75rem (12px) | 1.5 | 輔助說明 |
| Caption | 0.625rem (10px) | 1.4 | 標籤、徽章 |

---

## 3. 元件樣式 Components

### 按鈕 Buttons

```jsx
// 主要按鈕
<button className="bg-brand-primary-700 text-white px-4 py-2 rounded-lg font-medium 
                   hover:bg-brand-primary-600 focus:ring-2 focus:ring-brand-primary-700 
                   transition-all duration-200">
  主要動作
</button>

// 次要按鈕
<button className="bg-brand-primary-100 text-brand-primary-700 px-4 py-2 rounded-lg font-medium 
                   hover:bg-brand-primary-200 transition-all duration-200">
  次要動作
</button>

// 外框按鈕
<button className="border-2 border-brand-primary-700 text-brand-primary-700 px-4 py-2 rounded-lg 
                   hover:bg-brand-primary-700 hover:text-white transition-all duration-200">
  外框按鈕
</button>
```

### 輸入框 Input Fields

```jsx
<input className="w-full px-3 py-2 border border-brand-primary-200 rounded-lg 
                  focus:ring-2 focus:ring-brand-primary-700 focus:border-transparent 
                  transition-all duration-200" />
```

### 卡片 Cards

```jsx
// 標準卡片
<div className="bg-white border border-brand-primary-100 rounded-xl p-5 
                shadow-sm hover:shadow-brand transition-shadow duration-200">
  內容
</div>

// 品牌卡片（漸層背景）
<div className="bg-gradient-to-br from-brand-primary-700 to-brand-primary-600 
                text-white rounded-xl p-5">
  內容
</div>
```

### 徽章 Badges

```jsx
// 品牌徽章
<span className="bg-brand-primary-100 text-brand-primary-700 px-2.5 py-0.5 
                 rounded-full text-xs font-medium">
  標籤
</span>

// 成功徽章
<span className="bg-green-100 text-green-800 px-2.5 py-0.5 
                 rounded-full text-xs font-medium">
  已完成
</span>
```

### 表格 Tables

```jsx
// 表頭
<thead className="bg-brand-primary-50 border-b border-brand-primary-100">
  <th className="text-brand-primary-700 text-xs font-semibold uppercase">欄位</th>
</thead>

// 列 Hover
<tr className="hover:bg-brand-primary-50 transition-colors">
  <td>內容</td>
</tr>
```

---

## 4. 陰影 Shadows

```css
/* 品牌陰影 */
box-shadow: 0 4px 14px 0 rgba(163, 22, 33, 0.25);

/* 大型品牌陰影 */
box-shadow: 0 10px 40px 0 rgba(163, 22, 33, 0.3);
```

---

## 5. 導航 Navigation

### 側邊欄項目

```jsx
// 預設狀態
<a className="flex items-center gap-3 px-3 py-2.5 text-gray-600 rounded-lg
              hover:bg-brand-primary-50 hover:text-brand-primary-700 
              transition-all duration-200">
  <Icon className="w-5 h-5" />
  <span>項目名稱</span>
</a>

// 選中狀態
<a className="flex items-center gap-3 px-3 py-2.5 rounded-lg
              bg-brand-primary-100 text-brand-primary-700 font-medium">
  <Icon className="w-5 h-5" />
  <span>項目名稱</span>
</a>
```

---

## 6. Logo 使用規範

### Logo 元素

- **圖形**：由 "M" 和 "W" 組成的幾何圖案
- **顏色**：深酒紅到淺粉紅的漸層
- **文字**："MW" 或 "智慧媽咪"

### 最小安全空間

Logo 周圍應保持至少 Logo 寬度 25% 的空白區域

### 禁止事項

- ❌ 不可更改 Logo 顏色
- ❌ 不可拉伸變形
- ❌ 不可在複雜背景上使用（需加白底）
- ❌ 不可旋轉

---

## 7. Tailwind CSS 類名速查

### 品牌色

```
bg-brand-primary-50   至 bg-brand-primary-950
text-brand-primary-50 至 text-brand-primary-950
border-brand-primary-50 至 border-brand-primary-950
ring-brand-primary-50 至 ring-brand-primary-950
```

### 漸層

```
bg-brand-gradient        // 主漸層
bg-brand-gradient-soft   // 柔和漸層
bg-brand-gradient-vertical // 垂直漸層
```

### 陰影

```
shadow-brand    // 品牌陰影
shadow-brand-lg // 大型品牌陰影
```

### 預設類

```
.btn-primary    // 主要按鈕
.btn-secondary  // 次要按鈕
.btn-outline    // 外框按鈕
.btn-success    // 成功按鈕
.btn-danger     // 危險按鈕
.input-field    // 輸入框
.input-label    // 標籤
.nav-item       // 導航項目
.nav-item.active // 選中導航
.badge-brand    // 品牌徽章
.brand-card     // 品牌卡片
.brand-link     // 品牌連結
.stats-card-brand // 品牌統計卡片
```

---

## 8. 響應式設計

| 斷點 | 寬度 | 用途 |
|------|------|------|
| sm | 640px | 手機橫向 |
| md | 768px | 平板 |
| lg | 1024px | 小筆電 |
| xl | 1280px | 桌面 |
| 2xl | 1536px | 大螢幕 |

---

## 9. 動畫 Animations

```css
/* 淡入 */
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}

/* 滑入 */
.animate-slide-up {
  animation: slideUp 0.3s ease-out;
}

/* 過渡效果 */
transition-all duration-200
```

---

**智慧媽咪國際有限公司 © 2026**
*Mommy Wisdom International Co.*
