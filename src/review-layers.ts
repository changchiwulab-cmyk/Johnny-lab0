/**
 * Automated Review System - Type Definitions
 * Implements the 3-layer review architecture for Trend 4
 */

// --- Layer 1: Automated Quality Checks ---

export type ReviewStatus = 'pass' | 'fail' | 'warning';
export type ReviewLayer = 'layer1-quality' | 'layer2-security' | 'layer3-human';

export interface ReviewResult {
  layer: ReviewLayer;
  status: ReviewStatus;
  tool: string;
  messages: string[];
  timestamp: string;
  durationMs: number;
}

// --- Layer 2: Anomaly Detection ---

export type AnomalySeverity = 'info' | 'warning' | 'critical' | 'blocker';

export interface AnomalyReport {
  severity: AnomalySeverity;
  category: 'complexity' | 'security' | 'dependency' | 'coverage';
  description: string;
  file?: string;
  line?: number;
  recommendation: string;
}

// --- Layer 3: Human Checkpoints ---

export type DecisionType = 'architecture' | 'security-critical' | 'business-logic' | 'compliance';

export interface HumanCheckpoint {
  id: string;
  triggerCondition: string;
  decisionType: DecisionType;
  requiredApprovers: number;
  slaMinutes: number;
  description: string;
}

// --- Agent Trust Metrics ---

export interface TrustMetric {
  agentId: string;
  totalReviews: number;
  passRate: number;
  escalationRate: number;
  averageCycleTimeMs: number;
  lastUpdated: string;
}

// --- Review Pipeline ---

export interface PipelineConfig {
  coverageThreshold: number;
  complexityThreshold: number;
  slaMinutes: number;
  requiredApprovers: number;
}

export const DEFAULT_CONFIG: PipelineConfig = {
  coverageThreshold: 80,
  complexityThreshold: 10,
  slaMinutes: 30,
  requiredApprovers: 1,
};

export function createReviewResult(
  layer: ReviewLayer,
  tool: string,
  status: ReviewStatus,
  messages: string[],
  durationMs: number,
): ReviewResult {
  return {
    layer,
    status,
    tool,
    messages,
    timestamp: new Date().toISOString(),
    durationMs,
  };
}

export function createAnomalyReport(
  severity: AnomalySeverity,
  category: AnomalyReport['category'],
  description: string,
  recommendation: string,
  file?: string,
  line?: number,
): AnomalyReport {
  return { severity, category, description, recommendation, file, line };
}

export function shouldEscalateToHuman(anomalies: AnomalyReport[]): boolean {
  return anomalies.some((a) => a.severity === 'critical' || a.severity === 'blocker');
}

export function calculateTrustScore(metric: TrustMetric): number {
  const passWeight = 0.6;
  const escalationWeight = 0.4;
  return metric.passRate * passWeight + (1 - metric.escalationRate) * escalationWeight;
}
