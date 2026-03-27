/**
 * ImplementationAgent - 實現代理
 *
 * 負責代碼生成、修改、Bug 修復和需求分析。
 * 模擬代碼實現過程並回傳結構化結果。
 */
class ImplementationAgent {
  constructor() {
    this.name = "ImplementationAgent";
    this.version = "1.0.0";
  }

  /**
   * 執行子任務
   * @param {object} taskContext - { id, type, description, priority, dependencies }
   * @returns {object} 結構化結果
   */
  async execute(taskContext) {
    const startTime = Date.now();

    if (!taskContext || !taskContext.type) {
      throw new Error("任務上下文必須包含 type 屬性");
    }

    let output;
    switch (taskContext.type) {
      case "analyze":
        output = this.executeAnalysis(taskContext);
        break;
      case "implement":
        output = this.executeImplementation(taskContext);
        break;
      case "fix":
      case "diagnose":
        output = this.executeBugFix(taskContext);
        break;
      default:
        output = this.executeImplementation(taskContext);
    }

    return {
      metadata: {
        agent: this.name,
        version: this.version,
        subtask_id: taskContext.id,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      },
      status: "completed",
      output,
      quality: this.estimateQuality(taskContext),
    };
  }

  executeAnalysis(taskContext) {
    const description = taskContext.description || "";
    const components = this.extractComponents(description);

    return {
      analysis_type: "requirement_analysis",
      components_identified: components,
      impact_scope: this.assessImpactScope(components),
      architecture_notes: `分析完成：識別到 ${components.length} 個相關元件`,
      dependencies_found: components.slice(0, 2).map((c) => `${c}/index.js`),
      recommendations: [
        "建議先建立介面定義",
        "確認與現有模組的相容性",
        "準備回滾方案",
      ],
    };
  }

  executeImplementation(taskContext) {
    const description = taskContext.description || "";
    const components = this.extractComponents(description);
    const fileCount = Math.max(2, components.length);

    return {
      implementation_type: "code_generation",
      files_created: components.map(
        (c) => `src/${c.toLowerCase()}/${c.toLowerCase()}.js`,
      ),
      files_modified: [`src/index.js`, `src/config.js`],
      lines_added: fileCount * 45 + 20,
      lines_removed: Math.floor(fileCount * 5),
      patterns_used: this.suggestPatterns(description),
      implementation_notes: `實現完成：建立 ${fileCount} 個檔案，修改 2 個檔案`,
    };
  }

  executeBugFix(taskContext) {
    const description = taskContext.description || "";

    return {
      fix_type: "bug_fix",
      root_cause: `根據描述分析的根本原因: ${description.substring(0, 50)}`,
      files_modified: ["src/core/handler.js", "src/utils/validator.js"],
      lines_added: 15,
      lines_removed: 8,
      regression_risk: "low",
      fix_notes: "修復完成：已驗證邊界條件處理",
    };
  }

  extractComponents(description) {
    const componentKeywords = [
      "auth",
      "user",
      "payment",
      "api",
      "database",
      "service",
      "controller",
      "model",
      "view",
      "router",
      "middleware",
      "config",
      "util",
    ];

    const lower = description.toLowerCase();
    const found = componentKeywords.filter((kw) => lower.includes(kw));

    if (found.length === 0) {
      return ["Module", "Handler"];
    }

    return found.map((kw) => kw.charAt(0).toUpperCase() + kw.slice(1));
  }

  assessImpactScope(components) {
    if (components.length >= 4) return "high";
    if (components.length >= 2) return "medium";
    return "low";
  }

  suggestPatterns(description) {
    const patterns = [];
    const lower = description.toLowerCase();

    if (lower.includes("strategy") || lower.includes("pattern"))
      patterns.push("Strategy Pattern");
    if (lower.includes("auth") || lower.includes("token"))
      patterns.push("Middleware Pattern");
    if (lower.includes("api") || lower.includes("endpoint"))
      patterns.push("Controller Pattern");
    if (lower.includes("database") || lower.includes("model"))
      patterns.push("Repository Pattern");

    if (patterns.length === 0) {
      patterns.push("Module Pattern");
    }

    return patterns;
  }

  estimateQuality(taskContext) {
    const baseScore = 95;
    const priorityBonus =
      taskContext.priority === "critical"
        ? -2
        : taskContext.priority === "low"
          ? 2
          : 0;

    return {
      estimated_quality_score: Math.min(100, baseScore + priorityBonus),
      confidence: "high",
      potential_issues:
        taskContext.priority === "critical"
          ? ["高優先級任務需要額外審查"]
          : [],
    };
  }
}

module.exports = ImplementationAgent;

if (require.main === module) {
  const agent = new ImplementationAgent();
  agent
    .execute({
      id: "demo_001",
      type: "implement",
      description: "Add user authentication with JWT tokens",
      priority: "high",
    })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    });
}
