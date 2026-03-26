import { describe, it, expect } from "vitest";
import { RBAC } from "../src/permissions/rbac";
import { ROLES } from "../src/permissions/roles";
import { legalReviewTemplate } from "../src/permissions/templates/legal-review";
import { securityAuditTemplate } from "../src/permissions/templates/security-audit";

describe("RBAC", () => {
  const rbac = new RBAC();

  it("should allow developer to write to src files", () => {
    const decision = rbac.checkPermission({
      role: "developer",
      action: "write",
      resource: "src/app.ts",
    });
    expect(decision.allowed).toBe(true);
  });

  it("should deny legal from writing to src files", () => {
    const decision = rbac.checkPermission({
      role: "legal",
      action: "write",
      resource: "src/app.ts",
    });
    expect(decision.allowed).toBe(false);
  });

  it("should allow legal to read any file", () => {
    const decision = rbac.checkPermission({
      role: "legal",
      action: "read",
      resource: "contracts/draft.pdf",
    });
    expect(decision.allowed).toBe(true);
  });

  it("should allow legal to edit markdown files", () => {
    const decision = rbac.checkPermission({
      role: "legal",
      action: "edit",
      resource: "notes.md",
    });
    expect(decision.allowed).toBe(true);
  });

  it("should allow security to execute audit commands", () => {
    const decision = rbac.checkPermission({
      role: "security",
      action: "execute",
      resource: "audit:dependencies",
    });
    expect(decision.allowed).toBe(true);
  });

  it("should deny marketing from deleting files", () => {
    const decision = rbac.checkPermission({
      role: "marketing",
      action: "delete",
      resource: "src/app.ts",
    });
    expect(decision.allowed).toBe(false);
  });

  it("should list all roles", () => {
    const roles = rbac.listRoles();
    expect(roles).toHaveLength(5);
    expect(roles.map((r) => r.name)).toContain("developer");
    expect(roles.map((r) => r.name)).toContain("legal");
  });
});

describe("Roles", () => {
  it("should have all expected roles defined", () => {
    expect(ROLES.developer).toBeDefined();
    expect(ROLES.operations).toBeDefined();
    expect(ROLES.legal).toBeDefined();
    expect(ROLES.security).toBeDefined();
    expect(ROLES.marketing).toBeDefined();
  });

  it("should have permissions for each role", () => {
    for (const role of Object.values(ROLES)) {
      expect(role.permissions.length).toBeGreaterThan(0);
      expect(role.displayName).toBeTruthy();
    }
  });
});

describe("Workflow Templates", () => {
  it("should have valid legal review template", () => {
    expect(legalReviewTemplate.steps.length).toBeGreaterThan(0);
    expect(legalReviewTemplate.department).toBe("legal");
    expect(legalReviewTemplate.steps.some((s) => !s.autoExecute)).toBe(true); // has manual steps
  });

  it("should have valid security audit template", () => {
    expect(securityAuditTemplate.steps.length).toBeGreaterThan(0);
    expect(securityAuditTemplate.department).toBe("security");
    expect(securityAuditTemplate.steps[0].autoExecute).toBe(false); // first step is manual
  });
});
