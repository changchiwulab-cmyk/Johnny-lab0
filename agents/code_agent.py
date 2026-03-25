"""Code agent - writes code, fixes bugs, refactors."""

import asyncio
import random
import time
from typing import Any

from .base_agent import BaseAgent, TaskResult, TaskStatus


class CodeAgent(BaseAgent):
    name = "CodeAgent"
    capabilities = ["write_code", "fix_bug", "refactor"]

    async def execute(
        self,
        task_id: str,
        payload: dict[str, Any],
        upstream_results: dict[str, TaskResult],
    ) -> TaskResult:
        start = time.monotonic()
        try:
            action = payload.get("action", "write_code")
            description = payload.get("description", "generic function")

            await asyncio.sleep(random.uniform(0.5, 1.2))

            if action == "write_code":
                code = self._generate_code(description)
                output = f"Generated code for: {description}"
            elif action == "fix_bug":
                code = self._generate_fix(description)
                output = f"Fixed bug: {description}"
            elif action == "refactor":
                code = self._generate_refactor(description, upstream_results)
                output = f"Refactored: {description}"
            else:
                code = self._generate_code(description)
                output = f"Completed: {description}"

            return TaskResult(
                task_id=task_id,
                status=TaskStatus.SUCCESS,
                output=output,
                artifacts={
                    "code": code,
                    "language": payload.get("language", "python"),
                    "action": action,
                },
                duration_seconds=time.monotonic() - start,
            )
        except Exception as e:
            return TaskResult(
                task_id=task_id,
                status=TaskStatus.FAILED,
                output=f"Code generation failed: {e}",
                error=str(e),
                duration_seconds=time.monotonic() - start,
            )

    def _generate_code(self, description: str) -> str:
        func_name = description.lower().replace(" ", "_").replace("-", "_")[:40]
        return (
            f"import logging\n"
            f"\n"
            f"logger = logging.getLogger(__name__)\n"
            f"\n"
            f"\n"
            f"def {func_name}(request):\n"
            f'    """Handle {description}."""\n'
            f"    logger.info(f\"Processing: {{request}}\")\n"
            f"    # Implementation for: {description}\n"
            f"    result = process(request)\n"
            f"    return {{\"status\": \"success\", \"data\": result}}\n"
        )

    def _generate_fix(self, description: str) -> str:
        return (
            f"# Bug fix: {description}\n"
            f"# Added input validation and error handling\n"
            f"def fixed_handler(request):\n"
            f"    if not request:\n"
            f"        raise ValueError(\"Request cannot be empty\")\n"
            f"    return process_safely(request)\n"
        )

    def _generate_refactor(
        self, description: str, upstream_results: dict[str, TaskResult]
    ) -> str:
        upstream_code = ""
        for result in upstream_results.values():
            if "code" in result.artifacts:
                upstream_code = result.artifacts["code"]
                break
        return (
            f"# Refactored: {description}\n"
            f"# Original code improved with better structure\n"
            f"{upstream_code or '# No upstream code available'}\n"
        )
