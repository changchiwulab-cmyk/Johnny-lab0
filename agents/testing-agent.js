/**
 * TestingAgent - 測試代理
 *
 * 負責生成單元測試、集成測試和覆蓋率分析。
 * 模擬測試生成過程並回傳結構化結果。
 */
class TestingAgent {
  constructor() {
    this.name = "TestingAgent";
    this.version = "1.0.0";
  }

  /**
   * 執行測試生成子任務
   * @param {object} taskContext - { id, type, description, priority, dependencyResults }
   * @returns {object} 結構化結果
   */
  async execute(taskContext) {
    const startTime = Date.now();

    if (!taskContext || !taskContext.type) {
      throw new Error("任務上下文必須包含 type 屬性");
    }

    const testPlan = this.generateTestPlan(taskContext);
    const testResults = this.simulateTestExecution(testPlan);
    const coverage = this.calculateCoverage(testPlan, taskContext);

    return {
      metadata: {
        agent: this.name,
        version: this.version,
        subtask_id: taskContext.id,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      },
      status: "completed",
      output: {
        test_plan: testPlan,
        test_suites: testResults.suites,
        total_tests: testResults.totalTests,
        test_results: {
          passed: testResults.passed,
          failed: testResults.failed,
          skipped: testResults.skipped,
        },
        coverage,
        test_files: testPlan.files,
      },
    };
  }

  generateTestPlan(taskContext) {
    const description = taskContext.description || "";
    const implResult = taskContext.dependencyResults?.implementation;
    const filesCreated = implResult?.output?.files_created || [
      "src/module.js",
    ];

    const unitTests = filesCreated.map((file) => ({
      source_file: file,
      test_file: file
        .replace("src/", "tests/unit/")
        .replace(".js", ".test.js"),
      test_count: this.estimateTestCount(description, "unit"),
      type: "unit",
    }));

    const integrationTests = [
      {
        source_file: "src/index.js",
        test_file: "tests/integration/workflow.test.js",
        test_count: this.estimateTestCount(description, "integration"),
        type: "integration",
      },
    ];

    const allTests = [...unitTests, ...integrationTests];

    return {
      suites: allTests,
      files: allTests.map((t) => t.test_file),
      total_planned: allTests.reduce((sum, t) => sum + t.test_count, 0),
    };
  }

  simulateTestExecution(testPlan) {
    const totalTests = testPlan.total_planned;
    const passRate = 0.98;

    const passed = Math.floor(totalTests * passRate);
    const failed = 0;
    const skipped = totalTests - passed;

    return {
      suites: testPlan.suites.map((suite) => ({
        name: suite.test_file,
        type: suite.type,
        test_count: suite.test_count,
        passed: suite.test_count,
        failed: 0,
      })),
      totalTests,
      passed,
      failed,
      skipped,
    };
  }

  calculateCoverage(testPlan, taskContext) {
    const baseStatements = 87;
    const baseBranches = 79;
    const baseFunctions = 92;
    const baseLines = 88;

    const bonus = taskContext.priority === "critical" ? 5 : 0;

    return {
      statements: Math.min(100, baseStatements + bonus),
      branches: Math.min(100, baseBranches + bonus),
      functions: Math.min(100, baseFunctions + bonus),
      lines: Math.min(100, baseLines + bonus),
    };
  }

  estimateTestCount(description, type) {
    const lower = description.toLowerCase();
    const baseCount = type === "unit" ? 8 : 5;
    let multiplier = 1;

    if (lower.includes("auth") || lower.includes("security")) multiplier = 1.5;
    if (lower.includes("database") || lower.includes("payment"))
      multiplier = 1.3;

    return Math.ceil(baseCount * multiplier);
  }
}

module.exports = TestingAgent;

if (require.main === module) {
  const agent = new TestingAgent();
  agent
    .execute({
      id: "demo_test_001",
      type: "test",
      description: "Add user authentication with JWT tokens",
      priority: "high",
    })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    });
}
