"""Implementation Agent - Generates and modifies code using the Anthropic API."""

from __future__ import annotations

import os

import anthropic


class ImplementationAgent:
    """Generates or fixes code for a given subtask description."""

    MODEL = "claude-sonnet-4-6"

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self._client: anthropic.Anthropic | None = None

    @property
    def client(self) -> anthropic.Anthropic:
        if self._client is None:
            self._client = anthropic.Anthropic(api_key=self.api_key)
        return self._client

    def run(self, subtask: str) -> str:
        """Generate code for the given subtask description.

        Returns the generated code as a string.
        """
        message = self.client.messages.create(
            model=self.MODEL,
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "You are a senior software engineer. Write clean, production-ready "
                        "Python code for the following task. Return ONLY the code, no explanation.\n\n"
                        f"Task: {subtask}"
                    ),
                }
            ],
        )
        return message.content[0].text
