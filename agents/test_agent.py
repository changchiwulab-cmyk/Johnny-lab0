"""Test agent - generates unit tests and integration tests."""

import asyncio
import random
import time
from typing import Any

from .base_agent import BaseAgent, TaskResult, TaskStatus


class TestAgent(BaseAgent):
    name = "TestAgent"
    capabilities = ["unit_test", "integration_test"]

    async def execute(
        self,
        task_id: str,
        payload: dict[str, Any],
        upstream_results: dict[str, TaskResult],
    ) -> TaskResult:
        start = time.monotonic()
        try:
            action = payload.get("action", "unit_test")
            description = payload.get("description", "generic tests")

            upstream_code = self._extract_upstream_code(upstream_results)
            await asyncio.sleep(random.uniform(0.3, 0.8))

            if action == "unit_test":
                tests = self._generate_unit_tests(description, upstream_code)
                coverage = f"{random.randint(82, 96)}%"
                test_count = random.randint(3, 8)
                output = f"Generated {test_count} unit tests, coverage: {coverage}"
            elif action == "integration_test":
                tests = self._generate_integration_tests(description, upstream_code)
                coverage = f"{random.randint(70, 88)}%"
                test_count = random.randint(2, 5)
                output = f"Generated {test_count} integration tests, coverage: {coverage}"
            else:
                tests = self._generate_unit_tests(description, upstream_code)
                coverage = f"{random.randint(80, 95)}%"
                test_count = random.randint(3, 6)
                output = f"Generated {test_count} tests, coverage: {coverage}"

            return TaskResult(
                task_id=task_id,
                status=TaskStatus.SUCCESS,
                output=output,
                artifacts={
                    "tests": tests,
                    "coverage": coverage,
                    "test_count": test_count,
                    "action": action,
                },
                duration_seconds=time.monotonic() - start,
            )
        except Exception as e:
            return TaskResult(
                task_id=task_id,
                status=TaskStatus.FAILED,
                output=f"Test generation failed: {e}",
                error=str(e),
                duration_seconds=time.monotonic() - start,
            )

    def _extract_upstream_code(self, upstream_results: dict[str, TaskResult]) -> str:
        for result in upstream_results.values():
            if "code" in result.artifacts:
                return result.artifacts["code"]
        return ""

    def _generate_unit_tests(self, description: str, code: str) -> str:
        func_name = description.lower().replace(" ", "_").replace("-", "_")[:30]
        return (
            f"import pytest\n"
            f"\n"
            f"\n"
            f"class Test{func_name.title().replace('_', '')}:\n"
            f"    def test_success(self):\n"
            f'        result = {func_name}({{"valid": True}})\n'
            f'        assert result["status"] == "success"\n'
            f"\n"
            f"    def test_empty_input(self):\n"
            f"        with pytest.raises(ValueError):\n"
            f"            {func_name}(None)\n"
            f"\n"
            f"    def test_invalid_input(self):\n"
            f"        with pytest.raises(ValueError):\n"
            f'            {func_name}({{"invalid": True}})\n'
        )

    def _generate_integration_tests(self, description: str, code: str) -> str:
        func_name = description.lower().replace(" ", "_").replace("-", "_")[:30]
        return (
            f"import pytest\n"
            f"\n"
            f"\n"
            f"class TestIntegration{func_name.title().replace('_', '')}:\n"
            f"    @pytest.fixture\n"
            f"    def setup_env(self):\n"
            f"        # Setup test environment\n"
            f"        yield {{}}\n"
            f"\n"
            f"    def test_end_to_end(self, setup_env):\n"
            f'        result = {func_name}({{"e2e": True}})\n'
            f'        assert result["status"] == "success"\n'
            f"\n"
            f"    def test_with_dependencies(self, setup_env):\n"
            f'        result = {func_name}({{"deps": True}})\n'
            f"        assert result is not None\n"
        )
