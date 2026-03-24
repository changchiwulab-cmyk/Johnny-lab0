const OwnerResolver = require("../../agents/owner-resolver");

describe("OwnerResolver", () => {
  let resolver;

  beforeAll(() => {
    resolver = new OwnerResolver();
  });

  describe("calculateRiskLevel", () => {
    it("should return high when highSeverityCount >= 2", () => {
      expect(
        resolver.calculateRiskLevel({ highSeverityCount: 2, totalRisks: 3 }),
      ).toBe("high");
    });

    it("should return high when criticalComplianceCount >= 1", () => {
      expect(
        resolver.calculateRiskLevel({
          highSeverityCount: 0,
          criticalComplianceCount: 1,
        }),
      ).toBe("high");
    });

    it("should return medium when highSeverityCount is 1", () => {
      expect(
        resolver.calculateRiskLevel({
          highSeverityCount: 1,
          criticalComplianceCount: 0,
        }),
      ).toBe("medium");
    });

    it("should return medium when totalRisks >= 3", () => {
      expect(
        resolver.calculateRiskLevel({
          highSeverityCount: 0,
          criticalComplianceCount: 0,
          totalRisks: 3,
        }),
      ).toBe("medium");
    });

    it("should return low when no significant risks", () => {
      expect(
        resolver.calculateRiskLevel({
          highSeverityCount: 0,
          criticalComplianceCount: 0,
          totalRisks: 1,
        }),
      ).toBe("low");
    });
  });

  describe("resolveByRisk", () => {
    it("should assign Senior Legal Counsel for high risk phase 1", () => {
      const node = { id: "phase_1_immediate", defaultOwners: ["Legal Team Lead"] };
      const context = { highSeverityCount: 3, criticalComplianceCount: 0 };
      const owners = resolver.resolveByRisk(node, context);
      expect(owners).toContain("Senior Legal Counsel");
      expect(owners).toContain("Legal Team Lead");
    });

    it("should assign Contract Manager for low risk", () => {
      const node = { id: "phase_1_immediate", defaultOwners: ["Legal Team Lead"] };
      const context = { highSeverityCount: 0, criticalComplianceCount: 0, totalRisks: 1 };
      const owners = resolver.resolveByRisk(node, context);
      expect(owners).toEqual(["Contract Manager"]);
    });
  });

  describe("resolveByContractType", () => {
    it("should use NDA specialist for NDA contracts", () => {
      const node = { id: "phase_2_negotiation", type: "implementation", defaultOwners: [] };
      const context = { contractType: "NDA" };
      const owners = resolver.resolveByContractType(node, context);
      expect(owners).toContain("Senior Legal Counsel");
    });

    it("should use Labor Law Specialist for Employment contracts", () => {
      const node = { id: "step_3_prepare_counter", type: "drafting", defaultOwners: [] };
      const context = { contractType: "Employment" };
      const owners = resolver.resolveByContractType(node, context);
      expect(owners).toContain("Labor Law Specialist");
    });

    it("should use IP Specialist for License contracts", () => {
      const node = { id: "phase_2_negotiation", type: "implementation", defaultOwners: [] };
      const context = { contractType: "License" };
      const owners = resolver.resolveByContractType(node, context);
      expect(owners).toContain("IP Specialist");
    });

    it("should use Default rules for unknown contract type", () => {
      const node = { id: "phase_2_negotiation", type: "implementation", defaultOwners: [] };
      const context = { contractType: "Unknown" };
      const owners = resolver.resolveByContractType(node, context);
      expect(owners).toContain("Legal Counsel");
    });

    it("should assign reviewer for approval nodes", () => {
      const node = { id: "phase_3_final_review", type: "approval", defaultOwners: [] };
      const context = { contractType: "NDA" };
      const owners = resolver.resolveByContractType(node, context);
      expect(owners).toContain("Legal Team Lead");
    });
  });

  describe("resolveByStep", () => {
    it("should assign coordination owners for high risk", () => {
      const node = { id: "step_2_confirm_points", type: "coordination", defaultOwners: [] };
      const context = { highSeverityCount: 3 };
      const owners = resolver.resolveByStep(node, context);
      expect(owners).toContain("Senior Legal Counsel");
      expect(owners).toContain("Contract Manager");
    });

    it("should assign Contract Manager for low risk coordination", () => {
      const node = { id: "step_2_confirm_points", type: "coordination", defaultOwners: [] };
      const context = { highSeverityCount: 0, totalRisks: 1 };
      const owners = resolver.resolveByStep(node, context);
      expect(owners).toEqual(["Contract Manager"]);
    });

    it("should assign Legal Team Lead for high risk monitoring", () => {
      const node = { id: "step_5_track_progress", type: "monitoring", defaultOwners: [] };
      const context = { highSeverityCount: 3 };
      const owners = resolver.resolveByStep(node, context);
      expect(owners).toEqual(["Legal Team Lead"]);
    });
  });

  describe("resolve (integration)", () => {
    it("should use the correct strategy based on ownerRule", () => {
      const node = {
        id: "phase_1_immediate",
        ownerRule: "resolve_by_risk",
        defaultOwners: ["Legal Team Lead"],
      };
      const context = { highSeverityCount: 3 };
      const owners = resolver.resolve(node, context);
      expect(owners).toContain("Senior Legal Counsel");
    });

    it("should fallback to defaultOwners for unknown strategy", () => {
      const node = {
        id: "test_node",
        ownerRule: "unknown_strategy",
        defaultOwners: ["Fallback Owner"],
      };
      const owners = resolver.resolve(node, {});
      expect(owners).toEqual(["Fallback Owner"]);
    });

    it("should fallback to defaultOwners when strategy returns null", () => {
      const node = {
        id: "nonexistent_node",
        ownerRule: "resolve_by_risk",
        defaultOwners: ["Default Owner"],
      };
      // Use a resolver with empty rules so resolveByRisk returns null
      const emptyResolver = new OwnerResolver({
        roles: {},
        risk_based_rules: {},
        contract_type_rules: {},
      });
      const owners = emptyResolver.resolve(node, {});
      expect(owners).toEqual(["Default Owner"]);
    });
  });

  describe("getRole", () => {
    it("should return role info for known role", () => {
      const role = resolver.getRole("Legal Team Lead");
      expect(role).toBeDefined();
      expect(role.department).toBe("legal");
      expect(role.capabilities).toContain("approve");
    });

    it("should return null for unknown role", () => {
      expect(resolver.getRole("Unknown Role")).toBeNull();
    });
  });

  describe("getAvailableRoles", () => {
    it("should return list of role names", () => {
      const roles = resolver.getAvailableRoles();
      expect(roles).toContain("Legal Team Lead");
      expect(roles).toContain("Contract Manager");
      expect(roles.length).toBeGreaterThan(0);
    });
  });
});
