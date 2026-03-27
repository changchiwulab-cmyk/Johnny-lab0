const fs = require("fs");
const path = require("path");

/**
 * SecurityAgent - 安全代理
 *
 * 負責漏洞掃描、依賴審計和密鑰檢測。
 * 模擬安全檢查過程並回傳結構化結果。
 */
class SecurityAgent {
  constructor() {
    this.name = "SecurityAgent";
    this.version = "1.0.0";
  }

  /**
   * 執行安全掃描子任務
   * @param {object} taskContext - { id, type, description, priority, dependencyResults }
   * @returns {object} 結構化結果
   */
  async execute(taskContext) {
    const startTime = Date.now();

    if (!taskContext || !taskContext.type) {
      throw new Error("任務上下文必須包含 type 屬性");
    }

    const vulnerabilities = this.scanVulnerabilities(taskContext);
    const dependencyAudit = this.auditDependencies(taskContext);
    const secretScan = this.scanSecrets(taskContext);
    const owaspChecks = this.checkOWASPTop10(taskContext);
    const securityScore = this.calculateSecurityScore(
      vulnerabilities,
      dependencyAudit,
      secretScan,
    );

    return {
      metadata: {
        agent: this.name,
        version: this.version,
        subtask_id: taskContext.id,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      },
      status: "completed",
      output: {
        vulnerabilities,
        dependency_audit: dependencyAudit,
        secret_scan: secretScan,
        owasp_top10_checks: owaspChecks,
        security_score: securityScore,
      },
      summary: this.buildSummary(vulnerabilities),
    };
  }

  scanVulnerabilities(taskContext) {
    const description = (taskContext.description || "").toLowerCase();
    const vulnerabilities = [];

    // 根據任務描述模擬可能的漏洞
    if (description.includes("auth") || description.includes("login")) {
      vulnerabilities.push({
        id: "VULN-001",
        severity: "MEDIUM",
        category: "Authentication",
        description: "建議實施速率限制以防止暴力破解攻擊",
        recommendation: "添加登入嘗試次數限制和帳號鎖定機制",
      });
    }

    if (description.includes("api") || description.includes("endpoint")) {
      vulnerabilities.push({
        id: "VULN-002",
        severity: "LOW",
        category: "Input Validation",
        description: "確保所有 API 輸入經過驗證和清理",
        recommendation: "使用輸入驗證中間件",
      });
    }

    if (description.includes("database") || description.includes("sql")) {
      vulnerabilities.push({
        id: "VULN-003",
        severity: "HIGH",
        category: "SQL Injection",
        description: "潛在的 SQL 注入風險",
        recommendation: "使用參數化查詢或 ORM",
      });
    }

    return vulnerabilities;
  }

  auditDependencies(taskContext) {
    return {
      total_dependencies: 45,
      direct_dependencies: 12,
      vulnerable_dependencies: 0,
      outdated_dependencies: 3,
      audit_status: "passed",
      details: [
        {
          name: "example-lib",
          current: "2.1.0",
          latest: "2.3.0",
          severity: "none",
        },
      ],
    };
  }

  scanSecrets(taskContext) {
    return {
      files_scanned: 25,
      secrets_found: 0,
      patterns_checked: [
        "API keys",
        "Private keys",
        "Passwords",
        "Connection strings",
        "Tokens",
      ],
      scan_status: "clean",
    };
  }

  checkOWASPTop10(taskContext) {
    const checks = [
      {
        id: "A01",
        name: "Broken Access Control",
        status: "passed",
        notes: "存取控制正常",
      },
      {
        id: "A02",
        name: "Cryptographic Failures",
        status: "passed",
        notes: "加密實作符合標準",
      },
      {
        id: "A03",
        name: "Injection",
        status: "passed",
        notes: "輸入驗證已實施",
      },
      {
        id: "A04",
        name: "Insecure Design",
        status: "passed",
        notes: "設計安全",
      },
      {
        id: "A05",
        name: "Security Misconfiguration",
        status: "passed",
        notes: "配置正確",
      },
      {
        id: "A06",
        name: "Vulnerable Components",
        status: "passed",
        notes: "依賴無已知漏洞",
      },
      {
        id: "A07",
        name: "Authentication Failures",
        status: "review",
        notes: "建議加強認證機制",
      },
      {
        id: "A08",
        name: "Data Integrity Failures",
        status: "passed",
        notes: "資料完整性保護正常",
      },
      {
        id: "A09",
        name: "Security Logging Failures",
        status: "review",
        notes: "建議增加安全日誌",
      },
      {
        id: "A10",
        name: "SSRF",
        status: "passed",
        notes: "無 SSRF 風險",
      },
    ];

    return checks;
  }

  calculateSecurityScore(vulnerabilities, audit, secrets) {
    let score = 100;

    for (const vuln of vulnerabilities) {
      switch (vuln.severity) {
        case "CRITICAL":
          score -= 25;
          break;
        case "HIGH":
          score -= 15;
          break;
        case "MEDIUM":
          score -= 8;
          break;
        case "LOW":
          score -= 3;
          break;
      }
    }

    if (audit.vulnerable_dependencies > 0) {
      score -= audit.vulnerable_dependencies * 10;
    }

    if (secrets.secrets_found > 0) {
      score -= secrets.secrets_found * 20;
    }

    return Math.max(0, score);
  }

  buildSummary(vulnerabilities) {
    const summary = { total_issues: 0, critical: 0, high: 0, medium: 0, low: 0 };

    for (const vuln of vulnerabilities) {
      summary.total_issues++;
      const key = vuln.severity.toLowerCase();
      if (summary[key] !== undefined) {
        summary[key]++;
      }
    }

    return summary;
  }
}

module.exports = SecurityAgent;

if (require.main === module) {
  const agent = new SecurityAgent();
  agent
    .execute({
      id: "demo_sec_001",
      type: "security_scan",
      description: "Add user authentication with JWT tokens and API endpoints",
      priority: "high",
    })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    });
}
