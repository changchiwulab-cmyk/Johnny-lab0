const DocumentationAgent = require("../../agents/documentation-agent");

describe("DocumentationAgent", () => {
  let agent;

  beforeEach(() => {
    agent = new DocumentationAgent();
  });

  describe("constructor", () => {
    it("should initialize with correct name and version", () => {
      expect(agent.name).toBe("DocumentationAgent");
      expect(agent.version).toBe("1.0.0");
    });
  });

  describe("execute", () => {
    it("should return structured result", async () => {
      const result = await agent.execute({
        id: "doc_001",
        type: "document",
        description: "Document user authentication API",
        priority: "medium",
      });

      expect(result.status).toBe("completed");
      expect(result.metadata.agent).toBe("DocumentationAgent");
      expect(result.metadata.subtask_id).toBe("doc_001");
    });

    it("should generate documents", async () => {
      const result = await agent.execute({
        id: "doc_002",
        type: "document",
        description: "Document new API endpoint",
        priority: "medium",
      });

      expect(result.output.documents_generated).toBeDefined();
      expect(result.output.total_documents).toBeGreaterThan(0);
    });

    it("should include changelog entry", async () => {
      const result = await agent.execute({
        id: "doc_003",
        type: "document",
        description: "Add new feature",
        priority: "medium",
      });

      expect(result.output.changelog_entry).toBeDefined();
      expect(result.output.changelog_entry.version).toBeDefined();
      expect(result.output.changelog_entry.date).toBeDefined();
    });

    it("should include documentation coverage", async () => {
      const result = await agent.execute({
        id: "doc_004",
        type: "document",
        description: "Document module",
        priority: "medium",
      });

      expect(result.output.documentation_coverage).toBeGreaterThan(0);
      expect(result.output.documentation_coverage).toBeLessThanOrEqual(100);
    });

    it("should throw on missing type", async () => {
      await expect(agent.execute({ id: "doc_005" })).rejects.toThrow("type");
    });
  });

  describe("analyzeDocNeeds", () => {
    it("should include api_docs for API tasks", () => {
      const needs = agent.analyzeDocNeeds({
        description: "Add new API endpoint",
      });
      expect(needs).toContain("api_docs");
    });

    it("should include readme_update for new features", () => {
      const needs = agent.analyzeDocNeeds({
        description: "Add new authentication feature",
      });
      expect(needs).toContain("readme_update");
    });

    it("should always include changelog", () => {
      const needs = agent.analyzeDocNeeds({ description: "some task" });
      expect(needs).toContain("changelog");
    });
  });

  describe("getChangeType", () => {
    it("should return fix for bugfix descriptions", () => {
      expect(agent.getChangeType({ description: "Fix login bug" })).toBe(
        "fix",
      );
    });

    it("should return refactor for refactor descriptions", () => {
      expect(agent.getChangeType({ description: "Refactor module" })).toBe(
        "refactor",
      );
    });

    it("should return feature by default", () => {
      expect(agent.getChangeType({ description: "Add new thing" })).toBe(
        "feature",
      );
    });
  });
});
