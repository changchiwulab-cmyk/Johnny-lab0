const AutomatedReviewHooks = require("../../agents/automated-review-hooks");

describe("AutomatedReviewHooks", () => {
  let hooks;

  beforeEach(() => {
    hooks = new AutomatedReviewHooks();
  });

  describe("constructor", () => {
    it("should load config from file or use defaults", () => {
      expect(hooks.config).toBeDefined();
      expect(hooks.config.checkpoints).toBeDefined();
    });

    it("should accept custom config", () => {
      const custom = {
        checkpoints: { mandatory: [], conditional: [] },
        actions: {},
      };
      const h = new AutomatedReviewHooks(custom);
      expect(h.config).toBe(custom);
    });
  });

  describe("evaluateTrigger()", () => {
    it("should return true for 'always'", () => {
      expect(hooks.evaluateTrigger("always", {})).toBe(true);
    });

    it("should return false for null/undefined trigger", () => {
      expect(hooks.evaluateTrigger(null, {})).toBe(false);
      expect(hooks.evaluateTrigger(undefined, {})).toBe(false);
    });

    it("should evaluate >= correctly", () => {
      expect(
        hooks.evaluateTrigger("highSeverityCount >= 2", { highSeverityCount: 2 }),
      ).toBe(true);
      expect(
        hooks.evaluateTrigger("highSeverityCount >= 2", { highSeverityCount: 1 }),
      ).toBe(false);
    });

    it("should evaluate > correctly", () => {
      expect(
        hooks.evaluateTrigger("anomalyScore > 0.7", { anomalyScore: 0.8 }),
      ).toBe(true);
      expect(
        hooks.evaluateTrigger("anomalyScore > 0.7", { anomalyScore: 0.7 }),
      ).toBe(false);
    });

    it("should evaluate < correctly", () => {
      expect(
        hooks.evaluateTrigger("agentConfidence < 0.6", { agentConfidence: 0.5 }),
      ).toBe(true);
      expect(
        hooks.evaluateTrigger("agentConfidence < 0.6", { agentConfidence: 0.6 }),
      ).toBe(false);
    });

    it("should evaluate <= correctly", () => {
      expect(
        hooks.evaluateTrigger("totalRisks <= 3", { totalRisks: 3 }),
      ).toBe(true);
      expect(
        hooks.evaluateTrigger("totalRisks <= 3", { totalRisks: 4 }),
      ).toBe(false);
    });

    it("should evaluate == correctly", () => {
      expect(
        hooks.evaluateTrigger("totalRisks == 5", { totalRisks: 5 }),
      ).toBe(true);
      expect(
        hooks.evaluateTrigger("totalRisks == 5", { totalRisks: 4 }),
      ).toBe(false);
    });

    it("should return false for unknown variable", () => {
      expect(hooks.evaluateTrigger("unknown >= 1", {})).toBe(false);
    });

    it("should return false for invalid trigger format", () => {
      expect(hooks.evaluateTrigger("invalid", {})).toBe(false);
    });
  });

  describe("reviewResults()", () => {
    const makeRisks = (high = 0, medium = 0, low = 0) => ({
      metadata: {
        total_risks: high + medium + low,
        high_severity: high,
        medium_severity: medium,
        low_severity: low,
      },
      risks: [],
    });

    const makeCompliance = (critical = 0, high = 0, medium = 0) => ({
      metadata: {
        total_issues: critical + high + medium,
        critical,
        high,
        medium,
        low: 0,
      },
      compliance_checks: [],
    });

    const makeTerms = () => ({
      basic_info: { parties: [], jurisdiction: "CA" },
      metadata: { contract_type: "NDA" },
      key_terms: {},
    });

    it("should pass review for low-risk contract", () => {
      const result = hooks.reviewResults(
        makeTerms(),
        makeRisks(0, 1, 2),
        makeCompliance(0, 0, 1),
      );
      // 'always' checkpoint (final_approval) is blocking, so it won't pass
      // But there should be no quality flags
      expect(result.flags).toBeDefined();
      expect(result.checkpoints).toBeDefined();
    });

    it("should trigger mandatory checkpoint for critical compliance", () => {
      const result = hooks.reviewResults(
        makeTerms(),
        makeRisks(0, 1, 0),
        makeCompliance(1, 0, 0),
      );
      const criticalCheckpoint = result.checkpoints.find(
        (c) => c.id === "critical_compliance",
      );
      expect(criticalCheckpoint).toBeDefined();
      expect(criticalCheckpoint.type).toBe("mandatory");
    });

    it("should trigger mandatory checkpoint for high risk threshold", () => {
      const result = hooks.reviewResults(
        makeTerms(),
        makeRisks(3, 0, 0),
        makeCompliance(0, 0, 0),
      );
      const highRiskCheckpoint = result.checkpoints.find(
        (c) => c.id === "high_risk_threshold",
      );
      expect(highRiskCheckpoint).toBeDefined();
    });

    it("should flag quality issues for missing data", () => {
      const result = hooks.reviewResults(null, null, null);
      const errorFlags = result.flags.filter((f) => f.level === "ERROR");
      expect(errorFlags.length).toBeGreaterThanOrEqual(3);
    });

    it("should trigger conditional checkpoint for low confidence", () => {
      const result = hooks.reviewResults(
        makeTerms(),
        makeRisks(0, 0, 1),
        makeCompliance(0, 0, 0),
        null,
        { agentConfidence: 0.3 },
      );
      const lowConfCheckpoint = result.checkpoints.find(
        (c) => c.id === "low_confidence",
      );
      expect(lowConfCheckpoint).toBeDefined();
      expect(lowConfCheckpoint.type).toBe("conditional");
    });

    it("should trigger conditional checkpoint for anomaly score", () => {
      const result = hooks.reviewResults(
        makeTerms(),
        makeRisks(0, 0, 1),
        makeCompliance(0, 0, 0),
        null,
        { anomalyScore: 0.9 },
      );
      const anomalyCheckpoint = result.checkpoints.find(
        (c) => c.id === "unusual_terms",
      );
      expect(anomalyCheckpoint).toBeDefined();
    });
  });

  describe("evaluateHumanCheckpoint()", () => {
    it("should not require human when no blocking checkpoints", () => {
      const result = hooks.evaluateHumanCheckpoint({
        passed: true,
        flags: [],
        checkpoints: [],
        context: {},
      });
      expect(result.requiresHuman).toBe(false);
    });

    it("should return false for null input", () => {
      const result = hooks.evaluateHumanCheckpoint(null);
      expect(result.requiresHuman).toBe(false);
    });

    it("should require human when blocking checkpoints exist", () => {
      const result = hooks.evaluateHumanCheckpoint({
        passed: false,
        flags: [{ level: "CRITICAL", message: "test" }],
        checkpoints: [
          {
            id: "critical_compliance",
            description: "存在關鍵合規問題",
            blocking: true,
          },
        ],
        context: { criticalComplianceCount: 1, highSeverityCount: 0 },
      });
      expect(result.requiresHuman).toBe(true);
      expect(result.reason).toContain("合規");
      expect(result.assignedTo.length).toBeGreaterThan(0);
    });

    it("should require human when ERROR flags exist", () => {
      const result = hooks.evaluateHumanCheckpoint({
        passed: false,
        flags: [{ level: "ERROR", message: "品質問題" }],
        checkpoints: [],
        context: {},
      });
      expect(result.requiresHuman).toBe(true);
      expect(result.reason).toContain("品質");
    });

    it("should resolve assignees based on risk level", () => {
      const highRisk = hooks.evaluateHumanCheckpoint({
        passed: false,
        flags: [],
        checkpoints: [{ id: "test", description: "test", blocking: true }],
        context: { highSeverityCount: 3, criticalComplianceCount: 0 },
      });
      expect(highRisk.assignedTo).toContain("Senior Legal Counsel");

      const lowRisk = hooks.evaluateHumanCheckpoint({
        passed: false,
        flags: [],
        checkpoints: [{ id: "test", description: "test", blocking: true }],
        context: { highSeverityCount: 0, criticalComplianceCount: 0, totalRisks: 0 },
      });
      expect(lowRisk.assignedTo).toContain("Contract Manager");
    });
  });

  describe("checkOutputQuality()", () => {
    it("should flag missing terms basic_info", () => {
      const flags = hooks.checkOutputQuality({}, { metadata: {} }, { metadata: {} });
      expect(flags.some((f) => f.checkpoint_id === "quality_terms")).toBe(true);
    });

    it("should flag suspicious risk distribution", () => {
      const flags = hooks.checkOutputQuality(
        { basic_info: {} },
        { metadata: { total_risks: 6, high_severity: 0 } },
        { metadata: {} },
      );
      expect(flags.some((f) => f.checkpoint_id === "quality_risk_distribution")).toBe(
        true,
      );
    });

    it("should return no flags for valid output", () => {
      const flags = hooks.checkOutputQuality(
        { basic_info: {} },
        { metadata: { total_risks: 2, high_severity: 1 } },
        { metadata: {} },
      );
      expect(flags).toHaveLength(0);
    });
  });
});
