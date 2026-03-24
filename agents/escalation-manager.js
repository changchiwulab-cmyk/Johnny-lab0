/**
 * 異常上報管理器
 * 根據異常類型和嚴重程度，透過 DAG 路由決定上報對象和層級
 */

const OwnerAssignmentDAG = require("./owner-assignment-dag");

class EscalationManager {
  constructor(config) {
    try {
      this.dag = new OwnerAssignmentDAG(config);
    } catch {
      this.dag = null;
    }
    this.history = [];
    this.nextId = 1;
  }

  /**
   * 根據異常觸發上報
   * @param {Object} issue
   * @param {string} issue.type - 異常類型
   * @param {string} issue.severity - 嚴重程度 (CRITICAL, HIGH, MEDIUM, LOW)
   * @param {string} issue.source - 來源代理或模組
   * @param {Object} issue.details - 詳細資訊
   * @returns {Object} 上報結果
   */
  escalate(issue) {
    if (!issue || !issue.type) {
      throw new Error("issue.type 為必填");
    }

    const level = this.determineLevel(issue.severity);
    const assignedTo = this.resolveAssignees(level, issue);
    const deadline = this.calculateDeadline(level);

    const escalation = {
      escalationId: `ESC-${String(this.nextId).padStart(4, "0")}`,
      level,
      type: issue.type,
      severity: issue.severity || "MEDIUM",
      source: issue.source || "unknown",
      assignedTo,
      deadline,
      actions: this.generateActions(level, issue),
      status: "open",
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      resolution: null,
    };

    this.nextId++;
    this.history.push(escalation);

    return escalation;
  }

  /**
   * 決定上報層級
   * L1: Contract Manager（低風險）
   * L2: Senior Legal Counsel / Legal Team Lead（高風險、合規問題）
   * L3: Executive（CRITICAL 合規、多個未解決高風險）
   */
  determineLevel(severity) {
    switch ((severity || "").toUpperCase()) {
      case "CRITICAL":
        return "L3";
      case "HIGH":
        return "L2";
      case "MEDIUM":
        return "L1";
      case "LOW":
        return "L1";
      default:
        return "L1";
    }
  }

  /**
   * 透過 DAG 解析上報負責人
   */
  resolveAssignees(level, issue) {
    // 先嘗試用 DAG 解析
    if (this.dag) {
      try {
        const context = {
          highSeverityCount:
            issue.severity === "HIGH" || issue.severity === "CRITICAL" ? 2 : 0,
          criticalComplianceCount: issue.severity === "CRITICAL" ? 1 : 0,
          totalRisks: issue.details?.totalRisks || 0,
          contractType: issue.details?.contractType || "Default",
        };

        const assignments = this.dag.resolveOwners(context);

        // 根據層級選擇對應的 DAG 節點
        if (level === "L3" && assignments.phase_3_final_review) {
          return assignments.phase_3_final_review;
        }
        if (level === "L2" && assignments.phase_1_immediate) {
          return assignments.phase_1_immediate;
        }
        if (level === "L1" && assignments.phase_2_negotiation) {
          return assignments.phase_2_negotiation;
        }
      } catch {
        // fallback to defaults
      }
    }

    // 預設分配
    return this.getDefaultAssignees(level);
  }

  getDefaultAssignees(level) {
    switch (level) {
      case "L3":
        return ["Legal Team Lead", "Executive"];
      case "L2":
        return ["Senior Legal Counsel", "Legal Team Lead"];
      case "L1":
        return ["Contract Manager"];
      default:
        return ["Contract Manager"];
    }
  }

  /**
   * 計算上報截止時間
   */
  calculateDeadline(level) {
    const now = new Date();
    switch (level) {
      case "L3":
        now.setHours(now.getHours() + 4);
        break;
      case "L2":
        now.setHours(now.getHours() + 24);
        break;
      case "L1":
        now.setHours(now.getHours() + 48);
        break;
      default:
        now.setHours(now.getHours() + 48);
    }
    return now.toISOString();
  }

  /**
   * 生成上報行動項
   */
  generateActions(level, issue) {
    const baseActions = [
      `審查異常: ${issue.type}`,
      "評估影響範圍",
    ];

    if (level === "L3") {
      return [
        ...baseActions,
        "召開緊急會議",
        "通知相關利益方",
        "制定應急方案",
        "在 4 小時內做出決策",
      ];
    }

    if (level === "L2") {
      return [
        ...baseActions,
        "進行詳細分析",
        "準備處理方案",
        "在 24 小時內回報",
      ];
    }

    return [
      ...baseActions,
      "記錄處理過程",
      "在 48 小時內完成處理",
    ];
  }

  /**
   * 取得上報歷史
   */
  getEscalationHistory() {
    return [...this.history];
  }

  /**
   * 取得未解決的上報
   */
  getOpenEscalations() {
    return this.history.filter((e) => e.status === "open");
  }

  /**
   * 記錄上報解決結果
   * @param {string} escalationId
   * @param {Object} resolution - { action, notes, resolvedBy }
   */
  recordResolution(escalationId, resolution) {
    const escalation = this.history.find(
      (e) => e.escalationId === escalationId,
    );
    if (!escalation) {
      throw new Error(`找不到上報記錄: ${escalationId}`);
    }
    if (escalation.status === "resolved") {
      throw new Error(`上報已解決: ${escalationId}`);
    }

    escalation.status = "resolved";
    escalation.resolvedAt = new Date().toISOString();
    escalation.resolution = {
      action: resolution.action || "resolved",
      notes: resolution.notes || "",
      resolvedBy: resolution.resolvedBy || "unknown",
    };

    return escalation;
  }

  /**
   * 取得上報統計
   */
  getStats() {
    const total = this.history.length;
    const open = this.history.filter((e) => e.status === "open").length;
    const resolved = this.history.filter((e) => e.status === "resolved").length;
    const byLevel = { L1: 0, L2: 0, L3: 0 };
    this.history.forEach((e) => {
      byLevel[e.level] = (byLevel[e.level] || 0) + 1;
    });

    return { total, open, resolved, byLevel };
  }
}

module.exports = EscalationManager;
