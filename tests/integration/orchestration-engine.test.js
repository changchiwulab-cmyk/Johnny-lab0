const fs = require("fs");
const path = require("path");
const os = require("os");
const OrchestrationEngine = require("../../agents/orchestration-engine");
const fixtures = require("../fixtures/sample-task.json");

describe("OrchestrationEngine - Integration Tests", () => {
  let engine;
  let tmpDir;

  beforeEach(() => {
    engine = new OrchestrationEngine();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orch-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("constructor", () => {
    it("should initialize with all 4 agents", () => {
      expect(engine.agents.implementation).toBeDefined();
      expect(engine.agents.testing).toBeDefined();
      expect(engine.agents.documentation).toBeDefined();
      expect(engine.agents.security).toBeDefined();
    });

    it("should have correct name and version", () => {
      expect(engine.name).toBe("OrchestrationEngine");
      expect(engine.version).toBe("1.0.0");
    });
  });

  describe("orchestrate - full end-to-end", () => {
    it("should complete feature task orchestration", async () => {
      const result = await engine.orchestrate(
        fixtures.simple_feature.description,
        { outputDir: tmpDir },
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe("completed");
      expect(result.duration_ms).toBeGreaterThan(0);
      expect(result.report_file).toBeDefined();
      expect(result.artifacts).toBeDefined();
    });

    it("should complete bugfix task orchestration", async () => {
      const result = await engine.orchestrate(
        fixtures.bugfix.description,
        { type: "bugfix", outputDir: tmpDir },
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe("completed");
    });

    it("should complete refactor task orchestration", async () => {
      const result = await engine.orchestrate(
        fixtures.refactor.description,
        { outputDir: tmpDir },
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe("completed");
    });

    it("should generate report file", async () => {
      const result = await engine.orchestrate(
        fixtures.simple_feature.description,
        { outputDir: tmpDir },
      );

      expect(fs.existsSync(result.report_file)).toBe(true);
      const content = fs.readFileSync(result.report_file, "utf-8");
      expect(content).toContain("多代理編排執行報告");
      expect(content).toContain("執行摘要");
      expect(content).toContain("品質指標");
    });

    it("should include quality metrics in artifacts", async () => {
      const result = await engine.orchestrate(
        fixtures.simple_feature.description,
        { outputDir: tmpDir },
      );

      const metrics = result.artifacts.quality_metrics;
      expect(metrics.code_quality_score).toBeGreaterThan(0);
      expect(metrics.test_coverage).toBeGreaterThan(0);
      expect(metrics.security_score).toBeGreaterThan(0);
      expect(metrics.overall_score).toBeGreaterThan(0);
    });

    it("should include DAG summary in artifacts", async () => {
      const result = await engine.orchestrate(
        fixtures.simple_feature.description,
        { outputDir: tmpDir },
      );

      const summary = result.artifacts.dag_summary;
      expect(summary.totalNodes).toBeGreaterThan(0);
      expect(summary.completed).toBe(summary.totalNodes);
      expect(summary.failed).toBe(0);
    });

    it("should include metadata", async () => {
      const result = await engine.orchestrate(
        fixtures.simple_feature.description,
        { outputDir: tmpDir },
      );

      expect(result.metadata.taskType).toBeDefined();
      expect(result.metadata.complexity).toBeDefined();
      expect(result.metadata.subtaskCount).toBeGreaterThan(0);
      expect(result.metadata.agents_used).toBe(4);
    });

    it("should work with default outputDir", async () => {
      const result = await engine.orchestrate(
        "Add simple feature for testing",
      );

      expect(result.success).toBe(true);
      // Clean up the auto-created temp dir
      if (result.report_file) {
        const dir = path.dirname(result.report_file);
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("parallel execution", () => {
    it("should execute multiple agents without blocking", async () => {
      const result = await engine.orchestrate(
        fixtures.simple_feature.description,
        { outputDir: tmpDir },
      );

      // Feature task has 5 subtasks across 3 parallel groups
      expect(result.artifacts.dag_summary.totalNodes).toBe(5);
      expect(result.artifacts.dag_summary.parallelGroups).toBe(3);
    });

    it("should respect maxParallel setting", async () => {
      const limitedEngine = new OrchestrationEngine({ maxParallel: 1 });
      const result = await limitedEngine.orchestrate(
        fixtures.simple_feature.description,
        { outputDir: tmpDir },
      );

      expect(result.success).toBe(true);
    });
  });

  describe("context passing between agents", () => {
    it("should pass implementation results to downstream agents", async () => {
      const result = await engine.orchestrate(
        fixtures.simple_feature.description,
        { outputDir: tmpDir },
      );

      // The event log should show implementation completing before testing
      const nodeCompleteEvents = result.event_log.filter(
        (e) => e.type === "node_complete",
      );
      expect(nodeCompleteEvents.length).toBeGreaterThanOrEqual(5);

      // Check that agents in later groups ran after earlier ones
      const agentOrder = nodeCompleteEvents.map((e) => e.data.agent);
      const implIndex = agentOrder.indexOf("ImplementationAgent");
      const testIndex = agentOrder.lastIndexOf("TestingAgent");

      // Implementation should appear before testing in event log
      if (implIndex !== -1 && testIndex !== -1) {
        expect(implIndex).toBeLessThan(testIndex);
      }
    });
  });

  describe("error propagation", () => {
    it("should reject on empty task description", async () => {
      await expect(
        engine.orchestrate("", { outputDir: tmpDir }),
      ).rejects.toThrow("非空字串");
    });

    it("should reject on null task description", async () => {
      await expect(
        engine.orchestrate(null, { outputDir: tmpDir }),
      ).rejects.toThrow();
    });

    it("should propagate agent failure", async () => {
      jest
        .spyOn(engine.agents.implementation, "execute")
        .mockRejectedValue(new Error("Agent crashed"));

      await expect(
        engine.orchestrate("Add feature", { outputDir: tmpDir }),
      ).rejects.toThrow();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });
  });

  describe("event logging", () => {
    it("should log workflow start and complete events", async () => {
      const result = await engine.orchestrate(
        fixtures.simple_feature.description,
        { outputDir: tmpDir },
      );

      const eventTypes = result.event_log.map((e) => e.type);
      expect(eventTypes).toContain("workflow_start");
      expect(eventTypes).toContain("workflow_complete");
      expect(eventTypes).toContain("decomposition_complete");
      expect(eventTypes).toContain("synthesis_complete");
    });

    it("should log batch execution events", async () => {
      const result = await engine.orchestrate(
        fixtures.simple_feature.description,
        { outputDir: tmpDir },
      );

      const batchEvents = result.event_log.filter(
        (e) => e.type === "batch_start",
      );
      expect(batchEvents.length).toBeGreaterThan(0);
    });
  });
});
