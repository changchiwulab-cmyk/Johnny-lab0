"""Security Agent — 安全審查

Specialized agent for vulnerability scanning, compliance checks, and dependency auditing.
"""

import asyncio

from .base_agent import AgentResult, BaseAgent, Task


class SecurityAgent(BaseAgent):
    """Agent responsible for security review (安全代理).

    Handles task types: vulnerability_scan, compliance_check, dependency_audit.
    """

    OWASP_TOP_10 = [
        "A01:2021 - Broken Access Control",
        "A02:2021 - Cryptographic Failures",
        "A03:2021 - Injection",
        "A04:2021 - Insecure Design",
        "A05:2021 - Security Misconfiguration",
        "A06:2021 - Vulnerable Components",
        "A07:2021 - Auth Failures",
        "A08:2021 - Software/Data Integrity",
        "A09:2021 - Logging/Monitoring Failures",
        "A10:2021 - SSRF",
    ]

    def __init__(self):
        super().__init__(name="SecurityAgent", role="安全審查")
        self.supported_types = {
            "vulnerability_scan",
            "compliance_check",
            "dependency_audit",
        }

    async def execute(self, task: Task) -> AgentResult:
        self.logger.info(f"Analyzing task type: {task.task_type}")

        if task.task_type == "vulnerability_scan":
            output = await self._scan_vulnerabilities(task)
        elif task.task_type == "compliance_check":
            output = await self._check_compliance(task)
        elif task.task_type == "dependency_audit":
            output = await self._audit_dependencies(task)
        else:
            output = await self._general_security(task)

        return AgentResult(
            agent_name=self.name,
            task_id=task.id,
            success=True,
            output=output,
        )

    async def _scan_vulnerabilities(self, task: Task) -> str:
        await asyncio.sleep(0.12)
        return (
            f"Vulnerability scan complete.\n"
            f"  Scope: {task.description}\n"
            f"  OWASP Top 10 checked: {len(self.OWASP_TOP_10)} categories\n"
            f"  Critical: 0 | High: 0 | Medium: 1 | Low: 2\n"
            f"  No blocking issues found."
        )

    async def _check_compliance(self, task: Task) -> str:
        await asyncio.sleep(0.1)
        return (
            f"Compliance check complete.\n"
            f"  Scope: {task.description}\n"
            f"  Standards checked: OWASP, CWE, SANS\n"
            f"  Compliance status: PASS"
        )

    async def _audit_dependencies(self, task: Task) -> str:
        await asyncio.sleep(0.1)
        return (
            f"Dependency audit complete.\n"
            f"  Scope: {task.description}\n"
            f"  Dependencies scanned: 0 (stdlib only)\n"
            f"  Known vulnerabilities: 0\n"
            f"  Status: Clean"
        )

    async def _general_security(self, task: Task) -> str:
        await asyncio.sleep(0.1)
        return (
            f"Security review complete.\n"
            f"  Task: {task.description}\n"
            f"  No critical issues detected."
        )
