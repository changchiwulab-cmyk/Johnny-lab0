const TaskDecomposer = require("../../agents/task-decomposer");
const fixtures = require("../fixtures/sample-task.json");

describe("TaskDecomposer", () => {
  let decomposer;

  beforeEach(() => {
    decomposer = new TaskDecomposer();
  });

  describe("constructor", () => {
    it("should initialize with correct name and version", () => {
      expect(decomposer.name).toBe("TaskDecomposer");
      expect(decomposer.version).toBe("1.0.0");
    });

    it("should load config", () => {
      expect(decomposer.config).toBeDefined();
      expect(decomposer.config.task_types).toBeDefined();
    });
  });

  describe("validateInput", () => {
    it("should throw on null input", () => {
      expect(() => decomposer.validateInput(null)).toThrow("非空字串");
    });

    it("should throw on number input", () => {
      expect(() => decomposer.validateInput(123)).toThrow("非空字串");
    });

    it("should throw on empty string", () => {
      expect(() => decomposer.validateInput("")).toThrow("非空字串");
    });

    it("should throw on whitespace-only string", () => {
      expect(() => decomposer.validateInput("   ")).toThrow("空白");
    });

    it("should pass for valid description", () => {
      expect(() =>
        decomposer.validateInput("Add user auth"),
      ).not.toThrow();
    });
  });

  describe("classifyTask", () => {
    it("should classify feature tasks", () => {
      expect(decomposer.classifyTask("Add new login page")).toBe("feature");
      expect(decomposer.classifyTask("Create user dashboard")).toBe("feature");
      expect(decomposer.classifyTask("Implement search feature")).toBe(
        "feature",
      );
    });

    it("should classify bugfix tasks", () => {
      expect(decomposer.classifyTask("Fix login error")).toBe("bugfix");
      expect(decomposer.classifyTask("Fix the crash on startup")).toBe(
        "bugfix",
      );
      expect(decomposer.classifyTask("Bug in payment processing")).toBe(
        "bugfix",
      );
    });

    it("should classify refactor tasks", () => {
      expect(decomposer.classifyTask("Refactor database module")).toBe(
        "refactor",
      );
      expect(decomposer.classifyTask("Clean up legacy code")).toBe("refactor");
      expect(decomposer.classifyTask("Simplify the validation logic")).toBe(
        "refactor",
      );
    });

    it("should default to feature for ambiguous descriptions", () => {
      expect(decomposer.classifyTask("update the system")).toBe("feature");
    });
  });

  describe("assessComplexity", () => {
    it("should assess high complexity for security + database keywords", () => {
      expect(
        decomposer.assessComplexity(
          "database migration with security checks and authentication",
        ),
      ).toBe("critical");
    });

    it("should assess high complexity for single high keyword", () => {
      expect(
        decomposer.assessComplexity("Add authentication system"),
      ).toBe("high");
    });

    it("should assess medium complexity for API tasks", () => {
      expect(decomposer.assessComplexity("Create new api endpoint")).toBe(
        "medium",
      );
    });

    it("should assess low complexity for simple tasks", () => {
      expect(decomposer.assessComplexity("Fix typo in config")).toBe("low");
    });
  });

  describe("decompose", () => {
    it("should decompose a feature task", async () => {
      const result = await decomposer.decompose(
        fixtures.simple_feature.description,
      );

      expect(result.dag).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.taskType).toBe("feature");
      expect(result.metadata.subtaskCount).toBe(5);
      expect(result.dag.getNodeCount()).toBe(5);
    });

    it("should decompose a bugfix task", async () => {
      const result = await decomposer.decompose(
        fixtures.bugfix.description,
        { type: "bugfix" },
      );

      expect(result.metadata.taskType).toBe("bugfix");
      expect(result.metadata.subtaskCount).toBe(4);
    });

    it("should decompose a refactor task", async () => {
      const result = await decomposer.decompose(
        fixtures.refactor.description,
      );

      expect(result.metadata.taskType).toBe("refactor");
      expect(result.metadata.subtaskCount).toBe(4);
    });

    it("should respect explicit type override", async () => {
      const result = await decomposer.decompose("some task", {
        type: "bugfix",
      });

      expect(result.metadata.taskType).toBe("bugfix");
    });

    it("should throw on unknown task type", async () => {
      await expect(
        decomposer.decompose("task", { type: "unknown" }),
      ).rejects.toThrow("未知的任務類型");
    });

    it("should produce valid DAG", async () => {
      const result = await decomposer.decompose("Add new feature");
      expect(() => result.dag.validateDAG()).not.toThrow();
    });

    it("should include metadata with timing", async () => {
      const result = await decomposer.decompose("Add new feature");
      expect(result.metadata.timestamp).toBeDefined();
      expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
      expect(result.metadata.decomposed_by).toBe("TaskDecomposer");
    });
  });

  describe("buildSubtasks", () => {
    it("should assign correct agents", async () => {
      const result = await decomposer.decompose("Add new API endpoint");
      const nodes = [...result.dag.nodes.values()];

      const agents = nodes.map((n) => n.agent);
      expect(agents).toContain("implementation");
      expect(agents).toContain("testing");
    });

    it("should generate unique subtask IDs", async () => {
      const result = await decomposer.decompose("Add feature");
      const ids = [...result.dag.nodes.values()].map((n) => n.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("buildDependencyEdges", () => {
    it("should create edges between parallel groups", async () => {
      const result = await decomposer.decompose("Add feature");
      // Feature has 3 groups: [analyze] -> [implement] -> [test, document, security_scan]
      expect(result.dag.getEdgeCount()).toBeGreaterThan(0);
    });

    it("should respect group ordering", async () => {
      const result = await decomposer.decompose("Add feature");
      const order = result.dag.getExecutionOrder();
      const types = order.map((n) => n.type);

      // analyze should come before implement
      expect(types.indexOf("analyze")).toBeLessThan(
        types.indexOf("implement"),
      );
      // implement should come before test
      expect(types.indexOf("implement")).toBeLessThan(
        types.indexOf("test"),
      );
    });
  });

  describe("estimateDuration", () => {
    it("should return higher duration for critical priority", () => {
      const critical = decomposer.estimateDuration("implement", "critical");
      const low = decomposer.estimateDuration("implement", "low");
      expect(critical).toBeGreaterThan(low);
    });
  });
});
