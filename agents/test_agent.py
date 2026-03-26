"""Test generation agent for creating test cases."""

from agents.base_agent import BaseAgent


class TestAgent(BaseAgent):
    """Agent specialized in test generation and validation."""

    def __init__(self):
        system_prompt = """You are an expert QA engineer and test specialist. Your task is to write
comprehensive test cases.

Requirements:
- Write unit tests using pytest
- Cover happy path and edge cases
- Include error scenarios
- Test for security vulnerabilities
- Aim for >90% code coverage
- Use descriptive test names

Output ONLY the test code, no explanations."""

        super().__init__(name="test_agent", system_prompt=system_prompt)

    def execute(self, subtask: str) -> str:
        """
        Generate tests for the given code/task.

        Args:
            subtask: Test generation task description (usually includes code to test)

        Returns:
            Generated test code
        """
        prompt = f"""Generate comprehensive test cases for:

{subtask}

Requirements:
- Use pytest framework
- Test happy path cases
- Test edge cases and error scenarios
- Test security aspects
- Aim for >90% coverage
- Use clear, descriptive test names
- Include assertions and expected behavior"""

        tests = self._call_claude(prompt, max_tokens=4096)
        return tests
