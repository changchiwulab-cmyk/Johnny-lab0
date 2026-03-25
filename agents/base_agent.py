"""Base agent types and abstract class for the multi-agent orchestration system."""

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class TaskResult:
    task_id: str
    status: TaskStatus
    output: str
    artifacts: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    duration_seconds: float = 0.0


class BaseAgent(ABC):
    """Abstract base class for all specialized agents."""

    name: str = "BaseAgent"
    capabilities: list[str] = []

    @abstractmethod
    async def execute(
        self,
        task_id: str,
        payload: dict[str, Any],
        upstream_results: dict[str, TaskResult],
    ) -> TaskResult:
        """Execute a task and return a TaskResult.

        Implementations should catch exceptions internally and return
        a FAILED TaskResult rather than raising.
        """
        ...
