"""Security Agent - Reviews code for OWASP Top 10 and common vulnerabilities."""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class SecurityFinding:
    severity: str  # "high", "medium", "low"
    category: str
    description: str
    line_hint: str | None = None


@dataclass
class SecurityReport:
    passed: bool
    findings: list[SecurityFinding] = field(default_factory=list)

    def __str__(self) -> str:
        if self.passed:
            return "Security review PASSED - no issues found."
        lines = [f"Security review FAILED - {len(self.findings)} issue(s):"]
        for f in self.findings:
            lines.append(f"  [{f.severity.upper()}] {f.category}: {f.description}")
        return "\n".join(lines)


# Patterns that indicate potential security issues
_PATTERNS: list[tuple[str, str, str]] = [
    (r"eval\s*\(", "high", "Code Injection - use of eval()"),
    (r"exec\s*\(", "high", "Code Injection - use of exec()"),
    (r"subprocess\.call\(.*, shell\s*=\s*True", "high", "Command Injection - shell=True in subprocess"),
    (r"os\.system\s*\(", "high", "Command Injection - use of os.system()"),
    (r"pickle\.loads?\s*\(", "medium", "Insecure Deserialization - use of pickle"),
    (r"yaml\.load\s*\((?!.*Loader)", "medium", "Insecure Deserialization - yaml.load without safe Loader"),
    (r"(password|secret|api_key)\s*=\s*[\"'][^\"']+[\"']", "high", "Hardcoded Credentials detected"),
    (r"SELECT\s+.*\+.*FROM", "high", "SQL Injection - string concatenation in query"),
    (r"\.format\(.*\).*(?:SELECT|INSERT|UPDATE|DELETE)", "high", "SQL Injection - format string in query"),
    (r"verify\s*=\s*False", "medium", "Disabled SSL Verification"),
    (r"DEBUG\s*=\s*True", "low", "Debug Mode enabled"),
]


class SecurityAgent:
    """Static analysis agent that checks code for common security issues."""

    def run(self, code: str) -> SecurityReport:
        """Scan code for security vulnerabilities.

        Returns a SecurityReport with findings.
        """
        findings: list[SecurityFinding] = []

        for pattern, severity, description in _PATTERNS:
            for match in re.finditer(pattern, code, re.IGNORECASE):
                line_num = code[: match.start()].count("\n") + 1
                findings.append(
                    SecurityFinding(
                        severity=severity,
                        category=description.split(" - ")[0],
                        description=description,
                        line_hint=f"~line {line_num}",
                    )
                )

        return SecurityReport(passed=len(findings) == 0, findings=findings)
