const fs = require("fs");
const path = require("path");
const TaskDAG = require("./task-dag");

/**
 * TaskDecomposer - 任務分解代理
 *
 * 將任務描述分解為子任務 DAG，包含任務分類、
 * 複雜度評估、子任務生成和依賴關係建立。
 */
class TaskDecomposer {
  constructor() {
    this.name = "TaskDecomposer";
    this.version = "1.0.0";
    this.config = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../tools/task-templates.json"),
        "utf-8",
      ),
    );
  }

  /**
   * 分解任務
   * @param {string} taskDescription - 任務描述
   * @param {object} options - 選項 { type, priority }
   * @returns {{ dag: TaskDAG, metadata: object }}
   */
  async decompose(taskDescription, options = {}) {
    const startTime = Date.now();

    this.validateInput(taskDescription);

    const taskType = options.type || this.classifyTask(taskDescription);
    const complexity = this.assessComplexity(taskDescription);
    const priority = options.priority || this.complexityToPriority(complexity);

    const typeConfig = this.config.task_types[taskType];
    if (!typeConfig) {
      throw new Error(`未知的任務類型: ${taskType}`);
    }

    const subtasks = this.buildSubtasks(
      taskType,
      taskDescription,
      priority,
      typeConfig,
    );
    const edges = this.buildDependencyEdges(subtasks, typeConfig);

    const dag = new TaskDAG({ subtasks, edges });
    dag.validateDAG();

    const metadata = {
      taskType,
      complexity,
      priority,
      subtaskCount: subtasks.length,
      parallelGroups: dag.getParallelGroups().length,
      decomposed_by: this.name,
      version: this.version,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
    };

    return { dag, metadata };
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
   * 分類任務類型
   */
  classifyTask(description) {
    const lower = description.toLowerCase();
    const keywords = this.config.classification_keywords;

    let bestType = "feature";
    let bestScore = 0;

    for (const [type, typeKeywords] of Object.entries(keywords)) {
      let score = 0;
      for (const kw of typeKeywords) {
        if (lower.includes(kw)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }

    return bestType;
  }

  /**
   * 評估任務複雜度
   */
  assessComplexity(description) {
    const lower = description.toLowerCase();
    const keywords = this.config.complexity_keywords;

    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const kw of keywords.high) {
      if (lower.includes(kw)) highCount++;
    }
    for (const kw of keywords.medium) {
      if (lower.includes(kw)) mediumCount++;
    }
    for (const kw of keywords.low) {
      if (lower.includes(kw)) lowCount++;
    }

    if (highCount >= 2) return "critical";
    if (highCount >= 1) return "high";
    if (mediumCount >= 1) return "medium";
    return "low";
  }

  complexityToPriority(complexity) {
    const map = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
    };
    return map[complexity] || "medium";
  }

  /**
   * 建立子任務
   */
  buildSubtasks(taskType, description, priority, typeConfig) {
    const subtasks = [];

    for (let i = 0; i < typeConfig.subtasks.length; i++) {
      const subtaskType = typeConfig.subtasks[i];
      const definition = this.config.subtask_definitions[subtaskType];

      subtasks.push({
        id: `${taskType}_${subtaskType}_${String(i).padStart(3, "0")}`,
        type: subtaskType,
        name: definition.name,
        description: `${definition.description} - ${description}`,
        agent: definition.agent,
        priority: priority,
        estimatedDuration: this.estimateDuration(subtaskType, priority),
      });
    }

    return subtasks;
  }

  /**
   * 建立依賴邊
   * 根據 parallel_groups 配置，組 N 中的每個子任務依賴於組 N-1 中的所有子任務
   */
  buildDependencyEdges(subtasks, typeConfig) {
    const edges = [];
    const groups = typeConfig.parallel_groups;

    // 建立子任務類型到 ID 的映射
    const typeToId = new Map();
    for (const subtask of subtasks) {
      typeToId.set(subtask.type, subtask.id);
    }

    for (let g = 1; g < groups.length; g++) {
      const prevGroup = groups[g - 1];
      const currGroup = groups[g];

      for (const prevType of prevGroup) {
        for (const currType of currGroup) {
          const fromId = typeToId.get(prevType);
          const toId = typeToId.get(currType);
          if (fromId && toId) {
            edges.push({ from: fromId, to: toId });
          }
        }
      }
    }

    return edges;
  }

  estimateDuration(subtaskType, priority) {
    const baseDurations = {
      analyze: 5000,
      implement: 15000,
      test: 10000,
      document: 8000,
      security_scan: 10000,
    };

    const priorityMultipliers = {
      critical: 1.5,
      high: 1.2,
      medium: 1.0,
      low: 0.8,
    };

    const base = baseDurations[subtaskType] || 10000;
    const multiplier = priorityMultipliers[priority] || 1.0;
    return Math.round(base * multiplier);
  }
}

module.exports = TaskDecomposer;

if (require.main === module) {
  const decomposer = new TaskDecomposer();
  decomposer
    .decompose("Add user authentication with JWT tokens")
    .then((result) => {
      console.log("分解結果:");
      console.log("  任務類型:", result.metadata.taskType);
      console.log("  複雜度:", result.metadata.complexity);
      console.log("  子任務數:", result.metadata.subtaskCount);
      console.log("  並行分組:", result.metadata.parallelGroups);
      console.log("\nDAG 摘要:", result.dag.getSummary());
      console.log(
        "\n並行分組:",
        JSON.stringify(result.dag.getParallelGroups(), null, 2),
      );
    })
    .catch((err) => {
      console.error("分解失敗:", err.message);
      process.exit(1);
    });
}
