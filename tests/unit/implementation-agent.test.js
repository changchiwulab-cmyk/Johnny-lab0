const ImplementationAgent = require("../../agents/implementation-agent");

describe("ImplementationAgent", () => {
  let agent;

  beforeEach(() => {
    agent = new ImplementationAgent();
  });

  describe("constructor", () => {
    it("should initialize with correct name and version", () => {
      expect(agent.name).toBe("ImplementationAgent");
      expect(agent.version).toBe("1.0.0");
    });
  });

  describe("execute", () => {
    it("should return structured result for analyze task", async () => {
      const result = await agent.execute({
        id: "test_001",
        type: "analyze",
        description: "Analyze user authentication module",
        priority: "high",
      });

      expect(result.status).toBe("completed");
      expect(result.metadata.agent).toBe("ImplementationAgent");
      expect(result.metadata.subtask_id).toBe("test_001");
      expect(result.metadata.timestamp).toBeDefined();
      expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
      expect(result.output.analysis_type).toBe("requirement_analysis");
      expect(result.output.components_identified).toBeDefined();
    });

    it("should return structured result for implement task", async () => {
      const result = await agent.execute({
        id: "test_002",
        type: "implement",
        description: "Add user authentication with API endpoints",
        priority: "medium",
      });

      expect(result.status).toBe("completed");
      expect(result.output.implementation_type).toBe("code_generation");
      expect(result.output.files_created).toBeDefined();
      expect(result.output.lines_added).toBeGreaterThan(0);
    });

    it("should return structured result for fix task", async () => {
      const result = await agent.execute({
        id: "test_003",
        type: "fix",
        description: "Fix login error",
        priority: "critical",
      });

      expect(result.status).toBe("completed");
      expect(result.output.fix_type).toBe("bug_fix");
      expect(result.output.root_cause).toBeDefined();
    });

    it("should throw on missing type", async () => {
      await expect(agent.execute({ id: "test_004" })).rejects.toThrow(
        "type",
      );
    });

    it("should throw on null context", async () => {
      await expect(agent.execute(null)).rejects.toThrow();
    });

    it("should include quality estimate", async () => {
      const result = await agent.execute({
        id: "test_005",
        type: "implement",
        description: "Simple module",
        priority: "low",
      });

      expect(result.quality).toBeDefined();
      expect(result.quality.estimated_quality_score).toBeGreaterThanOrEqual(
        90,
      );
      expect(result.quality.estimated_quality_score).toBeLessThanOrEqual(100);
    });
  });

  describe("extractComponents", () => {
    it("should extract auth component", () => {
      const components = agent.extractComponents("Add authentication system");
      expect(components).toContain("Auth");
    });

    it("should extract multiple components", () => {
      const components = agent.extractComponents(
        "Add user authentication API",
      );
      expect(components.length).toBeGreaterThanOrEqual(2);
    });

    it("should return defaults for unknown description", () => {
      const components = agent.extractComponents("do something");
      expect(components).toEqual(["Module", "Handler"]);
    });
  });

  describe("suggestPatterns", () => {
    it("should suggest middleware pattern for auth tasks", () => {
      expect(agent.suggestPatterns("add auth token")).toContain(
        "Middleware Pattern",
      );
    });

    it("should suggest controller pattern for API tasks", () => {
      expect(agent.suggestPatterns("create api endpoint")).toContain(
        "Controller Pattern",
      );
    });

    it("should default to Module Pattern", () => {
      expect(agent.suggestPatterns("do something")).toContain(
        "Module Pattern",
      );
    });
  });
});
