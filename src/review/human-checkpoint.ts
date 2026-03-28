import { createChildLogger } from "../utils/logger";
import { SecurityFinding } from "./security-scanner";

const logger = createChildLogger("review:human-checkpoint");

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface HumanReviewItem {
  category: string;
  riskLevel: RiskLevel;
  description: string;
  recommendation: string;
  requiresApproval: boolean;
}

export interface HumanCheckpointResult {
  requiresHumanReview: boolean;
  items: HumanReviewItem[];
  autoApproved: string[];
  pendingApproval: string[];
}

export class HumanCheckpoint {
  private riskThreshold: RiskLevel = "high";

  assessRisk(context: {
    securityFindings: SecurityFinding[];
    qualityScore: number;
    changedFiles: string[];
    isArchitecturalChange: boolean;
  }): HumanCheckpointResult {
    const items: HumanReviewItem[] = [];
    const autoApproved: string[] = [];
    const pendingApproval: string[] = [];

    // Check security findings
    for (const finding of context.securityFindings) {
      if (this.isSeverityAboveThreshold(finding.severity)) {
        items.push({
          category: "Security",
          riskLevel: finding.severity as RiskLevel,
          description: `${finding.rule}: ${finding.message}`,
          recommendation: "Requires security team review before merging",
          requiresApproval: true,
        });
        pendingApproval.push(finding.rule);
      } else {
        autoApproved.push(finding.rule);
      }
    }

    // Check quality score
    if (context.qualityScore < 70) {
      items.push({
        category: "Code Quality",
        riskLevel: "medium",
        description: `Quality score ${context.qualityScore}% is below threshold (70%)`,
        recommendation: "Review code quality before proceeding",
        requiresApproval: true,
      });
      pendingApproval.push("quality-review");
    } else {
      autoApproved.push("quality-check");
    }

    // Check for architectural changes
    if (context.isArchitecturalChange) {
      items.push({
        category: "Architecture",
        riskLevel: "high",
        description: "Architectural change detected",
        recommendation: "Requires architect review and approval",
        requiresApproval: true,
      });
      pendingApproval.push("architecture-review");
    }

    // Check for sensitive file changes
    const sensitivePatterns = [/\.env/, /config.*secret/i, /credential/i, /\.pem$/, /\.key$/];
    for (const file of context.changedFiles) {
      if (sensitivePatterns.some((p) => p.test(file))) {
        items.push({
          category: "Sensitive Files",
          riskLevel: "critical",
          description: `Sensitive file modified: ${file}`,
          recommendation: "Requires security review",
          requiresApproval: true,
        });
        pendingApproval.push(`sensitive:${file}`);
      }
    }

    const requiresHumanReview = items.some((i) => i.requiresApproval);
    logger.info(
      `Human checkpoint: ${requiresHumanReview ? "REVIEW REQUIRED" : "AUTO-APPROVED"} ` +
        `(${pendingApproval.length} pending, ${autoApproved.length} auto-approved)`,
    );

    return { requiresHumanReview, items, autoApproved, pendingApproval };
  }

  private isSeverityAboveThreshold(severity: string): boolean {
    const levels: Record<string, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
    const thresholdLevel = levels[this.riskThreshold] ?? 3;
    const severityLevel = levels[severity] ?? 0;
    return severityLevel >= thresholdLevel;
  }

  setThreshold(level: RiskLevel): void {
    this.riskThreshold = level;
    logger.info(`Human review threshold set to: ${level}`);
  }
}
