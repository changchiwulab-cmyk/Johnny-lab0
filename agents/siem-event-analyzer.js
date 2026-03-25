/**
 * SIEM 事件分析器
 * 模式偵測、異常評分、事件關聯分析，產生告警
 */

const fs = require("fs");
const path = require("path");

class SIEMEventAnalyzer {
  constructor() {
    this.name = "SIEMEventAnalyzer";
    this.version = "1.0.0";

    const rulesPath = path.join(
      __dirname,
      "..",
      "tools",
      "siem-rules-engine.json",
    );
    this.rules = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
    this.alertCounter = 0;
  }

  /**
   * 主入口：分析事件集合
   * @param {Array} events - 正規化且豐富化的事件陣列
   * @returns {object} 分析結果
   */
  analyze(events) {
    if (!Array.isArray(events)) {
      throw new Error("events must be an array");
    }

    const startTime = Date.now();
    const patterns = this.detectPatterns(events);
    const anomalies = this.detectAnomalies(events);
    const correlations = this.correlateEvents(events);
    const alerts = this.generateAlerts(patterns, anomalies, correlations);

    return {
      metadata: {
        total_events_analyzed: events.length,
        patterns_detected: patterns.length,
        anomalies_detected: anomalies.length,
        correlations_found: correlations.length,
        alerts_generated: alerts.length,
        analysis_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      patterns,
      anomalies,
      correlations,
      alerts,
    };
  }

  /**
   * 偵測匹配規則的模式
   * @param {Array} events
   * @returns {Array} 偵測到的模式
   */
  detectPatterns(events) {
    const detected = [];
    const ruleEntries = Object.entries(this.rules.detection_rules);

    for (const [ruleName, rule] of ruleEntries) {
      const matching = events.filter((e) => {
        if (rule.source_filter && e.source !== rule.source_filter) return false;
        return e.category === rule.pattern;
      });

      if (matching.length >= rule.threshold) {
        if (rule.window_minutes !== null && rule.window_minutes !== undefined) {
          const withinWindow = this.filterByTimeWindow(
            matching,
            rule.window_minutes,
          );
          if (withinWindow.length >= rule.threshold) {
            detected.push({
              rule_name: ruleName,
              rule,
              matched_events: withinWindow.map((e) => e.event_id),
              count: withinWindow.length,
              severity: rule.severity,
            });
          }
        } else {
          detected.push({
            rule_name: ruleName,
            rule,
            matched_events: matching.map((e) => e.event_id),
            count: matching.length,
            severity: rule.severity,
          });
        }
      }
    }

    return detected;
  }

  /**
   * 偵測異常事件
   * @param {Array} events
   * @returns {Array} 異常事件及其分數
   */
  detectAnomalies(events) {
    const anomalies = [];

    for (const event of events) {
      const score = this.scoreAnomaly(event);
      const minScore =
        this.rules.detection_rules.anomalous_behavior?.anomaly_score_min || 75;

      if (score >= minScore) {
        anomalies.push({
          event_id: event.event_id,
          anomaly_score: score,
          category: event.category,
          severity: event.severity,
          reason: this.getAnomalyReason(event, score),
        });
      }
    }

    return anomalies;
  }

  /**
   * 計算事件的異常分數 (0-100)
   * @param {object} event
   * @returns {number} 異常分數
   */
  scoreAnomaly(event) {
    let score = 0;

    const severityScores = {
      CRITICAL: 40,
      HIGH: 30,
      MEDIUM: 15,
      LOW: 5,
      INFO: 0,
    };
    score += severityScores[event.severity] || 0;

    const categoryScores = {
      secret_leak: 40,
      access_violation: 30,
      vulnerability: 20,
      policy_breach: 15,
      anomaly: 25,
    };
    score += categoryScores[event.category] || 0;

    if (
      event.enrichment &&
      event.enrichment.threat_tags &&
      event.enrichment.threat_tags.includes("urgent")
    ) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  /**
   * 關聯分析：按時間窗口和分類分組相關事件
   * @param {Array} events
   * @returns {Array} 關聯組
   */
  correlateEvents(events) {
    if (events.length < 2) return [];

    const correlations = [];
    const windowMinutes = 30;

    const byCategory = {};
    for (const event of events) {
      const key = event.category;
      if (!byCategory[key]) byCategory[key] = [];
      byCategory[key].push(event);
    }

    for (const [category, group] of Object.entries(byCategory)) {
      if (group.length < 2) continue;

      const withinWindow = this.filterByTimeWindow(group, windowMinutes);
      if (withinWindow.length >= 2) {
        correlations.push({
          correlation_id: `CORR-${category}-${withinWindow.length}`,
          category,
          event_count: withinWindow.length,
          event_ids: withinWindow.map((e) => e.event_id),
          time_span_minutes: this.calculateTimeSpan(withinWindow),
          combined_severity: this.combineSeverity(withinWindow),
        });
      }
    }

    return correlations;
  }

  /**
   * 基於偵測結果產生告警
   * @param {Array} patterns
   * @param {Array} anomalies
   * @param {Array} correlations
   * @returns {Array} 告警列表
   */
  generateAlerts(patterns, anomalies, correlations) {
    const alerts = [];

    for (const pattern of patterns) {
      const sla = this.rules.severity_sla[pattern.severity] || {};
      alerts.push({
        alert_id: `ALERT-${String(++this.alertCounter).padStart(4, "0")}`,
        type: "pattern_match",
        triggered_by: pattern.matched_events,
        rule_name: pattern.rule_name,
        severity: pattern.severity,
        category: pattern.rule.pattern,
        description: pattern.rule.description,
        recommended_action: this.getRecommendedAction(
          pattern.rule.pattern,
          pattern.severity,
        ),
        escalation_level: sla.escalation_level || 1,
        sla_response_minutes: sla.response_minutes || 1440,
        timestamp: new Date().toISOString(),
      });
    }

    for (const anomaly of anomalies) {
      const sla = this.rules.severity_sla[anomaly.severity] || {};
      alerts.push({
        alert_id: `ALERT-${String(++this.alertCounter).padStart(4, "0")}`,
        type: "anomaly",
        triggered_by: [anomaly.event_id],
        severity: anomaly.severity,
        category: anomaly.category,
        description: anomaly.reason,
        anomaly_score: anomaly.anomaly_score,
        recommended_action: "review",
        escalation_level: sla.escalation_level || 1,
        sla_response_minutes: sla.response_minutes || 1440,
        timestamp: new Date().toISOString(),
      });
    }

    for (const corr of correlations) {
      if (corr.event_count >= 3) {
        const sla = this.rules.severity_sla[corr.combined_severity] || {};
        alerts.push({
          alert_id: `ALERT-${String(++this.alertCounter).padStart(4, "0")}`,
          type: "correlation",
          triggered_by: corr.event_ids,
          severity: corr.combined_severity,
          category: corr.category,
          description: `關聯偵測：${corr.event_count} 個 ${corr.category} 事件在 ${corr.time_span_minutes} 分鐘內發生`,
          recommended_action: this.getRecommendedAction(
            corr.category,
            corr.combined_severity,
          ),
          escalation_level: sla.escalation_level || 1,
          sla_response_minutes: sla.response_minutes || 1440,
          timestamp: new Date().toISOString(),
        });
      }
    }

    alerts.sort((a, b) => {
      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    });

    return alerts;
  }

  /**
   * 取得推薦操作
   */
  getRecommendedAction(category, severity) {
    if (category === "secret_leak") return "isolate";
    if (severity === "CRITICAL") return "isolate";
    if (category === "vulnerability" && severity === "HIGH") return "patch";
    if (category === "access_violation") return "block";
    return "review";
  }

  /**
   * 取得異常原因描述
   */
  getAnomalyReason(event, score) {
    if (event.category === "secret_leak") {
      return `密鑰洩露偵測 (分數: ${score})`;
    }
    if (event.severity === "CRITICAL") {
      return `嚴重等級事件異常 (分數: ${score})`;
    }
    if (event.category === "access_violation") {
      return `訪問違規異常 (分數: ${score})`;
    }
    return `行為異常偵測 (分數: ${score})`;
  }

  /**
   * 按時間窗口篩選事件
   */
  filterByTimeWindow(events, windowMinutes) {
    if (events.length === 0) return [];

    const sorted = [...events].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
    );

    let bestGroup = [];
    for (let i = 0; i < sorted.length; i++) {
      const windowStart = new Date(sorted[i].timestamp);
      const windowEnd = new Date(
        windowStart.getTime() + windowMinutes * 60 * 1000,
      );
      const group = sorted.filter((e) => {
        const t = new Date(e.timestamp);
        return t >= windowStart && t <= windowEnd;
      });
      if (group.length > bestGroup.length) {
        bestGroup = group;
      }
    }

    return bestGroup;
  }

  /**
   * 計算事件時間跨度（分鐘）
   */
  calculateTimeSpan(events) {
    if (events.length < 2) return 0;
    const times = events.map((e) => new Date(e.timestamp).getTime());
    return Math.round((Math.max(...times) - Math.min(...times)) / 60000);
  }

  /**
   * 合併多事件的嚴重等級（取最高）
   */
  combineSeverity(events) {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
    let highest = "INFO";
    for (const e of events) {
      if ((order[e.severity] ?? 4) < (order[highest] ?? 4)) {
        highest = e.severity;
      }
    }
    return highest;
  }
}

module.exports = SIEMEventAnalyzer;
