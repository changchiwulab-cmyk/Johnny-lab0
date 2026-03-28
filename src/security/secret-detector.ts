import { createChildLogger } from "../utils/logger";

const logger = createChildLogger("security:secrets");

export interface SecretMatch {
  type: string;
  pattern: string;
  line: number;
  column: number;
  snippet: string;
  severity: "high" | "critical";
}

export interface SecretScanResult {
  clean: boolean;
  matches: SecretMatch[];
  filesScanned: number;
}

const SECRET_PATTERNS: { type: string; regex: RegExp; severity: "high" | "critical" }[] = [
  { type: "AWS Access Key ID", regex: /\bAKIA[0-9A-Z]{16}\b/, severity: "critical" },
  { type: "AWS Secret Access Key", regex: /\b[0-9a-zA-Z/+=]{40}\b/, severity: "critical" },
  { type: "GitHub Personal Access Token", regex: /\bghp_[0-9a-zA-Z]{36}\b/, severity: "critical" },
  { type: "GitHub OAuth Token", regex: /\bgho_[0-9a-zA-Z]{36}\b/, severity: "critical" },
  { type: "Slack Token", regex: /\bxox[bpors]-[0-9a-zA-Z-]{10,}/, severity: "critical" },
  { type: "Google API Key", regex: /\bAIza[0-9A-Za-z_-]{35}\b/, severity: "high" },
  { type: "RSA Private Key", regex: /-----BEGIN RSA PRIVATE KEY-----/, severity: "critical" },
  { type: "SSH Private Key", regex: /-----BEGIN OPENSSH PRIVATE KEY-----/, severity: "critical" },
  { type: "Generic Password", regex: /password\s*[:=]\s*["'][^"'\s]{8,}["']/i, severity: "high" },
  { type: "Generic API Key", regex: /api[_-]?key\s*[:=]\s*["'][a-zA-Z0-9]{20,}["']/i, severity: "high" },
  { type: "JWT Token", regex: /\beyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\b/, severity: "high" },
  { type: "Connection String", regex: /(?:mongodb|postgres|mysql|redis):\/\/[^\s"']+:[^\s"']+@/, severity: "critical" },
];

export class SecretDetector {
  scan(content: string, fileName?: string): SecretScanResult {
    const matches: SecretMatch[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments and common false positives
      if (this.isComment(line) || this.isTestFixture(line)) continue;

      for (const pattern of SECRET_PATTERNS) {
        const match = pattern.regex.exec(line);
        if (match) {
          const masked = this.maskSecret(match[0]);
          matches.push({
            type: pattern.type,
            pattern: pattern.regex.source.slice(0, 30) + "...",
            line: i + 1,
            column: match.index + 1,
            snippet: masked,
            severity: pattern.severity,
          });
          logger.warn(
            `Secret detected: ${pattern.type} at ${fileName || "unknown"}:${i + 1}:${match.index + 1}`,
          );
        }
      }
    }

    return {
      clean: matches.length === 0,
      matches,
      filesScanned: 1,
    };
  }

  scanMultiple(files: { name: string; content: string }[]): SecretScanResult {
    const allMatches: SecretMatch[] = [];

    for (const file of files) {
      const result = this.scan(file.content, file.name);
      allMatches.push(...result.matches);
    }

    logger.info(`Scanned ${files.length} files, found ${allMatches.length} potential secrets`);

    return {
      clean: allMatches.length === 0,
      matches: allMatches,
      filesScanned: files.length,
    };
  }

  private isComment(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*");
  }

  private isTestFixture(line: string): boolean {
    return /\b(test|spec|mock|fake|dummy|example)\b/i.test(line);
  }

  private maskSecret(value: string): string {
    if (value.length <= 8) return "***";
    return value.slice(0, 4) + "****" + value.slice(-4);
  }
}
