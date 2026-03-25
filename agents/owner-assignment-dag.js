/**
 * Owner 分配 DAG 引擎
 * 管理工作流節點依賴關係，並透過 OwnerResolver 動態解析每個節點的負責人
 */

const fs = require("fs");
const path = require("path");
const OwnerResolver = require("./owner-resolver");

class OwnerAssignmentDAG {
  constructor(config) {
    this.nodes = new Map();
    this.edges = [];
    this.resolver = null;
    this.config = config || this.loadConfig();
    this.resolver = new OwnerResolver(this.config);
    this.buildFromConfig();
  }

  loadConfig() {
    const configPath = path.join(
      __dirname,
      "../tools/owner-roles-config.json",
    );
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
    return this.getDefaultConfig();
  }

  getDefaultConfig() {
    return {
      roles: {},
      dag_nodes: [],
      dag_edges: [],
      risk_based_rules: {},
      contract_type_rules: {},
    };
  }

  buildFromConfig() {
    if (this.config.dag_nodes) {
      this.config.dag_nodes.forEach((node) => this.addNode(node));
    }
    if (this.config.dag_edges) {
      this.config.dag_edges.forEach((edge) => this.addEdge(edge));
    }
  }

  /**
   * 新增節點
   */
  addNode(node) {
    if (!node.id) {
      throw new Error("節點必須有 id");
    }
    this.nodes.set(node.id, { ...node });
  }

  /**
   * 新增邊
   */
  addEdge(edge) {
    if (!edge.from || !edge.to) {
      throw new Error("邊必須有 from 和 to");
    }
    if (!this.nodes.has(edge.from)) {
      throw new Error(`來源節點不存在: ${edge.from}`);
    }
    if (!this.nodes.has(edge.to)) {
      throw new Error(`目標節點不存在: ${edge.to}`);
    }
    this.edges.push({ ...edge });
  }

  /**
   * 取得節點
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId) || null;
  }

  /**
   * 取得節點的上游依賴
   */
  getDependencies(nodeId) {
    return this.edges
      .filter((e) => e.to === nodeId)
      .map((e) => e.from);
  }

  /**
   * 取得節點的下游節點
   */
  getDependents(nodeId) {
    return this.edges
      .filter((e) => e.from === nodeId)
      .map((e) => e.to);
  }

  /**
   * 拓撲排序（Kahn's algorithm）
   * @returns {string[]} 排序後的節點 ID 陣列
   */
  topologicalSort() {
    const inDegree = new Map();
    for (const id of this.nodes.keys()) {
      inDegree.set(id, 0);
    }

    for (const edge of this.edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    const queue = [];
    for (const [id, degree] of inDegree) {
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
   * 驗證 DAG（檢測環路）
   * @returns {{ valid: boolean, message: string }}
   */
  validateDAG() {
    const sorted = this.topologicalSort();
    if (sorted.length !== this.nodes.size) {
      const missing = [...this.nodes.keys()].filter(
        (id) => !sorted.includes(id),
      );
      return {
        valid: false,
        message: `檢測到環路，涉及節點: ${missing.join(", ")}`,
      };
    }
    return { valid: true, message: "DAG 驗證通過" };
  }

  /**
   * 取得執行順序（含節點資訊）
   */
  getExecutionOrder() {
    const sortedIds = this.topologicalSort();
    return sortedIds.map((id) => this.nodes.get(id));
  }

  /**
   * 對所有節點解析 owner
   * @param {Object} context - 解析 context
   * @returns {Object} { nodeId: [owners] } 映射
   */
  resolveOwners(context) {
    const assignments = {};
    const sortedIds = this.topologicalSort();

    for (const nodeId of sortedIds) {
      const node = this.nodes.get(nodeId);
      assignments[nodeId] = this.resolver.resolve(node, context);
    }

    return assignments;
  }

  /**
   * 取得帶 owner 的完整執行計劃
   * @param {Object} context - 解析 context
   * @returns {Object[]} 帶 owners 的節點陣列
   */
  getAssignmentPlan(context) {
    const assignments = this.resolveOwners(context);
    const sortedIds = this.topologicalSort();

    return sortedIds.map((id) => {
      const node = this.nodes.get(id);
      return {
        ...node,
        assignedOwners: assignments[id],
        dependencies: this.getDependencies(id),
        dependents: this.getDependents(id),
      };
    });
  }

  /**
   * 取得節點總數
   */
  getNodeCount() {
    return this.nodes.size;
  }

  /**
   * 取得邊總數
   */
  getEdgeCount() {
    return this.edges.length;
  }
}

module.exports = OwnerAssignmentDAG;
