"""Implementation Agent — 實現引擎

Specialized agent for code generation, bug fixing, and refactoring.
"""

import asyncio

from .base_agent import AgentResult, BaseAgent, Task


class ImplementationAgent(BaseAgent):
    """Agent responsible for code writing and bug fixing (實現代理).

    Handles task types: code_generation, bug_fix, refactor.
    """

    def __init__(self):
        super().__init__(name="ImplementationAgent", role="實現引擎")
        self.supported_types = {"code_generation", "bug_fix", "refactor"}

    async def execute(self, task: Task) -> AgentResult:
        self.logger.info(f"Analyzing task type: {task.task_type}")

        if task.task_type == "code_generation":
            output = await self._generate_code(task)
        elif task.task_type == "bug_fix":
            output = await self._fix_bug(task)
        elif task.task_type == "refactor":
            output = await self._refactor(task)
        else:
            output = await self._general_implementation(task)

        return AgentResult(
            agent_name=self.name,
            task_id=task.id,
            success=True,
            output=output,
        )

    async def _generate_code(self, task: Task) -> str:
        await asyncio.sleep(0.1)  # Simulate work
        language = task.metadata.get("language", "python")
        return (
            f"Code generation complete.\n"
            f"  Language: {language}\n"
            f"  Task: {task.description}\n"
            f"  Status: Implementation ready for review."
        )

    async def _fix_bug(self, task: Task) -> str:
        await asyncio.sleep(0.1)
        return (
            f"Bug fix analysis complete.\n"
            f"  Issue: {task.description}\n"
            f"  Root cause identified and patch prepared."
        )

    async def _refactor(self, task: Task) -> str:
        await asyncio.sleep(0.1)
        return (
            f"Refactoring plan complete.\n"
            f"  Scope: {task.description}\n"
            f"  Changes identified and ready to apply."
        )

    async def _general_implementation(self, task: Task) -> str:
        await asyncio.sleep(0.1)
        return (
            f"General implementation complete.\n"
            f"  Task: {task.description}\n"
            f"  Output ready for integration."
        )
