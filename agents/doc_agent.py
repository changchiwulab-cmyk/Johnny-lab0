"""Documentation agent - generates API docs, comments, and READMEs."""

import asyncio
import random
import time
from typing import Any

from .base_agent import BaseAgent, TaskResult, TaskStatus


class DocAgent(BaseAgent):
    name = "DocAgent"
    capabilities = ["api_docs", "comments", "readme"]

    async def execute(
        self,
        task_id: str,
        payload: dict[str, Any],
        upstream_results: dict[str, TaskResult],
    ) -> TaskResult:
        start = time.monotonic()
        try:
            action = payload.get("action", "api_docs")
            description = payload.get("description", "documentation")

            upstream_code = self._extract_upstream_code(upstream_results)
            await asyncio.sleep(random.uniform(0.3, 0.7))

            if action == "api_docs":
                docs = self._generate_api_docs(description, upstream_code)
                output = f"Generated API documentation for: {description}"
            elif action == "comments":
                docs = self._generate_comments(description, upstream_code)
                output = f"Added inline comments for: {description}"
            elif action == "readme":
                docs = self._generate_readme(description, upstream_results)
                output = f"Generated README section for: {description}"
            else:
                docs = self._generate_api_docs(description, upstream_code)
                output = f"Generated docs for: {description}"

            return TaskResult(
                task_id=task_id,
                status=TaskStatus.SUCCESS,
                output=output,
                artifacts={
                    "docs": docs,
                    "format": "markdown",
                    "action": action,
                },
                duration_seconds=time.monotonic() - start,
            )
        except Exception as e:
            return TaskResult(
                task_id=task_id,
                status=TaskStatus.FAILED,
                output=f"Documentation generation failed: {e}",
                error=str(e),
                duration_seconds=time.monotonic() - start,
            )

    def _extract_upstream_code(self, upstream_results: dict[str, TaskResult]) -> str:
        for result in upstream_results.values():
            if "code" in result.artifacts:
                return result.artifacts["code"]
        return ""

    def _generate_api_docs(self, description: str, code: str) -> str:
        return (
            f"## API Reference: {description}\n"
            f"\n"
            f"### Endpoint\n"
            f"- **Method**: POST\n"
            f"- **Path**: /api/{description.lower().replace(' ', '-')}\n"
            f"\n"
            f"### Request\n"
            f"```json\n"
            f'{{"request": "data"}}\n'
            f"```\n"
            f"\n"
            f"### Response\n"
            f"```json\n"
            f'{{"status": "success", "data": {{}}}}\n'
            f"```\n"
            f"\n"
            f"### Error Codes\n"
            f"| Code | Description |\n"
            f"|------|-------------|\n"
            f"| 400  | Invalid request |\n"
            f"| 401  | Unauthorized |\n"
            f"| 500  | Internal error |\n"
        )

    def _generate_comments(self, description: str, code: str) -> str:
        if not code:
            return f"# No code available to comment on: {description}\n"
        lines = code.split("\n")
        commented = []
        for line in lines:
            if line.startswith("def "):
                commented.append(f"# Function: {description}")
            commented.append(line)
        return "\n".join(commented)

    def _generate_readme(
        self, description: str, upstream_results: dict[str, TaskResult]
    ) -> str:
        sections = [f"# {description}\n"]
        for tid, result in upstream_results.items():
            if result.status == TaskStatus.SUCCESS:
                sections.append(f"## {tid}\n{result.output}\n")
        return "\n".join(sections)
