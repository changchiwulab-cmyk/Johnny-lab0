/**
 * 自動化審查鉤子模組
 * 在工作流中插入審查檢查點，判定是否需要人類介入
 * 複用 OwnerResolver 解析負責人分配
 */

const fs = require("fs");
const path = require("path");
const OwnerResolver = require("./owner-resolver");

class AutomatedReviewHooks {
  constructor(config) {
    this.config = config || this.loadConfig();
    try {
      this.resolver = new OwnerResolver();
    } catch {
      this.resolver = null;
    }
  }

  loadConfig() {
    const configPath = path.join(
      __dirname,
      "../tools/human-checkpoint-config.json",
    );
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
    return this.getDefaultConfig();
  }

  getDefaultConfig() {
    return {
      checkpoints: { mandatory: [], conditional: [] },
      actions: {},
    };
  }

  /**
   * 對審查結果進行自動化審查
   * @param {Object} terms - 條款提取結果
   * @param {Object} risks - 風險分析結果
   * @param {Object} compliance - 合規檢查結果
   * @param {Object} recommendations - 建議結果（可選）
   * @param {Object} context - 額外 context
   * @returns {Object} { passed, flags, checkpoints, escalations }
   */
  reviewResults(terms, risks, compliance, recommendations, context) {
    const reviewContext = this.buildContext(
      terms,
      risks,
      compliance,
      recommendations,
      context,
    );
    const flags = [];
    const triggeredCheckpoints = [];

    // 檢查 mandatory checkpoints
    const mandatory = this.config.checkpoints?.mandatory || [];
    for (const checkpoint of mandatory) {
      if (this.evaluateTrigger(checkpoint.trigger, reviewContext)) {
        const actionConfig = this.config.actions?.[checkpoint.action] || {};
        triggeredCheckpoints.push({
          id: checkpoint.id,
          description: checkpoint.description,
          type: "mandatory",
          action: checkpoint.action,
          blocking: actionConfig.blocking || false,
          timeout_hours: actionConfig.timeout_hours || 48,
        });
        if (actionConfig.blocking) {
          flags.push({
            level: "CRITICAL",
            message: checkpoint.description,
            checkpoint_id: checkpoint.id,
          });
        }
      }
    }

    // 檢查 conditional checkpoints
    const conditional = this.config.checkpoints?.conditional || [];
    for (const checkpoint of conditional) {
      if (this.evaluateTrigger(checkpoint.trigger, reviewContext)) {
        const actionConfig = this.config.actions?.[checkpoint.action] || {};
        triggeredCheckpoints.push({
          id: checkpoint.id,
          description: checkpoint.description,
          type: "conditional",
          action: checkpoint.action,
          blocking: actionConfig.blocking || false,
          timeout_hours: actionConfig.timeout_hours || 24,
        });
        flags.push({
          level: "WARNING",
          message: checkpoint.description,
          checkpoint_id: checkpoint.id,
        });
      }
    }

    // 額外品質檢查
    const qualityFlags = this.checkOutputQuality(terms, risks, compliance);
    flags.push(...qualityFlags);

    const hasBlockingCheckpoint = triggeredCheckpoints.some((c) => c.blocking);
    const passed = !hasBlockingCheckpoint && qualityFlags.length === 0;

    return {
      passed,
      flags,
      checkpoints: triggeredCheckpoints,
      context: reviewContext,
    };
  }

  /**
   * 建構審查 context
   */
  buildContext(terms, risks, compliance, recommendations, extraContext) {
    return {
      highSeverityCount: risks?.metadata?.high_severity || 0,
      criticalComplianceCount: compliance?.metadata?.critical || 0,
      totalRisks: risks?.metadata?.total_risks || 0,
      totalComplianceIssues: compliance?.metadata?.total_issues || 0,
      contractType: terms?.metadata?.contract_type || "Default",
      anomalyScore: extraContext?.anomalyScore || 0,
      agentConfidence: extraContext?.agentConfidence || 1,
      ...(extraContext || {}),
    };
  }

