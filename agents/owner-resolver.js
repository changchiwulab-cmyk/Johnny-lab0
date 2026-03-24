/**
 * 動態 Owner 解析器
 * 根據合同類型、風險等級等 context 因素，為 DAG 節點解析負責人
 */

const fs = require("fs");
const path = require("path");

class OwnerResolver {
  constructor(config) {
    this.config = config || this.loadConfig();
  }

  loadConfig() {
    const configPath = path.join(
      __dirname,
      "../tools/owner-roles-config.json",
    );
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
    return this.getDefaultConfig();
  }

  getDefaultConfig() {
    return {
      roles: {},
      risk_based_rules: {},
      contract_type_rules: {
        Default: {
          specialist: "Legal Counsel",
          negotiator: "Contract Manager",
          reviewer: "Legal Team Lead",
        },
      },
    };
  }

  /**
   * 解析單個節點的 owner
   * @param {Object} node - DAG 節點
   * @param {Object} context - 解析 context
   * @returns {string[]} owner 陣列
   */
  resolve(node, context) {
    const strategy = this.getStrategy(node.ownerRule);
    if (!strategy) {
      return node.defaultOwners || [];
    }

    try {
      const owners = strategy.call(this, node, context);
      return owners && owners.length > 0 ? owners : node.defaultOwners || [];
    } catch {
      return node.defaultOwners || [];
    }
  }

  getStrategy(ruleName) {
    const strategies = {
      resolve_by_risk: this.resolveByRisk,
      resolve_by_contract_type: this.resolveByContractType,
      resolve_by_step: this.resolveByStep,
      resolve_by_phase: this.resolveByPhase,
    };
    return strategies[ruleName] || null;
  }

  /**
   * 依風險等級分配 owner
   */
  resolveByRisk(node, context) {
    const riskLevel = this.calculateRiskLevel(context);
    const rules = this.config.risk_based_rules?.[riskLevel];
    if (!rules) {
      return null;
    }
    return rules[node.id] || null;
  }

  /**
   * 依合同類型分配 owner
   */
  resolveByContractType(node, context) {
    const contractType = context.contractType || "Default";
    const typeRules =
      this.config.contract_type_rules?.[contractType] ||
      this.config.contract_type_rules?.Default;

    if (!typeRules) {
      return null;
    }

    const owners = [];
    if (node.type === "implementation" || node.type === "drafting") {
      if (typeRules.specialist) owners.push(typeRules.specialist);
      if (typeRules.negotiator) owners.push(typeRules.negotiator);
    } else if (node.type === "approval" || node.type === "review") {
      if (typeRules.reviewer) owners.push(typeRules.reviewer);
    } else {
      if (typeRules.negotiator) owners.push(typeRules.negotiator);
    }

    return owners.length > 0 ? owners : null;
  }

  /**
   * 依步驟性質分配 owner
   */
  resolveByStep(node, context) {
    const riskLevel = this.calculateRiskLevel(context);

    if (node.type === "coordination" || node.type === "execution") {
      return riskLevel === "high"
        ? ["Senior Legal Counsel", "Contract Manager"]
        : ["Contract Manager"];
    }

    if (node.type === "monitoring") {
      return riskLevel === "high"
        ? ["Legal Team Lead"]
        : ["Contract Manager"];
    }

    return null;
  }

  /**
   * 依實施階段分配 owner
   */
  resolveByPhase(node, context) {
    return this.resolveByRisk(node, context);
  }

  /**
   * 計算整體風險等級
   */
  calculateRiskLevel(context) {
    const highCount = context.highSeverityCount || 0;
    const criticalCount = context.criticalComplianceCount || 0;

    if (highCount >= 2 || criticalCount >= 1) {
      return "high";
    }
    if (highCount >= 1 || (context.totalRisks || 0) >= 3) {
      return "medium";
    }
    return "low";
  }

  /**
   * 查詢角色資訊
   */
  getRole(roleName) {
    return this.config.roles?.[roleName] || null;
  }

  /**
   * 取得所有可用角色
   */
  getAvailableRoles() {
    return Object.keys(this.config.roles || {});
  }
}

module.exports = OwnerResolver;
