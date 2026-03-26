/**
 * DocumentationAgent - 文檔代理
 *
 * 負責生成 API 文檔、README 更新和變更日誌。
 * 模擬文檔生成過程並回傳結構化結果。
 */
class DocumentationAgent {
  constructor() {
    this.name = "DocumentationAgent";
    this.version = "1.0.0";
  }

  /**
   * 執行文檔生成子任務
   * @param {object} taskContext - { id, type, description, priority, dependencyResults }
   * @returns {object} 結構化結果
   */
  async execute(taskContext) {
    const startTime = Date.now();

    if (!taskContext || !taskContext.type) {
      throw new Error("任務上下文必須包含 type 屬性");
    }

    const docNeeds = this.analyzeDocNeeds(taskContext);
    const docPlan = this.generateDocPlan(docNeeds, taskContext);
    const documents = this.simulateDocGeneration(docPlan);

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
        documents_generated: documents,
        total_documents: documents.length,
        inline_comments_added: this.estimateInlineComments(taskContext),
        documentation_coverage: this.estimateDocCoverage(taskContext),
        changelog_entry: this.generateChangelogEntry(taskContext),
      },
    };
  }

  analyzeDocNeeds(taskContext) {
    const needs = ["changelog"];
    const description = (taskContext.description || "").toLowerCase();

    if (description.includes("api") || description.includes("endpoint")) {
      needs.push("api_docs");
    }
    if (
      description.includes("new") ||
      description.includes("add") ||
      description.includes("create")
    ) {
      needs.push("readme_update");
    }
    if (description.includes("config") || description.includes("setup")) {
      needs.push("setup_guide");
    }

    // 預設至少有 API 文檔
    if (!needs.includes("api_docs")) {
      needs.push("api_docs");
    }

    return needs;
  }

  generateDocPlan(needs, taskContext) {
    return needs.map((need) => ({
      type: need,
      priority:
        need === "api_docs" ? "high" : need === "changelog" ? "high" : "medium",
      sections: this.getSectionsForType(need, taskContext),
    }));
  }

  getSectionsForType(docType, taskContext) {
    const sections = {
      api_docs: ["概述", "端點", "參數", "回應格式", "錯誤碼", "範例"],
      readme_update: ["功能說明", "使用方式", "配置選項"],
      changelog: ["版本號", "變更摘要", "影響範圍"],
      setup_guide: ["前置條件", "安裝步驟", "配置說明", "驗證方式"],
    };

    return sections[docType] || ["概述", "詳情"];
  }

  simulateDocGeneration(docPlan) {
    return docPlan.map((plan) => ({
      type: plan.type,
      path: this.getDocPath(plan.type),
      sections: plan.sections,
      word_count: plan.sections.length * 120,
      status: "generated",
    }));
  }

  getDocPath(docType) {
    const paths = {
      api_docs: "docs/api.md",
      readme_update: "README.md",
      changelog: "CHANGELOG.md",
      setup_guide: "docs/setup.md",
    };
    return paths[docType] || `docs/${docType}.md`;
  }

  estimateInlineComments(taskContext) {
    const implResult = taskContext.dependencyResults?.implementation;
    const linesAdded = implResult?.output?.lines_added || 50;
    return Math.ceil(linesAdded * 0.15);
  }

  estimateDocCoverage(taskContext) {
    const baseCoverage = 82;
    const bonus = taskContext.priority === "critical" ? 8 : 0;
    return Math.min(100, baseCoverage + bonus);
  }

  generateChangelogEntry(taskContext) {
    const description = taskContext.description || "未知變更";
    const date = new Date().toISOString().split("T")[0];

    return {
      version: "1.1.0",
      date,
      type: this.getChangeType(taskContext),
      summary: description.substring(0, 100),
    };
  }

  getChangeType(taskContext) {
    const description = (taskContext.description || "").toLowerCase();
    if (description.includes("fix") || description.includes("bug"))
      return "fix";
    if (description.includes("refactor")) return "refactor";
    return "feature";
  }
}

module.exports = DocumentationAgent;

if (require.main === module) {
  const agent = new DocumentationAgent();
  agent
    .execute({
      id: "demo_doc_001",
      type: "document",
      description: "Add new API endpoint for user authentication",
      priority: "medium",
    })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    });
}
