import { QualityChecker, QualityResult } from "./quality-checker";
import { SecurityScanner, SecurityScanResult } from "./security-scanner";
import { HumanCheckpoint, HumanCheckpointResult } from "./human-checkpoint";
import { createChildLogger } from "../utils/logger";

const logger = createChildLogger("review:pipeline");

export interface ReviewResult {
  passed: boolean;
  quality: QualityResult;
  security: SecurityScanResult;
  humanReview: HumanCheckpointResult;
  summary: string;
}

export class ReviewPipeline {
  private qualityChecker = new QualityChecker();
  private securityScanner = new SecurityScanner();
  private humanCheckpoint = new HumanCheckpoint();

  async review(filePath: string, content: string, changedFiles: string[] = []): Promise<ReviewResult> {
    logger.info(`Starting 3-layer review for: ${filePath}`);

    // Layer 1: Code Quality
    logger.info("Layer 1: Code Quality Check");
    const quality = this.qualityChecker.runAll(filePath, content);

    // Layer 2: Security Scan
    logger.info("Layer 2: Security Scan");
    const security = this.securityScanner.scanAll(content, filePath);

    // Layer 3: Human Checkpoint
    logger.info("Layer 3: Human Checkpoint Assessment");
    const humanReview = this.humanCheckpoint.assessRisk({
      securityFindings: security.findings,
      qualityScore: quality.score,
      changedFiles: changedFiles.length > 0 ? changedFiles : [filePath],
      isArchitecturalChange: this.detectArchitecturalChange(content),
    });

    const passed = quality.passed && security.passed && !humanReview.requiresHumanReview;

    const summary = [
      `Review: ${passed ? "PASSED" : "NEEDS ATTENTION"}`,
      `  Quality: ${quality.score}% (${quality.passed ? "PASS" : "FAIL"})`,
      `  Security: ${security.findings.length} findings (${security.passed ? "PASS" : "FAIL"})`,
      `  Human Review: ${humanReview.requiresHumanReview ? "REQUIRED" : "Auto-approved"}`,
    ].join("\n");

    logger.info(summary);
    return { passed, quality, security, humanReview, summary };
  }

  private detectArchitecturalChange(content: string): boolean {
    const indicators = [
      /class\s+\w+\s+extends\s+\w+/,
      /export\s+default\s+class/,
      /interface\s+\w+Service/,
      /createConnection|createPool|mongoose\.connect/,
      /express\(\)|fastify\(\)|createServer/,
    ];
    return indicators.filter((i) => i.test(content)).length >= 2;
  }

  getQualityChecker(): QualityChecker {
    return this.qualityChecker;
  }

  getSecurityScanner(): SecurityScanner {
    return this.securityScanner;
  }

  getHumanCheckpoint(): HumanCheckpoint {
    return this.humanCheckpoint;
  }
}
