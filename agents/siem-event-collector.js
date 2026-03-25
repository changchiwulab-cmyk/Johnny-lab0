/**
 * SIEM 事件收集器
 * 收集、正規化、豐富化安全事件，為分析層提供標準化資料
 */

const fs = require("fs");
const path = require("path");

class SIEMEventCollector {
  constructor() {
    this.name = "SIEMEventCollector";
    this.version = "1.0.0";

    const rulesPath = path.join(
      __dirname,
      "..",
      "tools",
      "siem-rules-engine.json",
    );
    this.rules = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
    this.eventCounter = 0;
  }

  /**
   * 主入口：批次收集並處理事件
   * @param {Array} rawEvents - 原始事件陣列
   * @returns {object} 處理結果含 metadata 與正規化事件
   */
  collect(rawEvents) {
    if (!Array.isArray(rawEvents)) {
      throw new Error("rawEvents must be an array");
    }

    const startTime = Date.now();
    const normalized = [];
    const rejected = [];

    for (const raw of rawEvents) {
      try {
        const event = this.normalizeEvent(raw);
        if (this.isRelevant(event)) {
          const enriched = this.enrichEvent(event);
          normalized.push(enriched);
        } else {
          rejected.push({
            reason: "filtered_by_relevance",
            event_id: event.event_id,
          });
        }
      } catch (err) {
        rejected.push({ reason: err.message, raw });
      }
    }

    return {
      metadata: {
        total_received: rawEvents.length,
        total_ingested: normalized.length,
        total_rejected: rejected.length,
        processing_time_ms: Date.now() - startTime,
        collector_version: this.version,
        timestamp: new Date().toISOString(),
      },
      events: normalized,
      rejected,
    };
  }

  /**
   * 正規化單一原始事件至標準 schema
   * @param {object} rawEvent
   * @returns {object} 正規化事件
   */
  normalizeEvent(rawEvent) {
    if (!rawEvent || typeof rawEvent !== "object") {
      throw new Error("Invalid event: must be a non-null object");
    }

    const eventId =
      rawEvent.event_id ||
      rawEvent.id ||
      `EVT-${String(++this.eventCounter).padStart(4, "0")}`;

    const timestamp =
      rawEvent.timestamp || rawEvent.created_at || new Date().toISOString();

    const source = this.resolveSource(rawEvent);
    const severity = this.resolveSeverity(rawEvent);
    const category = this.resolveCategory(rawEvent);

    return {
      event_id: eventId,
      timestamp,
      source,
      severity,
      category,
      payload: rawEvent.payload || rawEvent.details || {},
      raw: rawEvent,
    };
  }

  /**
   * 豐富化事件：加入資產分類與威脅標籤
   * @param {object} event - 正規化事件
   * @returns {object} 豐富化事件
   */
  enrichEvent(event) {
    const assetClass = this.classifyAsset(event);
    const threatTags = this.assignThreatTags(event);

    return {
      ...event,
      enrichment: {
        asset_class: assetClass,
        threat_tags: threatTags,
        enriched_at: new Date().toISOString(),
      },
    };
  }

  /**
   * 檢查事件是否符合相關性（非噪音）
   * @param {object} event - 正規化事件
   * @returns {boolean}
   */
  isRelevant(event) {
    const { blacklist_patterns } = this.rules.noise_filters;

    const eventStr = JSON.stringify(event).toLowerCase();
    for (const pattern of blacklist_patterns) {
      if (eventStr.includes(pattern.toLowerCase())) {
        return false;
      }
    }

    return true;
  }

  /**
   * 解析事件來源
   */
  resolveSource(rawEvent) {
    if (rawEvent.source) return rawEvent.source;
    if (rawEvent.tool) return rawEvent.tool;
    if (rawEvent.scanner) return rawEvent.scanner;
    return "unknown";
  }

  /**
   * 解析嚴重等級
   */
  resolveSeverity(rawEvent) {
    const validLevels = this.rules.severity_levels;
    const raw =
      rawEvent.severity || rawEvent.level || rawEvent.priority || "INFO";
    const upper = String(raw).toUpperCase();

    if (validLevels.includes(upper)) return upper;

    const mapping = {
      critical: "CRITICAL",
      high: "HIGH",
      moderate: "MEDIUM",
      medium: "MEDIUM",
      low: "LOW",
      info: "INFO",
      informational: "INFO",
      warning: "MEDIUM",
      error: "HIGH",
    };

    return mapping[String(raw).toLowerCase()] || "INFO";
  }

  /**
   * 解析事件分類
   */
  resolveCategory(rawEvent) {
    const validCategories = this.rules.event_categories;
    if (rawEvent.category && validCategories.includes(rawEvent.category)) {
      return rawEvent.category;
    }

    if (rawEvent.type) {
      const typeLower = String(rawEvent.type).toLowerCase();

      if (validCategories.includes(typeLower)) {
        return typeLower;
      }

      const typeMap = {
        vuln: "vulnerability",
        auth_failure: "access_violation",
        access: "access_violation",
        unauthorized: "access_violation",
        suspicious: "anomaly",
        secret: "secret_leak",
        leak: "secret_leak",
        policy: "policy_breach",
        compliance: "policy_breach",
      };
      const mapped = typeMap[typeLower];
      if (mapped) return mapped;
    }

    return "anomaly";
  }

  /**
   * 資產分類
   */
  classifyAsset(event) {
    const source = event.source.toLowerCase();
    if (source.includes("npm") || source.includes("snyk")) {
      return "dependency";
    }
    if (source.includes("codeql") || source.includes("sast")) {
      return "source_code";
    }
    if (source.includes("runtime") || source.includes("monitor")) {
      return "runtime";
    }
    if (source.includes("trufflehog") || source.includes("secret")) {
      return "credentials";
    }
    return "general";
  }

  /**
   * 指派威脅標籤
   */
  assignThreatTags(event) {
    const tags = [];
    const category = event.category;
    const severity = event.severity;

    if (category === "secret_leak") {
      tags.push("credential-exposure", "data-leak");
    }
    if (category === "vulnerability") {
      tags.push("software-vulnerability");
      if (severity === "CRITICAL" || severity === "HIGH") {
        tags.push("exploitable");
      }
    }
    if (category === "access_violation") {
      tags.push("unauthorized-access");
    }
    if (category === "anomaly") {
      tags.push("behavioral-anomaly");
    }
    if (category === "policy_breach") {
      tags.push("compliance-violation");
    }
    if (severity === "CRITICAL") {
      tags.push("urgent");
    }

    return tags;
  }
}

module.exports = SIEMEventCollector;
