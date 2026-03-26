const SecurityAgent = require("../../agents/security-agent");

describe("SecurityAgent", () => {
  let agent;

  beforeEach(() => {
    agent = new SecurityAgent();
  });

  describe("constructor", () => {
    it("should initialize with correct name and version", () => {
      expect(agent.name).toBe("SecurityAgent");
      expect(agent.version).toBe("1.0.0");
    });
  });

  describe("execute", () => {
    it("should return structured result", async () => {
      const result = await agent.execute({
        id: "sec_001",
        type: "security_scan",
        description: "Scan user authentication module",
        priority: "high",
      });

      expect(result.status).toBe("completed");
      expect(result.metadata.agent).toBe("SecurityAgent");
      expect(result.metadata.subtask_id).toBe("sec_001");
    });

    it("should include vulnerability scan results", async () => {
      const result = await agent.execute({
        id: "sec_002",
        type: "security_scan",
        description: "Scan API with auth and database",
        priority: "high",
      });

      expect(result.output.vulnerabilities).toBeDefined();
      expect(Array.isArray(result.output.vulnerabilities)).toBe(true);
    });

    it("should include dependency audit", async () => {
      const result = await agent.execute({
        id: "sec_003",
        type: "security_scan",
        description: "Scan module",
        priority: "medium",
      });

      expect(result.output.dependency_audit).toBeDefined();
      expect(result.output.dependency_audit.audit_status).toBe("passed");
    });

    it("should include secret scan results", async () => {
      const result = await agent.execute({
        id: "sec_004",
        type: "security_scan",
        description: "Scan module",
        priority: "medium",
      });

      expect(result.output.secret_scan).toBeDefined();
      expect(result.output.secret_scan.scan_status).toBe("clean");
      expect(result.output.secret_scan.secrets_found).toBe(0);
    });

    it("should include OWASP Top 10 checks", async () => {
      const result = await agent.execute({
        id: "sec_005",
        type: "security_scan",
        description: "Scan module",
        priority: "medium",
      });

      expect(result.output.owasp_top10_checks).toBeDefined();
      expect(result.output.owasp_top10_checks).toHaveLength(10);
    });

    it("should include security score", async () => {
      const result = await agent.execute({
        id: "sec_006",
        type: "security_scan",
        description: "Simple module scan",
        priority: "low",
      });

      expect(result.output.security_score).toBeDefined();
      expect(result.output.security_score).toBeGreaterThanOrEqual(0);
      expect(result.output.security_score).toBeLessThanOrEqual(100);
    });

    it("should include summary", async () => {
      const result = await agent.execute({
        id: "sec_007",
        type: "security_scan",
        description: "Scan module",
        priority: "medium",
      });

      expect(result.summary).toBeDefined();
      expect(result.summary.total_issues).toBeGreaterThanOrEqual(0);
    });

    it("should throw on missing type", async () => {
      await expect(agent.execute({ id: "sec_008" })).rejects.toThrow("type");
    });
  });

  describe("scanVulnerabilities", () => {
    it("should find auth vulnerabilities for auth tasks", () => {
      const vulns = agent.scanVulnerabilities({
        description: "Add authentication login system",
      });
      expect(vulns.length).toBeGreaterThan(0);
      expect(vulns.some((v) => v.category === "Authentication")).toBe(true);
    });

    it("should find SQL injection risk for database tasks", () => {
      const vulns = agent.scanVulnerabilities({
        description: "Add SQL database query handler",
      });
      expect(vulns.some((v) => v.severity === "HIGH")).toBe(true);
    });

    it("should return empty for simple tasks", () => {
      const vulns = agent.scanVulnerabilities({
        description: "Update readme file",
      });
      expect(vulns).toHaveLength(0);
    });
  });

  describe("calculateSecurityScore", () => {
    it("should return 100 for no vulnerabilities", () => {
      expect(
        agent.calculateSecurityScore(
          [],
          { vulnerable_dependencies: 0 },
          { secrets_found: 0 },
        ),
      ).toBe(100);
    });

    it("should reduce score for vulnerabilities", () => {
      const vulns = [{ severity: "HIGH" }, { severity: "MEDIUM" }];
      const score = agent.calculateSecurityScore(
        vulns,
        { vulnerable_dependencies: 0 },
        { secrets_found: 0 },
      );
      expect(score).toBeLessThan(100);
    });

    it("should reduce score for vulnerable dependencies", () => {
      const score = agent.calculateSecurityScore(
        [],
        { vulnerable_dependencies: 2 },
        { secrets_found: 0 },
      );
      expect(score).toBe(80);
    });

    it("should heavily penalize secrets found", () => {
      const score = agent.calculateSecurityScore(
        [],
        { vulnerable_dependencies: 0 },
        { secrets_found: 2 },
      );
      expect(score).toBe(60);
    });

    it("should not go below 0", () => {
      const vulns = Array(10).fill({ severity: "CRITICAL" });
      const score = agent.calculateSecurityScore(
        vulns,
        { vulnerable_dependencies: 5 },
        { secrets_found: 5 },
      );
      expect(score).toBe(0);
    });
  });
});
