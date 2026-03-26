"""Orchestrator — 編排代理 (Orchestrator Agent)

Main entry point for the multi-agent coordination system.
Handles task decomposition, parallel agent execution, result synthesis,
and status tracking.

Architecture:
    Orchestrator → [ImplementationAgent, TestingAgent, DocumentationAgent, SecurityAgent]
    → Result Synthesis (結果合成層)
"""

import asyncio
import logging
import time
from datetime import datetime

from agents import (
    AgentResult,
    DocumentationAgent,
    ImplementationAgent,
    SecurityAgent,
    Task,
    TaskPriority,
    TestingAgent,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("orchestrator")


class Orchestrator:
    """Multi-agent orchestrator (編排代理).

    Coordinates 4 specialized agents:
      1. ImplementationAgent (實現引擎) — code generation, bug fixes
      2. TestingAgent (測試引擎) — unit/integration tests
      3. DocumentationAgent (文檔生成) — API docs, comments
      4. SecurityAgent (安全審查) — vulnerability scanning, compliance
    """

    def __init__(self):
        self.agents = [
            ImplementationAgent(),
            TestingAgent(),
            DocumentationAgent(),
            SecurityAgent(),
        ]
        logger.info(
            f"Orchestrator initialized with {len(self.agents)} agents: "
            f"{', '.join(a.name for a in self.agents)}"
        )

    def decompose_task(self, description: str) -> list[Task]:
        """Decompose a high-level task into sub-tasks for each agent (任務分解).

        Args:
            description: High-level task description.

        Returns:
            List of Task objects, one per specialized agent.
        """
        tasks = [
            Task(
                description=f"Implement: {description}",
                task_type="code_generation",
                priority=TaskPriority.HIGH,
                metadata={"language": "python"},
            ),
            Task(
                description=f"Test: {description}",
                task_type="unit_test",
                priority=TaskPriority.HIGH,
            ),
            Task(
                description=f"Document: {description}",
                task_type="api_docs",
                priority=TaskPriority.MEDIUM,
            ),
            Task(
                description=f"Security review: {description}",
                task_type="vulnerability_scan",
                priority=TaskPriority.HIGH,
            ),
        ]
        logger.info(f"Decomposed into {len(tasks)} sub-tasks")
        return tasks

    async def execute_all(self, tasks: list[Task]) -> list[AgentResult]:
        """Execute tasks across all agents in parallel (並行執行).

        Each agent receives its corresponding task and runs concurrently.

        Args:
            tasks: List of tasks (one per agent).

        Returns:
            List of AgentResult from all agents.
        """
        if len(tasks) != len(self.agents):
            raise ValueError(
                f"Expected {len(self.agents)} tasks, got {len(tasks)}"
            )

        logger.info("Launching all agents in parallel...")
        results = await asyncio.gather(
            *(agent.run(task) for agent, task in zip(self.agents, tasks))
        )
        return list(results)

    def synthesize_results(self, results: list[AgentResult]) -> dict:
        """Combine all agent results into a unified report (結果合成層).

        Args:
            results: List of AgentResult from all agents.

        Returns:
            Synthesized report dictionary.
        """
        successful = [r for r in results if r.success]
        failed = [r for r in results if not r.success]
        total_duration = sum(r.duration for r in results)

        report = {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_agents": len(results),
                "successful": len(successful),
                "failed": len(failed),
                "total_duration_seconds": round(total_duration, 3),
            },
            "agent_results": {
                r.agent_name: {
                    "success": r.success,
                    "output": r.output,
                    "errors": r.errors,
                    "duration": round(r.duration, 3),
                }
                for r in results
            },
        }

        if failed:
            report["warnings"] = [
                f"{r.agent_name}: {', '.join(r.errors)}" for r in failed
            ]

        return report

    async def run(self, task_description: str) -> dict:
        """Full orchestration pipeline: decompose → execute → synthesize.

        Args:
            task_description: High-level task description.

        Returns:
            Synthesized report from all agents.
        """
        logger.info(f"=== Orchestrator starting: {task_description} ===")
        start = time.monotonic()

        # Step 1: Task decomposition (任務分解)
        tasks = self.decompose_task(task_description)

        # Step 2: Parallel execution (協調執行)
        results = await self.execute_all(tasks)

        # Step 3: Result synthesis (結果合成)
        report = self.synthesize_results(results)

        elapsed = time.monotonic() - start
        report["summary"]["wall_clock_seconds"] = round(elapsed, 3)

        logger.info(
            f"=== Orchestration complete in {elapsed:.2f}s "
            f"({report['summary']['successful']}/{report['summary']['total_agents']} succeeded) ==="
        )
        return report

    def get_status(self) -> list[dict]:
        """Return status of all agents."""
        return [agent.get_status() for agent in self.agents]


def print_report(report: dict) -> None:
    """Pretty-print the orchestration report."""
    print("\n" + "=" * 60)
    print("  Multi-Agent Orchestration Report (多代理協調報告)")
    print("=" * 60)

    summary = report["summary"]
    print(f"\n  Timestamp : {report['timestamp']}")
    print(f"  Agents    : {summary['successful']}/{summary['total_agents']} succeeded")
    print(f"  Wall clock: {summary['wall_clock_seconds']}s")
    print(f"  Total CPU : {summary['total_duration_seconds']}s")

    print("\n" + "-" * 60)
    for agent_name, result in report["agent_results"].items():
        status = "✓" if result["success"] else "✗"
        print(f"\n  [{status}] {agent_name} ({result['duration']}s)")
        for line in result["output"].strip().split("\n"):
            print(f"      {line}")
        if result["errors"]:
            for err in result["errors"]:
                print(f"      ERROR: {err}")

    if "warnings" in report:
        print("\n  Warnings:")
        for w in report["warnings"]:
            print(f"    ⚠ {w}")

    print("\n" + "=" * 60)


async def main():
    """Demo: run the orchestrator with a sample task."""
    orchestrator = Orchestrator()

    report = await orchestrator.run(
        "Build a user authentication module with JWT support"
    )
    print_report(report)


if __name__ == "__main__":
    asyncio.run(main())
