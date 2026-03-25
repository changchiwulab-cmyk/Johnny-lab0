"use strict";

const SecurityOrchestrator = require("../../agents/security-orchestrator");

describe("SecurityOrchestrator (Integration)", () => {
  let orchestrator;
  let sampleEvents;

  beforeAll(() => {
    orchestrator = new SecurityOrchestrator();
    sampleEvents = require("../fixtures/sample-security-events.json");
  });

  // ─── Constructor ────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("should initialize with correct name and version", () => {
      expect(orchestrator.name).toBe("SecurityOrchestrator");
      expect(orchestrator.version).toBe("1.0.0");
    });

    it("should instantiate all three sub-agents", () => {
      expect(orchestrator.agents.collector).toBeDefined();
      expect(orchestrator.agents.analyzer).toBeDefined();
      expect(orchestrator.agents.responder).toBeDefined();
    });

    it("should have collector with collect() method", () => {
      expect(typeof orchestrator.agents.collector.collect).toBe("function");
    });

    it("should have analyzer with analyze() method", () => {
      expect(typeof orchestrator.agents.analyzer.analyze).toBe("function");
    });

    it("should have responder with respond() method", () => {
      expect(typeof orchestrator.agents.responder.respond).toBe("function");
    });
  });

  // ─── validateInput() ─────────────────────────────────────────────────────────

  describe("validateInput()", () => {
    it("should throw if eventSources is not an array", () => {
      expect(() => orchestrator.validateInput(null)).toThrow("eventSources must be an array");
      expect(() => orchestrator.validateInput("string")).toThrow("eventSources must be an array");
    });

    it("should throw if eventSources is empty", () => {
      expect(() => orchestrator.validateInput([])).toThrow("eventSources cannot be empty");
    });

    it("should throw if any event is not an object", () => {
      expect(() => orchestrator.validateInput([null])).toThrow();
      expect(() => orchestrator.validateInput(["string"])).toThrow();
    });

    it("should not throw for valid event array", () => {
      expect(() => orchestrator.validateInput([{ source: "test" }])).not.toThrow();
    });
  });

  // ─── Full orchestration pipeline ─────────────────────────────────────────────

  describe("orchestrate() full pipeline", () => {
    let result;

    beforeAll(async () => {
      result = await orchestrator.orchestrate(sampleEvents, { writeReport: false });
    });

    it("should complete without throwing", () => {
      expect(result).toBeDefined();
    });

    it("should return all required top-level keys", () => {
      expect(result).toHaveProperty("metadata");
      expect(result).toHaveProperty("collection");
      expect(result).toHaveProperty("analysis");
      expect(result).toHaveProperty("response");
      expect(result).toHaveProperty("report");
      expect(result).toHaveProperty("metrics");
    });

    it("should have valid metadata", () => {
      expect(result.metadata.workflow).toBe("security-siem-response");
      expect(result.metadata.total_time_ms).toBeGreaterThan(0);
      expect(result.metadata.timestamp).toBeDefined();
    });

    it("should process events through collection stage", () => {
      expect(result.collection.metadata.total_received).toBe(sampleEvents.length);
      expect(result.collection.metadata.total_ingested).toBeGreaterThan(0);
    });

    it("should filter out noise events (heartbeat, debug_log)", () => {
      const noiseCount = sampleEvents.filter(e =>
        JSON.stringify(e).toLowerCase().includes("heartbeat") ||
        JSON.stringify(e).toLowerCase().includes("debug_log")
      ).length;
      expect(result.collection.metadata.total_rejected).toBeGreaterThanOrEqual(noiseCount);
    });

    it("should generate alerts from analysis stage", () => {
      expect(result.analysis.metadata.alerts_generated).toBeGreaterThan(0);
      expect(result.analysis.alerts.length).toBeGreaterThan(0);
    });

    it("should detect secret_leak pattern", () => {
      const secretAlert = result.analysis.alerts.find(a => a.category === "secret_leak");
      expect(secretAlert).toBeDefined();
    });

    it("should respond to all generated alerts", () => {
      expect(result.response.metadata.responded).toBe(result.analysis.metadata.alerts_generated);
    });

    it("should generate a Markdown report string", () => {
      expect(typeof result.report).toBe("string");
      expect(result.report).toContain("安全事件報告");
      expect(result.report).toContain("概要");
    });

    it("should include alert details in report", () => {
      expect(result.report).toContain("告警詳情");
    });

    it("should include response summary in report", () => {
      expect(result.report).toContain("響應摘要");
    });
  });

  // ─── getMetricsDashboard() ───────────────────────────────────────────────────

  describe("getMetricsDashboard()", () => {
    it("should return targets and actual metrics", async () => {
      const result = await orchestrator.orchestrate(sampleEvents, { writeReport: false });
      const { metrics } = result;
      expect(metrics).toHaveProperty("targets");
      expect(metrics).toHaveProperty("actual");
    });

    it("should include SLA compliance rate", async () => {
      const result = await orchestrator.orchestrate(sampleEvents, { writeReport: false });
      expect(result.metrics.actual.sla_compliance_rate).toBeGreaterThanOrEqual(0);
      expect(result.metrics.actual.sla_compliance_rate).toBeLessThanOrEqual(100);
    });

    it("should include target values from config", async () => {
      const result = await orchestrator.orchestrate(sampleEvents, { writeReport: false });
      expect(result.metrics.targets.detection_time_seconds).toBe(60);
      expect(result.metrics.targets.high_severity_response_hours).toBe(4);
      expect(result.metrics.targets.coverage_percent).toBe(95);
      expect(result.metrics.targets.zero_day_leaks).toBe(0);
    });
  });

  // ─── Error handling ──────────────────────────────────────────────────────────

  describe("error handling", () => {
    it("should throw for invalid input (null)", async () => {
      await expect(orchestrator.orchestrate(null)).rejects.toThrow();
    });

    it("should throw for empty event array", async () => {
      await expect(orchestrator.orchestrate([])).rejects.toThrow("eventSources cannot be empty");
    });

    it("should throw for non-object events", async () => {
      await expect(orchestrator.orchestrate(["invalid"])).rejects.toThrow();
    });
  });
});
