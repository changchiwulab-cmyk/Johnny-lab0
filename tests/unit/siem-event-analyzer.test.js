"use strict";

const SIEMEventAnalyzer = require("../../agents/siem-event-analyzer");
const SIEMEventCollector = require("../../agents/siem-event-collector");

describe("SIEMEventAnalyzer", () => {
  let analyzer;
  let collector;
  let normalizedEvents;

  beforeAll(() => {
    collector = new SIEMEventCollector();
    const rawEvents = require("../fixtures/sample-security-events.json");
    const result = collector.collect(rawEvents);
    normalizedEvents = result.events;
  });

  beforeEach(() => {
    analyzer = new SIEMEventAnalyzer();
  });

  // ─── Constructor ────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("should initialize with correct name and version", () => {
      expect(analyzer.name).toBe("SIEMEventAnalyzer");
      expect(analyzer.version).toBe("1.0.0");
    });

    it("should load siem-rules-engine.json", () => {
      expect(analyzer.rules).toBeDefined();
      expect(analyzer.rules.detection_rules).toBeDefined();
      expect(analyzer.rules.severity_sla).toBeDefined();
    });
  });

  // ─── analyze() ──────────────────────────────────────────────────────────────

  describe("analyze()", () => {
    it("should throw if events is not an array", () => {
      expect(() => analyzer.analyze(null)).toThrow("events must be an array");
      expect(() => analyzer.analyze("string")).toThrow("events must be an array");
    });

    it("should handle empty array", () => {
      const result = analyzer.analyze([]);
      expect(result.metadata.total_events_analyzed).toBe(0);
      expect(result.alerts).toHaveLength(0);
    });

    it("should return all required result keys", () => {
      const result = analyzer.analyze(normalizedEvents);
      expect(result).toHaveProperty("metadata");
      expect(result).toHaveProperty("patterns");
      expect(result).toHaveProperty("anomalies");
      expect(result).toHaveProperty("correlations");
      expect(result).toHaveProperty("alerts");
    });

    it("should include analysis_time_ms in metadata", () => {
      const result = analyzer.analyze(normalizedEvents);
      expect(result.metadata.analysis_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── detectPatterns() ───────────────────────────────────────────────────────

  describe("detectPatterns()", () => {
    it("should detect secret_leak pattern when threshold met", () => {
      const events = [
        { event_id: "E1", timestamp: new Date().toISOString(), source: "trufflehog", severity: "CRITICAL", category: "secret_leak", payload: {}, enrichment: { threat_tags: [] } },
      ];
      const patterns = analyzer.detectPatterns(events);
      const secretPattern = patterns.find(p => p.rule_name === "secret_leak_detected");
      expect(secretPattern).toBeDefined();
    });

    it("should not trigger repeated_auth_failure below threshold", () => {
      const events = [
        { event_id: "E1", timestamp: new Date().toISOString(), source: "runtime", severity: "HIGH", category: "access_violation", payload: {}, enrichment: { threat_tags: [] } },
        { event_id: "E2", timestamp: new Date().toISOString(), source: "runtime", severity: "HIGH", category: "access_violation", payload: {}, enrichment: { threat_tags: [] } },
      ];
      const patterns = analyzer.detectPatterns(events);
      const authPattern = patterns.find(p => p.rule_name === "repeated_auth_failure");
      expect(authPattern).toBeUndefined();
    });

    it("should detect repeated_auth_failure at or above threshold", () => {
      const now = new Date();
      const events = Array.from({ length: 5 }, (_, i) => ({
        event_id: `E${i + 1}`,
        timestamp: new Date(now.getTime() + i * 60000).toISOString(),
        source: "runtime",
        severity: "HIGH",
        category: "access_violation",
        payload: {},
        enrichment: { threat_tags: [] },
      }));
      const patterns = analyzer.detectPatterns(events);
      const authPattern = patterns.find(p => p.rule_name === "repeated_auth_failure");
      expect(authPattern).toBeDefined();
      expect(authPattern.severity).toBe("HIGH");
    });

    it("should detect vulnerability_cluster with 3+ vulnerabilities", () => {
      const now = new Date();
      const events = Array.from({ length: 3 }, (_, i) => ({
        event_id: `V${i + 1}`,
        timestamp: new Date(now.getTime() + i * 600000).toISOString(),
        source: "npm-audit",
        severity: "HIGH",
        category: "vulnerability",
        payload: {},
        enrichment: { threat_tags: [] },
      }));
      const patterns = analyzer.detectPatterns(events);
      const clusterPattern = patterns.find(p => p.rule_name === "vulnerability_cluster");
      expect(clusterPattern).toBeDefined();
    });

    it("should return pattern with matched_events list", () => {
      const events = [
        { event_id: "S1", timestamp: new Date().toISOString(), source: "trufflehog", severity: "CRITICAL", category: "secret_leak", payload: {}, enrichment: { threat_tags: [] } },
      ];
      const patterns = analyzer.detectPatterns(events);
      expect(patterns[0].matched_events).toContain("S1");
    });
  });

  // ─── scoreAnomaly() ─────────────────────────────────────────────────────────

  describe("scoreAnomaly()", () => {
    it("should return 0-100 range", () => {
      const event = { event_id: "E1", severity: "CRITICAL", category: "secret_leak", enrichment: { threat_tags: ["urgent"] } };
      const score = analyzer.scoreAnomaly(event);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should score CRITICAL secret_leak at maximum (100)", () => {
      const event = { event_id: "E1", severity: "CRITICAL", category: "secret_leak", enrichment: { threat_tags: ["urgent"] } };
      const score = analyzer.scoreAnomaly(event);
      expect(score).toBe(100);
    });

    it("should score INFO anomaly lower than HIGH vulnerability", () => {
      const infoEvent = { event_id: "E1", severity: "INFO", category: "anomaly", enrichment: { threat_tags: [] } };
      const highEvent = { event_id: "E2", severity: "HIGH", category: "vulnerability", enrichment: { threat_tags: [] } };
      expect(analyzer.scoreAnomaly(infoEvent)).toBeLessThan(analyzer.scoreAnomaly(highEvent));
    });

    it("should give bonus score for urgent threat_tag", () => {
      const eventWithUrgent = { event_id: "E1", severity: "HIGH", category: "vulnerability", enrichment: { threat_tags: ["urgent"] } };
      const eventWithout = { event_id: "E2", severity: "HIGH", category: "vulnerability", enrichment: { threat_tags: [] } };
      expect(analyzer.scoreAnomaly(eventWithUrgent)).toBeGreaterThan(analyzer.scoreAnomaly(eventWithout));
    });

    it("should handle missing enrichment gracefully", () => {
      const event = { event_id: "E1", severity: "MEDIUM", category: "anomaly" };
      expect(() => analyzer.scoreAnomaly(event)).not.toThrow();
    });
  });

  // ─── correlateEvents() ──────────────────────────────────────────────────────

  describe("correlateEvents()", () => {
    it("should return empty array for single event", () => {
      const events = [{ event_id: "E1", timestamp: new Date().toISOString(), category: "vulnerability", severity: "HIGH" }];
      expect(analyzer.correlateEvents(events)).toHaveLength(0);
    });

    it("should correlate events of same category within time window", () => {
      const now = new Date();
      const events = [
        { event_id: "E1", timestamp: now.toISOString(), category: "vulnerability", severity: "HIGH" },
        { event_id: "E2", timestamp: new Date(now.getTime() + 5 * 60000).toISOString(), category: "vulnerability", severity: "HIGH" },
        { event_id: "E3", timestamp: new Date(now.getTime() + 10 * 60000).toISOString(), category: "vulnerability", severity: "HIGH" },
      ];
      const correlations = analyzer.correlateEvents(events);
      expect(correlations.length).toBeGreaterThan(0);
      const vulnCorr = correlations.find(c => c.category === "vulnerability");
      expect(vulnCorr).toBeDefined();
      expect(vulnCorr.event_count).toBeGreaterThanOrEqual(2);
    });

    it("should not correlate events of different categories", () => {
      const now = new Date();
      const events = [
        { event_id: "E1", timestamp: now.toISOString(), category: "vulnerability", severity: "HIGH" },
        { event_id: "E2", timestamp: now.toISOString(), category: "secret_leak", severity: "CRITICAL" },
      ];
      const correlations = analyzer.correlateEvents(events);
      const mixedCorr = correlations.find(c => c.category === "mixed");
      expect(mixedCorr).toBeUndefined();
    });

    it("should include event_ids in correlation", () => {
      const now = new Date();
      const events = [
        { event_id: "E1", timestamp: now.toISOString(), category: "access_violation", severity: "HIGH" },
        { event_id: "E2", timestamp: new Date(now.getTime() + 2 * 60000).toISOString(), category: "access_violation", severity: "HIGH" },
        { event_id: "E3", timestamp: new Date(now.getTime() + 4 * 60000).toISOString(), category: "access_violation", severity: "HIGH" },
      ];
      const correlations = analyzer.correlateEvents(events);
      const corr = correlations[0];
      expect(corr.event_ids).toContain("E1");
      expect(corr.event_ids).toContain("E2");
    });

    it("should calculate combined severity as highest in group", () => {
      const now = new Date();
      const events = [
        { event_id: "E1", timestamp: now.toISOString(), category: "vulnerability", severity: "LOW" },
        { event_id: "E2", timestamp: new Date(now.getTime() + 5 * 60000).toISOString(), category: "vulnerability", severity: "CRITICAL" },
        { event_id: "E3", timestamp: new Date(now.getTime() + 10 * 60000).toISOString(), category: "vulnerability", severity: "MEDIUM" },
      ];
      const correlations = analyzer.correlateEvents(events);
      if (correlations.length > 0) {
        expect(correlations[0].combined_severity).toBe("CRITICAL");
      }
    });
  });

  // ─── generateAlerts() ───────────────────────────────────────────────────────

  describe("generateAlerts()", () => {
    it("should generate alert for each pattern", () => {
      const patterns = [{
        rule_name: "secret_leak_detected",
        rule: { pattern: "secret_leak", description: "密鑰洩露" },
        matched_events: ["E1"],
        count: 1,
        severity: "CRITICAL",
      }];
      const alerts = analyzer.generateAlerts(patterns, [], []);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe("CRITICAL");
    });

    it("should assign correct escalation_level based on severity", () => {
      const patterns = [{
        rule_name: "secret_leak_detected",
        rule: { pattern: "secret_leak", description: "密鑰洩露" },
        matched_events: ["E1"],
        count: 1,
        severity: "CRITICAL",
      }];
      const alerts = analyzer.generateAlerts(patterns, [], []);
      expect(alerts[0].escalation_level).toBe(3);
    });

    it("should assign HIGH escalation_level 2", () => {
      const patterns = [{
        rule_name: "repeated_auth_failure",
        rule: { pattern: "access_violation", description: "認證失敗" },
        matched_events: ["E1", "E2", "E3", "E4", "E5"],
        count: 5,
        severity: "HIGH",
      }];
      const alerts = analyzer.generateAlerts(patterns, [], []);
      expect(alerts[0].escalation_level).toBe(2);
    });

    it("should generate alert for high-score anomaly", () => {
      const anomalies = [{
        event_id: "A1",
        anomaly_score: 90,
        category: "secret_leak",
        severity: "CRITICAL",
        reason: "密鑰洩露偵測 (分數: 90)",
      }];
      const alerts = analyzer.generateAlerts([], anomalies, []);
      expect(alerts.length).toBeGreaterThan(0);
    });

    it("should sort alerts by severity (CRITICAL first)", () => {
      const patterns = [
        {
          rule_name: "vulnerability_cluster",
          rule: { pattern: "vulnerability", description: "漏洞群集" },
          matched_events: ["V1", "V2", "V3"],
          count: 3,
          severity: "HIGH",
        },
        {
          rule_name: "secret_leak_detected",
          rule: { pattern: "secret_leak", description: "密鑰洩露" },
          matched_events: ["S1"],
          count: 1,
          severity: "CRITICAL",
        },
      ];
      const alerts = analyzer.generateAlerts(patterns, [], []);
      expect(alerts[0].severity).toBe("CRITICAL");
    });

    it("should include sla_response_minutes in alert", () => {
      const patterns = [{
        rule_name: "secret_leak_detected",
        rule: { pattern: "secret_leak", description: "密鑰洩露" },
        matched_events: ["E1"],
        count: 1,
        severity: "CRITICAL",
      }];
      const alerts = analyzer.generateAlerts(patterns, [], []);
      expect(alerts[0].sla_response_minutes).toBe(60);
    });
  });

  // ─── Full pipeline ───────────────────────────────────────────────────────────

  describe("full analyze pipeline with sample events", () => {
    it("should process normalized sample events without throwing", () => {
      expect(() => analyzer.analyze(normalizedEvents)).not.toThrow();
    });

    it("should detect alerts from sample events", () => {
      const result = analyzer.analyze(normalizedEvents);
      expect(result.alerts.length).toBeGreaterThan(0);
    });

    it("should have metadata counts consistent with results", () => {
      const result = analyzer.analyze(normalizedEvents);
      expect(result.metadata.patterns_detected).toBe(result.patterns.length);
      expect(result.metadata.anomalies_detected).toBe(result.anomalies.length);
      expect(result.metadata.correlations_found).toBe(result.correlations.length);
      expect(result.metadata.alerts_generated).toBe(result.alerts.length);
    });
  });
});
