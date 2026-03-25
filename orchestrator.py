"""DAG-based multi-agent orchestration engine.

Executes tasks in topological order with parallel dispatch of independent tasks.
Supports dependency resolution, retry logic, failure propagation, and result synthesis.
"""

import asyncio
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any

from agents import (
    BaseAgent,
    CodeAgent,
    DocAgent,
    SecurityAgent,
    TaskResult,
    TaskStatus,
    TestAgent,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Task & DAG
# ---------------------------------------------------------------------------


@dataclass
class Task:
    id: str
    name: str
    agent_type: str  # "code", "test", "doc", "security"
    payload: dict[str, Any] = field(default_factory=dict)
    dependencies: list[str] = field(default_factory=list)
    max_retries: int = 1
    status: TaskStatus = TaskStatus.PENDING


class DAG:
    """Directed acyclic graph of tasks."""

    def __init__(self) -> None:
        self.tasks: dict[str, Task] = {}

    def add_task(self, task: Task) -> "DAG":
        if task.id in self.tasks:
            raise ValueError(f"Duplicate task id: {task.id}")
        self.tasks[task.id] = task
        return self  # allow chaining

    def validate(self) -> None:
        """Check for missing dependencies and cycles (Kahn's algorithm)."""
        for task in self.tasks.values():
            for dep in task.dependencies:
                if dep not in self.tasks:
                    raise ValueError(
                        f"Task '{task.id}' depends on unknown task '{dep}'"
                    )

        in_degree: dict[str, int] = {tid: 0 for tid in self.tasks}
        for task in self.tasks.values():
            for dep in task.dependencies:
                in_degree[task.id] += 1  # task depends on dep

        queue: deque[str] = deque(
            tid for tid, deg in in_degree.items() if deg == 0
        )
        visited = 0

        # Build reverse adjacency: dep -> list of tasks that depend on it
        dependents: dict[str, list[str]] = {tid: [] for tid in self.tasks}
        for task in self.tasks.values():
            for dep in task.dependencies:
                dependents[dep].append(task.id)

        while queue:
            node = queue.popleft()
            visited += 1
            for child in dependents[node]:
                in_degree[child] -= 1
                if in_degree[child] == 0:
                    queue.append(child)

        if visited != len(self.tasks):
            raise ValueError(
                f"DAG contains a cycle (visited {visited}/{len(self.tasks)} tasks)"
            )

    def get_ready_tasks(
        self, completed: set[str], failed: set[str]
    ) -> list[Task]:
        """Return tasks whose dependencies are all completed and none failed."""
        ready = []
        for task in self.tasks.values():
            if task.status != TaskStatus.PENDING:
                continue
            deps = set(task.dependencies)
            if deps & failed:
                task.status = TaskStatus.SKIPPED
                continue
            if deps <= completed:
                ready.append(task)
        return ready


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


class Orchestrator:
    """DAG orchestration engine with parallel task execution."""

    def __init__(self) -> None:
        self.agents: dict[str, BaseAgent] = {
            "code": CodeAgent(),
            "test": TestAgent(),
            "doc": DocAgent(),
            "security": SecurityAgent(),
        }
        self.results: dict[str, TaskResult] = {}

    async def run(self, dag: DAG) -> dict[str, TaskResult]:
        """Execute all tasks in the DAG respecting dependencies."""
        dag.validate()

        completed: set[str] = set()
        failed: set[str] = set()
        wave = 0

        while True:
            ready = dag.get_ready_tasks(completed, failed)
            if not ready:
                break

            wave += 1
            task_names = ", ".join(t.name for t in ready)
            logger.info(f"Wave {wave}: dispatching [{task_names}]")

            results = await self._dispatch_parallel(ready)

            for task, result in zip(ready, results):
                self.results[task.id] = result
                if result.status == TaskStatus.SUCCESS:
                    completed.add(task.id)
                    logger.info(
                        f"  [OK] {task.name} ({result.duration_seconds:.2f}s)"
                    )
                else:
                    failed.add(task.id)
                    logger.warning(
                        f"  [FAIL] {task.name}: {result.error or result.output}"
                    )

        # Mark remaining pending tasks as skipped
        for task in dag.tasks.values():
            if task.status == TaskStatus.PENDING:
                task.status = TaskStatus.SKIPPED
                self.results[task.id] = TaskResult(
                    task_id=task.id,
                    status=TaskStatus.SKIPPED,
                    output=f"Skipped: dependency failed",
                )

        return self.results

    async def _dispatch_parallel(self, tasks: list[Task]) -> list[TaskResult]:
        """Run multiple tasks concurrently."""
        async with asyncio.TaskGroup() as tg:
            futures = [tg.create_task(self._execute_task(task)) for task in tasks]
        return [f.result() for f in futures]

    async def _execute_task(self, task: Task) -> TaskResult:
        """Execute a single task with retry logic."""
        task.status = TaskStatus.RUNNING
        agent = self.agents.get(task.agent_type)
        if agent is None:
            task.status = TaskStatus.FAILED
            return TaskResult(
                task_id=task.id,
                status=TaskStatus.FAILED,
                output=f"No agent found for type: {task.agent_type}",
                error=f"Unknown agent type: {task.agent_type}",
            )

        # Gather upstream results
        upstream: dict[str, TaskResult] = {
            dep: self.results[dep]
            for dep in task.dependencies
            if dep in self.results
        }

        last_result: TaskResult | None = None
        for attempt in range(task.max_retries + 1):
            try:
                last_result = await agent.execute(task.id, task.payload, upstream)
                if last_result.status == TaskStatus.SUCCESS:
                    task.status = TaskStatus.SUCCESS
                    return last_result
            except Exception as e:
                last_result = TaskResult(
                    task_id=task.id,
                    status=TaskStatus.FAILED,
                    output=f"Agent raised exception: {e}",
                    error=str(e),
                )

            if attempt < task.max_retries:
                logger.info(
                    f"  Retrying {task.name} (attempt {attempt + 2}/{task.max_retries + 1})"
                )

        task.status = TaskStatus.FAILED
        assert last_result is not None
        return last_result

    def synthesize(self) -> str:
        """Produce a final summary report from all results."""
        if not self.results:
            return "No tasks were executed."

        total = len(self.results)
        succeeded = sum(
            1 for r in self.results.values() if r.status == TaskStatus.SUCCESS
        )
        failed_count = sum(
            1 for r in self.results.values() if r.status == TaskStatus.FAILED
        )
        skipped = sum(
            1 for r in self.results.values() if r.status == TaskStatus.SKIPPED
        )

        lines = [
            "",
            "=" * 60,
            "  ORCHESTRATION REPORT",
            "=" * 60,
            f"  Tasks: {total} total | {succeeded} succeeded | "
            f"{failed_count} failed | {skipped} skipped",
            "-" * 60,
        ]

        status_icon = {
            TaskStatus.SUCCESS: "OK",
            TaskStatus.FAILED: "FAIL",
            TaskStatus.SKIPPED: "SKIP",
        }

        for tid, result in self.results.items():
            icon = status_icon.get(result.status, "??")
            duration = (
                f" ({result.duration_seconds:.2f}s)"
                if result.duration_seconds > 0
                else ""
            )
            lines.append(f"  [{icon}] {tid}{duration}")
            lines.append(f"        {result.output}")
            if result.error:
                lines.append(f"        Error: {result.error}")

        lines.append("=" * 60)
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------


def build_demo_dag() -> DAG:
    """Build a demo DAG: implement a user login endpoint.

    Task graph:
        write_login_code
              |
        +-----+--------+
        |     |        |
      tests  docs  security_scan
        |              |
    integration    compliance
    """
    dag = DAG()

    # Wave 1: no dependencies
    dag.add_task(
        Task(
            id="write_login_code",
            name="Write Login Code",
            agent_type="code",
            payload={
                "action": "write_code",
                "description": "user login with JWT authentication",
                "language": "python",
            },
        )
    )

    # Wave 2: depend on write_login_code
    dag.add_task(
        Task(
            id="unit_tests",
            name="Generate Unit Tests",
            agent_type="test",
            payload={
                "action": "unit_test",
                "description": "user login",
            },
            dependencies=["write_login_code"],
        )
    )
    dag.add_task(
        Task(
            id="api_docs",
            name="Generate API Docs",
            agent_type="doc",
            payload={
                "action": "api_docs",
                "description": "user login",
            },
            dependencies=["write_login_code"],
        )
    )
    dag.add_task(
        Task(
            id="security_scan",
            name="Security Vulnerability Scan",
            agent_type="security",
            payload={
                "action": "vuln_scan",
                "description": "login endpoint security",
            },
            dependencies=["write_login_code"],
        )
    )

    # Wave 3: depend on wave 2 tasks
    dag.add_task(
        Task(
            id="integration_tests",
            name="Integration Tests",
            agent_type="test",
            payload={
                "action": "integration_test",
                "description": "login end-to-end",
            },
            dependencies=["unit_tests"],
        )
    )
    dag.add_task(
        Task(
            id="compliance_report",
            name="Compliance Report",
            agent_type="security",
            payload={
                "action": "compliance_check",
                "description": "login compliance",
            },
            dependencies=["security_scan"],
        )
    )

    return dag


async def main() -> None:
    print("=" * 60)
    print("  Multi-Agent Orchestration System - Demo")
    print("=" * 60)
    print()

    dag = build_demo_dag()
    orchestrator = Orchestrator()

    start = time.monotonic()
    await orchestrator.run(dag)
    elapsed = time.monotonic() - start

    print(orchestrator.synthesize())
    print(f"\n  Total execution time: {elapsed:.2f}s")
    print()


if __name__ == "__main__":
    asyncio.run(main())
