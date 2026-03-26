import { DAGNode, ExecutionPhase, ExecutionPlan, Task } from "./types";

export class TaskDAG {
  private nodes: Map<string, DAGNode> = new Map();

  addTask(task: Task): void {
    const existing = this.nodes.get(task.id);
    this.nodes.set(task.id, {
      task,
      children: existing?.children ?? [],
      parents: [...task.dependencies],
    });

    for (const depId of task.dependencies) {
      const parent = this.nodes.get(depId);
      if (parent) {
        parent.children.push(task.id);
      } else {
        // Parent not yet added; create a placeholder so children link is preserved
        this.nodes.set(depId, {
          task: { id: depId, name: "", description: "", status: "pending", dependencies: [] },
          children: [task.id],
          parents: [],
        });
      }
    }
  }

  getTask(id: string): Task | undefined {
    return this.nodes.get(id)?.task;
  }

  getAllTasks(): Task[] {
    return Array.from(this.nodes.values()).map((n) => n.task);
  }

  validate(): { valid: boolean; error?: string } {
    // Check for missing dependencies
    for (const [id, node] of this.nodes) {
      for (const dep of node.parents) {
        if (!this.nodes.has(dep)) {
          return { valid: false, error: `Task "${id}" depends on unknown task "${dep}"` };
        }
      }
    }

    // Check for cycles using DFS
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      inStack.add(nodeId);

      const node = this.nodes.get(nodeId)!;
      for (const childId of node.children) {
        if (!visited.has(childId)) {
          if (hasCycle(childId)) return true;
        } else if (inStack.has(childId)) {
          return true;
        }
      }

      inStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (hasCycle(nodeId)) {
          return { valid: false, error: "DAG contains a cycle" };
        }
      }
    }

    return { valid: true };
  }

  topologicalSort(): string[] {
    const inDegree = new Map<string, number>();
    for (const [id, node] of this.nodes) {
      inDegree.set(id, node.parents.filter((p) => this.nodes.has(p)).length);
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      const node = this.nodes.get(current)!;
      for (const childId of node.children) {
        const newDegree = (inDegree.get(childId) || 0) - 1;
        inDegree.set(childId, newDegree);
        if (newDegree === 0) queue.push(childId);
      }
    }

    return sorted;
  }

  buildExecutionPlan(): ExecutionPlan {
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`Invalid DAG: ${validation.error}`);
    }

    const inDegree = new Map<string, number>();
    for (const [id, node] of this.nodes) {
      inDegree.set(id, node.parents.filter((p) => this.nodes.has(p)).length);
    }

    const phases: ExecutionPhase[] = [];
    const completed = new Set<string>();
    let phaseNumber = 1;

    while (completed.size < this.nodes.size) {
      const ready: Task[] = [];
      for (const [id, degree] of inDegree) {
        if (!completed.has(id) && degree === 0) {
          ready.push(this.nodes.get(id)!.task);
        }
      }

      if (ready.length === 0) break;

      phases.push({
        phaseNumber: phaseNumber++,
        tasks: ready,
        parallel: ready.length > 1,
      });

      for (const task of ready) {
        completed.add(task.id);
        const node = this.nodes.get(task.id)!;
        for (const childId of node.children) {
          inDegree.set(childId, (inDegree.get(childId) || 0) - 1);
        }
      }
    }

    return { phases, totalTasks: this.nodes.size };
  }
}
