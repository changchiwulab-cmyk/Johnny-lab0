/**
 * ReviewPipeline - 3-Layer Automated Review System
 *
 * Layer 1: Code Quality (format, lint, typecheck, test coverage)
 * Layer 2: Security & Anomaly Detection (audit, secrets, complexity)
 * Layer 3: Human Checkpoints (architecture, security-critical, business logic)
 */

import {
  type ReviewResult,
  type AnomalyReport,
  type HumanCheckpoint,
  type TrustMetric,
  type PipelineConfig,
  DEFAULT_CONFIG,
  createReviewResult,
  shouldEscalateToHuman,
  calculateTrustScore,
} from './review-layers.js';

export class ReviewPipeline {
  private config: PipelineConfig;
  private results: ReviewResult[] = [];
  private anomalies: AnomalyReport[] = [];
  private checkpoints: HumanCheckpoint[] = [];

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getConfig(): PipelineConfig {
    return { ...this.config };
  }

  addResult(result: ReviewResult): void {
    this.results.push(result);
  }

  addAnomaly(anomaly: AnomalyReport): void {
    this.anomalies.push(anomaly);
  }

  addCheckpoint(checkpoint: HumanCheckpoint): void {
    this.checkpoints.push(checkpoint);
  }

  runLayer1(): ReviewResult {
    const start = Date.now();
    const allPassed = this.results
      .filter((r) => r.layer === 'layer1-quality')
      .every((r) => r.status === 'pass');

    const result = createReviewResult(
      'layer1-quality',
      'pipeline',
      allPassed ? 'pass' : 'fail',
      allPassed ? ['All quality checks passed'] : ['Quality checks failed'],
      Date.now() - start,
    );

    this.addResult(result);
    return result;
  }

  runLayer2(): { result: ReviewResult; needsHumanReview: boolean } {
    const start = Date.now();
    const needsHumanReview = shouldEscalateToHuman(this.anomalies);
    const hasCritical = this.anomalies.some(
      (a) => a.severity === 'critical' || a.severity === 'blocker',
    );

    const result = createReviewResult(
      'layer2-security',
      'pipeline',
      hasCritical ? 'fail' : this.anomalies.length > 0 ? 'warning' : 'pass',
      this.anomalies.map((a) => `[${a.severity}] ${a.description}`),
      Date.now() - start,
    );

    this.addResult(result);
    return { result, needsHumanReview };
  }

  getPendingCheckpoints(): HumanCheckpoint[] {
    return [...this.checkpoints];
  }

  getSummary(): {
    totalResults: number;
    passed: number;
    failed: number;
    warnings: number;
    anomalyCount: number;
    pendingCheckpoints: number;
  } {
    return {
      totalResults: this.results.length,
      passed: this.results.filter((r) => r.status === 'pass').length,
      failed: this.results.filter((r) => r.status === 'fail').length,
      warnings: this.results.filter((r) => r.status === 'warning').length,
      anomalyCount: this.anomalies.length,
      pendingCheckpoints: this.checkpoints.length,
    };
  }

  evaluateAgentTrust(metric: TrustMetric): { score: number; recommendation: string } {
    const score = calculateTrustScore(metric);
    let recommendation: string;

    if (score >= 0.9) {
      recommendation = 'High trust - reduce human oversight for routine tasks';
    } else if (score >= 0.7) {
      recommendation = 'Moderate trust - maintain standard review process';
    } else {
      recommendation = 'Low trust - increase human checkpoints';
    }

    return { score, recommendation };
  }
}

export {
  type ReviewResult,
  type AnomalyReport,
  type HumanCheckpoint,
  type TrustMetric,
  type PipelineConfig,
  DEFAULT_CONFIG,
} from './review-layers.js';
