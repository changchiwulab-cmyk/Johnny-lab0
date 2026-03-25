"""Testing Agent - Generates unit tests using the Anthropic API."""

from __future__ import annotations

import os

import anthropic


class TestingAgent:
    """Generates pytest-style unit tests for provided code."""

    MODEL = "claude-sonnet-4-6"

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self._client: anthropic.Anthropic | None = None

    @property
    def client(self) -> anthropic.Anthropic:
        if self._client is None:
            self._client = anthropic.Anthropic(api_key=self.api_key)
        return self._client

    def run(self, code: str) -> str:
        """Generate pytest unit tests for the given code.

        Returns test code as a string.
        """
        message = self.client.messages.create(
            model=self.MODEL,
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "You are a senior QA engineer. Write comprehensive pytest unit tests "
                        "for the following code. Target >=85% coverage. Return ONLY the test code.\n\n"
                        f"```python\n{code}\n```"
                    ),
                }
            ],
        )
        return message.content[0].text
