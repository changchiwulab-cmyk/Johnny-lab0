const TaskDAG = require("../../agents/task-dag");

describe("TaskDAG", () => {
  let dag;

  beforeEach(() => {
    dag = new TaskDAG();
  });

  describe("constructor", () => {
    it("should initialize with empty nodes and edges", () => {
      expect(dag.getNodeCount()).toBe(0);
      expect(dag.getEdgeCount()).toBe(0);
    });

    it("should build from decomposition result", () => {
      const decomposition = {
        subtasks: [
          { id: "a", name: "A", type: "analyze" },
          { id: "b", name: "B", type: "implement" },
          { id: "c", name: "C", type: "test" },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "c" },
        ],
      };
      const built = new TaskDAG(decomposition);
      expect(built.getNodeCount()).toBe(3);
      expect(built.getEdgeCount()).toBe(2);
    });
  });

  describe("addNode", () => {
    it("should add a valid node", () => {
      dag.addNode({ id: "n1", name: "Node 1" });
      expect(dag.getNodeCount()).toBe(1);
      expect(dag.getNode("n1")).toBeDefined();
    });

    it("should throw on missing id", () => {
      expect(() => dag.addNode({ name: "No ID" })).toThrow("id");
    });

    it("should throw on null node", () => {
      expect(() => dag.addNode(null)).toThrow("id");
    });

    it("should throw on duplicate id", () => {
      dag.addNode({ id: "n1", name: "Node 1" });
      expect(() => dag.addNode({ id: "n1", name: "Dup" })).toThrow("重複");
    });

    it("should set default status to pending", () => {
      dag.addNode({ id: "n1", name: "Node 1" });
      expect(dag.getNode("n1").status).toBe("pending");
    });
  });

  describe("addEdge", () => {
    beforeEach(() => {
      dag.addNode({ id: "a", name: "A" });
      dag.addNode({ id: "b", name: "B" });
    });

    it("should add a valid edge", () => {
      dag.addEdge({ from: "a", to: "b" });
      expect(dag.getEdgeCount()).toBe(1);
    });

    it("should throw on missing from", () => {
      expect(() => dag.addEdge({ to: "b" })).toThrow("from");
    });

    it("should throw on missing to", () => {
      expect(() => dag.addEdge({ from: "a" })).toThrow("to");
    });

    it("should throw on nonexistent source node", () => {
      expect(() => dag.addEdge({ from: "x", to: "b" })).toThrow("不存在");
    });

    it("should throw on nonexistent target node", () => {
      expect(() => dag.addEdge({ from: "a", to: "x" })).toThrow("不存在");
    });

    it("should throw on self-loop", () => {
      expect(() => dag.addEdge({ from: "a", to: "a" })).toThrow("自循環");
    });
  });

  describe("getNode", () => {
    it("should return node by id", () => {
      dag.addNode({ id: "n1", name: "Node 1" });
      expect(dag.getNode("n1").name).toBe("Node 1");
    });

    it("should return null for nonexistent node", () => {
      expect(dag.getNode("nonexistent")).toBeNull();
    });
  });

  describe("getDependencies / getDependents", () => {
    beforeEach(() => {
      dag.addNode({ id: "a", name: "A" });
      dag.addNode({ id: "b", name: "B" });
      dag.addNode({ id: "c", name: "C" });
      dag.addEdge({ from: "a", to: "b" });
      dag.addEdge({ from: "b", to: "c" });
    });

    it("should return empty dependencies for root node", () => {
      expect(dag.getDependencies("a")).toHaveLength(0);
    });

    it("should return correct dependencies for middle node", () => {
      const deps = dag.getDependencies("b");
      expect(deps).toHaveLength(1);
      expect(deps[0].id).toBe("a");
    });

    it("should return empty dependents for leaf node", () => {
      expect(dag.getDependents("c")).toHaveLength(0);
    });

    it("should return correct dependents for root node", () => {
      const deps = dag.getDependents("a");
      expect(deps).toHaveLength(1);
      expect(deps[0].id).toBe("b");
    });
  });

  describe("topologicalSort", () => {
    it("should return all nodes in valid order", () => {
      dag.addNode({ id: "a", name: "A" });
      dag.addNode({ id: "b", name: "B" });
      dag.addNode({ id: "c", name: "C" });
      dag.addEdge({ from: "a", to: "b" });
      dag.addEdge({ from: "b", to: "c" });

      const sorted = dag.topologicalSort();
      expect(sorted).toHaveLength(3);
      expect(sorted.indexOf("a")).toBeLessThan(sorted.indexOf("b"));
      expect(sorted.indexOf("b")).toBeLessThan(sorted.indexOf("c"));
    });

    it("should handle independent nodes", () => {
      dag.addNode({ id: "a", name: "A" });
      dag.addNode({ id: "b", name: "B" });
      dag.addNode({ id: "c", name: "C" });

      const sorted = dag.topologicalSort();
      expect(sorted).toHaveLength(3);
    });

    it("should handle diamond dependency", () => {
      dag.addNode({ id: "a", name: "A" });
      dag.addNode({ id: "b", name: "B" });
      dag.addNode({ id: "c", name: "C" });
      dag.addNode({ id: "d", name: "D" });
      dag.addEdge({ from: "a", to: "b" });
      dag.addEdge({ from: "a", to: "c" });
      dag.addEdge({ from: "b", to: "d" });
      dag.addEdge({ from: "c", to: "d" });

      const sorted = dag.topologicalSort();
      expect(sorted).toHaveLength(4);
      expect(sorted.indexOf("a")).toBeLessThan(sorted.indexOf("b"));
      expect(sorted.indexOf("a")).toBeLessThan(sorted.indexOf("c"));
      expect(sorted.indexOf("b")).toBeLessThan(sorted.indexOf("d"));
      expect(sorted.indexOf("c")).toBeLessThan(sorted.indexOf("d"));
    });

    it("should handle empty DAG", () => {
      expect(dag.topologicalSort()).toEqual([]);
    });
  });

  describe("validateDAG", () => {
    it("should pass for valid DAG", () => {
      dag.addNode({ id: "a", name: "A" });
      dag.addNode({ id: "b", name: "B" });
      dag.addEdge({ from: "a", to: "b" });

      expect(dag.validateDAG()).toBe(true);
    });

    it("should detect cycle", () => {
      dag.addNode({ id: "a", name: "A" });
      dag.addNode({ id: "b", name: "B" });
      dag.addNode({ id: "c", name: "C" });
      dag.addEdge({ from: "a", to: "b" });
      dag.addEdge({ from: "b", to: "c" });
      dag.addEdge({ from: "c", to: "a" });

      expect(() => dag.validateDAG()).toThrow("循環");
    });

    it("should pass for empty DAG", () => {
      expect(dag.validateDAG()).toBe(true);
    });
  });

  describe("getExecutionOrder", () => {
    it("should return nodes in topological order with data", () => {
      dag.addNode({ id: "a", name: "A" });
      dag.addNode({ id: "b", name: "B" });
      dag.addEdge({ from: "a", to: "b" });

      const order = dag.getExecutionOrder();
      expect(order).toHaveLength(2);
      expect(order[0].id).toBe("a");
      expect(order[1].id).toBe("b");
    });
  });

  describe("getParallelGroups", () => {
    it("should group independent nodes together", () => {
      dag.addNode({ id: "a", name: "A" });
      dag.addNode({ id: "b", name: "B" });
      dag.addNode({ id: "c", name: "C" });

      const groups = dag.getParallelGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0]).toHaveLength(3);
    });

    it("should create separate groups for dependent nodes", () => {
      dag.addNode({ id: "a", name: "A" });
      dag.addNode({ id: "b", name: "B" });
      dag.addNode({ id: "c", name: "C" });
      dag.addEdge({ from: "a", to: "b" });
      dag.addEdge({ from: "b", to: "c" });

      const groups = dag.getParallelGroups();
      expect(groups).toHaveLength(3);
      expect(groups[0]).toHaveLength(1);
      expect(groups[1]).toHaveLength(1);
      expect(groups[2]).toHaveLength(1);
    });

    it("should handle diamond dependency correctly", () => {
      dag.addNode({ id: "a", name: "A" });
      dag.addNode({ id: "b", name: "B" });
      dag.addNode({ id: "c", name: "C" });
      dag.addNode({ id: "d", name: "D" });
      dag.addEdge({ from: "a", to: "b" });
      dag.addEdge({ from: "a", to: "c" });
      dag.addEdge({ from: "b", to: "d" });
      dag.addEdge({ from: "c", to: "d" });

      const groups = dag.getParallelGroups();
      expect(groups).toHaveLength(3);
      expect(groups[0]).toHaveLength(1); // a
      expect(groups[1]).toHaveLength(2); // b, c
      expect(groups[2]).toHaveLength(1); // d
    });

    it("should return empty array for empty DAG", () => {
      expect(dag.getParallelGroups()).toEqual([]);
    });
  });

  describe("getReadyNodes", () => {
    beforeEach(() => {
      dag.addNode({ id: "a", name: "A", agent: "impl" });
      dag.addNode({ id: "b", name: "B", agent: "test" });
      dag.addNode({ id: "c", name: "C", agent: "doc" });
      dag.addEdge({ from: "a", to: "b" });
      dag.addEdge({ from: "a", to: "c" });
    });

    it("should return root nodes initially", () => {
      const ready = dag.getReadyNodes();
      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe("a");
    });

    it("should return dependents after root completed", () => {
      dag.markCompleted("a", { done: true });
      const ready = dag.getReadyNodes();
      expect(ready).toHaveLength(2);
    });

    it("should return empty when all completed", () => {
      dag.markCompleted("a", {});
      dag.markCompleted("b", {});
      dag.markCompleted("c", {});
      expect(dag.getReadyNodes()).toHaveLength(0);
    });
  });

  describe("markCompleted / markFailed", () => {
    beforeEach(() => {
      dag.addNode({ id: "a", name: "A" });
    });

    it("should mark node completed with result", () => {
      dag.markCompleted("a", { data: "test" });
      const node = dag.getNode("a");
      expect(node.status).toBe("completed");
      expect(node.result).toEqual({ data: "test" });
    });

    it("should mark node failed with error", () => {
      dag.markFailed("a", "Something went wrong");
      const node = dag.getNode("a");
      expect(node.status).toBe("failed");
      expect(node.error).toBe("Something went wrong");
    });

    it("should throw for nonexistent node", () => {
      expect(() => dag.markCompleted("x", {})).toThrow("不存在");
      expect(() => dag.markFailed("x", "err")).toThrow("不存在");
    });
  });

  describe("getSummary", () => {
    it("should return correct summary", () => {
      dag.addNode({ id: "a", name: "A" });
      dag.addNode({ id: "b", name: "B" });
      dag.addEdge({ from: "a", to: "b" });

      const summary = dag.getSummary();
      expect(summary.totalNodes).toBe(2);
      expect(summary.totalEdges).toBe(1);
      expect(summary.pending).toBe(2);
      expect(summary.completed).toBe(0);
      expect(summary.failed).toBe(0);
    });

    it("should track completed and failed", () => {
      dag.addNode({ id: "a", name: "A" });
      dag.addNode({ id: "b", name: "B" });
      dag.markCompleted("a", {});
      dag.markFailed("b", "err");

      const summary = dag.getSummary();
      expect(summary.completed).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.pending).toBe(0);
    });

    it("should return correct summary for empty DAG", () => {
      const summary = dag.getSummary();
      expect(summary.totalNodes).toBe(0);
      expect(summary.parallelGroups).toBe(0);
    });
  });
});
