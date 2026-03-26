import { execSync } from "child_process";
import { createChildLogger } from "../utils/logger";

const logger = createChildLogger("review:security");

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface SecurityFinding {
  rule: string;
  severity: Severity;
  message: string;
  line?: number;
  file?: string;
}

export interface SecurityScanResult {
  passed: boolean;
  findings: SecurityFinding[];
  highSeverityCount: number;
}

export class SecurityScanner {
  runNpmAudit(): SecurityFinding[] {
    try {
      const output = execSync("npm audit --json 2>/dev/null", { stdio: "pipe" }).toString();
      const audit = JSON.parse(output);
      const findings: SecurityFinding[] = [];

      if (audit.vulnerabilities) {
        for (const [name, vuln] of Object.entries<any>(audit.vulnerabilities)) {
          findings.push({
            rule: "npm-audit",
            severity: vuln.severity || "medium",
            message: `${name}: ${vuln.title || "vulnerability found"}`,
          });
        }
      }
      return findings;
    } catch {
      logger.info("npm audit completed (no issues or not available)");
      return [];
    }
  }

  detectSecrets(content: string, filePath?: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const lines = content.split("\n");

    const patterns: { name: string; regex: RegExp; severity: Severity }[] = [
      { name: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/, severity: "critical" },
      { name: "AWS Secret Key", regex: /[0-9a-zA-Z/+=]{40}(?=\s|$|")/, severity: "critical" },
      { name: "GitHub Token", regex: /ghp_[0-9a-zA-Z]{36}/, severity: "critical" },
      { name: "Generic API Key", regex: /api[_-]?key\s*[:=]\s*["']?[a-zA-Z0-9]{20,}["']?/i, severity: "high" },
      { name: "Generic Secret", regex: /secret\s*[:=]\s*["']?[a-zA-Z0-9]{10,}["']?/i, severity: "high" },
      { name: "Private Key", regex: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, severity: "critical" },
      { name: "Password in Code", regex: /password\s*[:=]\s*["'][^"']{6,}["']/i, severity: "high" },
      { name: "JWT Token", regex: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/, severity: "medium" },
    ];

    for (let i = 0; i < lines.length; i++) {
      for (const pattern of patterns) {
        if (pattern.regex.test(lines[i])) {
          findings.push({
            rule: `secret-detection:${pattern.name}`,
            severity: pattern.severity,
            message: `Potential ${pattern.name} detected`,
            line: i + 1,
            file: filePath,
          });
        }
      }
    }

    return findings;
  }

  scanOWASP(content: string, filePath?: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const lines = content.split("\n");

    const rules: { name: string; pattern: RegExp; severity: Severity; message: string }[] = [
      {
        name: "SQL Injection",
        pattern: /(\$\{|` ?\+).*?(SELECT|INSERT|UPDATE|DELETE|DROP)/i,
        severity: "critical",
        message: "Potential SQL injection via string interpolation",
      },
      {
        name: "XSS",
        pattern: /innerHTML\s*=|document\.write\(|\.html\(/,
        severity: "high",
        message: "Potential XSS via unsafe DOM manipulation",
      },
      {
        name: "Command Injection",
        pattern: /exec\(.*\$\{|execSync\(.*\+/,
        severity: "critical",
        message: "Potential command injection via string concatenation",
      },
      {
        name: "Path Traversal",
        pattern: /\.\.\//,
        severity: "medium",
        message: "Potential path traversal detected",
      },
      {
        name: "Eval Usage",
        pattern: /\beval\s*\(/,
        severity: "high",
        message: "Dangerous eval() usage detected",
      },
    ];

    for (let i = 0; i < lines.length; i++) {
      for (const rule of rules) {
        if (rule.pattern.test(lines[i])) {
          findings.push({
            rule: `owasp:${rule.name}`,
            severity: rule.severity,
            message: rule.message,
            line: i + 1,
            file: filePath,
          });
        }
      }
    }

    return findings;
  }

  scanAll(content: string, filePath?: string): SecurityScanResult {
    logger.info(`Running security scan${filePath ? ` on ${filePath}` : ""}`);

    const findings = [
      ...this.detectSecrets(content, filePath),
      ...this.scanOWASP(content, filePath),
      ...this.runNpmAudit(),
    ];

    const highSeverityCount = findings.filter(
      (f) => f.severity === "high" || f.severity === "critical",
    ).length;

    const passed = highSeverityCount === 0;
    logger.info(`Security scan: ${findings.length} findings, ${highSeverityCount} high/critical`);

    return { passed, findings, highSeverityCount };
  }
}
