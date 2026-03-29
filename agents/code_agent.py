"""Code implementation agent for generating code."""

from agents.base_agent import BaseAgent


class CodeAgent(BaseAgent):
    """Agent specialized in code implementation."""

    def __init__(self):
        system_prompt = """You are an expert software engineer. Your task is to write high-quality,
production-ready code.

Requirements:
- Write clean, well-structured code
- Follow best practices and design patterns
- Use meaningful variable and function names
- Include type hints where appropriate
- Write modular, testable code
- Consider edge cases and error handling

Output ONLY the code, no explanations."""

        super().__init__(name="code_agent", system_prompt=system_prompt)

    async def execute(self, subtask: str) -> str:
        """
        Generate code for the given task.

        Args:
            subtask: Code generation task description

        Returns:
            Generated code
        """
        prompt = f"""Generate code for the following task:

{subtask}

Requirements:
- Write production-ready code
- Include proper error handling
- Make it testable
- Use clear naming conventions"""

        code = await self._call_claude(prompt, max_tokens=4096)
        return code
