import { describe, it, expect } from "vitest";
import { SecurityScanner } from "../src/review/security-scanner";
import { HumanCheckpoint } from "../src/review/human-checkpoint";

describe("SecurityScanner", () => {
  const scanner = new SecurityScanner();

  it("should detect secrets in code", () => {
    const code = `const token = "ghp_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890";`;
    const findings = scanner.detectSecrets(code, "test.ts");

    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].rule).toContain("secret-detection");
  });

  it("should detect OWASP vulnerabilities", () => {
    const code = `const result = eval(userInput);`;
    const findings = scanner.scanOWASP(code, "test.ts");

    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.rule.includes("Eval"))).toBe(true);
  });

  it("should pass clean code", () => {
    const code = `const x = 1 + 2;\nconsole.log(x);`;
    const result = scanner.scanAll(code);

    expect(result.passed).toBe(true);
    expect(result.highSeverityCount).toBe(0);
  });

  it("should fail code with critical issues", () => {
    const code = `const key = "AKIA1234567890123456";\neval(input);`;
    const result = scanner.scanAll(code, "bad.ts");

    expect(result.passed).toBe(false);
    expect(result.highSeverityCount).toBeGreaterThan(0);
  });
});

describe("HumanCheckpoint", () => {
  const checkpoint = new HumanCheckpoint();

  it("should auto-approve low-risk changes", () => {
    const result = checkpoint.assessRisk({
      securityFindings: [],
      qualityScore: 95,
      changedFiles: ["src/utils.ts"],
      isArchitecturalChange: false,
    });

    expect(result.requiresHumanReview).toBe(false);
    expect(result.pendingApproval).toHaveLength(0);
  });

  it("should require review for low quality score", () => {
    const result = checkpoint.assessRisk({
      securityFindings: [],
      qualityScore: 50,
      changedFiles: ["src/app.ts"],
      isArchitecturalChange: false,
    });

    expect(result.requiresHumanReview).toBe(true);
    expect(result.pendingApproval).toContain("quality-review");
  });

  it("should require review for architectural changes", () => {
    const result = checkpoint.assessRisk({
      securityFindings: [],
      qualityScore: 90,
      changedFiles: ["src/app.ts"],
      isArchitecturalChange: true,
    });

    expect(result.requiresHumanReview).toBe(true);
    expect(result.pendingApproval).toContain("architecture-review");
  });

  it("should flag sensitive file changes", () => {
    const result = checkpoint.assessRisk({
      securityFindings: [],
      qualityScore: 90,
      changedFiles: [".env", "config.secret.json"],
      isArchitecturalChange: false,
    });

    expect(result.requiresHumanReview).toBe(true);
    expect(result.items.some((i) => i.category === "Sensitive Files")).toBe(true);
  });
});
