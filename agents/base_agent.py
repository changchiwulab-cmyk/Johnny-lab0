"""Base agent module — 代理基礎模組

Defines the abstract base class and shared data types for all agents
in the multi-agent coordination system (多代理協調系統).
"""

import asyncio
import logging
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class AgentStatus(Enum):
    """Agent execution status."""
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskPriority(Enum):
    """Task priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class Task:
    """A unit of work to be executed by an agent."""
    description: str
    task_type: str
    priority: TaskPriority = TaskPriority.MEDIUM
    metadata: dict[str, Any] = field(default_factory=dict)
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])


@dataclass
class AgentResult:
    """Result returned by an agent after task execution."""
    agent_name: str
    task_id: str
    success: bool
    output: str
    errors: list[str] = field(default_factory=list)
    duration: float = 0.0


class BaseAgent(ABC):
    """Abstract base class for all specialized agents (代理基類).

    Each agent has a name, role, status tracking, and an async execute method.
    Subclasses must implement the execute() method with their specialized logic.
    """

    def __init__(self, name: str, role: str):
        self.name = name
        self.role = role
        self.status = AgentStatus.IDLE
        self.logger = logging.getLogger(f"agent.{name}")

    @abstractmethod
    async def execute(self, task: Task) -> AgentResult:
        """Execute a task and return the result.

        Args:
            task: The task to execute.

        Returns:
            AgentResult with execution details.
        """

    async def run(self, task: Task) -> AgentResult:
        """Wrapper that handles status tracking and timing around execute()."""
        self.status = AgentStatus.RUNNING
        self.logger.info(f"[{self.name}] Starting task: {task.description}")
        start = time.monotonic()
        try:
            result = await self.execute(task)
            self.status = AgentStatus.COMPLETED
            result.duration = time.monotonic() - start
            self.logger.info(f"[{self.name}] Completed in {result.duration:.2f}s")
            return result
        except Exception as e:
            self.status = AgentStatus.FAILED
            duration = time.monotonic() - start
            self.logger.error(f"[{self.name}] Failed: {e}")
            return AgentResult(
                agent_name=self.name,
                task_id=task.id,
                success=False,
                output="",
                errors=[str(e)],
                duration=duration,
            )

    def get_status(self) -> dict[str, str]:
        """Return current agent status."""
        return {
            "name": self.name,
            "role": self.role,
            "status": self.status.value,
        }
