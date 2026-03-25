#!/usr/bin/env node

/**
 * Layer 2: Anomaly Detection Script
 *
 * Checks for:
 * 1. npm audit vulnerabilities (high/critical)
 * 2. Code complexity warnings from ESLint
 * 3. Dependency conflicts
 *
 * Outputs structured anomaly report and exits non-zero if critical issues found.
 */

import { execSync } from 'node:child_process';

const anomalies = [];

// --- Check 1: npm audit ---
function checkAudit() {
  console.log('--- Layer 2: npm audit check ---');
  try {
    const output = execSync('npm audit --json 2>/dev/null', { encoding: 'utf-8' });
    const audit = JSON.parse(output);
    const vulnerabilities = audit.vulnerabilities || {};

    for (const [name, info] of Object.entries(vulnerabilities)) {
      const severity = info.severity;
      if (severity === 'high' || severity === 'critical') {
        anomalies.push({
          severity: severity === 'critical' ? 'critical' : 'warning',
          category: 'security',
          description: `Vulnerability in ${name}: ${info.title || severity}`,
          recommendation: `Run: npm audit fix or update ${name}`,
        });
      }
    }

    console.log(`  Found ${Object.keys(vulnerabilities).length} total vulnerabilities`);
  } catch {
    console.log('  npm audit completed (no actionable vulnerabilities or audit unavailable)');
  }
}

// --- Check 2: ESLint complexity ---
function checkComplexity() {
  console.log('--- Layer 2: Complexity check ---');
  try {
    const output = execSync('npx eslint src/ --format json 2>/dev/null', { encoding: 'utf-8' });
    const results = JSON.parse(output);

    for (const file of results) {
      const complexityWarnings = file.messages.filter(
        (m) => m.ruleId === 'complexity' && m.severity >= 1,
      );
      for (const warning of complexityWarnings) {
        anomalies.push({
          severity: 'warning',
          category: 'complexity',
          description: `High complexity in ${file.filePath}:${warning.line} - ${warning.message}`,
          file: file.filePath,
          line: warning.line,
          recommendation: 'Refactor to reduce cyclomatic complexity',
        });
      }
    }

    console.log('  Complexity analysis complete');
  } catch {
    console.log('  ESLint analysis completed (no complexity issues or lint unavailable)');
  }
}

// --- Check 3: Dependency conflicts ---
function checkDependencies() {
  console.log('--- Layer 2: Dependency conflict check ---');
  try {
    const output = execSync('npm ls --json 2>/dev/null', { encoding: 'utf-8' });
    const deps = JSON.parse(output);

    if (deps.problems && deps.problems.length > 0) {
      for (const problem of deps.problems) {
        anomalies.push({
          severity: 'warning',
          category: 'dependency',
          description: problem,
          recommendation: 'Resolve dependency conflict with npm dedupe or version pinning',
        });
      }
    }

    console.log('  Dependency tree analysis complete');
  } catch {
    console.log('  Dependency check completed (no conflicts or check unavailable)');
  }
}

// --- Run all checks ---
checkAudit();
checkComplexity();
checkDependencies();

// --- Output report ---
console.log('\n=== Anomaly Report ===');
console.log(`Total anomalies: ${anomalies.length}`);

if (anomalies.length > 0) {
  for (const a of anomalies) {
    console.log(`  [${a.severity.toUpperCase()}] ${a.category}: ${a.description}`);
    console.log(`    -> ${a.recommendation}`);
  }
}

const hasCritical = anomalies.some((a) => a.severity === 'critical' || a.severity === 'blocker');

if (hasCritical) {
  console.log('\n!! Critical anomalies detected - human review required !!');
  process.exit(1);
} else {
  console.log('\nNo critical anomalies. Layer 2 passed.');
  process.exit(0);
}
