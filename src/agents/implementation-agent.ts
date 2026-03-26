import { BaseAgent } from "./base-agent";
import { Task } from "../orchestrator/types";

export class ImplementationAgent extends BaseAgent {
  constructor() {
    super("implementation");
  }

  protected async execute(task: Task): Promise<string> {
    this.logger.info(`Analyzing requirements: ${task.description}`);

    const steps = this.decomposeToSteps(task.description);
    const results: string[] = [];

    for (const step of steps) {
      this.logger.info(`Implementing step: ${step}`);
      results.push(`[IMPL] ${step} - completed`);
    }

    return [
      `Implementation completed for: ${task.name}`,
      `Steps executed: ${steps.length}`,
      ...results,
    ].join("\n");
  }

  private decomposeToSteps(description: string): string[] {
    const keywords = description.toLowerCase();
    const steps: string[] = ["Analyze requirements"];

    if (keywords.includes("api") || keywords.includes("endpoint")) {
      steps.push("Define API schema", "Implement route handlers", "Add input validation");
    }
    if (keywords.includes("database") || keywords.includes("model")) {
      steps.push("Design data model", "Create database schema", "Implement CRUD operations");
    }
    if (keywords.includes("ui") || keywords.includes("component")) {
      steps.push("Create component structure", "Implement render logic", "Add event handlers");
    }

    steps.push("Code review self-check", "Generate implementation report");
    return steps;
  }

  protected getArtifacts(task: Task): string[] {
    return [`${task.id}-implementation.ts`, `${task.id}-types.ts`];
  }
}
