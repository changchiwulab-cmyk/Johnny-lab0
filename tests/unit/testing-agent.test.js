const TestingAgent = require("../../agents/testing-agent");

describe("TestingAgent", () => {
  let agent;

  beforeEach(() => {
    agent = new TestingAgent();
  });

  describe("constructor", () => {
    it("should initialize with correct name and version", () => {
      expect(agent.name).toBe("TestingAgent");
      expect(agent.version).toBe("1.0.0");
    });
  });

  describe("execute", () => {
    it("should return structured result", async () => {
      const result = await agent.execute({
        id: "test_001",
        type: "test",
        description: "Test user authentication",
        priority: "high",
      });

      expect(result.status).toBe("completed");
      expect(result.metadata.agent).toBe("TestingAgent");
      expect(result.metadata.subtask_id).toBe("test_001");
      expect(result.metadata.timestamp).toBeDefined();
    });

    it("should include test suites", async () => {
      const result = await agent.execute({
        id: "test_002",
        type: "test",
        description: "Test module",
        priority: "medium",
      });

      expect(result.output.test_suites).toBeDefined();
      expect(result.output.test_suites.length).toBeGreaterThan(0);
      expect(result.output.total_tests).toBeGreaterThan(0);
    });

    it("should include test results", async () => {
      const result = await agent.execute({
        id: "test_003",
        type: "test",
        description: "Test",
        priority: "medium",
      });

      expect(result.output.test_results).toBeDefined();
      expect(result.output.test_results.passed).toBeGreaterThan(0);
      expect(result.output.test_results.failed).toBe(0);
    });

    it("should include coverage metrics", async () => {
      const result = await agent.execute({
        id: "test_004",
        type: "test",
        description: "Test module",
        priority: "medium",
      });

      const coverage = result.output.coverage;
      expect(coverage.statements).toBeGreaterThan(0);
      expect(coverage.branches).toBeGreaterThan(0);
      expect(coverage.functions).toBeGreaterThan(0);
      expect(coverage.lines).toBeGreaterThan(0);
    });

    it("should include test files list", async () => {
      const result = await agent.execute({
        id: "test_005",
        type: "test",
        description: "Test",
        priority: "low",
      });

      expect(result.output.test_files).toBeDefined();
      expect(result.output.test_files.length).toBeGreaterThan(0);
    });

    it("should throw on missing type", async () => {
      await expect(agent.execute({ id: "test_006" })).rejects.toThrow("type");
    });

    it("should use dependency results when available", async () => {
      const result = await agent.execute({
        id: "test_007",
        type: "test",
        description: "Test auth",
        priority: "high",
        dependencyResults: {
          implementation: {
            output: {
              files_created: ["src/auth.js", "src/token.js"],
            },
          },
        },
      });

      expect(result.output.test_files.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("estimateTestCount", () => {
    it("should return higher count for auth tasks", () => {
      const authCount = agent.estimateTestCount("authentication system", "unit");
      const simpleCount = agent.estimateTestCount("simple module", "unit");
      expect(authCount).toBeGreaterThan(simpleCount);
    });

    it("should return fewer tests for integration type", () => {
      const unit = agent.estimateTestCount("module", "unit");
      const integration = agent.estimateTestCount("module", "integration");
      expect(unit).toBeGreaterThan(integration);
    });
  });
});
