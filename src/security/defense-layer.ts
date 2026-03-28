import { SecretDetector, SecretScanResult } from "./secret-detector";
import { OWASPScanner, OWASPScanResult } from "./owasp-scanner";
import { SecurityDecisionTree, OperationContext, SecurityDecision } from "./decision-tree";
import { AuditLogger } from "./audit-logger";
import { createChildLogger } from "../utils/logger";

const logger = createChildLogger("security:defense");

export interface DefenseResult {
  layer1: { secrets: SecretScanResult; owasp: OWASPScanResult };
  layer2: SecurityDecision;
  overallPassed: boolean;
  summary: string;
}

export class DefenseLayer {
  private secretDetector = new SecretDetector();
  private owaspScanner = new OWASPScanner();
  private decisionTree = new SecurityDecisionTree();
  private auditLogger: AuditLogger;

  constructor(auditLogDir?: string) {
    this.auditLogger = new AuditLogger(auditLogDir);
  }

  evaluate(content: string, context: OperationContext, filePath?: string): DefenseResult {
    logger.info(`Defense evaluation: ${context.type} on ${context.resource}`);

    // Layer 1: Development-time protection (static analysis)
    const secrets = this.secretDetector.scan(content, filePath);
    const owasp = this.owaspScanner.scan(content, filePath);

    // Layer 2: Decision tree (operational security)
    const decision = this.decisionTree.evaluate(context);

    // Audit logging
    this.auditLogger.log({
      eventType: "DEFENSE_EVAL",
      user: context.user,
      role: context.role,
      action: context.type,
      resource: context.resource,
      decision: decision.action,
      details: {
        secretsFound: secrets.matches.length,
        owaspFindings: owasp.findings.length,
        environment: context.environment,
      },
    });

    const overallPassed = secrets.clean && owasp.passed && decision.action !== "deny";

    const summary = [
      `Defense Evaluation: ${overallPassed ? "PASSED" : "BLOCKED"}`,
      `  Layer 1 (Static Analysis):`,
      `    Secrets: ${secrets.clean ? "Clean" : `${secrets.matches.length} found`}`,
      `    OWASP: ${owasp.passed ? "Passed" : `${owasp.findings.length} findings`}`,
      `  Layer 2 (Decision):`,
      `    Action: ${decision.action}`,
      `    Reason: ${decision.reason}`,
      decision.requiresApproval ? `    Approver: ${decision.approver}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    logger.info(summary);

    return {
      layer1: { secrets, owasp },
      layer2: decision,
      overallPassed,
      summary,
    };
  }

  getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  async flushAudit(): Promise<void> {
    await this.auditLogger.flush();
  }
}
