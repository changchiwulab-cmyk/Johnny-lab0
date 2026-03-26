import { describe, it, expect } from "vitest";
import { ImplementationAgent } from "../src/agents/implementation-agent";
import { TestingAgent } from "../src/agents/testing-agent";
import { DocumentationAgent } from "../src/agents/documentation-agent";
import { SecurityAgent } from "../src/agents/security-agent";
import { Task } from "../src/orchestrator/types";

const makeTask = (name: string, description = ""): Task => ({
  id: "test-1",
  name,
  description,
  status: "pending",
  dependencies: [],
});

describe("ImplementationAgent", () => {
  it("should execute a task and return success", async () => {
    const agent = new ImplementationAgent();
    const result = await agent.run(makeTask("Build API", "Build an api endpoint"));

    expect(result.success).toBe(true);
    expect(result.output).toContain("Implementation completed");
    expect(result.artifacts.length).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});

describe("TestingAgent", () => {
  it("should generate and run tests", async () => {
    const agent = new TestingAgent();
    const result = await agent.run(makeTask("Test Auth", "Test auth api module"));

    expect(result.success).toBe(true);
    expect(result.output).toContain("Test results");
    expect(result.output).toContain("Coverage:");
  });
});

describe("DocumentationAgent", () => {
  it("should generate documentation", async () => {
    const agent = new DocumentationAgent();
    const result = await agent.run(makeTask("Doc API", "Document the api"));

    expect(result.success).toBe(true);
    expect(result.output).toContain("Documentation generated");
    expect(result.output).toContain("Sections:");
  });
});

describe("SecurityAgent", () => {
  it("should run security checks", async () => {
    const agent = new SecurityAgent();
    const result = await agent.run(makeTask("Scan Auth", "Scan auth module for vulnerabilities"));

    expect(result.success).toBe(true);
    expect(result.output).toContain("Security scan");
    expect(result.output).toContain("Checks run:");
  });
});
