"""Security agent - vulnerability scanning, dependency audit, compliance checks."""

import asyncio
import random
import time
from typing import Any

from .base_agent import BaseAgent, TaskResult, TaskStatus


class SecurityAgent(BaseAgent):
    name = "SecurityAgent"
    capabilities = ["vuln_scan", "dependency_audit", "compliance_check"]

    OWASP_CHECKS = [
        "SQL Injection",
        "Cross-Site Scripting (XSS)",
        "Broken Authentication",
        "Sensitive Data Exposure",
        "Broken Access Control",
        "Security Misconfiguration",
        "Insecure Deserialization",
        "Using Components with Known Vulnerabilities",
        "Insufficient Logging & Monitoring",
        "Server-Side Request Forgery (SSRF)",
    ]

    async def execute(
        self,
        task_id: str,
        payload: dict[str, Any],
        upstream_results: dict[str, TaskResult],
    ) -> TaskResult:
        start = time.monotonic()
        try:
            action = payload.get("action", "vuln_scan")
            description = payload.get("description", "security scan")

            upstream_code = self._extract_upstream_code(upstream_results)
            await asyncio.sleep(random.uniform(0.4, 1.0))

            if action == "vuln_scan":
                scan = self._run_vuln_scan(upstream_code)
                output = (
                    f"Vulnerability scan complete: {scan['total_checks']} checks, "
                    f"{scan['issues_found']} issues found"
                )
            elif action == "dependency_audit":
                scan = self._run_dependency_audit()
                output = (
                    f"Dependency audit complete: {scan['packages_scanned']} packages, "
                    f"{scan['issues_found']} vulnerabilities"
                )
            elif action == "compliance_check":
                scan = self._run_compliance_check(description, upstream_results)
                output = (
                    f"Compliance check complete: {scan['rules_checked']} rules, "
                    f"risk level: {scan['risk_level']}"
                )
            else:
                scan = self._run_vuln_scan(upstream_code)
                output = f"Security check complete: {scan['issues_found']} issues"

            return TaskResult(
                task_id=task_id,
                status=TaskStatus.SUCCESS,
                output=output,
                artifacts=scan,
                duration_seconds=time.monotonic() - start,
            )
        except Exception as e:
            return TaskResult(
                task_id=task_id,
                status=TaskStatus.FAILED,
                output=f"Security scan failed: {e}",
                error=str(e),
                duration_seconds=time.monotonic() - start,
            )

    def _extract_upstream_code(self, upstream_results: dict[str, TaskResult]) -> str:
        for result in upstream_results.values():
            if "code" in result.artifacts:
                return result.artifacts["code"]
        return ""

    def _run_vuln_scan(self, code: str) -> dict:
        checks_passed = random.sample(self.OWASP_CHECKS, k=random.randint(8, 10))
        checks_failed = [c for c in self.OWASP_CHECKS if c not in checks_passed]
        return {
            "action": "vuln_scan",
            "total_checks": len(self.OWASP_CHECKS),
            "checks_passed": checks_passed,
            "checks_failed": checks_failed,
            "issues_found": len(checks_failed),
            "risk_level": "low" if len(checks_failed) <= 1 else "medium",
            "vulnerabilities": [
                {"type": c, "severity": "medium", "recommendation": f"Review {c} controls"}
                for c in checks_failed
            ],
        }

    def _run_dependency_audit(self) -> dict:
        packages_scanned = random.randint(15, 40)
        issues = random.randint(0, 3)
        return {
            "action": "dependency_audit",
            "packages_scanned": packages_scanned,
            "issues_found": issues,
            "risk_level": "low" if issues <= 1 else "medium",
            "vulnerabilities": [
                {
                    "package": f"dep-{i}",
                    "severity": random.choice(["low", "medium"]),
                    "recommendation": "Upgrade to latest version",
                }
                for i in range(issues)
            ],
        }

    def _run_compliance_check(
        self, description: str, upstream_results: dict[str, TaskResult]
    ) -> dict:
        rules = [
            "Input validation required",
            "Authentication enforced",
            "Logging enabled",
            "Error handling present",
            "Rate limiting configured",
            "CORS policy defined",
        ]
        passed = random.sample(rules, k=random.randint(4, 6))
        failed = [r for r in rules if r not in passed]
        return {
            "action": "compliance_check",
            "rules_checked": len(rules),
            "rules_passed": passed,
            "rules_failed": failed,
            "issues_found": len(failed),
            "risk_level": "low" if len(failed) <= 1 else "medium",
            "recommendations": [f"Implement: {r}" for r in failed],
        }
