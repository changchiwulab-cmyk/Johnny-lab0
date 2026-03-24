const EscalationManager = require("../../agents/escalation-manager");

describe("EscalationManager", () => {
  let manager;

  beforeEach(() => {
    manager = new EscalationManager();
  });

  describe("constructor", () => {
    it("should initialize with empty history", () => {
      expect(manager.getEscalationHistory()).toHaveLength(0);
    });

    it("should initialize DAG", () => {
      expect(manager.dag).toBeDefined();
    });
  });

  describe("determineLevel()", () => {
    it("should return L3 for CRITICAL severity", () => {
      expect(manager.determineLevel("CRITICAL")).toBe("L3");
    });

    it("should return L2 for HIGH severity", () => {
      expect(manager.determineLevel("HIGH")).toBe("L2");
    });

    it("should return L1 for MEDIUM severity", () => {
      expect(manager.determineLevel("MEDIUM")).toBe("L1");
    });

    it("should return L1 for LOW severity", () => {
      expect(manager.determineLevel("LOW")).toBe("L1");
    });

    it("should return L1 for unknown severity", () => {
      expect(manager.determineLevel("UNKNOWN")).toBe("L1");
      expect(manager.determineLevel(null)).toBe("L1");
    });

    it("should be case-insensitive", () => {
      expect(manager.determineLevel("critical")).toBe("L3");
      expect(manager.determineLevel("high")).toBe("L2");
    });
  });

  describe("escalate()", () => {
    it("should throw when issue.type is missing", () => {
      expect(() => manager.escalate({})).toThrow("issue.type 為必填");
      expect(() => manager.escalate(null)).toThrow("issue.type 為必填");
    });

    it("should create L3 escalation for CRITICAL issues", () => {
      const result = manager.escalate({
        type: "critical_compliance",
        severity: "CRITICAL",
        source: "automated_review",
      });

      expect(result.level).toBe("L3");
      expect(result.escalationId).toMatch(/^ESC-\d{4}$/);
      expect(result.assignedTo).toBeDefined();
      expect(result.assignedTo.length).toBeGreaterThan(0);
      expect(result.status).toBe("open");
      expect(result.actions.length).toBeGreaterThan(2);
    });

    it("should create L2 escalation for HIGH issues", () => {
      const result = manager.escalate({
        type: "high_risk",
        severity: "HIGH",
        source: "risk_analyzer",
      });

      expect(result.level).toBe("L2");
      expect(result.assignedTo.length).toBeGreaterThan(0);
    });

    it("should create L1 escalation for MEDIUM issues", () => {
      const result = manager.escalate({
        type: "medium_risk",
        severity: "MEDIUM",
        source: "compliance_checker",
      });

      expect(result.level).toBe("L1");
    });

    it("should generate unique escalation IDs", () => {
      const e1 = manager.escalate({ type: "test1", severity: "LOW" });
      const e2 = manager.escalate({ type: "test2", severity: "LOW" });
      expect(e1.escalationId).not.toBe(e2.escalationId);
    });

    it("should add escalation to history", () => {
      manager.escalate({ type: "test", severity: "MEDIUM" });
      expect(manager.getEscalationHistory()).toHaveLength(1);
    });

    it("should set deadline based on level", () => {
      const l3 = manager.escalate({ type: "test", severity: "CRITICAL" });
      const l1 = manager.escalate({ type: "test", severity: "LOW" });

      const l3Deadline = new Date(l3.deadline);
      const l1Deadline = new Date(l1.deadline);
      expect(l3Deadline.getTime()).toBeLessThan(l1Deadline.getTime());
    });
  });

  describe("resolveAssignees()", () => {
    it("should return Executive for L3 via DAG", () => {
      const assignees = manager.resolveAssignees("L3", {
        type: "critical",
        severity: "CRITICAL",
        details: {},
      });
      expect(assignees.length).toBeGreaterThan(0);
    });

    it("should fall back to defaults when DAG is null", () => {
      manager.dag = null;
      const l3 = manager.resolveAssignees("L3", { type: "test" });
      expect(l3).toContain("Executive");

      const l2 = manager.resolveAssignees("L2", { type: "test" });
      expect(l2).toContain("Senior Legal Counsel");

      const l1 = manager.resolveAssignees("L1", { type: "test" });
      expect(l1).toContain("Contract Manager");
    });
  });

  describe("recordResolution()", () => {
    it("should resolve an open escalation", () => {
      const esc = manager.escalate({ type: "test", severity: "HIGH" });
      const resolved = manager.recordResolution(esc.escalationId, {
        action: "accepted",
        notes: "Issue was valid",
        resolvedBy: "Legal Lead",
      });

      expect(resolved.status).toBe("resolved");
      expect(resolved.resolvedAt).toBeDefined();
      expect(resolved.resolution.action).toBe("accepted");
      expect(resolved.resolution.resolvedBy).toBe("Legal Lead");
    });

    it("should throw for unknown escalation ID", () => {
      expect(() =>
        manager.recordResolution("ESC-9999", { action: "test" }),
      ).toThrow("找不到上報記錄");
    });

    it("should throw when resolving already-resolved escalation", () => {
      const esc = manager.escalate({ type: "test", severity: "LOW" });
      manager.recordResolution(esc.escalationId, { action: "done" });

      expect(() =>
        manager.recordResolution(esc.escalationId, { action: "again" }),
      ).toThrow("上報已解決");
    });
  });

  describe("getOpenEscalations()", () => {
    it("should return only open escalations", () => {
      const e1 = manager.escalate({ type: "test1", severity: "LOW" });
      manager.escalate({ type: "test2", severity: "HIGH" });
      manager.recordResolution(e1.escalationId, { action: "done" });

      const open = manager.getOpenEscalations();
      expect(open).toHaveLength(1);
      expect(open[0].type).toBe("test2");
    });
  });

  describe("getStats()", () => {
    it("should return correct statistics", () => {
      manager.escalate({ type: "t1", severity: "CRITICAL" });
      manager.escalate({ type: "t2", severity: "HIGH" });
      const e3 = manager.escalate({ type: "t3", severity: "LOW" });
      manager.recordResolution(e3.escalationId, { action: "done" });

      const stats = manager.getStats();
      expect(stats.total).toBe(3);
      expect(stats.open).toBe(2);
      expect(stats.resolved).toBe(1);
      expect(stats.byLevel.L3).toBe(1);
      expect(stats.byLevel.L2).toBe(1);
      expect(stats.byLevel.L1).toBe(1);
    });

    it("should return zeros for empty history", () => {
      const stats = manager.getStats();
      expect(stats.total).toBe(0);
      expect(stats.open).toBe(0);
    });
  });
});
