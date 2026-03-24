# 法務部門合同自動審查工作流程

## 📋 工作流概述

本文檔定義法務部門的合同自動審查工作流程，包括輸入輸出規範、數據格式、交接點定義。

---

## 🔄 工作流程架構

```
┌─────────────────────────────────────────────────────────┐
│  1. 合同上傳與初始化                                      │
│  • 法務人員上傳 PDF/Word 合同                            │
│  • 觸發自動提取和預處理                                  │
└──┬──────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│  2. 多代理協調層 (Orchestrator)                          │
│  ├─ 任務分解：合同內容 → 4 個並行檢查任務              │
│  └─ 狀態追蹤：監控各代理進度                            │
└──┬──────────────────────────────────────────────────────┘
   │
   ├─ 代理 1: 條款提取                                      │
   │  ├─ 提取關鍵條款（期限、費用、責任、終止條款）       │
   │  └─ 輸出：structured_terms.json                      │
   │
   ├─ 代理 2: 風險分析                                      │
   │  ├─ 對比公司標準模板                                  │
   │  ├─ 識別偏離項、不利條款                              │
   │  └─ 輸出：risk_flags.json (嚴重級別)                 │
   │
   ├─ 代理 3: 合規性檢查                                    │
   │  ├─ 掃描法律條款（數據保護、責任限制、保密條款）     │
   │  ├─ 檢查管轄權、準據法                                │
   │  └─ 輸出：compliance_issues.json                     │
   │
   └─ 代理 4: 建議生成                                      │
      ├─ 基於風險和合規性問題生成修改建議                 │
      └─ 輸出：recommendations.md                          │
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│  3. 結果合成與報告生成                                   │
│  • 整合 4 個代理輸出                                      │
│  • 生成結構化審查報告（Markdown + 可選 PDF）             │
│  • 標記高優先級問題                                      │
└──┬──────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│  4. 人類檢查點                                           │
│  • 律師審閱 AI 建議                                       │
│  • 確認關鍵風險項                                        │
│  • 決定是否需要進一步談判                               │
└──┬──────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│  5. 歸檔與知識積累                                       │
│  • 審查結果存儲到知識庫                                  │
│  • 更新合同模板和風險規則                               │
└─────────────────────────────────────────────────────────┘
```

---

## 📥 輸入規範

### 上傳的合同文件格式

| 項目 | 規範 |
|------|------|
| **文件格式** | PDF、DOCX、TXT |
| **檔案大小** | ≤ 50MB |
| **字符編碼** | UTF-8 建議 |
| **命名規範** | `contract-{type}-{date}.{ext}` |

示例：`contract-nda-2026-03-22.pdf`

### 合同類型（Contract Type）

- `NDA` - 保密協議
- `SLA` - 服務水平協議
- `MSA` - 主服務協議
- `Purchase` - 購銷合同
- `Employment` - 僱傭合同
- `License` - 授權協議
- `Partnership` - 合作協議
- `Other` - 其他

### 可選元數據

```json
{
  "contract_type": "NDA",
  "parties": ["ABC Inc.", "XYZ Corp"],
  "effective_date": "2026-03-22",
  "custom_review_checklist": [
    "liability_cap",
    "confidentiality_period",
    "non_compete"
  ]
}
```

---

## 🔍 處理步驟和數據格式

### Step 1: PDF 文本提取

**輸入**：contract.pdf
**工具**：pdftotext / PyPDF2
**輸出**：contract_text.txt

**輸出格式示例**：
```
================================
CONTRACT - CONFIDENTIALITY AGREEMENT
Effective Date: March 22, 2026
BETWEEN
ABC Inc. ("Disclosing Party")
AND
XYZ Corp ("Receiving Party")
================================

1. DEFINITION OF CONFIDENTIAL INFORMATION
...
```

### Step 2: 條款提取（Agent 1）

**輸入**：contract_text.txt
**輸出**：`terms.json`

