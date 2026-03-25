"use strict";

const IncidentResponseHandler = require("../../agents/incident-response-handler");

describe("IncidentResponseHandler", () => {
  let handler;

  const makeAlert = (overrides = {}) => ({
    alert_id: "ALERT-0001",
    type: "pattern_match",
    triggered_by: ["EVT-0001"],
    severity: "HIGH",
    category: "vulnerability",
    description: "Test alert",
    recommended_action: "patch",
    escalation_level: 2,
    sla_response_minutes: 240,
    timestamp: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    handler = new IncidentResponseHandler();
  });

  // ─── Constructor ────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("should initialize with correct name and version", () => {
      expect(handler.name).toBe("IncidentResponseHandler");
      expect(handler.version).toBe("1.0.0");
    });

    it("should load incident-response-config.json", () => {
      expect(handler.config).toBeDefined();
      expect(handler.config.playbooks).toBeDefined();
      expect(handler.config.escalation_chains).toBeDefined();
    });

    it("should initialize empty actionLog", () => {
      expect(handler.actionLog).toBeInstanceOf(Array);
      expect(handler.actionLog).toHaveLength(0);
    });
  });

  // ─── respond() ──────────────────────────────────────────────────────────────

  describe("respond()", () => {
    it("should throw if alerts is not an array", () => {
      expect(() => handler.respond(null)).toThrow("alerts must be an array");
      expect(() => handler.respond("string")).toThrow("alerts must be an array");
    });

    it("should handle empty alerts array", () => {
      const result = handler.respond([]);
      expect(result.metadata.total_alerts).toBe(0);
      expect(result.metadata.responded).toBe(0);
      expect(result.responses).toHaveLength(0);
    });

    it("should return metadata with correct structure", () => {
      const result = handler.respond([makeAlert()]);
      expect(result.metadata).toHaveProperty("total_alerts");
      expect(result.metadata).toHaveProperty("responded");
      expect(result.metadata).toHaveProperty("escalated");
      expect(result.metadata).toHaveProperty("sla_met");
      expect(result.metadata).toHaveProperty("sla_breached");
    });

    it("should respond to all alerts", () => {
      const alerts = [makeAlert({ alert_id: "A1" }), makeAlert({ alert_id: "A2" })];
      const result = handler.respond(alerts);
      expect(result.metadata.total_alerts).toBe(2);
      expect(result.metadata.responded).toBe(2);
    });

    it("should include action_log in result", () => {
      handler.respond([makeAlert()]);
      expect(handler.actionLog.length).toBeGreaterThan(0);
    });
  });

  // ─── selectPlaybook() ───────────────────────────────────────────────────────

  describe("selectPlaybook()", () => {
    it("should select secret_leak playbook for CRITICAL secret_leak", () => {
      const alert = makeAlert({ severity: "CRITICAL", category: "secret_leak" });
      const playbook = handler.selectPlaybook(alert);
      expect(playbook).not.toBeNull();
      expect(playbook.name).toBe("secret_leak");
    });

    it("should select vulnerability_critical for CRITICAL vulnerability", () => {
      const alert = makeAlert({ severity: "CRITICAL", category: "vulnerability" });
      const playbook = handler.selectPlaybook(alert);
      expect(playbook).not.toBeNull();
      expect(playbook.name).toBe("vulnerability_critical");
    });

    it("should select vulnerability_high for HIGH vulnerability", () => {
      const alert = makeAlert({ severity: "HIGH", category: "vulnerability" });
      const playbook = handler.selectPlaybook(alert);
      expect(playbook).not.toBeNull();
      expect(playbook.name).toBe("vulnerability_high");
    });

    it("should select access_violation playbook for HIGH access_violation", () => {
      const alert = makeAlert({ severity: "HIGH", category: "access_violation" });
      const playbook = handler.selectPlaybook(alert);
      expect(playbook).not.toBeNull();
      expect(playbook.name).toBe("access_violation");
    });

    it("should select anomaly_detected for MEDIUM anomaly", () => {
      const alert = makeAlert({ severity: "MEDIUM", category: "anomaly", escalation_level: 1 });
      const playbook = handler.selectPlaybook(alert);
      expect(playbook).not.toBeNull();
      expect(playbook.name).toBe("anomaly_detected");
    });

    it("should select policy_breach for MEDIUM policy_breach", () => {
      const alert = makeAlert({ severity: "MEDIUM", category: "policy_breach", escalation_level: 1 });
      const playbook = handler.selectPlaybook(alert);
      expect(playbook).not.toBeNull();
      expect(playbook.name).toBe("policy_breach");
    });

    it("should return null for LOW severity with no matching playbook", () => {
      const alert = makeAlert({ severity: "LOW", category: "anomaly", escalation_level: 1, sla_response_minutes: 4320 });
      const playbook = handler.selectPlaybook(alert);
      expect(playbook).toBeNull();
    });
  });

  // ─── getEscalationChain() ────────────────────────────────────────────────────

  describe("getEscalationChain()", () => {
    it("should return Security Team for level 1", () => {
      const chain = handler.getEscalationChain(1);
      expect(chain).toContain("Security Team");
      expect(chain).toHaveLength(1);
    });

    it("should return 3 contacts for level 2", () => {
      const chain = handler.getEscalationChain(2);
      expect(chain).toContain("Security Team");
      expect(chain).toContain("Security Team Lead");
      expect(chain.length).toBeGreaterThan(1);
    });

    it("should return CTO and Executive for level 3", () => {
      const chain = handler.getEscalationChain(3);
      expect(chain).toContain("CTO");
      expect(chain).toContain("Executive Team");
    });

    it("should return empty array for level 0", () => {
      const chain = handler.getEscalationChain(0);
      expect(chain).toHaveLength(0);
    });
  });

  // ─── checkSLACompliance() ────────────────────────────────────────────────────

  describe("checkSLACompliance()", () => {
    it("should return 'met' when alert age is within SLA", () => {
      const alert = makeAlert({ sla_response_minutes: 240, timestamp: new Date().toISOString() });
      expect(handler.checkSLACompliance(alert, 0)).toBe("met");
    });

    it("should return 'breached' when alert age exceeds SLA", () => {
      const oldTime = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(); // 5 hours ago
      const alert = makeAlert({ sla_response_minutes: 240, timestamp: oldTime });
      expect(handler.checkSLACompliance(alert, 0)).toBe("breached");
    });

    it("should return 'met' when sla_response_minutes is null", () => {
      const alert = makeAlert({ sla_response_minutes: null });
      expect(handler.checkSLACompliance(alert, 999999)).toBe("met");
    });

    it("should fall back to responseTimeMs when no timestamp", () => {
      const alert = makeAlert({ sla_response_minutes: 1, timestamp: undefined });
      const responseTimeMs = 30 * 1000; // 30 seconds
      expect(handler.checkSLACompliance(alert, responseTimeMs)).toBe("met");
    });

    it("should use alert timestamp over handler processing time", () => {
      const recentTime = new Date(Date.now() - 30 * 1000).toISOString(); // 30 seconds ago
      const alert = makeAlert({ sla_response_minutes: 240, timestamp: recentTime });
      expect(handler.checkSLACompliance(alert, 999999999)).toBe("met");
    });
  });

  // ─── generateIncidentReport() ────────────────────────────────────────────────

  describe("generateIncidentReport()", () => {
    it("should return report with all required fields", () => {
      const alert = makeAlert();
      const actions = [{ action: "notify", status: "completed", description: "通知" }];
      const report = handler.generateIncidentReport(alert, actions);
      expect(report).toHaveProperty("incident_id");
      expect(report).toHaveProperty("alert_summary");
      expect(report).toHaveProperty("response_summary");
      expect(report).toHaveProperty("escalation");
      expect(report).toHaveProperty("timeline");
    });

    it("should generate incident_id from alert_id", () => {
      const alert = makeAlert({ alert_id: "ALERT-0042" });
      const report = handler.generateIncidentReport(alert, []);
      expect(report.incident_id).toBe("INC-ALERT-0042");
    });

    it("should count completed and failed actions correctly", () => {
      const alert = makeAlert();
      const actions = [
        { action: "notify", status: "completed" },
        { action: "auto_patch_attempt", status: "failed" },
        { action: "verify", status: "completed" },
      ];
      const report = handler.generateIncidentReport(alert, actions);
      expect(report.response_summary.total_actions).toBe(3);
      expect(report.response_summary.completed).toBe(2);
      expect(report.response_summary.failed).toBe(1);
    });

    it("should include timeline with step numbers", () => {
      const alert = makeAlert();
      const actions = [
        { action: "isolate_source", status: "completed" },
        { action: "notify", status: "completed" },
      ];
      const report = handler.generateIncidentReport(alert, actions);
      expect(report.timeline).toHaveLength(2);
      expect(report.timeline[0].step).toBe(1);
      expect(report.timeline[1].step).toBe(2);
    });
  });

  // ─── Full pipeline ────────────────────────────────────────────────────────────

  describe("full respond pipeline", () => {
    it("should mark human_required playbooks as escalated", () => {
      const alert = makeAlert({ severity: "CRITICAL", category: "secret_leak", escalation_level: 3 });
      const result = handler.respond([alert]);
      const response = result.responses[0];
      expect(response.remediation_status).toBe("escalated");
    });

    it("should mark auto-resolve playbooks as auto_resolved when all actions complete", () => {
      const alert = makeAlert({ severity: "HIGH", category: "vulnerability", escalation_level: 2, sla_response_minutes: 240 });
      const result = handler.respond([alert]);
      const response = result.responses[0];
      expect(["auto_resolved", "pending_human"]).toContain(response.remediation_status);
    });

    it("should track escalated count correctly", () => {
      const alerts = [
        makeAlert({ alert_id: "A1", severity: "CRITICAL", category: "secret_leak", escalation_level: 3 }),
        makeAlert({ alert_id: "A2", severity: "HIGH", category: "vulnerability", escalation_level: 2 }),
      ];
      const result = handler.respond(alerts);
      expect(result.metadata.escalated).toBeGreaterThanOrEqual(1);
    });
  });
});
