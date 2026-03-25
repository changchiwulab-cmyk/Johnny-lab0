import { describe, it, expect } from 'vitest';
import {
  createReviewResult,
  createAnomalyReport,
  shouldEscalateToHuman,
  calculateTrustScore,
  DEFAULT_CONFIG,
  type TrustMetric,
  type AnomalyReport,
} from '../review-layers.js';
import { ReviewPipeline } from '../index.js';

describe('createReviewResult', () => {
  it('creates a review result with correct fields', () => {
    const result = createReviewResult('layer1-quality', 'prettier', 'pass', ['Formatted'], 100);

    expect(result.layer).toBe('layer1-quality');
    expect(result.tool).toBe('prettier');
    expect(result.status).toBe('pass');
    expect(result.messages).toEqual(['Formatted']);
    expect(result.durationMs).toBe(100);
    expect(result.timestamp).toBeTruthy();
  });
});

describe('createAnomalyReport', () => {
  it('creates an anomaly report with all fields', () => {
    const report = createAnomalyReport(
      'critical',
      'security',
      'SQL injection found',
      'Use parameterized queries',
      'src/db.ts',
      42,
    );

    expect(report.severity).toBe('critical');
    expect(report.category).toBe('security');
    expect(report.description).toBe('SQL injection found');
    expect(report.recommendation).toBe('Use parameterized queries');
    expect(report.file).toBe('src/db.ts');
    expect(report.line).toBe(42);
  });

  it('creates an anomaly report without optional fields', () => {
    const report = createAnomalyReport('info', 'complexity', 'High complexity', 'Refactor');

    expect(report.file).toBeUndefined();
    expect(report.line).toBeUndefined();
  });
});

describe('shouldEscalateToHuman', () => {
  it('returns true for critical anomalies', () => {
    const anomalies: AnomalyReport[] = [
      createAnomalyReport('critical', 'security', 'Vulnerability found', 'Fix it'),
    ];
    expect(shouldEscalateToHuman(anomalies)).toBe(true);
  });

  it('returns true for blocker anomalies', () => {
    const anomalies: AnomalyReport[] = [
      createAnomalyReport('blocker', 'dependency', 'Breaking change', 'Update dependency'),
    ];
    expect(shouldEscalateToHuman(anomalies)).toBe(true);
  });

  it('returns false for warning-only anomalies', () => {
    const anomalies: AnomalyReport[] = [
      createAnomalyReport('warning', 'complexity', 'High complexity', 'Refactor'),
      createAnomalyReport('info', 'coverage', 'Low coverage', 'Add tests'),
    ];
    expect(shouldEscalateToHuman(anomalies)).toBe(false);
  });

  it('returns false for empty anomalies', () => {
    expect(shouldEscalateToHuman([])).toBe(false);
  });
});

describe('calculateTrustScore', () => {
  it('returns high score for perfect metrics', () => {
    const metric: TrustMetric = {
      agentId: 'agent-1',
      totalReviews: 100,
      passRate: 1.0,
      escalationRate: 0.0,
      averageCycleTimeMs: 5000,
      lastUpdated: new Date().toISOString(),
    };
    expect(calculateTrustScore(metric)).toBe(1.0);
  });

  it('returns low score for poor metrics', () => {
    const metric: TrustMetric = {
      agentId: 'agent-2',
      totalReviews: 50,
      passRate: 0.3,
      escalationRate: 0.8,
      averageCycleTimeMs: 60000,
      lastUpdated: new Date().toISOString(),
    };
    const score = calculateTrustScore(metric);
    expect(score).toBeLessThan(0.5);
  });

  it('weights pass rate at 60% and escalation at 40%', () => {
    const metric: TrustMetric = {
      agentId: 'agent-3',
      totalReviews: 75,
      passRate: 0.5,
      escalationRate: 0.5,
      averageCycleTimeMs: 10000,
      lastUpdated: new Date().toISOString(),
    };
    // 0.5 * 0.6 + (1 - 0.5) * 0.4 = 0.3 + 0.2 = 0.5
    expect(calculateTrustScore(metric)).toBe(0.5);
  });
});

describe('DEFAULT_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_CONFIG.coverageThreshold).toBe(80);
    expect(DEFAULT_CONFIG.complexityThreshold).toBe(10);
    expect(DEFAULT_CONFIG.slaMinutes).toBe(30);
    expect(DEFAULT_CONFIG.requiredApprovers).toBe(1);
  });
});