**數據格式**：
```json
{
  "metadata": {
    "contract_type": "NDA",
    "extraction_timestamp": "2026-03-22T10:30:00Z",
    "confidence": 0.92
  },
  "basic_info": {
    "parties": ["ABC Inc.", "XYZ Corp"],
    "effective_date": "2026-03-22",
    "expiration_date": "2027-03-22",
    "jurisdiction": "California"
  },
  "key_terms": {
    "confidentiality_duration": {
      "description": "3 years from disclosure",
      "numeric_value": 3,
      "unit": "years"
    },
    "liability_cap": {
      "description": "$1,000,000",
      "numeric_value": 1000000,
      "currency": "USD"
    },
    "termination_clause": {
      "description": "Either party may terminate with 30 days notice",
      "notice_period": 30,
      "notice_unit": "days"
    }
  },
  "obligations": [
    {
      "party": "Receiving Party",
      "description": "Protect confidential information with same care as own",
      "severity": "HIGH"
    }
  ]
}
```

### Step 3: 風險分析（Agent 2）

**輸入**：terms.json + legal-rules-engine.json
**輸出**：`risk_flags.json`

**數據格式**：
```json
{
  "metadata": {
    "analysis_timestamp": "2026-03-22T10:35:00Z",
    "total_risks": 3,
    "high_severity": 1,
    "medium_severity": 2,
    "low_severity": 0
  },
  "risks": [
    {
      "risk_id": "RISK-001",
      "type": "liability_cap",
      "severity": "HIGH",
      "description": "責任上限低於行業標準",
      "current_value": "$1,000,000",
      "recommended_value": "$5,000,000",
      "impact": "Company exposure risk in case of dispute",
      "recommendation": "請求提高責任上限至 $5,000,000"
    },
    {
      "risk_id": "RISK-002",
      "type": "confidentiality_period",
      "severity": "MEDIUM",
      "description": "保密期限短於合理期限",
      "current_value": "3 years",
      "recommended_value": "5 years",
      "recommendation": "協商將保密期延長至 5 年"
    }
  ]
}
```

### Step 4: 合規性檢查（Agent 3）

**輸入**：terms.json + compliance_rules.json
**輸出**：`compliance_issues.json`

**數據格式**：
```json
{
  "metadata": {
    "check_timestamp": "2026-03-22T10:40:00Z",
    "jurisdiction": "California",
    "total_issues": 2,
    "critical": 0,
    "high": 1,
    "medium": 1
  },
  "compliance_checks": [
    {
      "check_id": "COMP-001",
      "category": "data_protection",
      "severity": "HIGH",
      "requirement": "CCPA compliance clause required",
      "status": "MISSING",
      "description": "California Consumer Privacy Act (CCPA) 要求在隱私條款中明確說明數據處理",
      "recommendation": "添加 CCPA 合規條款"
    },
    {
      "check_id": "COMP-002",
      "category": "jurisdiction",
      "severity": "MEDIUM",
      "requirement": "Specify dispute resolution mechanism",
      "status": "PRESENT",
      "current_value": "Arbitration in Delaware",
      "recommendation": "確認仲裁地點與業務需求對齐"
    }
  ]
}
```

### Step 5: 建議生成（Agent 4）

**輸入**：risk_flags.json + compliance_issues.json
**輸出**：`recommendations.md`

