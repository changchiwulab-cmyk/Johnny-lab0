"""Security agent — audits code for vulnerabilities and security issues."""

from __future__ import annotations

import json

from .base_agent import AgentResult, BaseAgent, Task


class SecurityAgent(BaseAgent):
    name = "security"
    role = "Security Auditor"
    system_prompt = (
        "You are a security auditor. Review the given code for:\n"
        "- OWASP Top 10 vulnerabilities\n"
        "- Hardcoded secrets or credentials\n"
        "- Injection risks (SQL, command, XSS)\n"
        "- Unsafe deserialization\n"
        "- Insecure dependencies or imports\n"
        "- Path traversal vulnerabilities\n\n"
        "Return a JSON object with this structure:\n"
        '{"findings": [{"severity": "high|medium|low", "title": "...", '
        '"description": "...", "line": "..."}], "summary": "..."}\n'
        "If no issues are found, return an empty findings list."
    )

    async def execute(self, task: Task) -> AgentResult:
        self.logger.info("[%s] Auditing: %s", self.name, task.description[:80])

        code = task.context.get("code", "")
        user_content = (
            f"Perform a security audit on the following code:\n\n{code}\n\n"
            f"Additional context: {task.description}"
        )

        try:
            output = await self._call_llm([{"role": "user", "content": user_content}])
            issues = self._parse_findings(output)
            has_high = any("high" in issue.lower() for issue in issues)

            return AgentResult(
                agent_name=self.name,
                task_id=task.id,
                status="needs_review" if has_high else "success",
                output=output,
                issues=issues,
            )
        except Exception as exc:
            return AgentResult(
                agent_name=self.name,
                task_id=task.id,
                status="failure",
                output="",
                issues=[str(exc)],
            )

    @staticmethod
    def _parse_findings(raw: str) -> list[str]:
        try:
            start = raw.index("{")
            end = raw.rindex("}") + 1
            data = json.loads(raw[start:end])
            return [
                f"[{f.get('severity', 'unknown').upper()}] {f.get('title', 'Untitled')}: "
                f"{f.get('description', '')}"
                for f in data.get("findings", [])
            ]
        except (ValueError, json.JSONDecodeError):
            return [raw] if raw.strip() else []
