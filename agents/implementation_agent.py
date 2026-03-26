"""Implementation agent — generates clean, well-structured code."""

from __future__ import annotations

from .base_agent import AgentResult, BaseAgent, Task


class ImplementationAgent(BaseAgent):
    name = "implementation"
    role = "Senior Software Engineer"
    system_prompt = (
        "You are a senior software engineer. Given a task description and optional "
        "context (existing code, requirements), produce clean, well-structured Python "
        "code. Follow existing conventions when context is provided. Include type hints "
        "and keep functions small and focused. Return ONLY the code, no explanations."
    )

    async def execute(self, task: Task) -> AgentResult:
        self.logger.info("[%s] Implementing: %s", self.name, task.description[:80])

        user_content = f"Task: {task.description}"
        if task.context:
            context_str = "\n\n".join(
                f"--- {key} ---\n{value}" for key, value in task.context.items()
            )
            user_content += f"\n\nContext:\n{context_str}"

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