**文件格式**：
```markdown
# 合同審查建議報告

## 合同基本信息
- **合同類型**：NDA
- **當事人**：ABC Inc. / XYZ Corp
- **生效日期**：2026-03-22
- **過期日期**：2027-03-22

## 執行摘要
發現 3 個風險項（1 HIGH, 2 MEDIUM）和 2 個合規性問題（1 HIGH, 1 MEDIUM）。

## 高優先級風險（必須處理）

### RISK-001: 責任上限過低
- **當前值**：$1,000,000
- **推薦值**：$5,000,000
- **理由**：低於行業標準，可能導致公司風險敞口
- **建議談判內容**：
  ```
  提議將責任上限從 $1,000,000 修改為 $5,000,000，
  特別是在數據洩露和 IP 侵權情況下。
  ```

## 中等優先級風險（應該處理）

### RISK-002: 保密期限短
...

## 合規性問題

### COMP-001: CCPA 合規條款缺失
...

## 總結與後續步驟

1. **馬上行動**（本週）
   - 與對方討論責任上限修改
   - 添加 CCPA 合規條款

2. **列入議程**（後續協商）
   - 延長保密期至 5 年
   - 確認仲裁地點

3. **最終步驟**
   - 收集對方反饋
   - 準備修訂版本
```

### Step 6: 結果合成與報告生成

**輸入**：terms.json, risk_flags.json, compliance_issues.json, recommendations.md
**輸出**：`review_report_YYYY-MM-DD.md`

**最終報告格式**：
```markdown
# 合同審查報告

## 📋 報告信息
- 審查時間：2026-03-22 10:45:00
- 合同類型：NDA
- 審查員：AI Legal Reviewer v1.0
- 人類審核者：待指派

## 📊 概況

| 指標 | 結果 |
|------|------|
| 總風險項 | 3 (1 HIGH, 2 MEDIUM) |
| 合規性問題 | 2 (1 HIGH, 1 MEDIUM) |
| 條款提取置信度 | 92% |
| 處理時間 | 15 分鐘 |

## ⚠️ 高優先級項目（需立即處理）

[詳細內容...]

## 📝 中等優先級項目

[詳細內容...]

## ✅ 建議清單

[詳細內容...]

## 🔐 合規性檢查結果

[詳細內容...]

## 👤 人類檢查點

此報告已生成，等待律師審閱並確認。

律師簽名：_________________
審批日期：_________________
```

---

## 🔄 數據交接點

| 階段 | 輸入文件 | 輸出文件 | 責任方 |
|------|---------|---------|--------|
| 上傳 | contract.pdf | - | 法務人員 |
| 提取 | contract.pdf | contract_text.txt | tools/pdf-extractor.sh |
| 條款提取 | contract_text.txt | terms.json | contract-terms-extractor |
| 風險分析 | terms.json | risk_flags.json | contract-risk-analyzer |
| 合規檢查 | terms.json | compliance_issues.json | contract-compliance-checker |
| 建議生成 | risk_flags.json + compliance_issues.json | recommendations.md | contract-recommendations-generator |
| 報告合成 | 以上所有輸出 | review_report_YYYY-MM-DD.md | legal-orchestrator |
| 審核 | review_report_YYYY-MM-DD.md | - | 律師 |
| 歸檔 | 所有文件 | departments/legal/archive/ | legal-orchestrator |

---

## 📁 文件存儲位置

```
departments/legal/
├── contracts/              # 上傳的合同文件
│   ├── contract-nda-2026-03-22.pdf
│   ├── contract_text_2026-03-22.txt
│   ├── terms_2026-03-22.json
│   ├── risk_flags_2026-03-22.json
│   ├── compliance_issues_2026-03-22.json
│   ├── recommendations_2026-03-22.md
│   └── review_report_2026-03-22.md
└── archive/                # 已完成審查的合同
    └── 2026-03/
        └── contract-nda-2026-03-22/
            └── [所有處理文件]
```

---

## ⏱️ 時間目標

| 步驟 | 目標時間 |
|------|---------|
| PDF 文本提取 | < 30 秒 |
| 條款提取 | < 60 秒 |
| 風險分析 | < 60 秒 |
| 合規性檢查 | < 60 秒 |
| 建議生成 | < 60 秒 |
| 結果合成 | < 30 秒 |
| **總計** | **< 5 分鐘** |

最終報告生成後，律師審核通常需 30-120 分鐘（取決於複雜度）。
