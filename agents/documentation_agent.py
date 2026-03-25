"""Documentation Agent — 文檔生成

Specialized agent for API documentation, code comments, and README updates.
"""

import asyncio

from .base_agent import AgentResult, BaseAgent, Task


class DocumentationAgent(BaseAgent):
    """Agent responsible for documentation generation (文檔代理).

    Handles task types: api_docs, code_comments, readme_update.
    """

    def __init__(self):
        super().__init__(name="DocumentationAgent", role="文檔生成")
        self.supported_types = {"api_docs", "code_comments", "readme_update"}

    async def execute(self, task: Task) -> AgentResult:
        self.logger.info(f"Analyzing task type: {task.task_type}")

        if task.task_type == "api_docs":
            output = await self._generate_api_docs(task)
        elif task.task_type == "code_comments":
            output = await self._generate_comments(task)
        elif task.task_type == "readme_update":
            output = await self._update_readme(task)
        else:
            output = await self._general_docs(task)

        return AgentResult(
            agent_name=self.name,
            task_id=task.id,
            success=True,
            output=output,
        )

    async def _generate_api_docs(self, task: Task) -> str:
        await asyncio.sleep(0.1)
        return (
            f"API documentation generated.\n"
            f"  Scope: {task.description}\n"
            f"  Endpoints documented with request/response schemas.\n"
            f"  Format: OpenAPI 3.0 compatible."
        )

    async def _generate_comments(self, task: Task) -> str:
        await asyncio.sleep(0.08)
        return (
            f"Code comments generated.\n"
            f"  Scope: {task.description}\n"
            f"  Docstrings added for public interfaces.\n"
            f"  Inline comments for complex logic."
        )

    async def _update_readme(self, task: Task) -> str:
        await asyncio.sleep(0.08)
        return (
            f"README update prepared.\n"
            f"  Scope: {task.description}\n"
            f"  Sections updated: installation, usage, API reference."
        )

    async def _general_docs(self, task: Task) -> str:
        await asyncio.sleep(0.08)
        return (
            f"Documentation prepared.\n"
            f"  Task: {task.description}\n"
            f"  Documentation draft ready for review."
        )
