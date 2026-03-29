"""Security scanning agent for vulnerability analysis."""

from agents.base_agent import BaseAgent


class SecurityAgent(BaseAgent):
    """Agent specialized in security scanning and vulnerability detection."""

    def __init__(self):
        system_prompt = """You are a security expert and code auditor. Your task is to identify
security vulnerabilities and provide recommendations.

Requirements:
- Check for OWASP Top 10 vulnerabilities
- Look for common security anti-patterns
- Identify credential/secrets exposure risks
- Check for injection vulnerabilities
- Assess input validation and sanitization
- Review authentication and authorization
- Check for insecure dependencies

Output a detailed security report with findings and recommendations."""

        super().__init__(name="security_agent", system_prompt=system_prompt)

    async def execute(self, subtask: str) -> str:
        """
        Perform security scan on the given code/task.

        Args:
            subtask: Security scan task description (usually includes code to scan)

        Returns:
            Security analysis report
        """
        prompt = f"""Perform a comprehensive security analysis on:

{subtask}

Requirements:
- Check for OWASP Top 10 vulnerabilities
- Look for injection vulnerabilities (SQL, command, etc.)
- Check for insecure deserialization
- Identify secrets/credentials that might be exposed
- Review input validation and sanitization
- Check for authentication/authorization issues
- Assess data protection (encryption, hashing)
- Look for race conditions and concurrency issues
- Check dependency versions for known CVEs
- Provide risk severity levels (critical, high, medium, low)
- Recommend specific fixes for each issue"""

        security_report = await self._call_claude(prompt, max_tokens=4096)
        return security_report
