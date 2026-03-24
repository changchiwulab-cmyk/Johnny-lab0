const fs = require("fs");
const path = require("path");
const os = require("os");
const AgentTrustMetrics = require("../../agents/agent-trust-metrics");

describe("AgentTrustMetrics", () => {
  let metrics;

  beforeEach(() => {
    metrics = new AgentTrustMetrics();
  });

  describe("recordExecution()", () => {
    it("should record a successful execution", () => {
      metrics.recordExecution("testAgent", {
        success: true,
        duration_ms: 100,
        outputQuality: 0.9,
        humanOverrideRequired: false,
        escalated: false,
      });

      expect(metrics.executions.testAgent).toHaveLength(1);
      expect(metrics.executions.testAgent[0].success).toBe(true);
      expect(metrics.executions.testAgent[0].outputQuality).toBe(0.9);
    });

    it("should throw when agentName is missing", () => {
      expect(() => metrics.recordExecution(null, {})).toThrow("agentName 為必填");
      expect(() => metrics.recordExecution("", {})).toThrow("agentName 為必填");
    });

    it("should clamp outputQuality to 0-1 range", () => {
      metrics.recordExecution("agent", { outputQuality: 1.5 });
      expect(metrics.executions.agent[0].outputQuality).toBe(1);

      metrics.recordExecution("agent", { outputQuality: -0.5 });
      expect(metrics.executions.agent[1].outputQuality).toBe(0);
    });

    it("should default missing fields", () => {
      metrics.recordExecution("agent", {});
      const record = metrics.executions.agent[0];
      expect(record.success).toBe(false);
      expect(record.duration_ms).toBe(0);
      expect(record.outputQuality).toBe(0);
      expect(record.humanOverrideRequired).toBe(false);
      expect(record.escalated).toBe(false);
    });

    it("should accumulate multiple executions", () => {
      metrics.recordExecution("agent", { success: true });
      metrics.recordExecution("agent", { success: false });
      metrics.recordExecution("agent", { success: true });
      expect(metrics.executions.agent).toHaveLength(3);
    });
  });

  describe("calculateTrustScore()", () => {
    it("should return 0 for unknown agent", () => {
      expect(metrics.calculateTrustScore("unknown")).toBe(0);
    });

    it("should return high score for perfect execution", () => {
      metrics.recordExecution("agent", {
        success: true,
        outputQuality: 1.0,
        humanOverrideRequired: false,
        escalated: false,
      });
      const score = metrics.calculateTrustScore("agent");
      // 1*0.4 + 1*0.3 + 1*0.2 + 1*0.1 = 1.0
      expect(score).toBe(1.0);
    });

    it("should return lower score for failed execution", () => {
      metrics.recordExecution("agent", {
        success: false,
        outputQuality: 0.5,
        humanOverrideRequired: true,
        escalated: true,
      });
      const score = metrics.calculateTrustScore("agent");
      // 0*0.4 + 0*0.3 + 0*0.2 + 0.5*0.1 = 0.05
      expect(score).toBe(0.05);
    });

    it("should calculate average across multiple executions", () => {
      metrics.recordExecution("agent", {
        success: true,
        outputQuality: 1.0,
        humanOverrideRequired: false,
        escalated: false,
      });
      metrics.recordExecution("agent", {
        success: false,
        outputQuality: 0.0,
        humanOverrideRequired: true,
        escalated: true,
      });
      const score = metrics.calculateTrustScore("agent");
      // successRate=0.5, overrideRate=0.5, escalationRate=0.5, qualityAvg=0.5
      // 0.5*0.4 + 0.5*0.3 + 0.5*0.2 + 0.5*0.1 = 0.5
      expect(score).toBe(0.5);
    });
  });

  describe("getAgentStats()", () => {
    it("should return null for unknown agent", () => {
      expect(metrics.getAgentStats("unknown")).toBeNull();
    });

    it("should return complete stats", () => {
      metrics.recordExecution("agent", {
        success: true,
        duration_ms: 200,
        outputQuality: 0.8,
        humanOverrideRequired: false,
        escalated: false,
      });
      metrics.recordExecution("agent", {
        success: true,
        duration_ms: 300,
        outputQuality: 0.9,
        humanOverrideRequired: false,
        escalated: false,
      });

      const stats = metrics.getAgentStats("agent");
      expect(stats.totalRuns).toBe(2);
      expect(stats.successRate).toBe(1);
      expect(stats.avgDuration_ms).toBe(250);
      expect(stats.humanOverrideRate).toBe(0);
      expect(stats.escalationRate).toBe(0);
      expect(stats.trustScore).toBeGreaterThan(0.8);
    });
  });

  describe("getTrustReport()", () => {
    it("should return empty report with no executions", () => {
      const report = metrics.getTrustReport();
      expect(report.total_agents).toBe(0);
      expect(report.agents).toEqual({});
    });

    it("should include all agents", () => {
      metrics.recordExecution("agent1", { success: true, outputQuality: 0.9 });
      metrics.recordExecution("agent2", { success: true, outputQuality: 0.8 });

      const report = metrics.getTrustReport();
      expect(report.total_agents).toBe(2);
      expect(report.agents.agent1).toBeDefined();
      expect(report.agents.agent2).toBeDefined();
    });
  });

  describe("saveMetrics() / loadMetrics()", () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trust-metrics-test-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("should round-trip metrics through JSON", () => {
      metrics.recordExecution("agent1", {
        success: true,
        duration_ms: 100,
        outputQuality: 0.9,
      });
      metrics.recordExecution("agent2", {
        success: false,
        outputQuality: 0.5,
        escalated: true,
      });

      const filePath = path.join(tmpDir, "metrics.json");
      metrics.saveMetrics(filePath);

      const loaded = new AgentTrustMetrics();
      const result = loaded.loadMetrics(filePath);
      expect(result).toBe(true);
      expect(loaded.calculateTrustScore("agent1")).toBe(
        metrics.calculateTrustScore("agent1"),
      );
      expect(loaded.calculateTrustScore("agent2")).toBe(
        metrics.calculateTrustScore("agent2"),
      );
    });

    it("should return false when file does not exist", () => {
      expect(metrics.loadMetrics("/nonexistent/file.json")).toBe(false);
    });
  });
});
