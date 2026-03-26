const OrchestrationEngine = require("../../agents/orchestration-engine");

describe("OrchestrationEngine", () => {
  let engine;

  beforeEach(() => {
    engine = new OrchestrationEngine();
  });

  describe("constructor", () => {
    it("should initialize with correct name and version", () => {
      expect(engine.name).toBe("OrchestrationEngine");
      expect(engine.version).toBe("1.0.0");
    });

    it("should initialize all 4 agents", () => {
      expect(engine.agents.implementation).toBeDefined();
      expect(engine.agents.testing).toBeDefined();
      expect(engine.agents.documentation).toBeDefined();
      expect(engine.agents.security).toBeDefined();
    });

    it("should load config", () => {
      expect(engine.config).toBeDefined();
      expect(engine.config.max_parallel_agents).toBeDefined();
    });

    it("should set default maxParallel from config", () => {
      expect(engine.maxParallel).toBe(4);
    });

    it("should respect custom maxParallel", () => {
      const custom = new OrchestrationEngine({ maxParallel: 2 });
      expect(custom.maxParallel).toBe(2);
    });
  });

  describe("validateInput", () => {
    it("should throw on null input", () => {
      expect(() => engine.validateInput(null)).toThrow("非空字串");
    });

    it("should throw on empty string", () => {
      expect(() => engine.validateInput("")).toThrow("非空字串");
    });

    it("should throw on whitespace-only", () => {
      expect(() => engine.validateInput("   ")).toThrow("空白");
    });

    it("should pass for valid string", () => {
      expect(() => engine.validateInput("Add feature")).not.toThrow();
    });
  });

  describe("getAgentForNode", () => {
    it("should return correct agent for implementation", () => {
      const agent = engine.getAgentForNode({ agent: "implementation" });
      expect(agent.name).toBe("ImplementationAgent");
    });

    it("should return correct agent for testing", () => {
      const agent = engine.getAgentForNode({ agent: "testing" });
      expect(agent.name).toBe("TestingAgent");
    });

    it("should return correct agent for documentation", () => {
      const agent = engine.getAgentForNode({ agent: "documentation" });
      expect(agent.name).toBe("DocumentationAgent");
    });

    it("should return correct agent for security", () => {
      const agent = engine.getAgentForNode({ agent: "security" });
      expect(agent.name).toBe("SecurityAgent");
    });

    it("should throw for unknown agent type", () => {
      expect(() => engine.getAgentForNode({ agent: "unknown" })).toThrow(
        "未知",
      );
    });
  });

  describe("buildAgentContext", () => {
    it("should return empty context for nodes with no dependencies", () => {
      const TaskDAG = require("../../agents/task-dag");
      const dag = new TaskDAG();
      dag.addNode({ id: "a", name: "A", agent: "implementation" });

      const context = engine.buildAgentContext({ id: "a" }, dag);
      expect(Object.keys(context)).toHaveLength(0);
    });

    it("should include dependency results in context", () => {
      const TaskDAG = require("../../agents/task-dag");
      const dag = new TaskDAG();
      dag.addNode({ id: "a", name: "A", agent: "implementation" });
      dag.addNode({ id: "b", name: "B", agent: "testing" });
      dag.addEdge({ from: "a", to: "b" });
      dag.markCompleted("a", { output: { data: "test" } });

      const context = engine.buildAgentContext({ id: "b" }, dag);
      expect(context.implementation).toBeDefined();
      expect(context.implementation.output.data).toBe("test");
    });
  });

  describe("computeQualityMetrics", () => {
    it("should compute metrics from agent results", () => {
      const agentResults = {
        implementation: [
          {
            result: {
              quality: { estimated_quality_score: 96 },
            },
          },
        ],
        testing: [
          {
            result: {
              output: { coverage: { statements: 88 } },
            },
          },
        ],
        security: [
          {
            result: {
              output: { security_score: 92 },
            },
          },
        ],
      };

      const metrics = engine.computeQualityMetrics(agentResults);
      expect(metrics.code_quality_score).toBe(96);
      expect(metrics.test_coverage).toBe(88);
      expect(metrics.security_score).toBe(92);
      expect(metrics.overall_score).toBeDefined();
    });

    it("should handle empty results", () => {
      const metrics = engine.computeQualityMetrics({});
      expect(metrics.code_quality_score).toBeNull();
      expect(metrics.overall_score).toBeNull();
    });
  });

  describe("logEvent", () => {
    it("should add events to event log", () => {
      engine.logEvent("test_event", { key: "value" });
      expect(engine.eventLog).toHaveLength(1);
      expect(engine.eventLog[0].type).toBe("test_event");
      expect(engine.eventLog[0].data.key).toBe("value");
      expect(engine.eventLog[0].timestamp).toBeDefined();
    });
  });

  describe("getAgentDisplayName", () => {
    it("should return display names for known agents", () => {
      expect(engine.getAgentDisplayName("implementation")).toContain(
        "ImplementationAgent",
      );
      expect(engine.getAgentDisplayName("testing")).toContain("TestingAgent");
    });

    it("should return raw name for unknown agents", () => {
      expect(engine.getAgentDisplayName("custom")).toBe("custom");
    });
  });
});
