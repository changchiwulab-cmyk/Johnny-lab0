const OwnerAssignmentDAG = require("../../agents/owner-assignment-dag");

describe("OwnerAssignmentDAG", () => {
  let dag;

  beforeEach(() => {
    dag = new OwnerAssignmentDAG();
  });

  describe("construction from config", () => {
    it("should load nodes from config", () => {
      expect(dag.getNodeCount()).toBe(8);
    });

    it("should load edges from config", () => {
      expect(dag.getEdgeCount()).toBe(6);
    });

    it("should have all expected nodes", () => {
      expect(dag.getNode("phase_1_immediate")).not.toBeNull();
      expect(dag.getNode("phase_2_negotiation")).not.toBeNull();
      expect(dag.getNode("phase_3_final_review")).not.toBeNull();
      expect(dag.getNode("step_1_review_report")).not.toBeNull();
      expect(dag.getNode("step_5_track_progress")).not.toBeNull();
    });
  });

  describe("addNode / addEdge", () => {
    it("should throw if node has no id", () => {
      expect(() => dag.addNode({ name: "test" })).toThrow("節點必須有 id");
    });

    it("should throw if edge has invalid source", () => {
      expect(() =>
        dag.addEdge({ from: "nonexistent", to: "phase_1_immediate" }),
      ).toThrow("來源節點不存在");
    });

    it("should throw if edge has invalid target", () => {
      expect(() =>
        dag.addEdge({ from: "phase_1_immediate", to: "nonexistent" }),
      ).toThrow("目標節點不存在");
    });

    it("should throw if edge has no from/to", () => {
      expect(() => dag.addEdge({ from: "phase_1_immediate" })).toThrow(
        "邊必須有 from 和 to",
      );
    });
  });

  describe("getDependencies / getDependents", () => {
    it("should return dependencies for phase_2", () => {
      const deps = dag.getDependencies("phase_2_negotiation");
      expect(deps).toContain("phase_1_immediate");
    });

    it("should return empty for root nodes", () => {
      expect(dag.getDependencies("phase_1_immediate")).toHaveLength(0);
      expect(dag.getDependencies("step_1_review_report")).toHaveLength(0);
    });

    it("should return dependents for phase_1", () => {
      const deps = dag.getDependents("phase_1_immediate");
      expect(deps).toContain("phase_2_negotiation");
    });

    it("should return empty for leaf nodes", () => {
      expect(dag.getDependents("phase_3_final_review")).toHaveLength(0);
      expect(dag.getDependents("step_5_track_progress")).toHaveLength(0);
    });
  });

  describe("topologicalSort", () => {
    it("should return all nodes", () => {
      const sorted = dag.topologicalSort();
      expect(sorted).toHaveLength(8);
    });

    it("should place phase_1 before phase_2", () => {
      const sorted = dag.topologicalSort();
      const idx1 = sorted.indexOf("phase_1_immediate");
      const idx2 = sorted.indexOf("phase_2_negotiation");
      expect(idx1).toBeLessThan(idx2);
    });

    it("should place phase_2 before phase_3", () => {
      const sorted = dag.topologicalSort();
      const idx2 = sorted.indexOf("phase_2_negotiation");
      const idx3 = sorted.indexOf("phase_3_final_review");
      expect(idx2).toBeLessThan(idx3);
    });

    it("should place step_1 before step_5", () => {
      const sorted = dag.topologicalSort();
      const idx1 = sorted.indexOf("step_1_review_report");
      const idx5 = sorted.indexOf("step_5_track_progress");
      expect(idx1).toBeLessThan(idx5);
    });
  });

  describe("validateDAG", () => {
    it("should validate a correct DAG", () => {
      const result = dag.validateDAG();
      expect(result.valid).toBe(true);
    });

    it("should detect cycles", () => {
      const cyclicDag = new OwnerAssignmentDAG({
        roles: {},
        dag_nodes: [
          { id: "a", dependencies: [], ownerRule: "resolve_by_risk", defaultOwners: [] },
          { id: "b", dependencies: ["a"], ownerRule: "resolve_by_risk", defaultOwners: [] },
        ],
        dag_edges: [
          { from: "a", to: "b" },
          { from: "b", to: "a" },
        ],
        risk_based_rules: {},
        contract_type_rules: {},
      });
      const result = cyclicDag.validateDAG();
      expect(result.valid).toBe(false);
      expect(result.message).toContain("環路");
    });
  });

  describe("resolveOwners", () => {
    it("should return assignments for all nodes", () => {
      const context = {
        contractType: "NDA",
        highSeverityCount: 2,
        criticalComplianceCount: 0,
        totalRisks: 5,
      };
      const assignments = dag.resolveOwners(context);
      expect(Object.keys(assignments)).toHaveLength(8);
    });

    it("should assign senior staff for high risk", () => {
      const context = {
        contractType: "NDA",
        highSeverityCount: 3,
        criticalComplianceCount: 1,
      };
      const assignments = dag.resolveOwners(context);
      expect(assignments.phase_1_immediate).toContain("Senior Legal Counsel");
    });

    it("should assign Contract Manager for low risk", () => {
      const context = {
        contractType: "NDA",
        highSeverityCount: 0,
        criticalComplianceCount: 0,
        totalRisks: 1,
      };
      const assignments = dag.resolveOwners(context);
      expect(assignments.phase_1_immediate).toEqual(["Contract Manager"]);
    });

    it("should use contract type specialist for negotiation phase", () => {
      const context = {
        contractType: "Employment",
        highSeverityCount: 1,
      };
      const assignments = dag.resolveOwners(context);
      expect(assignments.phase_2_negotiation).toContain(
        "Labor Law Specialist",
      );
    });
  });

  describe("getAssignmentPlan", () => {
    it("should return enriched plan with owners", () => {
      const context = {
        contractType: "NDA",
        highSeverityCount: 1,
        totalRisks: 3,
      };
      const plan = dag.getAssignmentPlan(context);
      expect(plan).toHaveLength(8);
      plan.forEach((item) => {
        expect(item.assignedOwners).toBeDefined();
        expect(Array.isArray(item.assignedOwners)).toBe(true);
        expect(item.dependencies).toBeDefined();
        expect(item.dependents).toBeDefined();
      });
    });
  });

  describe("getExecutionOrder", () => {
    it("should return nodes in topological order", () => {
      const order = dag.getExecutionOrder();
      expect(order).toHaveLength(8);
      expect(order[0].id).toBeDefined();
    });
  });

  describe("empty config", () => {
    it("should handle empty DAG gracefully", () => {
      const emptyDag = new OwnerAssignmentDAG({
        roles: {},
        dag_nodes: [],
        dag_edges: [],
        risk_based_rules: {},
        contract_type_rules: {},
      });
      expect(emptyDag.getNodeCount()).toBe(0);
      expect(emptyDag.topologicalSort()).toHaveLength(0);
      expect(emptyDag.validateDAG().valid).toBe(true);
      expect(emptyDag.resolveOwners({})).toEqual({});
    });
  });
});
