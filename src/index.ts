import { Orchestrator } from "./orchestrator/orchestrator";
import { ReviewPipeline } from "./review/review-pipeline";
import { RBAC } from "./permissions/rbac";
import { ROLES, RoleName } from "./permissions/roles";
import { DefenseLayer } from "./security/defense-layer";
import { legalReviewTemplate } from "./permissions/templates/legal-review";
import { opsAutomationTemplate } from "./permissions/templates/ops-automation";
import { marketingReportTemplate } from "./permissions/templates/marketing-report";
import { securityAuditTemplate } from "./permissions/templates/security-audit";
import { logger } from "./utils/logger";

async function demoOrchestrator() {
  console.log("\n" + "=".repeat(60));
  console.log("  Priority 1: Multi-Agent Coordination System");
  console.log("=".repeat(60) + "\n");

  const orchestrator = new Orchestrator();

  // Decompose a complex task
  orchestrator.decompose(
    "User Authentication API",
    "Build a complete user authentication API with JWT tokens, password hashing, and session management",
  );

  // Show execution plan
  const plan = orchestrator.plan();
  console.log(`Execution Plan: ${plan.totalTasks} tasks in ${plan.phases.length} phases\n`);
  for (const phase of plan.phases) {
    console.log(
      `  Phase ${phase.phaseNumber} (${phase.parallel ? "parallel" : "sequential"}):`,
    );
    for (const task of phase.tasks) {
      console.log(`    - [${task.assignedTo}] ${task.name}`);
    }
  }

  // Execute
  console.log("\nExecuting...\n");
  const result = await orchestrator.execute();
  console.log(`Result: ${result.summary}`);
}

async function demoReviewPipeline() {
  console.log("\n" + "=".repeat(60));
  console.log("  Priority 2: Automated Review System (3-Layer)");
  console.log("=".repeat(60) + "\n");

  const pipeline = new ReviewPipeline();

  // Review a sample code snippet
  const sampleCode = `
import express from 'express';
const app = express();

app.get('/user', (req, res) => {
  const id = req.query.id;
  const result = db.query("SELECT * FROM users WHERE id = " + id);
  res.json(result);
});

const API_KEY = "sk-live-abcdefghijklmnopqrstuvwxyz123456";
`;

  const review = await pipeline.review("sample.ts", sampleCode);
  console.log(review.summary);

  if (review.security.findings.length > 0) {
    console.log("\nSecurity Findings:");
    for (const f of review.security.findings) {
      console.log(`  [${f.severity.toUpperCase()}] ${f.rule}: ${f.message}`);
    }
  }

  if (review.humanReview.requiresHumanReview) {
    console.log("\nHuman Review Required:");
    for (const item of review.humanReview.items) {
      console.log(`  [${item.riskLevel.toUpperCase()}] ${item.category}: ${item.description}`);
    }
  }
}

function demoRBAC() {
  console.log("\n" + "=".repeat(60));
  console.log("  Priority 3: Cross-Department Permission Templates");
  console.log("=".repeat(60) + "\n");

  const rbac = new RBAC();

  // Show all roles
  console.log("Roles:");
  for (const role of rbac.listRoles()) {
    console.log(`  ${role.displayName} (${role.name}): ${role.description}`);
    console.log(`    Permissions: ${role.permissions.length} rules, Max risk: ${role.maxRiskLevel}`);
  }

  // Demo permission checks
  console.log("\nPermission Checks:");
  const testCases: { role: RoleName; action: "read" | "write" | "execute" | "delete"; resource: string }[] = [
    { role: "developer", action: "write", resource: "src/app.ts" },
    { role: "legal", action: "write", resource: "src/app.ts" },
    { role: "legal", action: "read", resource: "contracts/draft.md" },
    { role: "operations", action: "execute", resource: "npm:run" },
    { role: "security", action: "execute", resource: "scan:vulnerabilities" },
    { role: "marketing", action: "read", resource: "reports/q1.csv" },
    { role: "marketing", action: "delete", resource: "src/app.ts" },
  ];

  for (const tc of testCases) {
    const decision = rbac.checkPermission(tc);
    const icon = decision.allowed ? "✅" : "❌";
    console.log(`  ${icon} ${tc.role} ${tc.action} ${tc.resource} → ${decision.reason}`);
  }

  // Show workflow templates
  console.log("\nWorkflow Templates:");
  const templates = [legalReviewTemplate, opsAutomationTemplate, marketingReportTemplate, securityAuditTemplate];
  for (const t of templates) {
    console.log(`  ${t.name} (${t.department}): ${t.steps.length} steps`);
    const autoSteps = t.steps.filter((s) => s.autoExecute).length;
    console.log(`    Auto: ${autoSteps} | Manual: ${t.steps.length - autoSteps}`);
  }
}

function demoSecurityDefense() {
  console.log("\n" + "=".repeat(60));
  console.log("  Priority 4: Security-First Architecture");
  console.log("=".repeat(60) + "\n");

  const defense = new DefenseLayer();

  // Test 1: Safe code in dev
  console.log("Test 1: Safe code in development");
  const safeResult = defense.evaluate(
    'const greeting = "Hello World";\nconsole.log(greeting);',
    {
      type: "write",
      resource: "src/hello.ts",
      user: "developer1",
      role: "developer",
      environment: "development",
    },
  );
  console.log(`  ${safeResult.summary}\n`);

  // Test 2: Code with secrets
  console.log("Test 2: Code containing secrets");
  const secretResult = defense.evaluate(
    'const token = "ghp_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890";',
    {
      type: "write",
      resource: "src/config.ts",
      user: "developer2",
      role: "developer",
      environment: "development",
    },
  );
  console.log(`  ${secretResult.summary}\n`);

  // Test 3: Production deployment
  console.log("Test 3: Production deployment");
  const prodResult = defense.evaluate("const config = {};", {
    type: "deploy",
    resource: "production/app",
    user: "ops-user",
    role: "operations",
    environment: "production",
  });
  console.log(`  ${prodResult.summary}\n`);

  // Test 4: Destructive operation in production
  console.log("Test 4: Destructive operation in production");
  const deleteResult = defense.evaluate("DROP TABLE users;", {
    type: "delete-database",
    resource: "production/database",
    user: "admin",
    role: "developer",
    environment: "production",
  });
  console.log(`  ${deleteResult.summary}\n`);

  // Show audit stats
  const audit = defense.getAuditLogger();
  const stats = audit.getStats();
  console.log(`Audit Log: ${stats.total} entries`);
  console.log(`  By type:`, stats.byType);
  console.log(`  By decision:`, stats.byDecision);
}

async function main() {
  logger.info("2026 Agentic Coding Framework - Demo");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║    2026 Agentic Coding Framework - 智能編碼最佳實踐     ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  await demoOrchestrator();
  await demoReviewPipeline();
  demoRBAC();
  demoSecurityDefense();

  console.log("\n" + "=".repeat(60));
  console.log("  Demo complete!");
  console.log("=".repeat(60));
}

main().catch(console.error);