describe('ReviewPipeline', () => {
  it('initializes with default config', () => {
    const pipeline = new ReviewPipeline();
    expect(pipeline.getConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('accepts partial config overrides', () => {
    const pipeline = new ReviewPipeline({ coverageThreshold: 90 });
    expect(pipeline.getConfig().coverageThreshold).toBe(90);
    expect(pipeline.getConfig().slaMinutes).toBe(30);
  });

  it('runs layer1 and reports pass when all checks pass', () => {
    const pipeline = new ReviewPipeline();
    pipeline.addResult(createReviewResult('layer1-quality', 'prettier', 'pass', ['OK'], 50));
    pipeline.addResult(createReviewResult('layer1-quality', 'eslint', 'pass', ['OK'], 30));

    const result = pipeline.runLayer1();
    expect(result.status).toBe('pass');
  });

  it('runs layer1 and reports fail when a check fails', () => {
    const pipeline = new ReviewPipeline();
    pipeline.addResult(createReviewResult('layer1-quality', 'prettier', 'pass', ['OK'], 50));
    pipeline.addResult(
      createReviewResult('layer1-quality', 'eslint', 'fail', ['Errors found'], 30),
    );

    const result = pipeline.runLayer1();
    expect(result.status).toBe('fail');
  });

  it('runs layer2 and flags human review for critical anomalies', () => {
    const pipeline = new ReviewPipeline();
    pipeline.addAnomaly(createAnomalyReport('critical', 'security', 'XSS found', 'Sanitize input'));

    const { result, needsHumanReview } = pipeline.runLayer2();
    expect(result.status).toBe('fail');
    expect(needsHumanReview).toBe(true);
  });

  it('runs layer2 with warnings but no human escalation', () => {
    const pipeline = new ReviewPipeline();
    pipeline.addAnomaly(
      createAnomalyReport('warning', 'complexity', 'High complexity', 'Refactor'),
    );

    const { result, needsHumanReview } = pipeline.runLayer2();
    expect(result.status).toBe('warning');
    expect(needsHumanReview).toBe(false);
  });

  it('runs layer2 clean with no anomalies', () => {
    const pipeline = new ReviewPipeline();
    const { result, needsHumanReview } = pipeline.runLayer2();
    expect(result.status).toBe('pass');
    expect(needsHumanReview).toBe(false);
  });

  it('tracks pending human checkpoints', () => {
    const pipeline = new ReviewPipeline();
    pipeline.addCheckpoint({
      id: 'cp-1',
      triggerCondition: 'Architecture change detected',
      decisionType: 'architecture',
      requiredApprovers: 2,
      slaMinutes: 30,
      description: 'New dependency added',
    });

    expect(pipeline.getPendingCheckpoints()).toHaveLength(1);
  });

  it('provides accurate summary', () => {
    const pipeline = new ReviewPipeline();
    pipeline.addResult(createReviewResult('layer1-quality', 'prettier', 'pass', [], 10));
    pipeline.addResult(createReviewResult('layer1-quality', 'eslint', 'fail', [], 20));
    pipeline.addResult(createReviewResult('layer2-security', 'audit', 'warning', [], 30));
    pipeline.addAnomaly(createAnomalyReport('warning', 'complexity', 'High', 'Refactor'));
    pipeline.addCheckpoint({
      id: 'cp-1',
      triggerCondition: 'test',
      decisionType: 'security-critical',
      requiredApprovers: 1,
      slaMinutes: 30,
      description: 'test',
    });

    const summary = pipeline.getSummary();
    expect(summary.totalResults).toBe(3);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.warnings).toBe(1);
    expect(summary.anomalyCount).toBe(1);
    expect(summary.pendingCheckpoints).toBe(1);
  });

  it('evaluates agent trust - high trust', () => {
    const pipeline = new ReviewPipeline();
    const { score, recommendation } = pipeline.evaluateAgentTrust({
      agentId: 'agent-1',
      totalReviews: 100,
      passRate: 0.95,
      escalationRate: 0.05,
      averageCycleTimeMs: 5000,
      lastUpdated: new Date().toISOString(),
    });
    expect(score).toBeGreaterThanOrEqual(0.9);
    expect(recommendation).toContain('High trust');
  });

  it('evaluates agent trust - moderate trust', () => {
    const pipeline = new ReviewPipeline();
    const { score, recommendation } = pipeline.evaluateAgentTrust({
      agentId: 'agent-2',
      totalReviews: 50,
      passRate: 0.8,
      escalationRate: 0.3,
      averageCycleTimeMs: 15000,
      lastUpdated: new Date().toISOString(),
    });
    expect(score).toBeGreaterThanOrEqual(0.7);
    expect(score).toBeLessThan(0.9);
    expect(recommendation).toContain('Moderate trust');
  });

  it('evaluates agent trust - low trust', () => {
    const pipeline = new ReviewPipeline();
    const { score, recommendation } = pipeline.evaluateAgentTrust({
      agentId: 'agent-3',
      totalReviews: 20,
      passRate: 0.4,
      escalationRate: 0.7,
      averageCycleTimeMs: 60000,
      lastUpdated: new Date().toISOString(),
    });
    expect(score).toBeLessThan(0.7);
    expect(recommendation).toContain('Low trust');
  });
});
