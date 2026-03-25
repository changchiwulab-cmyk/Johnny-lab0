"use strict";

const SIEMEventCollector = require("../../agents/siem-event-collector");

describe("SIEMEventCollector", () => {
  let collector;

  beforeEach(() => {
    collector = new SIEMEventCollector();
  });

  // ─── Constructor ────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("should initialize with correct name and version", () => {
      expect(collector.name).toBe("SIEMEventCollector");
      expect(collector.version).toBe("1.0.0");
    });

    it("should load siem-rules-engine.json", () => {
      expect(collector.rules).toBeDefined();
      expect(collector.rules.detection_rules).toBeDefined();
      expect(collector.rules.severity_sla).toBeDefined();
      expect(collector.rules.noise_filters).toBeDefined();
    });

    it("should initialize eventCounter to 0", () => {
      expect(collector.eventCounter).toBe(0);
    });
  });

  // ─── collect() ──────────────────────────────────────────────────────────────

  describe("collect()", () => {
    it("should throw if rawEvents is not an array", () => {
      expect(() => collector.collect(null)).toThrow("rawEvents must be an array");
      expect(() => collector.collect({})).toThrow("rawEvents must be an array");
      expect(() => collector.collect("string")).toThrow("rawEvents must be an array");
    });

    it("should handle empty array", () => {
      const result = collector.collect([]);
      expect(result.metadata.total_received).toBe(0);
      expect(result.metadata.total_ingested).toBe(0);
      expect(result.events).toHaveLength(0);
    });

    it("should return metadata with correct counts", () => {
      const events = [
        { source: "npm-audit", severity: "HIGH", category: "vulnerability" },
        { source: "runtime", severity: "LOW", category: "anomaly", payload: { type: "heartbeat" } },
      ];
      const result = collector.collect(events);
      expect(result.metadata.total_received).toBe(2);
      expect(result.metadata.total_ingested + result.metadata.total_rejected).toBe(2);
    });

    it("should include processing_time_ms in metadata", () => {
      const result = collector.collect([]);
      expect(result.metadata.processing_time_ms).toBeGreaterThanOrEqual(0);
    });

    it("should filter heartbeat events as noise", () => {
      const events = [
        { source: "runtime", severity: "INFO", category: "anomaly", payload: { type: "heartbeat" } },
      ];
      const result = collector.collect(events);
      expect(result.metadata.total_ingested).toBe(0);
      expect(result.metadata.total_rejected).toBe(1);
    });
  });

  // ─── normalizeEvent() ───────────────────────────────────────────────────────

  describe("normalizeEvent()", () => {
    it("should throw on null input", () => {
      expect(() => collector.normalizeEvent(null)).toThrow("Invalid event");
    });

    it("should throw on non-object input", () => {
      expect(() => collector.normalizeEvent("string")).toThrow("Invalid event");
      expect(() => collector.normalizeEvent(42)).toThrow("Invalid event");
    });

    it("should preserve existing event_id", () => {
      const raw = { event_id: "MY-ID-001", source: "npm-audit", severity: "HIGH", category: "vulnerability" };
      const result = collector.normalizeEvent(raw);
      expect(result.event_id).toBe("MY-ID-001");
    });

    it("should auto-generate event_id if missing", () => {
      const raw = { source: "codeql", severity: "MEDIUM", category: "vulnerability" };
      const result = collector.normalizeEvent(raw);
      expect(result.event_id).toMatch(/^EVT-\d{4}$/);
    });

    it("should map all required fields to standard schema", () => {
      const raw = { source: "npm-audit", severity: "HIGH", category: "vulnerability", payload: { pkg: "test" } };
      const result = collector.normalizeEvent(raw);
      expect(result).toHaveProperty("event_id");
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("source");
      expect(result).toHaveProperty("severity");
      expect(result).toHaveProperty("category");
      expect(result).toHaveProperty("payload");
      expect(result).toHaveProperty("raw");
    });

    it("should normalize 'moderate' severity to MEDIUM", () => {
      const raw = { source: "snyk", severity: "moderate", category: "vulnerability" };
      const result = collector.normalizeEvent(raw);
      expect(result.severity).toBe("MEDIUM");
    });

    it("should normalize 'warning' severity to MEDIUM", () => {
      const raw = { source: "runtime", severity: "warning", category: "anomaly" };
      const result = collector.normalizeEvent(raw);
      expect(result.severity).toBe("MEDIUM");
    });

    it("should normalize 'error' severity to HIGH", () => {
      const raw = { source: "runtime", severity: "error", category: "anomaly" };
      const result = collector.normalizeEvent(raw);
      expect(result.severity).toBe("HIGH");
    });

    it("should default severity to INFO if unknown", () => {
      const raw = { source: "unknown", severity: "banana", category: "anomaly" };
      const result = collector.normalizeEvent(raw);
      expect(result.severity).toBe("INFO");
    });

    it("should map 'auth_failure' type to access_violation category", () => {
      const raw = { source: "runtime", severity: "HIGH", type: "auth_failure" };
      const result = collector.normalizeEvent(raw);
      expect(result.category).toBe("access_violation");
    });

    it("should map 'secret' type to secret_leak category", () => {
      const raw = { source: "trufflehog", severity: "CRITICAL", type: "secret" };
      const result = collector.normalizeEvent(raw);
      expect(result.category).toBe("secret_leak");
    });

    it("should default category to anomaly if unknown", () => {
      const raw = { source: "unknown", severity: "LOW", type: "foo_bar" };
      const result = collector.normalizeEvent(raw);
      expect(result.category).toBe("anomaly");
    });

    it("should preserve payload", () => {
      const raw = { source: "npm-audit", severity: "HIGH", category: "vulnerability", payload: { pkg: "lodash", cve: "CVE-2021" } };
      const result = collector.normalizeEvent(raw);
      expect(result.payload).toEqual({ pkg: "lodash", cve: "CVE-2021" });
    });

    it("should default payload to empty object if missing", () => {
      const raw = { source: "runtime", severity: "LOW", category: "anomaly" };
      const result = collector.normalizeEvent(raw);
      expect(result.payload).toEqual({});
    });
  });

  // ─── enrichEvent() ──────────────────────────────────────────────────────────

  describe("enrichEvent()", () => {
    it("should add enrichment property", () => {
      const event = { event_id: "E1", source: "npm-audit", severity: "HIGH", category: "vulnerability", payload: {}, timestamp: new Date().toISOString() };
      const result = collector.enrichEvent(event);
      expect(result.enrichment).toBeDefined();
      expect(result.enrichment.asset_class).toBeDefined();
      expect(result.enrichment.threat_tags).toBeInstanceOf(Array);
    });

    it("should classify npm-audit source as dependency", () => {
      const event = { event_id: "E1", source: "npm-audit", severity: "HIGH", category: "vulnerability", payload: {}, timestamp: new Date().toISOString() };
      const result = collector.enrichEvent(event);
      expect(result.enrichment.asset_class).toBe("dependency");
    });

    it("should classify codeql source as source_code", () => {
      const event = { event_id: "E1", source: "codeql", severity: "MEDIUM", category: "vulnerability", payload: {}, timestamp: new Date().toISOString() };
      const result = collector.enrichEvent(event);
      expect(result.enrichment.asset_class).toBe("source_code");
    });

    it("should classify trufflehog source as credentials", () => {
      const event = { event_id: "E1", source: "trufflehog", severity: "CRITICAL", category: "secret_leak", payload: {}, timestamp: new Date().toISOString() };
      const result = collector.enrichEvent(event);
      expect(result.enrichment.asset_class).toBe("credentials");
    });

    it("should add credential-exposure tag for secret_leak", () => {
      const event = { event_id: "E1", source: "trufflehog", severity: "CRITICAL", category: "secret_leak", payload: {}, timestamp: new Date().toISOString() };
      const result = collector.enrichEvent(event);
      expect(result.enrichment.threat_tags).toContain("credential-exposure");
    });

    it("should add urgent tag for CRITICAL severity", () => {
      const event = { event_id: "E1", source: "npm-audit", severity: "CRITICAL", category: "vulnerability", payload: {}, timestamp: new Date().toISOString() };
      const result = collector.enrichEvent(event);
      expect(result.enrichment.threat_tags).toContain("urgent");
    });

    it("should add unauthorized-access tag for access_violation", () => {
      const event = { event_id: "E1", source: "runtime", severity: "HIGH", category: "access_violation", payload: {}, timestamp: new Date().toISOString() };
      const result = collector.enrichEvent(event);
      expect(result.enrichment.threat_tags).toContain("unauthorized-access");
    });
  });

  // ─── isRelevant() ───────────────────────────────────────────────────────────

  describe("isRelevant()", () => {
    it("should return true for non-noise events", () => {
      const event = { event_id: "E1", source: "npm-audit", severity: "HIGH", category: "vulnerability", payload: {} };
      expect(collector.isRelevant(event)).toBe(true);
    });

    it("should return false for events matching blacklist pattern 'heartbeat'", () => {
      const event = { event_id: "E1", source: "runtime", severity: "INFO", category: "anomaly", payload: { type: "heartbeat" } };
      expect(collector.isRelevant(event)).toBe(false);
    });

    it("should return false for events matching blacklist pattern 'health_check'", () => {
      const event = { event_id: "E1", source: "runtime", severity: "INFO", category: "anomaly", payload: { type: "health_check" } };
      expect(collector.isRelevant(event)).toBe(false);
    });

    it("should return false for events matching blacklist pattern 'debug_log'", () => {
      const event = { event_id: "E1", source: "runtime", severity: "INFO", category: "anomaly", payload: { type: "debug_log" } };
      expect(collector.isRelevant(event)).toBe(false);
    });
  });

  // ─── Full pipeline integration ───────────────────────────────────────────────

  describe("full collect pipeline", () => {
    it("should process real sample events correctly", () => {
      const events = require("../fixtures/sample-security-events.json");
      const result = collector.collect(events);
      expect(result.metadata.total_received).toBe(events.length);
      expect(result.metadata.total_ingested).toBeGreaterThan(0);
      expect(result.events.length).toBe(result.metadata.total_ingested);
    });

    it("should enrich all processed events", () => {
      const events = [
        { source: "npm-audit", severity: "HIGH", category: "vulnerability" },
        { source: "codeql", severity: "MEDIUM", category: "vulnerability" },
      ];
      const result = collector.collect(events);
      for (const event of result.events) {
        expect(event.enrichment).toBeDefined();
        expect(event.enrichment.threat_tags).toBeInstanceOf(Array);
      }
    });
  });
});
