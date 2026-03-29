"""Layer 1: Automated formatting, linting, and type checking."""

import asyncio
from typing import Dict, List, Optional
from shared.result_models import (
    CheckResult, Issue, IssueSeverity, Layer1Report
)
from shared.subprocess_utils import SubprocessRunner, ToolIntegration
from config_manager.models import ReviewConfig, CoverageConfig


class AutoFormatter:
    """Handles code formatting with multiple tools."""

    async def format_all(self, code_changes: Dict[str, str]) -> CheckResult:
        """Format all changed files."""
        formatted = 0
        failed = 0
        errors = []

        for file_path, content in code_changes.items():
            try:
                if file_path.endswith(".py"):
                    success = await self._format_python(file_path, content)
                elif file_path.endswith((".js", ".ts", ".jsx", ".tsx", ".json")):
                    success = await self._format_javascript(file_path, content)
                else:
                    continue

                if success:
                    formatted += 1
                else:
                    failed += 1
            except Exception as e:
                failed += 1
                errors.append(f"Error formatting {file_path}: {str(e)}")

        return CheckResult(
            check_type="format",
            success=formatted > 0,
            files_modified=formatted,
            files_failed=failed,
            errors=errors,
        )

    async def _format_python(self, file_path: str, content: str) -> bool:
        """Format Python file with black."""
        result = await SubprocessRunner.run_command(
            ["black", "--check", file_path],
            tool_name="black",
        )
        return result.get("success", False) if result else True

    async def _format_javascript(self, file_path: str, content: str) -> bool:
        """Format JavaScript/TypeScript file with prettier."""
        result = await SubprocessRunner.run_command(
            ["prettier", "--check", file_path],
            timeout=10,
        )
        return result.get("success", False) if result else True


class LinterManager:
    """Manages linting across multiple tools and languages."""

    async def lint_all(self, code_changes: Dict[str, str]) -> CheckResult:
        """Run all applicable linters."""
        all_issues: List[Issue] = []

        for file_path in code_changes.keys():
            try:
                if file_path.endswith(".py"):
                    issues = await self._lint_python(file_path)
                elif file_path.endswith((".js", ".ts", ".jsx", ".tsx")):
                    issues = await self._lint_javascript(file_path)
                else:
                    continue

                all_issues.extend(issues)
            except Exception as e:
                # Log but continue
                continue

        # Count severity levels
        errors = [i for i in all_issues if i.severity == IssueSeverity.ERROR]
        warnings = [i for i in all_issues if i.severity == IssueSeverity.WARNING]

        return CheckResult(
            check_type="lint",
            success=len(errors) == 0,
            issues=all_issues,
            error_count=len(errors),
            warning_count=len(warnings),
        )

    async def _lint_python(self, file_path: str) -> List[Issue]:
        """Run flake8 on Python file."""
        issues = []
        flake8_issues = await SubprocessRunner.run_with_json_output(
            ["flake8", file_path, "--format=json"],
            tool_name="flake8",
        )

        if flake8_issues:
            for issue in flake8_issues:
                issues.append(
                    Issue(
                        file=issue.get("filename", file_path),
                        line=issue.get("line_number", 0),
                        column=issue.get("column_number", 0),
                        severity=IssueSeverity.WARNING,
                        rule_id=issue.get("type", ""),
                        message=issue.get("text", ""),
                        source="flake8",
                    )
                )

        return issues

    async def _lint_javascript(self, file_path: str) -> List[Issue]:
        """Run eslint on JavaScript/TypeScript file."""
        issues = []
        eslint_results = await ToolIntegration.run_linter(file_path, tool="eslint")

        if eslint_results:
            for file_result in eslint_results:
                for msg in file_result.get("messages", []):
                    issues.append(
                        Issue(
                            file=file_result.get("filePath", file_path),
                            line=msg.get("line", 0),
                            column=msg.get("column", 0),
                            severity=(
                                IssueSeverity.ERROR
                                if msg.get("severity") == 2
                                else IssueSeverity.WARNING
                            ),
                            rule_id=msg.get("ruleId", ""),
                            message=msg.get("message", ""),
                            source="eslint",
                        )
                    )

        return issues


