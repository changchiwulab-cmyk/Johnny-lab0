import { createChildLogger } from "../utils/logger";

const logger = createChildLogger("security:owasp");

export interface OWASPFinding {
  id: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  line: number;
  file?: string;
  remediation: string;
}

export interface OWASPScanResult {
  passed: boolean;
  findings: OWASPFinding[];
  categorySummary: Record<string, number>;
}

interface ScanRule {
  id: string;
  category: string;
  pattern: RegExp;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  remediation: string;
}

const OWASP_RULES: ScanRule[] = [
  // A01: Broken Access Control
  {
    id: "A01-01",
    category: "A01:Broken Access Control",
    pattern: /\.role\s*===?\s*["']admin["']/,
    severity: "medium",
    description: "Hardcoded role check - consider using RBAC system",
    remediation: "Use centralized RBAC instead of inline role checks",
  },

  // A02: Cryptographic Failures
  {
    id: "A02-01",
    category: "A02:Cryptographic Failures",
    pattern: /\bcreateHash\s*\(\s*["']md5["']\s*\)/,
    severity: "high",
    description: "MD5 is cryptographically broken",
    remediation: "Use SHA-256 or stronger hash algorithm",
  },
  {
    id: "A02-02",
    category: "A02:Cryptographic Failures",
    pattern: /\bcreateHash\s*\(\s*["']sha1["']\s*\)/,
    severity: "medium",
    description: "SHA-1 is considered weak",
    remediation: "Upgrade to SHA-256 or SHA-3",
  },

  // A03: Injection
  {
    id: "A03-01",
    category: "A03:Injection",
    pattern: /`[^`]*\$\{[^}]*\}[^`]*(?:SELECT|INSERT|UPDATE|DELETE|DROP)\b/i,
    severity: "critical",
    description: "Potential SQL injection via template literal",
    remediation: "Use parameterized queries or prepared statements",
  },
  {
    id: "A03-02",
    category: "A03:Injection",
    pattern: /exec(?:Sync)?\s*\(\s*(?:`[^`]*\$\{|[^)]*\+\s*\w)/,
    severity: "critical",
    description: "Potential command injection",
    remediation: "Use execFile() with argument arrays instead of exec()",
  },
  {
    id: "A03-03",
    category: "A03:Injection",
    pattern: /\beval\s*\(/,
    severity: "critical",
    description: "eval() usage - potential code injection",
    remediation: "Avoid eval(); use JSON.parse() or safer alternatives",
  },

  // A05: Security Misconfiguration
  {
    id: "A05-01",
    category: "A05:Security Misconfiguration",
    pattern: /cors\(\s*\{[^}]*origin\s*:\s*["']\*["']/,
    severity: "medium",
    description: "CORS wildcard origin allows any domain",
    remediation: "Restrict CORS to specific allowed origins",
  },

  // A07: Identification and Authentication Failures
  {
    id: "A07-01",
    category: "A07:Auth Failures",
    pattern: /password\s*[:=]\s*["'][^"']{1,7}["']/i,
    severity: "high",
    description: "Short or weak password detected in code",
    remediation: "Enforce minimum password length of 12+ characters",
  },

  // A09: Security Logging and Monitoring Failures
  {
    id: "A09-01",
    category: "A09:Logging Failures",
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/,
    severity: "medium",
    description: "Empty catch block - errors are silently swallowed",
    remediation: "Log or handle errors in catch blocks",
  },

  // A10: Server-Side Request Forgery (SSRF)
  {
    id: "A10-01",
    category: "A10:SSRF",
    pattern: /fetch\s*\(\s*(?:req\.|request\.|params\.|query\.)/,
    severity: "high",
    description: "Potential SSRF - URL from user input",
    remediation: "Validate and whitelist allowed URLs before fetching",
  },

  // XSS
  {
    id: "XSS-01",
    category: "XSS",
    pattern: /\.innerHTML\s*=\s*(?!["']<)/,
    severity: "high",
    description: "Potential XSS via innerHTML assignment",
    remediation: "Use textContent or sanitize HTML before injection",
  },
  {
    id: "XSS-02",
    category: "XSS",
    pattern: /document\.write\s*\(/,
    severity: "high",
    description: "document.write() can introduce XSS",
    remediation: "Use DOM manipulation methods instead",
  },
];

export class OWASPScanner {
  scan(content: string, filePath?: string): OWASPScanResult {
    const findings: OWASPFinding[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      for (const rule of OWASP_RULES) {
        if (rule.pattern.test(lines[i])) {
          findings.push({
            id: rule.id,
            category: rule.category,
            severity: rule.severity,
            description: rule.description,
            line: i + 1,
            file: filePath,
            remediation: rule.remediation,
          });
        }
      }
    }

    const categorySummary: Record<string, number> = {};
    for (const f of findings) {
      categorySummary[f.category] = (categorySummary[f.category] || 0) + 1;
    }

    const hasCritical = findings.some((f) => f.severity === "critical");
    logger.info(
      `OWASP scan: ${findings.length} findings${filePath ? ` in ${filePath}` : ""} (${hasCritical ? "CRITICAL" : "OK"})`,
    );

    return { passed: !hasCritical, findings, categorySummary };
  }

  getRules(): ScanRule[] {
    return [...OWASP_RULES];
  }
}
