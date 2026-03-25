"""Orchestrator Agent - Coordinates multi-agent task execution."""

from __future__ import annotations

from dataclasses import dataclass, field

from agents.implementation_agent import ImplementationAgent
from agents.security_agent import SecurityAgent
from agents.testing_agent import TestingAgent


@dataclass
class SubTask:
    name: str
    agent_type: str
    description: str
    dependencies: list[str] = field(default_factory=list)
    result: str | None = None


class OrchestratorAgent:
    """Decomposes tasks into subtasks and delegates to specialist agents."""

    def __init__(self, api_key: str | None = None):
        self.implementation = ImplementationAgent(api_key=api_key)
        self.security = SecurityAgent()
        self.testing = TestingAgent(api_key=api_key)
        self._agents = {
            "implementation": self.implementation,
            "security": self.security,
            "testing": self.testing,
        }

    def decompose_task(self, task: str) -> list[SubTask]:
        """Split a high-level task into ordered subtasks for specialist agents."""
        return [
            SubTask(
                name="implement",
                agent_type="implementation",
                description=f"Implement: {task}",
            ),
            SubTask(
                name="security_review",
                agent_type="security",
                description="Review implementation for security issues",
                dependencies=["implement"],
            ),
            SubTask(
                name="generate_tests",
                agent_type="testing",
                description="Generate unit tests for the implementation",
                dependencies=["implement"],
            ),
        ]

    def run(self, task: str) -> dict:
        """Execute a full multi-agent workflow for the given task."""
        subtasks = self.decompose_task(task)
        results: dict[str, str] = {}

        for subtask in subtasks:
            agent = self._agents[subtask.agent_type]

            if subtask.agent_type == "implementation":
                subtask.result = agent.run(subtask.description)
            elif subtask.agent_type == "security":
                code = results.get("implement", "")
                review = agent.run(code)
                subtask.result = str(review)
            elif subtask.agent_type == "testing":
                code = results.get("implement", "")
                subtask.result = agent.run(code)

            results[subtask.name] = subtask.result or ""

        return {
            "task": task,
            "code": results.get("implement", ""),
            "security_review": results.get("security_review", ""),
            "tests": results.get("generate_tests", ""),
        }
