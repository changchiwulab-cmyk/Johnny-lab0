const fs = require("fs");
const path = require("path");
const os = require("os");
const TaskDecomposer = require("./task-decomposer");
const ImplementationAgent = require("./implementation-agent");
const TestingAgent = require("./testing-agent");
const DocumentationAgent = require("./documentation-agent");
const SecurityAgent = require("./security-agent");

/**
 * OrchestrationEngine - 編排引擎
 *
 * 協調多個專業化代理，通過 DAG 調度實現並行執行。
 * 負責任務分解、代理調度、結果合成和報告生成。
 */
class OrchestrationEngine {
  constructor(options = {}) {
    this.name = "OrchestrationEngine";
    this.version = "1.0.0";

    this.agents = {
      implementation: new ImplementationAgent(),
      testing: new TestingAgent(),
      documentation: new DocumentationAgent(),
      security: new SecurityAgent(),
    };

    this.config = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../tools/agent-registry.json"),
        "utf-8",
      ),
    );

    this.maxParallel =
      options.maxParallel || this.config.max_parallel_agents || 4;
    this.decomposer = new TaskDecomposer();
    this.results = new Map();
    this.eventLog = [];
  }

  /**
   * 主入口：編排完整工作流
   * @param {string} taskDescription - 任務描述
   * @param {object} options - { type, priority, outputDir }
   * @returns {object} 編排結果
   */
  async orchestrate(taskDescription, options = {}) {
    const workflowStartTime = Date.now();
    this.results.clear();
    this.eventLog = [];

    this.logEvent("workflow_start", { taskDescription });

    // Step 1: 驗證輸入
    console.log("\n📥 Step 1: 驗證輸入...");
    this.validateInput(taskDescription);
    console.log("✅ Step 1 完成：輸入驗證通過");

    // Step 2: 分解任務
    console.log("\n🔍 Step 2: 分解任務...");
    const { dag, metadata } = await this.decomposer.decompose(
      taskDescription,
      options,
    );
    this.logEvent("decomposition_complete", metadata);
    console.log(
      `✅ Step 2 完成：${metadata.subtaskCount} 個子任務，${metadata.parallelGroups} 個並行分組`,
    );

    // Step 3: 驗證 DAG
    console.log("\n🔗 Step 3: 驗證 DAG...");
    dag.validateDAG();
    console.log("✅ Step 3 完成：DAG 無循環依賴");

    // Step 4: 執行 DAG
    console.log("\n⚡ Step 4: 執行代理...");
    await this.executeDAG(dag);
    console.log("✅ Step 4 完成：所有代理執行完畢");

    // Step 5: 合成結果
    console.log("\n📊 Step 5: 合成結果...");
    const synthesized = this.synthesizeResults(dag, metadata);
    this.logEvent("synthesis_complete", {
      agentCount: Object.keys(synthesized.agentResults).length,
    });
    console.log("✅ Step 5 完成：結果合成完畢");

    // Step 6: 生成報告
    console.log("\n📋 Step 6: 生成報告...");
    const outputDir =
      options.outputDir || fs.mkdtempSync(path.join(os.tmpdir(), "orch-"));
    const reportFile = this.generateReport(synthesized, outputDir, metadata);
    console.log(`✅ Step 6 完成：報告已生成 ${reportFile}`);

    const duration = Date.now() - workflowStartTime;
    this.logEvent("workflow_complete", { duration_ms: duration });

    return {
      success: true,
      status: "completed",
      duration_ms: duration,
      report_file: reportFile,
      artifacts: {
        dag_summary: dag.getSummary(),
        agent_results: synthesized.agentResults,
        quality_metrics: synthesized.qualityMetrics,
      },
      metadata: {
        ...metadata,
        total_duration_ms: duration,
        agents_used: Object.keys(this.agents).length,
        max_parallel: this.maxParallel,
      },
      event_log: this.eventLog,
    };
  }

  validateInput(taskDescription) {
    if (!taskDescription || typeof taskDescription !== "string") {
      throw new Error("任務描述必須為非空字串");
    }
    if (taskDescription.trim().length === 0) {
      throw new Error("任務描述不能為空白");
    }
  }

  /**
   * 執行 DAG - 就緒節點輪詢調度迴圈
   */
  async executeDAG(dag) {
    let iteration = 0;

    while (true) {
      const readyNodes = dag.getReadyNodes();
      if (readyNodes.length === 0) {
        // 檢查是否所有節點都已完成或失敗
        const summary = dag.getSummary();
        if (summary.pending === 0) break;

        // 如果還有 pending 節點但沒有 ready 節點，表示有阻塞
        throw new Error(
          `DAG 執行阻塞：${summary.pending} 個待處理節點無法執行`,
        );
      }

      iteration++;
      const batch = readyNodes.slice(0, this.maxParallel);

      console.log(
        `  🔄 批次 ${iteration}: 並行執行 ${batch.length} 個子任務 [${batch.map((n) => n.name).join(", ")}]`,
      );

      this.logEvent("batch_start", {
        iteration,
        nodes: batch.map((n) => n.id),
      });

      // 並行執行批次中的所有節點
      const batchResults = await Promise.allSettled(
        batch.map((node) => this.executeNode(node, dag)),
      );

      // 處理結果
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const node = batch[i];

        if (result.status === "fulfilled") {
          dag.markCompleted(node.id, result.value);
          this.results.set(node.id, result.value);
        } else {
          dag.markFailed(node.id, result.reason?.message || "未知錯誤");
          this.logEvent("node_failed", {
            nodeId: node.id,
            error: result.reason?.message,
          });
        }
      }
    }
  }

  /**
   * 執行單一節點
   */
  async executeNode(node, dag) {
    const agent = this.getAgentForNode(node);
    const context = this.buildAgentContext(node, dag);

    const taskContext = {
      id: node.id,
      type: node.type,
      description: node.description,
      priority: node.priority,
      dependencyResults: context,
    };

    const startTime = Date.now();
    const result = await agent.execute(taskContext);
    const duration = Date.now() - startTime;

    this.logEvent("node_complete", {
      nodeId: node.id,
      agent: agent.name,
      duration_ms: duration,
    });

    return result;
  }

  getAgentForNode(node) {
    const agent = this.agents[node.agent];
    if (!agent) {
      throw new Error(`未知的代理類型: ${node.agent}`);
    }
    return agent;
  }

  /**
   * 建立代理上下文 - 收集依賴節點的結果
   */
  buildAgentContext(node, dag) {
    const context = {};
    const deps = dag.getDependencies(node.id);

    for (const dep of deps) {
      if (dep.result) {
        context[dep.agent] = dep.result;
      }
    }

    return context;
  }

  /**
   * 合成所有代理結果
   */
  synthesizeResults(dag, metadata) {
    const agentResults = {};
    const allNodes = [...dag.nodes.values()];

    for (const node of allNodes) {
      if (node.result) {
        if (!agentResults[node.agent]) {
          agentResults[node.agent] = [];
        }
        agentResults[node.agent].push({
          subtask_id: node.id,
          subtask_type: node.type,
          result: node.result,
        });
      }
    }

    const qualityMetrics = this.computeQualityMetrics(agentResults);

    return {
      executionSummary: dag.getSummary(),
      agentResults,
      qualityMetrics,
      taskType: metadata.taskType,
      timestamp: new Date().toISOString(),
    };
  }

  computeQualityMetrics(agentResults) {
    const metrics = {
      code_quality_score: null,
      test_coverage: null,
      documentation_coverage: null,
      security_score: null,
      overall_score: null,
    };

    // 從各代理結果中提取指標
    if (agentResults.implementation) {
      const implResults = agentResults.implementation;
      const scores = implResults
        .map((r) => r.result?.quality?.estimated_quality_score)
        .filter(Boolean);
      if (scores.length > 0) {
        metrics.code_quality_score =
          scores.reduce((a, b) => a + b, 0) / scores.length;
      }
    }

    if (agentResults.testing) {
      const testResults = agentResults.testing;
      const coverages = testResults
        .map((r) => r.result?.output?.coverage?.statements)
        .filter(Boolean);
      if (coverages.length > 0) {
        metrics.test_coverage =
          coverages.reduce((a, b) => a + b, 0) / coverages.length;
      }
    }

    if (agentResults.documentation) {
      const docResults = agentResults.documentation;
      const coverages = docResults
        .map((r) => r.result?.output?.documentation_coverage)
        .filter(Boolean);
      if (coverages.length > 0) {
        metrics.documentation_coverage =
          coverages.reduce((a, b) => a + b, 0) / coverages.length;
      }
    }

    if (agentResults.security) {
      const secResults = agentResults.security;
      const scores = secResults
        .map((r) => r.result?.output?.security_score)
        .filter((s) => s !== undefined && s !== null);
      if (scores.length > 0) {
        metrics.security_score =
          scores.reduce((a, b) => a + b, 0) / scores.length;
      }
    }

    // 計算綜合分數
    const validScores = [
      metrics.code_quality_score,
      metrics.test_coverage,
      metrics.documentation_coverage,
      metrics.security_score,
    ].filter((s) => s !== null);

    if (validScores.length > 0) {
      metrics.overall_score =
        Math.round(
          (validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10,
        ) / 10;
    }

    return metrics;
  }

  /**
   * 生成 Markdown 報告
   */
  generateReport(synthesized, outputDir, metadata) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = path.join(
      outputDir,
      `orchestration_report_${timestamp}.md`,
    );

    const report = this.buildReportMarkdown(synthesized, metadata);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(reportPath, report, "utf-8");

    return reportPath;
  }

  buildReportMarkdown(synthesized, metadata) {
    const { executionSummary, qualityMetrics, taskType } = synthesized;
    const lines = [];

    lines.push("# 多代理編排執行報告");
    lines.push("");
    lines.push(`**生成時間**: ${new Date().toISOString()}`);
    lines.push(`**任務類型**: ${taskType}`);
    lines.push(`**編排引擎版本**: ${this.version}`);
    lines.push("");

    lines.push("---");
    lines.push("");

    // 執行摘要
    lines.push("## 執行摘要");
    lines.push("");
    lines.push(`| 指標 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 總節點數 | ${executionSummary.totalNodes} |`);
    lines.push(`| 已完成 | ${executionSummary.completed} |`);
    lines.push(`| 失敗 | ${executionSummary.failed} |`);
    lines.push(`| 並行分組 | ${executionSummary.parallelGroups} |`);
    lines.push(`| 使用代理數 | ${Object.keys(this.agents).length} |`);
    lines.push("");

    // 品質指標
    lines.push("## 品質指標");
    lines.push("");
    lines.push(`| 指標 | 分數 |`);
    lines.push(`|------|------|`);
    if (qualityMetrics.code_quality_score !== null) {
      lines.push(
        `| 代碼品質 | ${qualityMetrics.code_quality_score.toFixed(1)} |`,
      );
    }
    if (qualityMetrics.test_coverage !== null) {
      lines.push(
        `| 測試覆蓋率 | ${qualityMetrics.test_coverage.toFixed(1)}% |`,
      );
    }
    if (qualityMetrics.documentation_coverage !== null) {
      lines.push(
        `| 文檔覆蓋率 | ${qualityMetrics.documentation_coverage.toFixed(1)}% |`,
      );
    }
    if (qualityMetrics.security_score !== null) {
      lines.push(
        `| 安全分數 | ${qualityMetrics.security_score.toFixed(1)} |`,
      );
    }
    if (qualityMetrics.overall_score !== null) {
      lines.push(`| **綜合分數** | **${qualityMetrics.overall_score}** |`);
    }
    lines.push("");

    // 代理結果
    lines.push("## 代理執行結果");
    lines.push("");
    for (const [agentType, results] of Object.entries(
      synthesized.agentResults,
    )) {
      lines.push(`### ${this.getAgentDisplayName(agentType)}`);
      lines.push("");
      for (const r of results) {
        lines.push(`- **${r.subtask_type}** (${r.subtask_id}): 完成`);
      }
      lines.push("");
    }

    // 分解元數據
    lines.push("## 任務分解詳情");
    lines.push("");
    lines.push(`- 任務類型: ${metadata.taskType}`);
    lines.push(`- 複雜度: ${metadata.complexity}`);
    lines.push(`- 優先級: ${metadata.priority}`);
    lines.push(`- 子任務數: ${metadata.subtaskCount}`);
    lines.push(`- 分解耗時: ${metadata.duration_ms}ms`);
    lines.push("");

    lines.push("---");
    lines.push("");
    lines.push(
      `*由 ${this.name} v${this.version} 生成 | ${new Date().toISOString()}*`,
    );

    return lines.join("\n");
  }

  getAgentDisplayName(agentType) {
    const names = {
      implementation: "實現代理 (ImplementationAgent)",
      testing: "測試代理 (TestingAgent)",
      documentation: "文檔代理 (DocumentationAgent)",
      security: "安全代理 (SecurityAgent)",
    };
    return names[agentType] || agentType;
  }

  logEvent(eventType, data) {
    this.eventLog.push({
      type: eventType,
      timestamp: new Date().toISOString(),
      data,
    });
  }
}

module.exports = OrchestrationEngine;

if (require.main === module) {
  const engine = new OrchestrationEngine();
  const taskDescription =
    process.argv[2] || "Add user authentication with JWT tokens";

  console.log("=".repeat(60));
  console.log("📋 多代理編排引擎 - 示範執行");
  console.log("=".repeat(60));
  console.log(`\n任務: ${taskDescription}\n`);

  engine
    .orchestrate(taskDescription)
    .then((result) => {
      console.log("\n" + "=".repeat(60));
      console.log("🎉 編排完成！");
      console.log("=".repeat(60));
      console.log(`  耗時: ${result.duration_ms}ms`);
      console.log(`  報告: ${result.report_file}`);
      console.log(
        `  品質分數: ${result.artifacts.quality_metrics.overall_score}`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ 編排失敗:", err.message);
      process.exit(1);
    });
}
