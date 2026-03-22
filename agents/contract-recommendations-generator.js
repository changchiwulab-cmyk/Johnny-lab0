/**
 * 合同建議生成代理
 * 基於風險分析和合規性檢查結果，生成修改建議
 */

const fs = require("fs");
const path = require("path");

class ContractRecommendationsGenerator {
  constructor() {
    this.name = "ContractRecommendationsGenerator";
    this.version = "1.0.0";
  }

  /**
   * 主執行方法
   * @param {Object} risks - 風險分析結果 (risk_flags.json)
   * @param {Object} compliance - 合規性檢查結果 (compliance_issues.json)
   * @param {Object} terms - 條款提取結果 (terms.json)
   * @returns {Object} 建議結果
   */
  async generate(risks, compliance, terms) {
    console.log(`🔍 [${this.name}] 開始生成建議...`);

    const startTime = Date.now();

    try {
      const recommendations = {
        metadata: {
          generation_timestamp: new Date().toISOString(),
          total_recommendations: 0,
          critical_actions: 0,
          generated_by: this.name,
          version: this.version,
        },
        executive_summary: this.generateExecutiveSummary(risks, compliance),
        critical_actions: this.generateCriticalActions(risks, compliance),
        negotiation_points: this.generateNegotiationPoints(
          risks,
          compliance,
          terms,
        ),
        compliance_improvements:
          this.generateComplianceImprovements(compliance),
        implementation_plan: this.generateImplementationPlan(risks, compliance),
        next_steps: this.generateNextSteps(risks, compliance),
      };

      recommendations.metadata.total_recommendations =
        recommendations.critical_actions.length +
        recommendations.negotiation_points.length +
        recommendations.compliance_improvements.length;

      recommendations.metadata.critical_actions =
        recommendations.critical_actions.filter(
          (a) => a.priority === "CRITICAL",
        ).length;

      const duration = Date.now() - startTime;
      console.log(`✅ [${this.name}] 建議生成完成 (${duration}ms)`);

      return recommendations;
    } catch (error) {
      console.error(`❌ [${this.name}] 生成失敗:`, error.message);
      throw error;
    }
  }

  /**
   * 生成執行摘要
   */
  generateExecutiveSummary(risks, compliance) {
    const totalIssues =
      (risks.metadata?.total_risks || 0) +
      (compliance.metadata?.total_issues || 0);
    const criticalCount =
      (risks.metadata?.high_severity || 0) +
      (compliance.metadata?.critical || 0);

    let summary = `發現 ${totalIssues} 個問題，其中 ${criticalCount} 個需要立即處理。\n\n`;

    if (criticalCount > 0) {
      summary += `🚨 **必須立即處理的項目**: ${criticalCount} 項\n`;
      summary += "- 這些項目可能導致重大法律風險或財務敞口\n";
      summary += "- 建議在簽署合同前必須解決\n\n";
    }

    const mediumCount =
      (risks.metadata?.medium_severity || 0) +
      (compliance.metadata?.medium || 0);
    if (mediumCount > 0) {
      summary += `⚠️ **應該處理的項目**: ${mediumCount} 項\n`;
      summary += "- 這些項目可能影響中期風險\n";
      summary += "- 建議在後續協商中逐步解決\n\n";
    }

    const lowCount =
      (risks.metadata?.low_severity || 0) + (compliance.metadata?.low || 0);
    if (lowCount > 0) {
      summary += `💡 **可選改進**: ${lowCount} 項\n`;
      summary += "- 這些項目為最佳實踐\n";
      summary += "- 在資源允許的情況下改進\n";
    }

    return summary;
  }

