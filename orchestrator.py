"""Multi-agent orchestrator — coordinates specialized agents for code tasks.

Usage:
    python orchestrator.py "Describe your coding task here"

Requires ANTHROPIC_API_KEY environment variable.
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys

from dotenv import load_dotenv

load_dotenv()

import anthropic

from agents import (
    AgentResult,
    BaseAgent,
    DocumentationAgent,
    ImplementationAgent,
    SecurityAgent,
    Task,
    TestingAgent,
)
from agents.base_agent import DEFAULT_MODEL

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("orchestrator")


class Orchestrator:
    """Central coordinator that delegates tasks to specialized agents."""

    def __init__(self, api_key: str | None = None) -> None:
        self.client = anthropic.Anthropic(api_key=api_key)
        self.agents: dict[str, BaseAgent] = {
            "implementation": ImplementationAgent(self.client),
            "testing": TestingAgent(self.client),
            "documentation": DocumentationAgent(self.client),
            "security": SecurityAgent(self.client),
        }

    async def run(self, user_request: str) -> dict:
        """Main entry point: take a user request, coordinate agents, return results."""
        logger.info("Received request: %s", user_request[:100])

        # Step 1: Plan — decompose into tasks
        tasks = await self._plan(user_request)
        logger.info("Planned %d task(s)", len(tasks))

        # Step 2-3: Execute pipeline
        results = await self._execute_pipeline(tasks)

        # Step 4: Synthesize
        return self._synthesize(results)

    async def _plan(self, user_request: str) -> list[Task]:
        """Use LLM to decompose the request into implementation tasks."""
        planning_prompt = (
            "You are a project planner. Given a user request, break it down into "
            "concrete implementation tasks. Return a JSON array where each element "
            'has: {"description": "...", "context": {}}.\n'
            "Keep it simple — most requests need just 1 task.\n\n"
            f"User request: {user_request}"
        )

        try:
            response = self.client.messages.create(
                model=DEFAULT_MODEL,
                max_tokens=2048,
                system="You are a task planner. Return ONLY valid JSON.",
                messages=[{"role": "user", "content": planning_prompt}],
            )
            raw = response.content[0].text
            start = raw.index("[")
            end = raw.rindex("]") + 1
            items = json.loads(raw[start:end])
        except (ValueError, json.JSONDecodeError):
            logger.warning("Planning LLM returned non-JSON; using single task fallback")
            items = [{"description": user_request, "context": {}}]

        return [
            Task(
                description=item.get("description", user_request),
                context=item.get("context", {}),
                task_type="implement",
            )
            for item in items
        ]

    async def _execute_pipeline(self, tasks: list[Task]) -> list[AgentResult]:
        """Run the pipeline: implement → [test, doc, security] in parallel."""
        all_results: list[AgentResult] = []

        for task in tasks:
            # Layer 1: Implementation (sequential — others depend on its output)
            impl_result = await self.agents["implementation"].execute(task)
            all_results.append(impl_result)

            if impl_result.status == "failure":
                logger.error("Implementation failed for task %s; skipping review", task.id)
                continue

            # Layer 2-3: Review agents run in parallel
            review_task = Task(
                description=task.description,
                context={**task.context, "code": impl_result.output},
                task_type="review",
            )

            review_results = await asyncio.gather(
                self.agents["testing"].execute(review_task),
                self.agents["documentation"].execute(review_task),
                self.agents["security"].execute(review_task),
            )
            all_results.extend(review_results)

        return all_results

    @staticmethod
    def _synthesize(results: list[AgentResult]) -> dict:
        """Combine agent results into a final deliverable."""
        output: dict = {
            "code": "",
            "tests": "",
            "documentation": "",
            "security_report": "",
            "needs_human_review": False,
            "review_reasons": [],
            "agent_results": [],
        }

        for r in results:
            output["agent_results"].append(r.model_dump())

            if r.agent_name == "implementation" and r.status == "success":
                output["code"] = r.output
            elif r.agent_name == "testing" and r.status == "success":
                output["tests"] = r.output
            elif r.agent_name == "documentation" and r.status == "success":
                output["documentation"] = r.output
            elif r.agent_name == "security":
                output["security_report"] = r.output
                if r.status == "needs_review":
                    output["needs_human_review"] = True
                    output["review_reasons"].extend(r.issues)

            if r.status == "failure":
                output["needs_human_review"] = True
                output["review_reasons"].append(
                    f"{r.agent_name} failed: {'; '.join(r.issues)}"
                )

        return output


async def main() -> None:
    request = sys.argv[1] if len(sys.argv) > 1 else input("Describe your task: ")
    orchestrator = Orchestrator()
    result = await orchestrator.run(request)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
