"""Base agent class and shared data models for the multi-agent orchestrator."""

from __future__ import annotations

import logging
import os
import uuid
from abc import ABC, abstractmethod

import anthropic
from pydantic import BaseModel, Field


DEFAULT_MODEL = os.getenv("ORCHESTRATOR_MODEL", "claude-sonnet-4-20250514")

logger = logging.getLogger(__name__)


class Task(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    description: str
    context: dict[str, str] = Field(default_factory=dict)
    task_type: str  # "implement" | "test" | "document" | "security"


class AgentResult(BaseModel):
    agent_name: str
    task_id: str
    status: str  # "success" | "failure" | "needs_review"
    output: str = ""
    issues: list[str] = Field(default_factory=list)


class BaseAgent(ABC):
    name: str = "base"
    role: str = "base agent"
    system_prompt: str = ""

    def __init__(self, client: anthropic.Anthropic) -> None:
        self.client = client
        self.logger = logging.getLogger(f"agent.{self.name}")

    @abstractmethod
    async def execute(self, task: Task) -> AgentResult:
        ...

    async def _call_llm(self, messages: list[dict]) -> str:
        self.logger.info("[%s] Calling LLM with %d message(s)", self.name, len(messages))
        try:
            response = self.client.messages.create(
                model=DEFAULT_MODEL,
                max_tokens=4096,
                system=self.system_prompt,
                messages=messages,
            )
            text = response.content[0].text
            self.logger.info("[%s] LLM response received (%d chars)", self.name, len(text))
            return text
        except anthropic.APIError as exc:
            self.logger.error("[%s] API error: %s", self.name, exc)
            raise
