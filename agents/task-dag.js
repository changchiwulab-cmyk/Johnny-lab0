const fs = require("fs");
const path = require("path");

/**
 * TaskDAG - 任務有向無環圖引擎
 *
 * 管理任務子項目之間的依賴關係，支援拓撲排序、
 * 並行分組、循環檢測和動態就緒節點追蹤。
 */
class TaskDAG {
  constructor(config) {
    this.nodes = new Map();
    this.edges = [];

    if (config && config.subtasks && config.edges) {
      this.buildFromDecomposition(config);
    }
  }

  buildFromDecomposition(decomposition) {
    for (const subtask of decomposition.subtasks) {
      this.addNode(subtask);
    }
    for (const edge of decomposition.edges) {
      this.addEdge(edge);
    }
  }

  addNode(node) {
    if (!node || !node.id) {
      throw new Error("節點必須包含 id 屬性");
    }
    if (this.nodes.has(node.id)) {
      throw new Error(`節點 ID 重複: ${node.id}`);
    }
    this.nodes.set(node.id, {
      ...node,
      status: node.status || "pending",
      result: null,
    });
  }

  addEdge(edge) {
    if (!edge || !edge.from || !edge.to) {
      throw new Error("邊必須包含 from 和 to 屬性");
    }
    if (!this.nodes.has(edge.from)) {
      throw new Error(`來源節點不存在: ${edge.from}`);
    }
    if (!this.nodes.has(edge.to)) {
      throw new Error(`目標節點不存在: ${edge.to}`);
    }
    if (edge.from === edge.to) {
      throw new Error(`自循環邊不允許: ${edge.from}`);
    }
    this.edges.push({ from: edge.from, to: edge.to });
  }

  getNode(nodeId) {
    return this.nodes.get(nodeId) || null;
  }

  getNodeCount() {
    return this.nodes.size;
  }

  getEdgeCount() {
    return this.edges.length;
  }

  getDependencies(nodeId) {
    return this.edges
      .filter((e) => e.to === nodeId)
      .map((e) => this.nodes.get(e.from));
  }

  getDependents(nodeId) {
    return this.edges
      .filter((e) => e.from === nodeId)
      .map((e) => this.nodes.get(e.to));
  }

  /**
   * 拓撲排序 - Kahn's 演算法
   * 回傳節點 ID 陣列（按拓撲順序排列）
   */
  topologicalSort() {
    const inDegree = new Map();
    for (const id of this.nodes.keys()) {
      inDegree.set(id, 0);
    }
    for (const edge of this.edges) {
      inDegree.set(edge.to, inDegree.get(edge.to) + 1);
    }

    const queue = [];
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    const sorted = [];
    while (queue.length > 0) {
      const current = queue.shift();
      sorted.push(current);

      for (const edge of this.edges) {
        if (edge.from === current) {
          const newDegree = inDegree.get(edge.to) - 1;
          inDegree.set(edge.to, newDegree);
          if (newDegree === 0) {
            queue.push(edge.to);
          }
        }
      }
    }

    return sorted;
  }

  /**
   * 驗證 DAG（檢測循環）
   * 若存在循環則拋出錯誤
   */
  validateDAG() {
    const sorted = this.topologicalSort();
    if (sorted.length !== this.nodes.size) {
      throw new Error("DAG 包含循環依賴");
    }
    return true;
  }

  /**
   * 取得執行順序（含完整節點資料）
   */
  getExecutionOrder() {
    const sortedIds = this.topologicalSort();
    return sortedIds.map((id) => this.nodes.get(id));
  }

  /**
   * 取得並行分組
   * 按 BFS 層級將節點分組，同一層級的節點可以並行執行
   */
  getParallelGroups() {
    if (this.nodes.size === 0) {
      return [];
    }

    this.validateDAG();

    const levels = new Map();
    const inDegree = new Map();

    for (const id of this.nodes.keys()) {
      inDegree.set(id, 0);
    }
    for (const edge of this.edges) {
      inDegree.set(edge.to, inDegree.get(edge.to) + 1);
    }

    // Level 0: 入度為 0 的節點
    const queue = [];
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        levels.set(id, 0);
        queue.push(id);
      }
    }

    // BFS 計算每個節點的層級
    while (queue.length > 0) {
      const current = queue.shift();
      const currentLevel = levels.get(current);

      for (const edge of this.edges) {
        if (edge.from === current) {
          const newDegree = inDegree.get(edge.to) - 1;
          inDegree.set(edge.to, newDegree);

          const existingLevel = levels.get(edge.to);
          const newLevel = currentLevel + 1;
          if (existingLevel === undefined || newLevel > existingLevel) {
            levels.set(edge.to, newLevel);
          }

          if (newDegree === 0) {
            queue.push(edge.to);
          }
        }
      }
    }

    // 按層級分組
    const groupMap = new Map();
    for (const [id, level] of levels.entries()) {
      if (!groupMap.has(level)) {
        groupMap.set(level, []);
      }
      groupMap.get(level).push(this.nodes.get(id));
    }

    const groups = [];
    const sortedLevels = [...groupMap.keys()].sort((a, b) => a - b);
    for (const level of sortedLevels) {
      groups.push(groupMap.get(level));
    }

    return groups;
  }

  /**
   * 取得就緒節點
   * 回傳所有依賴皆已完成且自身為 pending 狀態的節點
   */
  getReadyNodes() {
    const ready = [];
    for (const [id, node] of this.nodes.entries()) {
      if (node.status !== "pending") continue;

      const deps = this.getDependencies(id);
      const allDepsCompleted = deps.every((dep) => dep.status === "completed");
      if (allDepsCompleted) {
        ready.push(node);
      }
    }
    return ready;
  }

  /**
   * 標記節點完成
   */
  markCompleted(nodeId, result) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`節點不存在: ${nodeId}`);
    }
    node.status = "completed";
    node.result = result;
    return this.getReadyNodes();
  }

  /**
   * 標記節點失敗
   */
  markFailed(nodeId, error) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`節點不存在: ${nodeId}`);
    }
    node.status = "failed";
    node.error = error;
  }

  /**
   * 取得 DAG 摘要
   */
  getSummary() {
    const groups = this.nodes.size > 0 ? this.getParallelGroups() : [];
    const completed = [...this.nodes.values()].filter(
      (n) => n.status === "completed",
    ).length;
    const failed = [...this.nodes.values()].filter(
      (n) => n.status === "failed",
    ).length;

    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.length,
      parallelGroups: groups.length,
      completed,
      failed,
      pending: this.nodes.size - completed - failed,
    };
  }
}

module.exports = TaskDAG;

if (require.main === module) {
  const dag = new TaskDAG();
  dag.addNode({ id: "a", name: "分析" });
  dag.addNode({ id: "b", name: "實現" });
  dag.addNode({ id: "c", name: "測試" });
  dag.addNode({ id: "d", name: "文檔" });
  dag.addEdge({ from: "a", to: "b" });
  dag.addEdge({ from: "b", to: "c" });
  dag.addEdge({ from: "b", to: "d" });

  console.log("拓撲排序:", dag.topologicalSort());
  console.log("並行分組:", JSON.stringify(dag.getParallelGroups(), null, 2));
  console.log("DAG 摘要:", dag.getSummary());
}
