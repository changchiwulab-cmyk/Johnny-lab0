# Johnny-lab0 專案審計報告

**審計日期**: 2026-03-27
**專案**: 2026 Agentic Coding Framework Reference Library
**審計範圍**: 所有分支、架構、代理、資料、代碼

---

## 一、專案概覽

| 項目 | 說明 |
|------|------|
| 語言 | Python 3 + JSON |
| 框架 | Anthropic Claude API 多代理編排 |
| 用途 | 2026 Agentic Coding 參考實作 |
| 階段 | 設計與規劃階段 (v1.0-Reference) |
| 測試 | pytest, 62 個測試 |
| 依賴 | anthropic, pydantic, networkx, pytest, pytest-asyncio, python-dotenv |

### 目錄結構

```
Johnny-lab0/
├── agents/                  # 專業化代理
│   ├── base_agent.py        # 抽象基類 (Claude API)
│   ├── code_agent.py        # 代碼生成代理
│   ├── test_agent.py        # 測試生成代理
│   ├── doc_agent.py         # 文件生成代理
│   └── security_agent.py    # 安全掃描代理
├── review_system/           # 3 層自動審查系統
│   ├── layer1_auto.py       # 格式化/lint/型別檢查
│   ├── layer2_analyzer.py   # 異常偵測 (複雜度/安全/效能)
│   └── layer3_human_gates.py # 人工審批門
├── rbac/                    # 角色權限控制
│   ├── roles.py             # 角色定義
│   ├── permissions.py       # 權限矩陣
│   ├── enforcer.py          # 執行引擎
│   └── audit_logger.py      # 審計日誌
├── security/                # 安全掃描模組
│   ├── threat_detector.py   # 威脅偵測引擎
│   └── vulnerability_scanner.py # 漏洞掃描器
├── templates/               # 工作流模板
│   ├── base_template.py     # 抽象基類
│   └── legal_review_template.py # 法務審查模板
├── tests/                   # 測試套件 (62 個測試)
├── orchestrator.py          # 多代理編排器
├── task_decomposer.py       # 任務分解引擎 (DAG)
├── role_config.json         # 角色設定
├── review_config.json       # 審查系統設定
└── security_config.json     # 安全掃描設定
```

---

## 二、分支分析

| 分支 | 狀態 | 說明 |
|------|------|------|
| `master` | 落後 4 commits | 尚未合併任何功能代碼 |
| `claude/audit-project-branches-2zgLx` | 當前開發分支 | 包含所有功能 + 修復 |
| `claude/analyze-report-workflow-9LLqt` | **重複** | 與 audit 分支指向同一 commit，已刪除本地 |

### 開放中的 Pull Requests

共 **21 個開放 PR**，大部分為迭代開發過程中產生，存在大量重複：

| PR | 標題 | 分支 |
|----|------|------|
| #21 | Add multi-agent orchestrator for coordinated code generation | `claude/setup-orchestrator-framework-6Fb6D` |
| #20 | Add multi-agent orchestration framework with DAG scheduling | `claude/multi-agent-orchestration-If1Pw` |
| #19 | Implement multi-agent legal contract review orchestration system | `claude/implement-ai-trends-zzoBT` |
| #18 | Add agentic coding framework with multi-agent orchestration and security | `claude/write-code-VM20a` |
| #17 | Initialize project structure with dependencies and package layout | `claude/setup-project-infrastructure-ONLId` |
| #16 | Add multi-agent orchestration system with specialized agents | `claude/setup-multi-agent-system-1tsdp` |
| #15 | 創建項目結構與多代理框架核心實現 | `claude/create-project-structure-ULicT` |
| #14 | W7-W8 Trend 8: SIEM 與自動響應系統 | `claude/security-first-architecture-Va2X3` |
| #13 | feat: W5-W6 Trend 7 編碼民主化 — 實施 RBAC 模組 | `claude/implement-rbac-GRYN9` |
| #12 | feat: W3-W4 Trend 4 - 自動化審查系統 | `claude/automated-review-system-GgBRV` |
| #11 | Add pytest configuration and project setup files | `claude/setup-project-environment-CGhIy` |
| #10 | 建立多代理編排系統：DAG 引擎 + 4 個專業化代理 | `claude/multi-agent-orchestration-8D4x5` |
| #9 | Add comprehensive security scanning and tooling documentation | `claude/security-tools-checklist-2TgmI` |
| #8 | Confirm Legal department as Trend 7 pilot with UAT validation | `claude/trend7-pilot-department-8b0Wz` |
| #7 | feat: Trend 4 Owner 分配 - 自動化審查系統 | `claude/automate-owner-allocation-3ItRs` |
| #6 | feat: DAG-based dynamic Owner allocation (Trend 2) | `claude/dag-trend2-owner-allocation-AAKR0` |
| #5 | Standardize code formatting and improve test coverage | `claude/uat-pilot-report-vuM12` |
| #4 | Add comprehensive test suite for legal contract analysis agents | `claude/add-unit-integration-tests-X4S5s` |
| #3 | Add legal contract review orchestration system with 4 parallel agents | `claude/cross-dept-automation-pilot-Yd7bq` |
| #2 | Add automation hooks verification system with security scanning | `claude/test-automation-hooks-8mmT5` |
| #1 | Add 2026 agentic coding workflow planning and Claude configuration | `claude/analyze-report-workflow-9LLqt` |

