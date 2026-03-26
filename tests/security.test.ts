import { describe, it, expect } from "vitest";
import { SecretDetector } from "../src/security/secret-detector";
import { OWASPScanner } from "../src/security/owasp-scanner";
import { SecurityDecisionTree } from "../src/security/decision-tree";
import { AuditLogger } from "../src/security/audit-logger";
import { DefenseLayer } from "../src/security/defense-layer";

describe("SecretDetector", () => {
  const detector = new SecretDetector();

  it("should detect AWS access keys", () => {
    const result = detector.scan('const key = "AKIA1234567890ABCDEF";');
    expect(result.clean).toBe(false);
    expect(result.matches[0].type).toBe("AWS Access Key ID");
  });

  it("should detect GitHub tokens", () => {
    const result = detector.scan('const token = "ghp_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890";');
    expect(result.clean).toBe(false);
    expect(result.matches[0].type).toBe("GitHub Personal Access Token");
  });

  it("should pass clean code", () => {
    const result = detector.scan('const x = "hello world";');
    expect(result.clean).toBe(true);
    expect(result.matches).toHaveLength(0);
  });

  it("should scan multiple files", () => {
    const result = detector.scanMultiple([
      { name: "clean.ts", content: "const x = 1;" },
      { name: "dirty.ts", content: 'const key = "AKIA1234567890ABCDEF";' },
    ]);
    expect(result.filesScanned).toBe(2);
    expect(result.matches.length).toBeGreaterThan(0);
  });
});

describe("OWASPScanner", () => {
  const scanner = new OWASPScanner();

  it("should detect eval usage", () => {
    const result = scanner.scan("const x = eval(input);");
    expect(result.passed).toBe(false);
    expect(result.findings.some((f) => f.id === "A03-03")).toBe(true);
  });

  it("should detect innerHTML XSS", () => {
    const result = scanner.scan("element.innerHTML = userInput;");
    expect(result.findings.some((f) => f.category === "XSS")).toBe(true);
  });

  it("should pass safe code", () => {
    const result = scanner.scan("const sum = (a: number, b: number) => a + b;");
    expect(result.passed).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("should detect empty catch blocks", () => {
    const result = scanner.scan("try { x() } catch (e) {}");
    expect(result.findings.some((f) => f.id === "A09-01")).toBe(true);
  });
});

describe("SecurityDecisionTree", () => {
  const tree = new SecurityDecisionTree();

  it("should require approval for secret operations", () => {
    const decision = tree.evaluate({
      type: "read",
      resource: "secrets/api-key",
      user: "dev1",
      role: "developer",
      environment: "development",
    });
    expect(decision.action).toBe("require_approval");
    expect(decision.requiresApproval).toBe(true);
  });

  it("should deny destructive operations in production", () => {
    const decision = tree.evaluate({
      type: "delete-database",
      resource: "users-table",
      user: "admin",
      role: "developer",
      environment: "production",
    });
    expect(decision.action).toBe("deny");
  });

  it("should allow standard operations in development", () => {
    const decision = tree.evaluate({
      type: "write",
      resource: "src/app.ts",
      user: "dev1",
      role: "developer",
      environment: "development",
    });
    expect(decision.action).toBe("allow");
  });

  it("should require approval for production changes", () => {
    const decision = tree.evaluate({
      type: "deploy",
      resource: "app-server",
      user: "ops1",
      role: "operations",
      environment: "production",
    });
    expect(decision.action).toBe("require_approval");
  });

  it("should require approval for security config changes", () => {
    const decision = tree.evaluate({
      type: "update",
      resource: "security/rbac-config",
      user: "dev1",
      role: "developer",
      environment: "development",
    });
    expect(decision.action).toBe("require_approval");
  });
});

describe("AuditLogger", () => {
  it("should log entries", () => {
    const audit = new AuditLogger();

    audit.log({
      eventType: "TEST",
      user: "test-user",
      role: "developer",
      action: "read",
      resource: "src/app.ts",
      decision: "ALLOW",
    });

    expect(audit.getEntries()).toHaveLength(1);
    expect(audit.getEntries()[0].eventType).toBe("TEST");
  });

  it("should query entries by user", () => {
    const audit = new AuditLogger();
    audit.logAccess("user1", "dev", "file1.ts", true);
    audit.logAccess("user2", "ops", "file2.ts", false);

    const results = audit.query({ user: "user1" });
    expect(results).toHaveLength(1);
  });

  it("should calculate stats", () => {
    const audit = new AuditLogger();
    audit.logAccess("u1", "dev", "f1", true);
    audit.logAccess("u2", "dev", "f2", true);
    audit.logAccess("u3", "ops", "f3", false);

    const stats = audit.getStats();
    expect(stats.total).toBe(3);
    expect(stats.byDecision["ALLOW"]).toBe(2);
    expect(stats.byDecision["DENY"]).toBe(1);
  });
});

describe("DefenseLayer", () => {
  const defense = new DefenseLayer();

  it("should pass clean code in development", () => {
    const result = defense.evaluate("const x = 1;", {
      type: "write",
      resource: "src/utils.ts",
      user: "dev",
      role: "developer",
      environment: "development",
    });
    expect(result.overallPassed).toBe(true);
  });

  it("should block code with secrets", () => {
    const result = defense.evaluate('const k = "AKIA1234567890ABCDEF";', {
      type: "write",
      resource: "src/config.ts",
      user: "dev",
      role: "developer",
      environment: "development",
    });
    expect(result.overallPassed).toBe(false);
    expect(result.layer1.secrets.clean).toBe(false);
  });
});
