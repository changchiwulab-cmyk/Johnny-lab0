/**
 * 事件響應處理器
 * 按嚴重等級選擇 Playbook，執行自動響應，級聯通知，SLA 合規檢查
 */

const fs = require("fs");
const path = require("path");

class IncidentResponseHandler {
  constructor() {
    this.name = "IncidentResponseHandler";
    this.version = "1.0.0";

    const configPath = path.join(
      __dirname,
      "..",
      "tools",
      "incident-response-config.json",
    );
    this.config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    this.actionLog = [];
  }

  /**
   * 主入口：處理告警列表
   * @param {Array} alerts - 告警陣列
   * @returns {object} 響應報告
   */
  respond(alerts) {
    if (!Array.isArray(alerts)) {
      throw new Error("alerts must be an array");
    }

    const startTime = Date.now();
    this.actionLog = [];
    const responses = [];
    let slaMetCount = 0;
    let slaBreachedCount = 0;
    let escalatedCount = 0;

    for (const alert of alerts) {
      const responseStartTime = Date.now();
      const playbook = this.selectPlaybook(alert);
      const actions = this.executePlaybook(playbook, alert);
      const responseTimeMs = Date.now() - responseStartTime;

      const slaStatus = this.checkSLACompliance(alert, responseTimeMs);
      if (slaStatus === "met") slaMetCount++;
      else slaBreachedCount++;

      const escalationChain = this.getEscalationChain(alert.escalation_level);
      if (alert.escalation_level >= 2) escalatedCount++;

      const report = this.generateIncidentReport(alert, actions);

      responses.push({
        alert_id: alert.alert_id,
        playbook_used: playbook ? playbook.name : "default",
        actions_taken: actions,
        response_time_ms: responseTimeMs,
        sla_status: slaStatus,
        escalation_chain: escalationChain,
        remediation_status: this.getRemediationStatus(playbook, actions),
        incident_report: report,
      });
    }

    return {
      metadata: {
        total_alerts: alerts.length,
        responded: responses.length,
        escalated: escalatedCount,
        sla_met: slaMetCount,
        sla_breached: slaBreachedCount,
        total_response_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      responses,
      action_log: [...this.actionLog],
    };
  }

  /**
   * 為告警選擇匹配的 Playbook
   * @param {object} alert
   * @returns {object|null} playbook 含 name
   */
  selectPlaybook(alert) {
    const severityOrder = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
      INFO: 4,
    };
    const alertSeverityRank = severityOrder[alert.severity] ?? 4;

    let bestMatch = null;
    let bestMatchRank = Infinity;

    for (const [name, playbook] of Object.entries(this.config.playbooks)) {
      const playbookSeverityRank = severityOrder[playbook.severity_min] ?? 4;

      if (alertSeverityRank > playbookSeverityRank) continue;

      if (playbook.category && playbook.category !== alert.category) continue;

      if (playbookSeverityRank < bestMatchRank) {
        bestMatch = { name, ...playbook };
        bestMatchRank = playbookSeverityRank;
      }
    }

    return bestMatch;
  }

  /**
   * 執行 Playbook 中的動作序列
   * @param {object|null} playbook
   * @param {object} alert
   * @returns {Array} 已執行的動作列表
   */
  executePlaybook(playbook, alert) {
    const actions = playbook ? playbook.actions : ["log_enhanced", "notify"];
    const executedActions = [];

    for (const actionName of actions) {
      const actionDef = this.config.action_definitions[actionName];
      const result = this.executeAction(actionName, actionDef, alert);
      executedActions.push(result);
      this.actionLog.push({
        ...result,
        alert_id: alert.alert_id,
        timestamp: new Date().toISOString(),
      });
    }

    return executedActions;
  }

  /**
   * 執行單一動作
   * @param {string} actionName
   * @param {object} actionDef
   * @param {object} alert
   * @returns {object} 動作結果
   */
  executeAction(actionName, actionDef, alert) {
    const description = actionDef
      ? actionDef.description
      : `執行 ${actionName}`;

    if (actionName === "notify") {
      const chain = this.getEscalationChain(alert.escalation_level);
      return {
        action: actionName,
        status: "completed",
        description,
        details: { notified: chain },
      };
    }

    if (actionName === "auto_patch_attempt") {
      const patchResult = this.attemptAutoPatch(alert);
      return {
        action: actionName,
        status: patchResult.success ? "completed" : "failed",
        description,
        details: patchResult,
      };
    }

    return {
      action: actionName,
      status: "completed",
      description,
      details: { target: alert.category, severity: alert.severity },
    };
  }

  /**
   * 嘗試自動修補
   * @param {object} alert
   * @returns {object} 修補結果
   */
  attemptAutoPatch(alert) {
    const patchableCategories = ["vulnerability"];
    const canPatch = patchableCategories.includes(alert.category);

    if (canPatch) {
      return {
        success: true,
        method: "automated",
        description: `自動修補 ${alert.category} 類型漏洞`,
        remediation: `npm audit fix --force (模擬)`,
      };
    }

    return {
      success: false,
      method: "manual_required",
      description: `${alert.category} 類型無法自動修補，需人工介入`,
    };
  }

  /**
   * 取得級聯通知鏈
   * @param {number} level
   * @returns {Array} 通知對象列表
   */
  getEscalationChain(level) {
    const key = `level_${level}`;
    return this.config.escalation_chains[key] || this.config.escalation_chains.level_1 || [];
  }

  /**
   * 取得修復狀態
   * @param {object|null} playbook
   * @param {Array} actions
   * @returns {string}
   */
  getRemediationStatus(playbook, actions) {
    if (!playbook) return "pending_human";

    if (playbook.human_required) return "escalated";

    const allCompleted = actions.every((a) => a.status === "completed");
    if (playbook.auto_resolve && allCompleted) return "auto_resolved";

    return "pending_human";
  }

  /**
   * 檢查 SLA 合規性（基於告警年齡，非處理時間）
   * @param {object} alert
   * @param {number} responseTimeMs - 處理時間（備用）
   * @returns {string} "met" 或 "breached"
   */
  checkSLACompliance(alert, responseTimeMs) {
    const slaMinutes = alert.sla_response_minutes;
    if (!slaMinutes) return "met";

    let elapsedMinutes;
    if (alert.timestamp) {
      const alertTime = new Date(alert.timestamp).getTime();
      const now = Date.now();
      elapsedMinutes = (now - alertTime) / 60000;
    } else {
      elapsedMinutes = responseTimeMs / 60000;
    }

    return elapsedMinutes <= slaMinutes ? "met" : "breached";
  }

  /**
   * 生成事件報告
   * @param {object} alert
   * @param {Array} actions
   * @returns {object} 結構化報告
   */
  generateIncidentReport(alert, actions) {
    return {
      incident_id: `INC-${alert.alert_id}`,
      alert_summary: {
        alert_id: alert.alert_id,
        severity: alert.severity,
        category: alert.category,
        description: alert.description,
        triggered_by: alert.triggered_by,
      },
      response_summary: {
        total_actions: actions.length,
        completed: actions.filter((a) => a.status === "completed").length,
        failed: actions.filter((a) => a.status === "failed").length,
      },
      escalation: {
        level: alert.escalation_level,
        chain: this.getEscalationChain(alert.escalation_level),
      },
      timeline: actions.map((a, i) => ({
        step: i + 1,
        action: a.action,
        status: a.status,
      })),
    };
  }
}

module.exports = IncidentResponseHandler;