**建議**: 多數 PR 功能重疊（如 #16, #18, #20, #21 都是多代理編排），應進行整理並關閉過時的 PR。

---

## 三、已發現並修復的 Bugs

### Bug 1: `Role` dataclass 不可 hash (嚴重)

- **檔案**: `rbac/roles.py`
- **症狀**: `TypeError: unhashable type: 'Role'`
- **影響**: `get_all_roles()`, `get_roles_by_department()`, `get_roles_with_permission()`, `get_roles_with_template()` 全部無法使用
- **根因**: `Role` 使用 `@dataclass` 但包含 `Set[Permission]` 和 `Set[str]` 等 mutable 屬性，Python 預設不會為含 mutable 欄位的 dataclass 生成 `__hash__`
- **修復**: 加入 `__hash__` (基於 `name`) 和 `__eq__` 方法
- **測試影響**: 修復 3 個失敗測試

### Bug 2: TaskDecomposer doc 子任務條件反轉 (中等)

- **檔案**: `task_decomposer.py:146`
- **症狀**: `assert 3 >= 4` 失敗
- **根因**: `if "document" not in task.lower()` — 當任務描述包含 "document" 時反而跳過 doc 子任務，邏輯完全反轉
- **修復**: 改為 `if primary_intent != TaskType.DOCUMENTATION:`
- **測試影響**: 修復 1 個失敗測試

### 修復後測試結果: **62/62 通過** (修復前 58/62)

---

## 四、已發現並修復的重複

### 重複 1: API_KEYWORDS 重複值

- **檔案**: `review_system/layer3_human_gates.py:69-70`
- **問題**: `"handler"` 在 set 中出現兩次
- **修復**: 移除重複的 `"handler"`

### 重複 2: `developer` 與 `engineer_lead` 角色完全相同

- **檔案**: `rbac/roles.py`, `role_config.json`
- **問題**: 兩角色的 permissions、max_concurrent_tasks、allowed_templates 完全一樣
- **修復**: 為 `engineer_lead` 增加 `BASH_AUDIT` 權限以區分（team lead 需要審計能力）

### 重複 3: 角色定義在 Python 和 JSON 中不一致

| 項目 | `roles.py` | `role_config.json` (修復前) |
|------|-----------|---------------------------|
| security_team | `Read, BASH_AUDIT, BASH_SEARCH` | `Read, Bash(audit\|scan)` (少了 BASH_SEARCH) |
| operations | `Read, Edit, BASH_NPM` (npm:*) | `Read, Edit, Bash(npm:install)` (只有 install) |

- **修復**: 同步 `role_config.json` 與 `roles.py`

### 重複 4: `import time` 放在方法內部

- **檔案**: `security/vulnerability_scanner.py:30, 62`
- **修復**: 移到模組頂部

---

## 五、尚未修復的結構性問題

以下問題已記錄但未在此次修復中處理，因為它們屬於設計層面的改進：

### 5.1 角色定義重複三處 (設計問題)

- `rbac/roles.py` — Python 代碼（程式碼中的 source of truth）
- `role_config.json` — JSON 重複定義相同 6 個角色
- `rbac/permissions.py` — `PermissionMatrix.PERMISSION_ACTIONS` 第三次定義 permission 映射

**建議**: 選擇單一 source of truth，讓 Python 代碼從 JSON 讀取，或刪除 JSON

