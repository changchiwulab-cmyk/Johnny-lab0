"""Documentation agent for generating documentation."""

from agents.base_agent import BaseAgent


class DocAgent(BaseAgent):
    """Agent specialized in documentation generation."""

    def __init__(self):
        system_prompt = """You are an expert technical writer. Your task is to write clear,
comprehensive documentation.

Requirements:
- Write clear docstrings and comments
- Explain the purpose and usage of code
- Document parameters and return values
- Provide usage examples
- Include any important notes or caveats
- Use proper formatting (markdown, docstrings)

Output ONLY the documentation, no code."""

        super().__init__(name="doc_agent", system_prompt=system_prompt)

    async def execute(self, subtask: str) -> str:
        """
        Generate documentation for the given code/task.

        Args:
            subtask: Documentation task description (usually includes code to document)

        Returns:
            Generated documentation
        """
        prompt = f"""Generate comprehensive documentation for:

{subtask}

Requirements:
- Write clear docstrings (Google or NumPy style)
- Add inline comments for complex logic
- Provide usage examples
- Document parameters, return values, and exceptions
- Include any important notes or caveats
- Use proper markdown formatting
- Make it accessible to developers of all levels"""

        documentation = await self._call_claude(prompt, max_tokens=4096)
        return documentation
