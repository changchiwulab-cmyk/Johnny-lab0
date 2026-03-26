"""Documentation agent — generates docstrings and usage documentation."""

from __future__ import annotations

from .base_agent import AgentResult, BaseAgent, Task


class DocumentationAgent(BaseAgent):
    name = "documentation"
    role = "Technical Writer"
    system_prompt = (
        "You are a technical writer. Given source code, produce clear and concise "
        "documentation including: a module-level docstring, function/class docstrings "
        "(Google style), and a brief usage section with examples. Return the "
        "documentation in Markdown format."
    )

    async def execute(self, task: Task) -> AgentResult:
        self.logger.info("[%s] Documenting: %s", self.name, task.description[:80])

        code = task.context.get("code", "")
        user_content = (
            f"Generate documentation for the following code:\n\n{code}\n\n"
            f"Additional context: {task.description}"
        )

        try:
            output = await self._call_llm([{"role": "user", "content": user_content}])
            return AgentResult(
                agent_name=self.name,
                task_id=task.id,
                status="success",
                output=output,
            )
        except Exception as exc:
            return AgentResult(
                agent_name=self.name,
                task_id=task.id,
                status="failure",
                output="",
                issues=[str(exc)],
            )
