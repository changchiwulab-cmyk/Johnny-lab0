import { AgentRole, Task, TaskResult } from "../orchestrator/types";
import { createChildLogger } from "../utils/logger";

export abstract class BaseAgent {
  readonly role: AgentRole;
  protected logger;

  constructor(role: AgentRole) {
    this.role = role;
    this.logger = createChildLogger(`agent:${role}`);
  }

  async run(task: Task): Promise<TaskResult> {
    const start = Date.now();
    this.logger.info(`Starting task: ${task.name}`);

    try {
      const output = await this.execute(task);
      const duration = Date.now() - start;

      const result: TaskResult = {
        success: true,
        output,
        artifacts: this.getArtifacts(task),
        duration,
        errors: [],
      };

      this.logger.info(`Completed task: ${task.name} (${duration}ms)`);
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed task: ${task.name} - ${errorMsg}`);

      return {
        success: false,
        output: "",
        artifacts: [],
        duration,
        errors: [errorMsg],
      };
    }
  }

  protected abstract execute(task: Task): Promise<string>;

  protected getArtifacts(_task: Task): string[] {
    return [];
  }
}