  /**
   * 生成緊急行動
   */
  generateCriticalActions(risks, compliance) {
    const actions = [];

    // 從風險中提取 HIGH 優先級的行動
    if (risks.risks) {
      risks.risks
        .filter((r) => r.severity === "HIGH")
        .slice(0, 3)
        .forEach((risk) => {
          actions.push({
            action_id: risk.risk_id,
            priority: "CRITICAL",
            category: risk.type,
            title: risk.description,
            current_state: risk.current_value || "Missing",
            recommended_state: risk.recommended_value || risk.recommendation,
            action_items: [
              `立即聯繫對方談判`,
              `提供修改建議`,
              `設定談判截止日期`,
              `升級至法務負責人`,
            ],
            timeline: "This week",
          });
        });
    }

    // 從合規性中提取 CRITICAL 或 HIGH 優先級的行動
    if (compliance.compliance_checks) {
      compliance.compliance_checks
        .filter((c) => c.severity === "CRITICAL" || c.severity === "HIGH")
        .slice(0, 2)
        .forEach((check) => {
          actions.push({
            action_id: check.check_id,
            priority: "CRITICAL",
            category: check.category,
            title: check.description,
            requirement: check.requirement,
            action_items: [
              `添加或修改相關條款`,
              `確保符合 ${check.jurisdiction_requirement || "applicable"}  要求`,
              `法務審核`,
              `提交給對方`,
            ],
            timeline: "Before signature",
          });
        });
    }

    return actions;
  }

  /**
   * 生成談判要點
   */
  generateNegotiationPoints(risks, compliance, terms) {
    const points = [];

    // 從風險中生成談判要點
    if (risks.risks) {
      risks.risks.slice(0, 5).forEach((risk, index) => {
        points.push({
          point_id: `NEG-${index + 1}`,
          topic: risk.description,
          current_position: risk.current_value || "Not specified",
          our_position: risk.recommended_value || risk.recommendation,
          rationale: risk.impact,
          opening_offer: this.generateOpeningOffer(risk),
          fallback_position: this.generateFallbackPosition(risk),
          walk_away_point: this.generateWalkAwayPoint(risk),
        });
      });
    }

    return points;
  }

  /**
   * 生成初始報價
   */
  generateOpeningOffer(risk) {
    if (risk.type === "liability_cap_low") {
      const current = risk.current_value?.replace(/\D/g, "") || 1000000;
      const recommended = risk.recommended_value?.replace(/\D/g, "") || 5000000;
      const aggressive = Math.ceil(recommended * 1.2);
      return `提高責任上限至 $${aggressive.toLocaleString()}`;
    }
    return risk.recommendation;
  }

  /**
   * 生成退而求其次的方案
   */
  generateFallbackPosition(risk) {
    if (risk.type === "liability_cap_low") {
      return "Compromise at 75% of recommended value";
    }
    return "Acceptable alternative position";
  }

  /**
   * 生成底線
   */
  generateWalkAwayPoint(risk) {
    if (risk.severity === "HIGH") {
      return "Cannot proceed without resolution - escalate to management";
    }
    return "May accept current position but with additional protections";
  }

  /**
   * 生成合規性改進建議
   */
  generateComplianceImprovements(compliance) {
    const improvements = [];

    if (compliance.compliance_checks) {
      compliance.compliance_checks
        .filter((c) => c.status === "MISSING")
        .forEach((check, index) => {
          improvements.push({
            improvement_id: `CMP-${index + 1}`,
            category: check.category,
            requirement: check.requirement,
            current_status: "Missing",
            recommended_action: check.recommendation,
            template_clause: this.generateTemplateClause(check),
            priority: check.severity === "HIGH" ? "High" : "Medium",
          });
        });
    }

    return improvements;
  }

