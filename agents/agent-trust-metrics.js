/**
 * 代理信任度指標追蹤
 * 記錄代理執行歷史，計算信任分數，支援持久化
 */

const fs = require("fs");
const path = require("path");

class AgentTrustMetrics {
  constructor() {
    this.executions = {};
  }

  /**
   * 記錄一次代理執行
   * @param {string} agentName - 代理名稱
   * @param {Object} result - 執行結果
   * @param {boolean} result.success - 是否成功
   * @param {number} result.duration_ms - 執行時間（毫秒）
   * @param {number} result.outputQuality - 輸出品質 (0-1)
   * @param {boolean} result.humanOverrideRequired - 是否需要人類覆寫
   * @param {boolean} result.escalated - 是否觸發上報
   */
  recordExecution(agentName, result) {
    if (!agentName) {
      throw new Error("agentName 為必填");
    }

    if (!this.executions[agentName]) {
      this.executions[agentName] = [];
    }

    this.executions[agentName].push({
      timestamp: new Date().toISOString(),
      success: !!result.success,
      duration_ms: result.duration_ms || 0,
      outputQuality: Math.max(0, Math.min(1, result.outputQuality || 0)),
      humanOverrideRequired: !!result.humanOverrideRequired,
      escalated: !!result.escalated,
    });
  }

  /**
   * 計算代理信任分數
   * 公式：successRate×0.4 + (1-humanOverrideRate)×0.3 + (1-escalationRate)×0.2 + qualityAvg×0.1
   * @param {string} agentName
   * @returns {number} 信任分數 (0-1)
   */
  calculateTrustScore(agentName) {
    const records = this.executions[agentName];
    if (!records || records.length === 0) {
      return 0;
    }

    const total = records.length;
    const successCount = records.filter((r) => r.success).length;
    const overrideCount = records.filter((r) => r.humanOverrideRequired).length;
    const escalatedCount = records.filter((r) => r.escalated).length;
    const qualitySum = records.reduce((sum, r) => sum + r.outputQuality, 0);

    const successRate = successCount / total;
    const humanOverrideRate = overrideCount / total;
    const escalationRate = escalatedCount / total;
    const qualityAvg = qualitySum / total;

    const score =
      successRate * 0.4 +
      (1 - humanOverrideRate) * 0.3 +
      (1 - escalationRate) * 0.2 +
      qualityAvg * 0.1;

    return Math.round(score * 1000) / 1000;
  }

  /**
   * 取得單個代理的統計
   */
  getAgentStats(agentName) {
    const records = this.executions[agentName];
    if (!records || records.length === 0) {
      return null;
    }

    const total = records.length;
    const successCount = records.filter((r) => r.success).length;
    const overrideCount = records.filter((r) => r.humanOverrideRequired).length;
    const escalatedCount = records.filter((r) => r.escalated).length;
    const qualitySum = records.reduce((sum, r) => sum + r.outputQuality, 0);
    const durationSum = records.reduce((sum, r) => sum + r.duration_ms, 0);

    return {
      trustScore: this.calculateTrustScore(agentName),
      totalRuns: total,
      successRate: Math.round((successCount / total) * 1000) / 1000,
      avgDuration_ms: Math.round(durationSum / total),
      humanOverrideRate: Math.round((overrideCount / total) * 1000) / 1000,
      escalationRate: Math.round((escalatedCount / total) * 1000) / 1000,
      avgOutputQuality: Math.round((qualitySum / total) * 1000) / 1000,
    };
  }

  /**
   * 取得所有代理的信任報告
   */
  getTrustReport() {
    const agents = {};
    for (const agentName of Object.keys(this.executions)) {
      agents[agentName] = this.getAgentStats(agentName);
    }

    return {
      generated_at: new Date().toISOString(),
      total_agents: Object.keys(agents).length,
      agents,
    };
  }

  /**
   * 將指標持久化到 JSON
   */
  saveMetrics(outputPath) {
    const data = {
      version: "1.0.0",
      saved_at: new Date().toISOString(),
      executions: this.executions,
    };
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  }

  /**
   * 載入歷史指標
   */
  loadMetrics(inputPath) {
    if (!fs.existsSync(inputPath)) {
      return false;
    }

    const data = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
    if (data.executions) {
      this.executions = data.executions;
    }
    return true;
  }
}

module.exports = AgentTrustMetrics;
