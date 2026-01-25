# 📱 LINE Bot 使用說明

## 智慧媽咪 LINE 通知機器人

---

## 🤖 Bot 指令

在群組或私訊中輸入以下指令：

| 指令 | 說明 |
|------|------|
| `groupid` | 查詢目前群組/聊天室的 ID |
| `!groupid` | 同上 |
| `/groupid` | 同上 |

---

## 📋 如何取得群組 ID

1. 將 Bot 邀請加入群組
2. 在群組中輸入 `groupid`
3. Bot 會回覆：
   ```
   📋 群組 ID:
   Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
4. 複製這個 ID 到系統的「群組管理」

---

## ⚙️ 系統設定

### LINE Developers Console 設定

1. 前往 [LINE Developers Console](https://developers.line.biz/)
2. 選擇你的 Messaging API Channel
3. 設定以下項目：

| 設定項目 | 值 |
|---------|---|
| Webhook URL | `https://mommy-wisdom-accounting.vercel.app/api/line/webhook` |
| Use webhook | ✅ 開啟 |
| Allow bot to join group chats | ✅ 開啟 |
| Auto-reply messages | ❌ 關閉 |

---

## 📤 通知類型

系統可發送以下通知：

### 請款模組
- 📧 請款通知（手動發送）
- ✅ 收款確認（自動/手動）
- ⚠️ 逾期提醒（自動）

### 發票模組
- 🧾 發票開立通知（自動）
- ❌ 發票作廢通知（自動）

### 勞報模組
- 📝 勞報單建立通知（自動）
- ✍️ 簽署完成通知（自動）
- 💰 匯款完成通知（自動）

### 合約模組
- 📄 報價單送出（手動）
- 📑 合約簽署完成（自動）
- ⏰ 合約到期提醒（提前 7 天）
- 💳 付款日提醒（提前 1 天）

---

## 🔑 API 設定

在系統中設定 LINE API：

1. 進入「LINE 通知管理」→「API 設定」
2. 輸入：
   - **Channel Access Token**: 從 LINE Developers Console 取得
   - **Channel Secret**: 從 LINE Developers Console 取得
3. 開啟「啟用狀態」
4. 點擊「儲存設定」

---

## 🔧 常見問題

### Q: Bot 沒有回應指令？
1. 確認 Webhook URL 設定正確
2. 確認「Use webhook」已開啟
3. 在 LINE Developers Console 點擊「Verify」測試

### Q: 如何取得 Channel Access Token？
1. LINE Developers Console → 你的 Channel
2. Messaging API → Channel access token
3. 點擊「Issue」產生 Token

### Q: 群組 ID 要去哪裡設定？
1. 系統 →「LINE 通知管理」→「群組管理」
2. 點擊「新增群組」
3. 貼上群組 ID 和名稱

---

## 📞 技術支援

如有問題，請聯繫系統管理員。

---

*最後更新：2026-01-24*
*智慧媽咪國際有限公司*
