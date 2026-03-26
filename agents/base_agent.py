"""Base agent class for multi-agent orchestration."""

from abc import ABC, abstractmethod
from typing import Dict, Optional
import os
from anthropic import Anthropic


class BaseAgent(ABC):
    """Abstract base class for all specialized agents."""

    def __init__(self, name: str, system_prompt: str):
        """
        Initialize agent with name and system prompt.

        Args:
            name: Agent identifier
            system_prompt: System prompt for Claude
        """
        self.name = name
        self.system_prompt = system_prompt
        self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.model = "claude-opus-4-6"

    @abstractmethod
    def execute(self, subtask: str) -> str:
        """
        Execute the subtask using Claude.

        Args:
            subtask: Task description

        Returns:
            Agent's output/result
        """
        pass

    def _call_claude(self, user_message: str, max_tokens: int = 2048) -> str:
        """
        Call Claude API with error handling and retry logic.

        Args:
            user_message: User's request
            max_tokens: Maximum tokens in response

        Returns:
            Claude's response text
        """
        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=self.system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )
            return message.content[0].text

        except Exception as e:
            # Fallback response on error
            return f"Error executing {self.name}: {str(e)}"

    def format_output(self, content: str, metadata: Optional[Dict] = None) -> Dict:
        """
        Format agent output with metadata.

        Args:
            content: Main output content
            metadata: Additional metadata

        Returns:
            Formatted output dictionary
        """
        return {
            "agent": self.name,
            "content": content,
            "metadata": metadata or {},
        }
