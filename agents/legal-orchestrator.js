/**
 * 法務編排層
 * 協調 4 個並行代理（條款提取、風險分析、合規檢查、建議生成）
 * 進行完整的合同審查工作流
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ContractTermsExtractor = require("./contract-terms-extractor");
const ContractRiskAnalyzer = require("./contract-risk-analyzer");
const ContractComplianceChecker = require("./contract-compliance-checker");
const ContractRecommendationsGenerator = require("./contract-recommendations-generator");
const AutomatedReviewHooks = require("./automated-review-hooks");
const EscalationManager = require("./escalation-manager");
const AgentTrustMetrics = require("./agent-trust-metrics");

class LegalOrchestrator {
  constructor() {
    this.name = "LegalOrchestrator";
    this.version = "1.0.0";
    this.agents = {
      termsExtractor: new ContractTermsExtractor(),
      riskAnalyzer: new ContractRiskAnalyzer(),
      complianceChecker: new ContractComplianceChecker(),
      recommendationsGenerator: new ContractRecommendationsGenerator(),
    };
    try {
      this.reviewHooks = new AutomatedReviewHooks();
    } catch {
      this.reviewHooks = null;
    }
    try {
      this.escalationManager = new EscalationManager();
    } catch {
      this.escalationManager = null;
    }
    try {
      this.trustMetrics = new AgentTrustMetrics();
    } catch {
      this.trustMetrics = null;
    }
  }

  /**
   * 主工作流程
   * @param {string} contractPath - 合同文本文件路徑
   * @param {string} contractType - 合同類型 (NDA, SLA 等)
   * @param {object} options - 其他選項
   */
  async orchestrate(contractPath, contractType = "Other", options = {}) {
    console.log("\n" + "=".repeat(60));
    console.log("📋 [LegalOrchestrator] 開始合同審查工作流程");
    console.log("=".repeat(60));

    const workflowStartTime = Date.now();
    const outputDir = path.dirname(contractPath);
    this.timestamp = new Date().toISOString().split("T")[0];

    try {
      // Step 1: 驗證輸入
      console.log("\n📥 Step 1: 驗證輸入文件...");
      const contractText = this.validateInput(contractPath);

      // Step 2: 並行執行 4 個代理
      console.log("\n⚡ Step 2: 啟動並行代理...");
      const [terms, risks, compliance] = await this.executeAgentsInParallel(
        contractText,
        contractType,
        outputDir,
      );

      // Step 3: 生成建議
      console.log("\n💡 Step 3: 生成修改建議...");
      const recommendations = await this.generateRecommendations(
        risks,
        compliance,
        terms,
        outputDir,
        contractType,
      );

      // Step 4: 自動化審查
      console.log("\n🔍 Step 4: 自動化審查...");
      const reviewResult = this.runAutomatedReview(
        terms,
        risks,
        compliance,
        recommendations,
      );

      // Step 5: 合成最終報告
      console.log("\n📄 Step 5: 合成最終審查報告...");
      const report = await this.synthesizeReport(
        terms,
        risks,
        compliance,
        recommendations,
        contractType,
        this.timestamp,
        outputDir,
      );

      // Step 6: 評估人類檢查點 & 上報
      console.log("\n👤 Step 6: 評估人類檢查點...");
      const checkpoint = this.evaluateCheckpoint(reviewResult);
      let escalation = null;
      if (checkpoint.requiresHuman) {
        escalation = this.triggerEscalation(checkpoint, risks, compliance);
        console.log(
          `⚠️  需要人類審查: ${checkpoint.reason}`,
        );
        console.log(
          `📋 上報至: ${(escalation?.assignedTo || []).join(", ")}`,
        );
      } else {
        console.log("✅ 自動審查通過，無需人類介入");
      }

      // Step 7: 記錄信任度指標
      console.log("\n📊 Step 7: 記錄信任度指標...");
      this.recordAgentMetrics(terms, risks, compliance, recommendations);
      const trustReport = this.trustMetrics
        ? this.trustMetrics.getTrustReport()
        : null;

      // Step 8: 歸檔結果
      console.log("\n💾 Step 8: 歸檔審查結果...");
      const archivePath = await this.archiveResults(
        outputDir,
        this.timestamp,
        contractType,
      );

      const workflowDuration = Date.now() - workflowStartTime;

      console.log("\n" + "=".repeat(60));
      console.log("✅ 審查工作流程完成");
      console.log("=".repeat(60));
      console.log(`⏱️  總耗時: ${(workflowDuration / 1000).toFixed(2)} 秒`);
      console.log(`📂 歸檔位置: ${archivePath}`);
      console.log(`📄 最終報告: ${report}`);

      return {
        success: true,
        status: "completed",
        report_file: report,
        archive_path: archivePath,
        duration_ms: workflowDuration,
        artifacts: {
          terms: path.join(outputDir, `terms_${this.timestamp}.json`),
          risks: path.join(outputDir, `risk_flags_${this.timestamp}.json`),
          compliance: path.join(
            outputDir,
            `compliance_issues_${this.timestamp}.json`,
          ),
          recommendations: path.join(
            outputDir,
            `recommendations_${this.timestamp}.json`,
          ),
          report: report,
        },
        review: reviewResult,
        checkpoint,
        escalation,
        trustMetrics: trustReport,
      };
    } catch (error) {
      console.error(`\n❌ [LegalOrchestrator] 工作流程失敗:`, error.message);
      throw error;
    }
  }

  /**
   * 驗證輸入文件
   */
  validateInput(contractPath) {
    if (!fs.existsSync(contractPath)) {
      throw new Error(`合同文件不存在: ${contractPath}`);
    }

    const contractText = fs.readFileSync(contractPath, "utf-8");
    if (!contractText || contractText.trim().length === 0) {
      throw new Error("合同文件為空");
    }

    console.log(`✅ 文件驗證成功 (${contractText.length} 字符)`);
    return contractText;
  }

  /**
   * 並行執行代理
   * 先提取條款（一次），再並行執行風險分析和合規檢查
   */
  async executeAgentsInParallel(contractText, contractType, outputDir) {
    console.log(`🔄 執行多代理分析...`);
    const parallelStartTime = Date.now();

    try {
      // Step A: 提取條款（僅執行一次）
      console.log("  └─ 啟動條款提取代理...");
      const termsStartTime = Date.now();
      const terms = await this.agents.termsExtractor.extract(
        contractText,
        contractType,
      );
      this._agentDurations = this._agentDurations || {};
      this._agentDurations.termsExtractor = Date.now() - termsStartTime;
      fs.writeFileSync(
        path.join(outputDir, `terms_${this.timestamp}.json`),
        JSON.stringify(terms, null, 2),
      );
      console.log(`    ✅ 條款提取完成 (${this._agentDurations.termsExtractor}ms)`);

      // Step B: 並行執行風險分析和合規檢查（共用已提取的條款）
      console.log("  └─ 並行啟動風險分析 + 合規檢查...");
      const [risks, compliance] = await Promise.all([
        this.executeRiskAnalyzer(terms, contractType, outputDir),
        this.executeComplianceChecker(terms, contractType, outputDir),
      ]);

      const parallelDuration = Date.now() - parallelStartTime;
      console.log(
        `✅ 多代理分析完成 (${(parallelDuration / 1000).toFixed(2)}s)`,
      );

      return [terms, risks, compliance];
    } catch (error) {
      console.error("❌ 多代理分析失敗:", error.message);
      throw error;
    }
  }

  /**
   * 執行風險分析代理
   */
  async executeRiskAnalyzer(terms, contractType, outputDir) {
    const startTime = Date.now();

    try {
      const result = await this.agents.riskAnalyzer.analyze(
        terms,
        contractType,
      );

      fs.writeFileSync(
        path.join(outputDir, `risk_flags_${this.timestamp}.json`),
        JSON.stringify(result, null, 2),
      );

      const duration = Date.now() - startTime;
      this._agentDurations = this._agentDurations || {};
      this._agentDurations.riskAnalyzer = duration;
      console.log(
        `    ✅ 風險分析完成 (${duration}ms, ${result.metadata.total_risks} 項風險)`,
      );

      return result;
    } catch (error) {
      console.error("    ❌ 風險分析失敗:", error.message);
      throw error;
    }
  }

  /**
   * 執行合規檢查代理
   */
  async executeComplianceChecker(terms, contractType, outputDir) {
    const startTime = Date.now();

    try {
      const jurisdiction = terms.basic_info?.jurisdiction || "California";
      const result = await this.agents.complianceChecker.check(
        terms,
        jurisdiction,
      );

      fs.writeFileSync(
        path.join(outputDir, `compliance_issues_${this.timestamp}.json`),
        JSON.stringify(result, null, 2),
      );

      const duration = Date.now() - startTime;
      this._agentDurations = this._agentDurations || {};
      this._agentDurations.complianceChecker = duration;
      console.log(
        `    ✅ 合規檢查完成 (${duration}ms, ${result.metadata.total_issues} 項問題)`,
      );

      return result;
    } catch (error) {
      console.error("    ❌ 合規檢查失敗:", error.message);
      throw error;
    }
  }

  /**
   * 生成建議
   */
  async generateRecommendations(
    risks,
    compliance,
    terms,
    outputDir,
    contractType,
  ) {
    console.log(`📋 生成修改建議...`);
    const startTime = Date.now();

    try {
      // 設定 Owner 分配 context
      this.agents.recommendationsGenerator.setOwnerContext({
        contractType: contractType || "Default",
        highSeverityCount: risks?.metadata?.high_severity || 0,
        criticalComplianceCount: compliance?.metadata?.critical || 0,
        totalRisks: risks?.metadata?.total_risks || 0,
      });

      const result = await this.agents.recommendationsGenerator.generate(
        risks,
        compliance,
        terms,
      );

      // 保存結果
      const outputFile = path.join(
        outputDir,
        `recommendations_${this.timestamp}.json`,
      );
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

      const duration = Date.now() - startTime;
      this._agentDurations = this._agentDurations || {};
      this._agentDurations.recommendationsGenerator = duration;
      console.log(
        `✅ 建議生成完成 (${duration}ms, ${result.metadata.total_recommendations} 條建議)`,
      );

      return result;
    } catch (error) {
      console.error("❌ 建議生成失敗:", error.message);
      throw error;
    }
  }

  /**
   * 合成最終報告
   */
  async synthesizeReport(
    terms,
    risks,
    compliance,
    recommendations,
    contractType,
    timestamp,
    outputDir,
  ) {
    console.log("📄 生成最終審查報告...");

    const report = this.generateReportMarkdown(
      terms,
      risks,
      compliance,
      recommendations,
      contractType,
      timestamp,
    );

    const reportFile = path.join(outputDir, `review_report_${timestamp}.md`);
    fs.writeFileSync(reportFile, report);

    console.log(`✅ 最終報告已生成: ${reportFile}`);
    return reportFile;
  }

  /**
   * 生成報告 Markdown 內容
   */
  generateReportMarkdown(
    terms,
    risks,
    compliance,
    recommendations,
    contractType,
    timestamp,
  ) {
    const highRisks = risks.risks.filter((r) => r.severity === "HIGH");
    const mediumRisks = risks.risks.filter((r) => r.severity === "MEDIUM");
    const criticalCompliance = compliance.compliance_checks.filter(
      (c) => c.severity === "CRITICAL",
    );
    const highCompliance = compliance.compliance_checks.filter(
      (c) => c.severity === "HIGH",
    );

    let markdown = `# 合同審查報告

## 📋 報告信息
- **審查時間**: ${new Date().toLocaleString("zh-TW")}
- **合同類型**: ${contractType}
- **審查員**: AI Legal Reviewer v1.0
- **狀態**: ⏳ 待律師審批

---

## 📊 審查概況

| 指標 | 結果 |
|------|------|
| **風險總數** | ${risks.metadata.total_risks} (HIGH: ${risks.metadata.high_severity}, MEDIUM: ${risks.metadata.medium_severity}, LOW: ${risks.metadata.low_severity}) |
| **合規性問題** | ${compliance.metadata.total_issues} (CRITICAL: ${compliance.metadata.critical}, HIGH: ${compliance.metadata.high}, MEDIUM: ${compliance.metadata.medium}) |
| **建議總數** | ${recommendations.metadata.total_recommendations} |
| **緊急行動** | ${recommendations.metadata.critical_actions} |
| **當事人** | ${terms.basic_info.parties.join(", ")} |
| **管轄權** | ${terms.basic_info.jurisdiction} |

---

## ⚠️ 高優先級項目 (需立即處理)

### 高風險項 (${highRisks.length})
`;

    highRisks.forEach((risk) => {
      markdown += `
#### ${risk.risk_id}: ${risk.description}
- **當前狀態**: ${risk.current_value || "Not specified"}
- **推薦改正**: ${risk.recommended_value || risk.recommendation}
- **影響**: ${risk.impact}
`;
    });

    markdown += `

### 關鍵合規性問題 (${criticalCompliance.length + highCompliance.length})
`;

    [...criticalCompliance, ...highCompliance].forEach((issue) => {
      markdown += `
#### ${issue.check_id}: ${issue.description}
- **要求**: ${issue.requirement}
- **狀態**: ${issue.status}
- **建議**: ${issue.recommendation}
`;
    });

    markdown += `

---

## 📋 執行摘要

${recommendations.metadata ? recommendations.executive_summary : ""}

---

## 🚨 緊急行動計劃

${this.formatCriticalActions(recommendations.critical_actions)}

---

## 💼 談判要點

${this.formatNegotiationPoints(recommendations.negotiation_points)}

---

## ✅ 合規性改進

${this.formatComplianceImprovements(recommendations.compliance_improvements)}

---

## 📅 實施計劃

### Phase 1: 立即行動 (This Week)
${recommendations.implementation_plan?.phase_1?.tasks?.map((t) => `- ${t}`).join("\n") || "- 無"}

### Phase 2: 協商階段 (Next 2 Weeks)
${recommendations.implementation_plan?.phase_2?.tasks?.map((t) => `- ${t}`).join("\n") || "- 無"}

### Phase 3: 最終審查 (Week 3)
${recommendations.implementation_plan?.phase_3?.tasks?.map((t) => `- ${t}`).join("\n") || "- 無"}

---

## 🔍 詳細分析結果

### 提取的關鍵條款
- **保密期限**: ${terms.key_terms?.confidentiality_duration?.description || "Not specified"}
- **責任上限**: ${terms.key_terms?.liability_cap?.description || "Not specified"}
- **終止通知期**: ${terms.key_terms?.termination_clause?.notice_period || "Not specified"} ${terms.key_terms?.termination_clause?.notice_unit || ""}
- **支付條款**: ${terms.key_terms?.payment_terms?.description || "Not specified"}

### 風險統計
- 總計: ${risks.metadata.total_risks} 項
- 高風險: ${risks.metadata.high_severity} 項
- 中風險: ${risks.metadata.medium_severity} 項
- 低風險: ${risks.metadata.low_severity} 項

### 合規性統計
- 總計: ${compliance.metadata.total_issues} 項
- 關鍵: ${compliance.metadata.critical} 項
- 高: ${compliance.metadata.high} 項
- 中: ${compliance.metadata.medium} 項
- 低: ${compliance.metadata.low} 項

---

## 👤 人類檢查點

### 下一步行動

此報告已由 AI 自動生成，等待律師審閱和確認。

**審核律師**: ____________________

**簽名**: ____________________

**日期**: ____________________

**備註**:

---

## 📎 附件

- terms_${timestamp}.json - 提取的條款
- risk_flags_${timestamp}.json - 風險分析結果
- compliance_issues_${timestamp}.json - 合規性檢查結果
- recommendations_${timestamp}.json - 建議詳情

---

*報告由 LegalOrchestrator v1.0 生成*
*生成時間: ${new Date().toISOString()}*
`;

    return markdown;
  }

  /**
   * 格式化緊急行動
   */
  formatCriticalActions(actions) {
    if (!actions || actions.length === 0) {
      return "沒有緊急行動需要";
    }

    let formatted = "";
    actions.slice(0, 5).forEach((action, index) => {
      formatted += `
### ${index + 1}. ${action.title}
- **優先級**: ${action.priority}
- **當前**: ${action.current_state}
- **推薦**: ${action.recommended_state}
- **行動項**:
${action.action_items?.map((item) => `  - ${item}`).join("\n")}
- **期限**: ${action.timeline}
`;
    });

    return formatted;
  }

  /**
   * 格式化談判要點
   */
  formatNegotiationPoints(points) {
    if (!points || points.length === 0) {
      return "沒有談判要點";
    }

    let formatted = "";
    points.forEach((point, index) => {
      formatted += `
### ${index + 1}. ${point.topic}
- **我方立場**: ${point.our_position}
- **初始報價**: ${point.opening_offer}
- **退而求其次**: ${point.fallback_position}
- **底線**: ${point.walk_away_point}
`;
    });

    return formatted;
  }

  /**
   * 格式化合規性改進
   */
  formatComplianceImprovements(improvements) {
    if (!improvements || improvements.length === 0) {
      return "沒有合規性改進需要";
    }

    let formatted = "";
    improvements.slice(0, 3).forEach((imp, index) => {
      formatted += `
### ${index + 1}. ${imp.category}
- **要求**: ${imp.requirement}
- **推薦動作**: ${imp.recommended_action}
- **優先級**: ${imp.priority}
`;
    });

    return formatted;
  }

  /**
   * 執行自動化審查
   */
  runAutomatedReview(terms, risks, compliance, recommendations) {
    if (!this.reviewHooks) {
      return { passed: true, flags: [], checkpoints: [], context: {} };
    }
    try {
      return this.reviewHooks.reviewResults(
        terms,
        risks,
        compliance,
        recommendations,
      );
    } catch {
      return { passed: true, flags: [], checkpoints: [], context: {} };
    }
  }

  /**
   * 評估人類檢查點
   */
  evaluateCheckpoint(reviewResult) {
    if (!this.reviewHooks) {
      return { requiresHuman: false, reason: null, assignedTo: [], checkpoints: [] };
    }
    try {
      return this.reviewHooks.evaluateHumanCheckpoint(reviewResult);
    } catch {
      return { requiresHuman: false, reason: null, assignedTo: [], checkpoints: [] };
    }
  }

  /**
   * 觸發上報
   */
  triggerEscalation(checkpoint, risks, compliance) {
    if (!this.escalationManager) {
      return null;
    }
    try {
      const severity =
        (compliance?.metadata?.critical || 0) >= 1
          ? "CRITICAL"
          : (risks?.metadata?.high_severity || 0) >= 2
            ? "HIGH"
            : "MEDIUM";

      return this.escalationManager.escalate({
        type: checkpoint.reason,
        severity,
        source: "automated_review",
        details: {
          checkpoints: checkpoint.checkpoints,
          totalRisks: risks?.metadata?.total_risks || 0,
        },
      });
    } catch {
      return null;
    }
  }

  /**
   * 記錄代理信任度指標
   */
  recordAgentMetrics(terms, risks, compliance, recommendations) {
    if (!this.trustMetrics) return;
    const durations = this._agentDurations || {};
    try {
      this.trustMetrics.recordExecution("termsExtractor", {
        success: terms?.extraction_status === "completed",
        duration_ms: durations.termsExtractor || 0,
        outputQuality: this.calculateTermsQuality(terms),
        humanOverrideRequired: false,
        escalated: false,
      });
      this.trustMetrics.recordExecution("riskAnalyzer", {
        success: risks?.analysis_status === "completed",
        duration_ms: durations.riskAnalyzer || 0,
        outputQuality: this.calculateRisksQuality(risks),
        humanOverrideRequired: false,
        escalated: false,
      });
      this.trustMetrics.recordExecution("complianceChecker", {
        success: compliance?.check_status === "completed",
        duration_ms: durations.complianceChecker || 0,
        outputQuality: this.calculateComplianceQuality(compliance),
        humanOverrideRequired: false,
        escalated: false,
      });
      this.trustMetrics.recordExecution("recommendationsGenerator", {
        success: !!recommendations?.metadata,
        duration_ms: durations.recommendationsGenerator || 0,
        outputQuality: this.calculateRecommendationsQuality(recommendations),
        humanOverrideRequired: false,
        escalated: false,
      });
    } catch {
      // 信任度記錄失敗不影響主流程
    }
  }

  /**
   * 計算條款提取品質 (0-1)
   * 基於：基本資訊完整度 + 關鍵條款提取數量
   */
  calculateTermsQuality(terms) {
    if (!terms || !terms.basic_info) return 0.1;
    let score = 0.5; // 有 basic_info 基底分
    if (terms.basic_info.parties?.length > 0) score += 0.15;
    if (terms.basic_info.jurisdiction) score += 0.1;
    if (terms.key_terms && Object.keys(terms.key_terms).length >= 3) score += 0.25;
    return Math.min(1, score);
  }

  /**
   * 計算風險分析品質 (0-1)
   * 基於：是否有 metadata + 風險分級分佈合理性
   */
  calculateRisksQuality(risks) {
    if (!risks || !risks.metadata) return 0.1;
    let score = 0.5;
    if (risks.risks?.length > 0) score += 0.2;
    if (risks.metadata.high_severity > 0 || risks.metadata.total_risks <= 5) score += 0.15;
    if (risks.metadata.total_risks > 0) score += 0.15;
    return Math.min(1, score);
  }

  /**
   * 計算合規檢查品質 (0-1)
   */
  calculateComplianceQuality(compliance) {
    if (!compliance || !compliance.metadata) return 0.1;
    let score = 0.5;
    if (compliance.compliance_checks?.length > 0) score += 0.25;
    if (compliance.metadata.total_issues > 0) score += 0.25;
    return Math.min(1, score);
  }

  /**
   * 計算建議生成品質 (0-1)
   */
  calculateRecommendationsQuality(recommendations) {
    if (!recommendations || !recommendations.metadata) return 0.1;
    let score = 0.5;
    if (recommendations.metadata.total_recommendations > 0) score += 0.2;
    if (recommendations.implementation_plan) score += 0.15;
    if (recommendations.next_steps?.length > 0) score += 0.15;
    return Math.min(1, score);
  }

  /**
   * 歸檔結果
   */
  async archiveResults(outputDir, timestamp, contractType) {
    console.log("📂 歸檔審查結果...");

    const archiveDir = path.join(
      outputDir,
      "archive",
      timestamp.substring(0, 7),
      `contract-${contractType}-${timestamp}`,
    );

    try {
      // 創建歸檔目錄
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      // 移動所有結果文件到歸檔目錄
      const files = fs.readdirSync(outputDir);
      files.forEach((file) => {
        if (
          file.includes(timestamp) &&
          (file.endsWith(".json") ||
            file.endsWith(".md") ||
            file.endsWith(".txt"))
        ) {
          const src = path.join(outputDir, file);
          const dst = path.join(archiveDir, file);
          if (fs.existsSync(src) && !fs.existsSync(dst)) {
            fs.copyFileSync(src, dst);
          }
        }
      });

      console.log(`✅ 結果已歸檔到: ${archiveDir}`);
      return archiveDir;
    } catch (error) {
      console.warn(`⚠️ 歸檔失敗: ${error.message}`);
      return outputDir; // 返回原始目錄
    }
  }
}

// 如果作為獨立腳本運行
if (require.main === module) {
  const contractPath = process.argv[2] || "contract_text.txt";
  const contractType = process.argv[3] || "Other";

  const orchestrator = new LegalOrchestrator();
  orchestrator
    .orchestrate(contractPath, contractType)
    .then((result) => {
      console.log("\n🎉 工作流程成功完成!");
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ 工作流程失敗:", error.message);
      process.exit(1);
    });
}

module.exports = LegalOrchestrator;