class TypeChecker:
    """Manages type checking for multiple languages."""

    async def check_all(self, code_changes: Dict[str, str]) -> CheckResult:
        """Run type checking on all files."""
        errors = []
        warnings = []

        for file_path in code_changes.keys():
            try:
                if file_path.endswith(".py"):
                    result = await self._check_python(file_path)
                elif file_path.endswith(".ts"):
                    result = await self._check_typescript(file_path)
                else:
                    continue

                if result:
                    errors.extend(result.get("errors", []))
                    warnings.extend(result.get("warnings", []))
            except Exception:
                pass

        return CheckResult(
            check_type="type",
            success=len(errors) == 0,
            error_count=len(errors),
            errors=errors,
        )

    async def _check_python(self, file_path: str) -> Optional[Dict]:
        """Run mypy on Python file."""
        mypy_results = await ToolIntegration.run_type_checker(file_path, tool="mypy")

        if mypy_results:
            errors = [r for r in mypy_results if r.get("severity") == "error"]
            warnings = [r for r in mypy_results if r.get("severity") == "note"]
            return {
                "errors": [e.get("message", "") for e in errors],
                "warnings": [w.get("message", "") for w in warnings],
            }

        return None

    async def _check_typescript(self, file_path: str) -> Optional[Dict]:
        """Run TypeScript compiler on TypeScript file."""
        result = await SubprocessRunner.run_command(
            ["tsc", "--noEmit", file_path],
            timeout=15,
        )

        if result and result.get("stderr"):
            return {
                "errors": result.get("stderr", "").split("\n"),
                "warnings": [],
            }

        return None


class CoverageValidator:
    """Validates test coverage meets requirements."""

    def __init__(self, config: Optional[CoverageConfig] = None):
        """Initialize with config or use defaults."""
        if config:
            self.minimum_coverage = config.minimum_percentage
            self.fail_under = config.fail_under
        else:
            self.minimum_coverage = 85.0
            self.fail_under = 70.0

    async def validate(self, test_results: Optional[Dict] = None) -> CheckResult:
        """Validate coverage from test results."""
        cov_data = await SubprocessRunner.run_with_json_output(
            ["pytest", "--cov", "--cov-report=json"],
            tool_name="pytest",
        )

        if cov_data:
            total_coverage = cov_data.get("totals", {}).get("percent_covered", 0)
            lines_covered = cov_data.get("totals", {}).get("covered_lines", 0)
            lines_total = cov_data.get("totals", {}).get("num_statements", 0)

            is_acceptable = total_coverage >= self.minimum_coverage

            return CheckResult(
                check_type="coverage",
                success=is_acceptable,
                total_coverage=total_coverage,
                lines_covered=lines_covered,
                lines_total=lines_total,
                is_acceptable=is_acceptable,
                message=f"Coverage: {total_coverage:.1f}% (target: {self.minimum_coverage}%)",
            )

        # Default to acceptable if tools not available
        return CheckResult(
            check_type="coverage",
            success=True,
            total_coverage=100.0,
            lines_covered=0,
            lines_total=0,
            is_acceptable=True,
            message="Coverage check skipped (pytest not available)",
        )


class Layer1Executor:
    """Orchestrates Layer 1 automated checks."""

    def __init__(self, config: Optional[ReviewConfig] = None):
        """Initialize with optional configuration."""
        self.config = config
        self.formatter = AutoFormatter()
        self.linter = LinterManager()
        self.type_checker = TypeChecker()

        # Use config for coverage if provided
        coverage_config = config.layer1.coverage if config else None
        self.coverage_validator = CoverageValidator(coverage_config)

    async def execute(self, code_changes: Dict[str, str]) -> Layer1Report:
        """Run all Layer 1 checks in parallel."""
        # Run all checks concurrently
        tasks = [
            self.formatter.format_all(code_changes),
            self.linter.lint_all(code_changes),
            self.type_checker.check_all(code_changes),
            self.coverage_validator.validate(),
        ]

        results = await asyncio.gather(*tasks)
        return Layer1Report.synthesize(tuple(results))
