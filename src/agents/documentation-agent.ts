import { BaseAgent } from "./base-agent";
import { Task } from "../orchestrator/types";

export class DocumentationAgent extends BaseAgent {
  constructor() {
    super("documentation");
  }

  protected async execute(task: Task): Promise<string> {
    this.logger.info(`Generating documentation for: ${task.name}`);

    const sections = this.generateDocSections(task);

    return [
      `Documentation generated for: ${task.name}`,
      `Sections: ${sections.length}`,
      "",
      ...sections.map((s) => `  - ${s}`),
    ].join("\n");
  }

  private generateDocSections(task: Task): string[] {
    const sections = [
      "Overview & Purpose",
      "Architecture Diagram",
      "API Reference",
      "Usage Examples",
      "Configuration Guide",
    ];

    if (task.description.includes("security")) {
      sections.push("Security Considerations", "Threat Model");
    }
    if (task.description.includes("api")) {
      sections.push("Endpoint Reference", "Request/Response Schemas");
    }

    sections.push("Changelog", "FAQ");
    return sections;
  }

  protected getArtifacts(task: Task): string[] {
    return [`${task.id}-docs.md`, `${task.id}-api-reference.md`];
  }
}
