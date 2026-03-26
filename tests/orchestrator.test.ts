import { describe, it, expect } from "vitest";
import { TaskDAG } from "../src/orchestrator/dag";
import { Orchestrator } from "../src/orchestrator/orchestrator";
import { Task } from "../src/orchestrator/types";

describe("TaskDAG", () => {
  it("should add tasks and retrieve them", () => {
    const dag = new TaskDAG();
    dag.addTask({ id: "t1", name: "Task 1", description: "", status: "pending", dependencies: [] });
    dag.addTask({ id: "t2", name: "Task 2", description: "", status: "pending", dependencies: ["t1"] });

    expect(dag.getTask("t1")?.name).toBe("Task 1");
    expect(dag.getTask("t2")?.dependencies).toEqual(["t1"]);
    expect(dag.getAllTasks()).toHaveLength(2);
  });

  it("should validate a valid DAG", () => {
    const dag = new TaskDAG();
    dag.addTask({ id: "a", name: "A", description: "", status: "pending", dependencies: [] });
    dag.addTask({ id: "b", name: "B", description: "", status: "pending", dependencies: ["a"] });

    expect(dag.validate().valid).toBe(true);
  });

  it("should detect cycles", () => {
    const dag = new TaskDAG();
    dag.addTask({ id: "a", name: "A", description: "", status: "pending", dependencies: ["b"] });
    dag.addTask({ id: "b", name: "B", description: "", status: "pending", dependencies: ["a"] });

    expect(dag.validate().valid).toBe(false);
    expect(dag.validate().error).toContain("cycle");
  });

  it("should perform topological sort", () => {
    const dag = new TaskDAG();
    dag.addTask({ id: "a", name: "A", description: "", status: "pending", dependencies: [] });
    dag.addTask({ id: "b", name: "B", description: "", status: "pending", dependencies: ["a"] });
    dag.addTask({ id: "c", name: "C", description: "", status: "pending", dependencies: ["a"] });
    dag.addTask({ id: "d", name: "D", description: "", status: "pending", dependencies: ["b", "c"] });

    const sorted = dag.topologicalSort();
    expect(sorted[0]).toBe("a");
    expect(sorted[sorted.length - 1]).toBe("d");
    expect(sorted.indexOf("b")).toBeLessThan(sorted.indexOf("d"));
    expect(sorted.indexOf("c")).toBeLessThan(sorted.indexOf("d"));
  });

  it("should build execution plan with parallel phases", () => {
    const dag = new TaskDAG();
    dag.addTask({ id: "a", name: "A", description: "", status: "pending", dependencies: [] });
    dag.addTask({ id: "b", name: "B", description: "", status: "pending", dependencies: ["a"] });
    dag.addTask({ id: "c", name: "C", description: "", status: "pending", dependencies: ["a"] });

    const plan = dag.buildExecutionPlan();
    expect(plan.totalTasks).toBe(3);
    expect(plan.phases).toHaveLength(2);
    expect(plan.phases[0].tasks).toHaveLength(1); // a
    expect(plan.phases[1].tasks).toHaveLength(2); // b, c in parallel
    expect(plan.phases[1].parallel).toBe(true);
  });
});

describe("Orchestrator", () => {
  it("should decompose a task into DAG", () => {
    const orch = new Orchestrator();
    orch.decompose("Test Feature", "Build a test feature");

    const dag = orch.getDAG();
    const tasks = dag.getAllTasks();
    expect(tasks.length).toBeGreaterThanOrEqual(4);
  });

  it("should create a valid execution plan", () => {
    const orch = new Orchestrator();
    orch.decompose("API", "Build an API endpoint");

    const plan = orch.plan();
    expect(plan.totalTasks).toBeGreaterThan(0);
    expect(plan.phases.length).toBeGreaterThan(0);
  });

  it("should execute tasks through agents", async () => {
    const orch = new Orchestrator();
    orch.decompose("Feature", "A simple feature");

    const result = await orch.execute();
    expect(result.totalDuration).toBeGreaterThan(0);
    expect(result.summary).toContain("tasks succeeded");
    expect(result.phases.length).toBeGreaterThan(0);
  });
});