  /**
   * 評估 trigger 表達式
   * 支援：>=, <=, >, <, ==, always
   * @param {string} trigger
   * @param {Object} context
   * @returns {boolean}
   */
  evaluateTrigger(trigger, context) {
    if (!trigger) return false;
    if (trigger === "always") return true;

    const match = trigger.match(/^(\w+)\s*(>=|<=|>|<|==)\s*(.+)$/);
    if (!match) return false;

    const [, variable, operator, valueStr] = match;
    const contextValue = context[variable];
    if (contextValue === undefined) return false;

    const targetValue = parseFloat(valueStr);
    if (isNaN(targetValue)) return false;

    switch (operator) {
      case ">=":
        return contextValue >= targetValue;
      case "<=":
        return contextValue <= targetValue;
      case ">":
        return contextValue > targetValue;
      case "<":
        return contextValue < targetValue;
      case "==":
        return contextValue === targetValue;
      default:
        return false;
    }
  }

  /**
   * 檢查輸出品質
   */
  checkOutputQuality(terms, risks, compliance) {
    const flags = [];

    if (!terms || !terms.basic_info) {
      flags.push({
        level: "ERROR",
        message: "條款提取結果缺少 basic_info",
        checkpoint_id: "quality_terms",
      });
    }

    if (!risks || !risks.metadata) {
      flags.push({
        level: "ERROR",
        message: "風險分析結果缺少 metadata",
        checkpoint_id: "quality_risks",
      });
    }

    if (!compliance || !compliance.metadata) {
      flags.push({
        level: "ERROR",
        message: "合規檢查結果缺少 metadata",
        checkpoint_id: "quality_compliance",
      });
    }

    if (
      risks?.metadata?.total_risks > 5 &&
      risks?.metadata?.high_severity === 0
    ) {
      flags.push({
        level: "WARNING",
        message: "風險項超過 5 個但無高風險，可能有遺漏",
        checkpoint_id: "quality_risk_distribution",
      });
    }

    return flags;
  }

  /**
   * 判定是否需要人類介入
   * @param {Object} reviewResult - reviewResults 的返回值
   * @returns {Object} { requiresHuman, reason, assignedTo, checkpoints }
   */
  evaluateHumanCheckpoint(reviewResult) {
    if (!reviewResult) {
      return { requiresHuman: false, reason: null, assignedTo: [], checkpoints: [] };
    }

    const blockingCheckpoints = reviewResult.checkpoints.filter(
      (c) => c.blocking,
    );
    const hasErrors = reviewResult.flags.some((f) => f.level === "ERROR");

    if (blockingCheckpoints.length === 0 && !hasErrors) {
      return {
        requiresHuman: false,
        reason: null,
        assignedTo: [],
        checkpoints: [],
      };
    }

    const reasons = [];
    if (blockingCheckpoints.length > 0) {
      reasons.push(
        ...blockingCheckpoints.map((c) => c.description),
      );
    }
    if (hasErrors) {
      reasons.push("代理輸出品質異常");
    }

    // 透過 OwnerResolver 解析負責人
    const assignedTo = this.resolveAssignees(reviewResult.context);

    return {
      requiresHuman: true,
      reason: reasons.join("; "),
      assignedTo,
      checkpoints: blockingCheckpoints.map((c) => c.id),
    };
  }

  /**
   * 解析負責人
   */
  resolveAssignees(context) {
    if (!this.resolver) {
      return ["Legal Team Lead"];
    }

    try {
      const riskLevel = this.resolver.calculateRiskLevel(context || {});
      if (riskLevel === "high") {
        return ["Senior Legal Counsel", "Legal Team Lead"];
      }
      if (riskLevel === "medium") {
        return ["Legal Team Lead"];
      }
      return ["Contract Manager"];
    } catch {
      return ["Legal Team Lead"];
    }
  }
}

module.exports = AutomatedReviewHooks;
