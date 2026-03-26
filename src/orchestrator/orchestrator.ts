import { TaskDAG } from "./dag";
import { AgentRole, ExecutionPlan, OrchestratorResult, Task, TaskResult } from "./types";
import { BaseAgent } from "../agents/base-agent";
import { ImplementationAgent } from "../agents/implementation-agent";
import { TestingAgent } from "../agents/testing-agent";
import { DocumentationAgent } from "../agents/documentation-agent";
import { SecurityAgent } from "../agents/security-agent";
import { createChildLogger } from "../utils/logger";

export class Orchestrator {
  private dag: TaskDAG;
  private agents: Map<AgentRole, BaseAgent>;
  private logger = createChildLogger("orchestrator");

  constructor() {
    this.dag = new TaskDAG();
    this.agents = new Map<AgentRole, BaseAgent>([
      ["implementation", new ImplementationAgent()],
      ["testing", new TestingAgent()],
      ["documentation", new DocumentationAgent()],
      ["security", new SecurityAgent()],
    ]);
  }

  decompose(name: string, description: string): TaskDAG {
    this.dag = new TaskDAG();
    let taskCounter = 0;
    const makeId = () => `task-${++taskCounter}`;

    // Phase 1: Implementation (no dependencies)
    const implId = makeId();
    this.dag.addTask({
      id: implId,
      name: `Implement: ${name}`,
      description,
      assignedTo: "implementation",
      status: "pending",
      dependencies: [],
    });

    // Phase 2: Testing + Documentation (depend on implementation)
    const testId = makeId();
    this.dag.addTask({
      id: testId,
      name: `Test: ${name}`,
      description: `Generate and run tests for ${description}`,
      assignedTo: "testing",
      status: "pending",
      dependencies: [implId],
    });

    const docId = makeId();
    this.dag.addTask({
      id: docId,
      name: `Document: ${name}`,
      description: `Generate documentation for ${description}`,
      assignedTo: "documentation",
      status: "pending",
      dependencies: [implId],
    });

    // Phase 3: Security (depends on implementation)
    const secId = makeId();
    this.dag.addTask({
      id: secId,
      name: `Security Review: ${name}`,
      description: `Security scan for ${description}`,
      assignedTo: "security",
      status: "pending",
      dependencies: [implId],
    });

    this.logger.info(`Decomposed "${name}" into ${taskCounter} tasks`);
    return this.dag;
  }

  plan(): ExecutionPlan {
    return this.dag.buildExecutionPlan();
  }

  async execute(): Promise<OrchestratorResult> {
    const executionPlan = this.plan();
    const start = Date.now();
    const phaseResults: { phase: number; results: TaskResult[] }[] = [];

    this.logger.info(
      `Executing plan: ${executionPlan.totalTasks} tasks in ${executionPlan.phases.length} phases`,
    );

    for (const phase of executionPlan.phases) {
      this.logger.info(
        `Phase ${phase.phaseNumber}: ${phase.tasks.length} tasks (parallel: ${phase.parallel})`,
      );

      const results = await this.executePhase(phase.tasks, phase.parallel);
      phaseResults.push({ phase: phase.phaseNumber, results });

      const allSucceeded = results.every((r) => r.success);
      if (!allSucceeded) {
        this.logger.warn(`Phase ${phase.phaseNumber} had failures, continuing...`);
      }
    }

    const totalDuration = Date.now() - start;
    const allResults = phaseResults.flatMap((p) => p.results);
    const successCount = allResults.filter((r) => r.success).length;

    return {
      success: successCount === allResults.length,
      phases: phaseResults,
      totalDuration,
      summary: `${successCount}/${allResults.length} tasks succeeded in ${totalDuration}ms`,
    };
  }

  private async executePhase(tasks: Task[], parallel: boolean): Promise<TaskResult[]> {
    if (parallel) {
      return Promise.all(tasks.map((task) => this.executeTask(task)));
    }
    const results: TaskResult[] = [];
    for (const task of tasks) {
      results.push(await this.executeTask(task));
    }
    return results;
  }

  private async executeTask(task: Task): Promise<TaskResult> {
    const agent = task.assignedTo ? this.agents.get(task.assignedTo) : undefined;
    if (!agent) {
      return {
        success: false,
        output: "",
        artifacts: [],
        duration: 0,
        errors: [`No agent assigned for role: ${task.assignedTo}`],
      };
    }

    task.status = "running";
    const result = await agent.run(task);
    task.status = result.success ? "completed" : "failed";
    task.result = result;
    return result;
  }

  getDAG(): TaskDAG {
    return this.dag;
  }
}
