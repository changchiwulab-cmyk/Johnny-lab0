"""Testing agent — generates pytest test cases from source code."""

from __future__ import annotations

from .base_agent import AgentResult, BaseAgent, Task


class TestingAgent(BaseAgent):
    name = "testing"
    role = "Testing Specialist"
    system_prompt = (
        "You are a testing specialist. Given source code, generate comprehensive "
        "pytest test cases that cover: the happy path, edge cases, error handling, "
        "and boundary conditions. Target high coverage. Return ONLY the test code, "
        "no explanations."
    )

    async def execute(self, task: Task) -> AgentResult:
        self.logger.info("[%s] Generating tests for: %s", self.name, task.description[:80])

        code = task.context.get("code", "")
        user_content = (
            f"Generate pytest tests for the following code:\n\n{code}\n\n"
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