  /**
   * 生成條款模板
   */
  generateTemplateClause(check) {
    const templates = {
      data_protection: `**數據保護條款**
\n雙方同意遵守所有適用的數據保護法律，包括 CCPA、GDPR 等。\n接收方應採取適當的技術和組織措施保護個人數據的安全。`,
      liability: `**責任限制**\n除非法律禁止，任何一方的總責任均不超過本合同下應支付總金額的 2 倍。\n任何一方均不對另一方承擔間接、附帶或後果性損害的責任。`,
      privacy: `**隱私政策**\n雙方應在合理期間內向對方提供隱私政策。\n個人數據的處理應符合雙方協議的隱私政策。`,
      intellectual_property: `**知識產權**\n各方保留其所有知識產權的所有權。\n除合同明確授予的許可外，一方不得使用另一方的知識產權。`,
      dispute_resolution: `**爭議解決**\n任何因本合同引起的爭議應通過友好協商解決。\n如協商失敗，爭議應根據 [jurisdiction] 法律通過 [仲裁/訴訟] 解決。`,
    };

    return templates[check.category] || "請參考法務部提供的標準條款模板";
  }

  /**
   * 生成實施計劃
   */
  generateImplementationPlan(risks, compliance) {
    return {
      phase_1: {
        name: "立即行動 (This Week)",
        tasks: [
          "整理所有風險項和合規性問題清單",
          "將清單發送給法務負責人",
          "制定與對方的協商策略",
          "準備談判文件和反建議",
        ],
        owners: ["Legal Team Lead"],
        deliverables: ["Negotiation Strategy Document"],
      },
      phase_2: {
        name: "協商階段 (Next 2 Weeks)",
        tasks: [
          "與對方進行談判",
          "提出修改建議",
          "根據反饋進行調整",
          "記錄協商進度",
        ],
        owners: ["Contract Manager", "Legal Counsel"],
        deliverables: ["Revised Contract Draft"],
      },
      phase_3: {
        name: "最終審查 (Week 3)",
        tasks: [
          "重新審查修訂後的合同",
          "確保所有問題已解決",
          "獲得最終批准",
          "準備簽署",
        ],
        owners: ["Legal Team", "Executive"],
        deliverables: ["Final Approved Contract"],
      },
    };
  }

  /**
   * 生成後續步驟
   */
  generateNextSteps(risks, compliance) {
    return [
      {
        step: 1,
        action: "審查此報告中的所有建議",
        owner: "Legal Team Lead",
        deadline: "Tomorrow",
      },
      {
        step: 2,
        action: "與業務單位確認關鍵談判要點",
        owner: "Contract Manager",
        deadline: "Within 2 days",
      },
      {
        step: 3,
        action: "準備修改建議和反建議",
        owner: "Legal Counsel",
        deadline: "Within 3 days",
      },
      {
        step: 4,
        action: "啟動與對方的協商",
        owner: "Contract Manager",
        deadline: "Within 5 days",
      },
      {
        step: 5,
        action: "持續跟蹤談判進度，每 2 天更新狀態",
        owner: "Legal Team Lead",
        deadline: "Ongoing",
      },
    ];
  }
}

// 如果作為獨立腳本運行
if (require.main === module) {
  const risksPath = process.argv[2] || "risk_flags.json";
  const compliancePath = process.argv[3] || "compliance_issues.json";
  const termsPath = process.argv[4] || "terms.json";

  const files = [risksPath, compliancePath, termsPath];
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.error(`❌ 找不到文件: ${file}`);
      process.exit(1);
    }
  }

  const risks = JSON.parse(fs.readFileSync(risksPath, "utf-8"));
  const compliance = JSON.parse(fs.readFileSync(compliancePath, "utf-8"));
  const terms = JSON.parse(fs.readFileSync(termsPath, "utf-8"));

  const generator = new ContractRecommendationsGenerator();
  generator.generate(risks, compliance, terms).then((result) => {
    console.log("\n📋 生成的建議:");
    console.log(JSON.stringify(result, null, 2));

    // 保存到文件
    const outputFile = path.join(
      path.dirname(risksPath),
      "recommendations.json",
    );
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\n💾 結果已保存到: ${outputFile}`);
  });
}

module.exports = ContractRecommendationsGenerator;
