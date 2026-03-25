#!/usr/bin/env node

/**
 * Agent Trust Metrics Tracker
 *
 * Records and displays agent trust metrics.
 * Usage:
 *   node scripts/trust-metrics.mjs record <agentId> <pass|fail> <durationMs> [escalated]
 *   node scripts/trust-metrics.mjs report [agentId]
 *   node scripts/trust-metrics.mjs reset
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const METRICS_FILE = resolve(process.cwd(), 'review-metrics.json');

function loadMetrics() {
  try {
    return JSON.parse(readFileSync(METRICS_FILE, 'utf-8'));
  } catch {
    return { agents: {} };
  }
}

function saveMetrics(data) {
  writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2));
}

function recordReview(agentId, passed, durationMs, escalated) {
  const data = loadMetrics();

  if (!data.agents[agentId]) {
    data.agents[agentId] = {
      totalReviews: 0,
      passCount: 0,
      failCount: 0,
      escalationCount: 0,
      totalDurationMs: 0,
      lastUpdated: null,
    };
  }

  const agent = data.agents[agentId];
  agent.totalReviews++;
  if (passed) agent.passCount++;
  else agent.failCount++;
  if (escalated) agent.escalationCount++;
  agent.totalDurationMs += durationMs;
  agent.lastUpdated = new Date().toISOString();

  saveMetrics(data);
  console.log(`Recorded review for ${agentId}: ${passed ? 'PASS' : 'FAIL'} (${durationMs}ms)`);
}

function showReport(agentId) {
  const data = loadMetrics();

  if (agentId) {
    const agent = data.agents[agentId];
    if (!agent) {
      console.log(`No metrics found for agent: ${agentId}`);
      return;
    }
    printAgentReport(agentId, agent);
  } else {
    console.log('=== Agent Trust Metrics Report ===\n');
    for (const [id, agent] of Object.entries(data.agents)) {
      printAgentReport(id, agent);
      console.log('---');
    }
    if (Object.keys(data.agents).length === 0) {
      console.log('No metrics recorded yet.');
    }
  }
}

function printAgentReport(agentId, agent) {
  const passRate = agent.totalReviews > 0 ? agent.passCount / agent.totalReviews : 0;
  const escalationRate = agent.totalReviews > 0 ? agent.escalationCount / agent.totalReviews : 0;
  const avgDuration = agent.totalReviews > 0 ? agent.totalDurationMs / agent.totalReviews : 0;
  const trustScore = passRate * 0.6 + (1 - escalationRate) * 0.4;

  console.log(`Agent: ${agentId}`);
  console.log(`  Total reviews: ${agent.totalReviews}`);
  console.log(`  Pass rate: ${(passRate * 100).toFixed(1)}%`);
  console.log(`  Escalation rate: ${(escalationRate * 100).toFixed(1)}%`);
  console.log(`  Avg cycle time: ${(avgDuration / 1000).toFixed(1)}s`);
  console.log(`  Trust score: ${(trustScore * 100).toFixed(1)}%`);
  console.log(`  Last updated: ${agent.lastUpdated || 'never'}`);

  if (trustScore >= 0.9) console.log('  Recommendation: High trust - reduce oversight');
  else if (trustScore >= 0.7) console.log('  Recommendation: Moderate trust - standard review');
  else console.log('  Recommendation: Low trust - increase checkpoints');
}

// --- CLI ---
const [, , command, ...args] = process.argv;

switch (command) {
  case 'record': {
    const [agentId, result, duration, escalated] = args;
    if (!agentId || !result || !duration) {
      console.error(
        'Usage: trust-metrics.mjs record <agentId> <pass|fail> <durationMs> [escalated]',
      );
      process.exit(1);
    }
    recordReview(agentId, result === 'pass', parseInt(duration, 10), escalated === 'true');
    break;
  }
  case 'report':
    showReport(args[0]);
    break;
  case 'reset':
    saveMetrics({ agents: {} });
    console.log('Metrics reset.');
    break;
  default:
    console.log('Usage: trust-metrics.mjs <record|report|reset> [args]');
    break;
}