### 5.2 缺少 linter/formatter 配置檔

`review_config.json` 引用了以下工具，但專案中完全沒有對應配置檔：
- `black` (Python formatter) — 無 `pyproject.toml` 配置
- `prettier` (JS/TS formatter) — 無 `.prettierrc`
- `eslint` (JS linter) — 無 `.eslintrc.json`
- `flake8` (Python linter) — 無 `.flake8`
- `pylint` (Python linter) — 無 `.pylintrc`
- `mypy` (Python type checker) — 無 `mypy.ini`
- `radon` (Python complexity) — 無配置

`review_system/layer1_auto.py` 嘗試執行這些工具時會失敗。

### 5.3 `python-dotenv` 列在依賴中但未使用

- `requirements.txt` 包含 `python-dotenv>=1.0.0`
- 但專案中無任何代碼呼叫 `load_dotenv()`
- `orchestrator.py` 的 `main()` 需要 `ANTHROPIC_API_KEY` 但無 `.env` 載入邏輯

### 5.4 `templates/` 只有一個實作

- `role_config.json` 引用 4 個 templates: `legal_review`, `ops_automation`, `marketing_report`, `custom_template`
- 只有 `legal_review_template.py` 有實際程式碼
- 其餘 3 個模板不存在

### 5.5 `review_config.json` 與代碼脫鉤

- JSON 設定檔定義了工具列表和閾值
- 但 `layer1_auto.py` 的工具列表是 hardcoded，完全不讀取 config
- 設定和代碼是獨立的兩套系統

### 5.6 Audit Logger 無持久化

- `rbac/audit_logger.py` 所有日誌存在 `self.logs: List` 中
- 程式重啟即全部遺失
- 無檔案/資料庫持久化機制

### 5.7 `examples/` 不是有效的 Python package

- `examples/__init__.py` 存在，暗示這是 Python package
- 但目錄內只有 `multi_agent_workflow.md`（Markdown 文件，非可執行代碼）

---

## 六、CI/CD 問題

GitHub Actions 存在兩個平台層級問題（非專案代碼問題）：

### 6.1 `HttpError: Resource not accessible by integration` (錯誤)

- **來源**: GitHub App 或 Actions 的 GITHUB_TOKEN 權限不足
- **修復**: Repo Settings → Actions → General → Workflow permissions → 改為 `Read and write permissions`

### 6.2 Node.js 20 棄用警告

- `actions/checkout@v4` 和 `actions/github-script@v7` 使用 Node.js 20
- GitHub 將在 2026/6/2 起預設使用 Node.js 24
- **修復**: 等待 actions 發布新版本，或設定 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`

---

## 七、修復摘要

| # | 修復項目 | 檔案 | 嚴重度 | 狀態 |
|---|---------|------|--------|------|
| 1 | Role unhashable bug | `rbac/roles.py` | 嚴重 | 已修復 |
| 2 | TaskDecomposer 條件反轉 | `task_decomposer.py` | 中等 | 已修復 |
| 3 | import time 位置 | `security/vulnerability_scanner.py` | 低 | 已修復 |
| 4 | 重複 "handler" keyword | `review_system/layer3_human_gates.py` | 低 | 已修復 |
| 5 | developer = engineer_lead | `rbac/roles.py` | 中等 | 已修復 |
| 6 | JSON 與 Python 權限不一致 | `role_config.json` | 中等 | 已修復 |
| 7 | 重複分支 | `claude/analyze-report-workflow-9LLqt` | 低 | 本地已刪除 |
| 8 | 角色定義三處重複 | 多檔案 | 中等 | 待處理 |
| 9 | 缺少 linter 配置 | 專案根目錄 | 中等 | 待處理 |
| 10 | python-dotenv 未使用 | `requirements.txt` | 低 | 待處理 |
| 11 | 3/4 模板未實作 | `templates/` | 中等 | 待處理 |
| 12 | config 與代碼脫鉤 | `review_config.json` | 中等 | 待處理 |
| 13 | Audit Logger 無持久化 | `rbac/audit_logger.py` | 中等 | 待處理 |
| 14 | CI 權限不足 | GitHub Settings | 中等 | 待處理 |
| 15 | 21 個開放 PR 需整理 | GitHub | 低 | 待處理 |

**測試結果**: 62/62 通過
