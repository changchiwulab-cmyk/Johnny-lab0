# 安全工具清單

> 最後更新：2026-03-24

## 工具狀態總覽

| 工具 | 狀態 | 類型 | 配置位置 |
|------|------|------|----------|
| npm audit | ✅ 已配置 | 依賴漏洞掃描 | `package.json` + `.github/workflows/npm-audit.yml` |
| CodeQL | ✅ 已配置 | 靜態代碼分析 | `.github/workflows/codeql.yml` |
| Snyk | ✅ 已配置 | 依賴漏洞 + 代碼掃描 | `.github/workflows/snyk.yml` |
| 密鑰掃描 | ✅ 已配置 | 敏感資訊偵測 | `.claude/security-scan.sh` |
| ESLint | ✅ 已配置 | 代碼品質 | `package.json` |
| Prettier | ✅ 已配置 | 代碼格式化 | `package.json` |

## 各工具詳細說明

### npm audit

- **用途**：掃描 Node.js 依賴中的已知漏洞
- **本地執行**：`npm run audit` 或 `npm run audit:ci`（僅 high/critical 等級失敗）
- **CI 執行**：每次 push/PR 自動執行，每週一 UTC 07:00 定時掃描
- **嚴重等級**：CI 中設定為 `--audit-level=high`

### CodeQL

- **用途**：GitHub 原生靜態分析，偵測 SQL 注入、XSS、路徑穿越等安全漏洞
- **語言**：JavaScript
- **查詢集**：`security-extended`（比預設更全面）
- **觸發條件**：push（master/claude/*）、PR、每週一 UTC 05:30 排程
- **結果查看**：GitHub > Security > Code scanning alerts

### Snyk

- **用途**：依賴漏洞深度掃描，提供修復建議和升級路徑
- **前置需求**：需設定 `SNYK_TOKEN` GitHub Secret（見下方步驟）
- **觸發條件**：push（master/claude/*）、PR、每週一 UTC 06:00 排程
- **嚴重等級**：`--severity-threshold=high`
- **結果查看**：GitHub > Security > Code scanning alerts（SARIF 上傳）

### 自定義密鑰掃描

- **用途**：偵測硬編碼的密碼、API Key 等敏感資訊
- **觸發方式**：PostToolUse 鉤子，在 Edit/Write 操作後自動執行
- **掃描範圍**：`.js` 和 `.ts` 檔案
- **掃描模式**：`password`、`api_key`、`secret` 賦值語句

## 設定 Snyk Token 步驟

1. 前往 https://snyk.io 註冊或登入
2. 前往 Account Settings > API Token
3. 複製 Token
4. 在 GitHub repo 前往 Settings > Secrets and variables > Actions
5. 點擊 New repository secret
6. Name 填入 `SNYK_TOKEN`，Value 貼上 Token
7. 點擊 Add secret

## CI/CD 工作流程觸發時機

| 事件 | npm audit | CodeQL | Snyk |
|------|-----------|--------|------|
| Push to master | ✅ | ✅ | ✅ |
| Push to claude/* | ✅ | ✅ | ✅ |
| Pull Request | ✅ | ✅ | ✅ |
| 每週排程 | 週一 07:00 | 週一 05:30 | 週一 06:00 |
