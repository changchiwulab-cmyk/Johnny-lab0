# 自動化鉤子系統文件

**日期**：2026-03-22
**分支**：`claude/test-automation-hooks-8mmT5`
**狀態**：✅ 所有測試通過

---

## 鉤子架構

```
PostToolUse (Write/Edit)
├── Prettier 格式化 (.js, .ts, .jsx, .tsx, .json)
└── 安全掃描 (.js, .ts) → .claude/security-scan.sh

PostToolUse (Bash)
└── 偵測 test/spec 關鍵字 → 回報測試已執行

PreToolUse (Bash)
└── 偵測 rm/delete/drop → 警告危險操作
```

---

## 配置位置

- **鉤子設定**：`.claude/settings.json`
- **安全掃描腳本**：`.claude/security-scan.sh`

---

## 鉤子說明

### 1. 代碼格式化（PostToolUse）

- **觸發**：Write 或 Edit 操作
- **行為**：對 `.js`、`.ts`、`.jsx`、`.tsx`、`.json` 檔案自動執行 `npx prettier --write`
- **逾時**：30 秒

### 2. 安全掃描（PostToolUse）

- **觸發**：Write 或 Edit 操作
- **行為**：對 `.js`、`.ts` 檔案執行 `.claude/security-scan.sh`，偵測硬編碼的密碼、API 金鑰、密鑰
- **逾時**：20 秒
- **掃描模式**：`password`、`api_key`、`apiKey`、`secret` 等賦值語句

### 3. 測試偵測（PostToolUse）

- **觸發**：Bash 指令包含 `test` 或 `spec`
- **行為**：靜默匹配後回傳系統訊息
- **逾時**：60 秒

### 4. 危險操作攔截（PreToolUse）

- **觸發**：Bash 指令包含 `rm`、`delete`、`drop`
- **行為**：發出警告訊息，提示使用者確認
- **逾時**：5 秒

---

## 測試結果

| 測試項目 | 結果 | 備註 |
|----------|------|------|
| Prettier 格式化 JS | ✅ 通過 | 16-67ms |
| Prettier 格式化 JSON | ✅ 通過 | 47ms |
| 安全掃描偵測硬編碼密鑰 | ✅ 通過 | 正確識別 password、apiKey |
| npm test 執行 | ✅ 通過 | 測試鉤子正確觸發 |
| 危險操作檢測配置 | ✅ 通過 | PreToolUse 已就位 |
| 工具可用性（prettier, node, npm, jq） | ✅ 通過 | 全部可用 |

### 驗證方式

```bash
bash verify-hooks.sh
```

---

## 環境變數

| 變數 | 值 | 用途 |
|------|------|------|
| `AGENTIC_MODE` | `multi-agent-coordination` | 多代理協調模式 |
| `SECURITY_LEVEL` | `priority-first` | 安全優先策略 |
| `AUTO_REVIEW` | `enabled` | 自動審查已啟用 |

---

## 檔案結構

```
.claude/
├── settings.json       # 鉤子與權限設定
└── security-scan.sh    # 安全掃描獨立腳本

test-hook-automation.js # 格式化 + 安全掃描測試檔
test-security-check.js  # 安全檢查工具模組
test-config.json        # JSON 格式化測試
test.spec.js            # 測試鉤子觸發測試檔
verify-hooks.sh         # 自動化驗證腳本
package.json            # npm 設定
```
