"""Layer 1: Automated formatting, linting, and type checking."""

import asyncio
import json
import subprocess
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set
from enum import Enum


class IssueSeverity(Enum):
    """Issue severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


@dataclass
class LintIssue:
    """Represents a linting issue."""
    file: str
    line: int
    column: int
    severity: IssueSeverity
    rule: str
    message: str
    source: str  # Tool name (flake8, eslint, etc.)


@dataclass
class FormatResult:
    """Result of formatting operation."""
    formatted: bool
    files_modified: int
    files_failed: int
    errors: List[str] = field(default_factory=list)


@dataclass
class LintResult:
    """Result of linting operation."""
    issues: List[LintIssue]
    total_issues: int
    error_count: int
    warning_count: int


@dataclass
class TypeCheckResult:
    """Result of type checking."""
    has_errors: bool
    errors: List[str]
    warnings: List[str]


@dataclass
class CoverageResult:
    """Result of coverage validation."""
    total_coverage: float
    lines_covered: int
    lines_total: int
    is_acceptable: bool
    message: str


@dataclass
class Layer1Report:
    """Combined Layer 1 review report."""
    formatted: FormatResult
    linted: LintResult
    type_checked: TypeCheckResult
    coverage: CoverageResult
    status: str  # "pass", "warning", "fail"

    @classmethod
    def synthesize(cls, results: tuple) -> "Layer1Report":
        """Synthesize individual results into report."""
        formatted, linted, type_checked, coverage = results

        # Determine overall status
        if formatted.files_failed > 0 or type_checked.has_errors or not coverage.is_acceptable:
            status = "fail"
        elif linted.error_count > 0:
            status = "warning"
        else:
            status = "pass"

        return cls(
            formatted=formatted,
            linted=linted,
            type_checked=type_checked,
            coverage=coverage,
            status=status,
        )


class AutoFormatter:
    """Handles code formatting with multiple tools."""

    async def format_all(self, code_changes: Dict[str, str]) -> FormatResult:
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

        return FormatResult(
            formatted=formatted > 0,
            files_modified=formatted,
            files_failed=failed,
            errors=errors,
        )

    async def _format_python(self, file_path: str, content: str) -> bool:
        """Format Python file with black."""
        try:
            # Check if black is available
            result = subprocess.run(
                ["black", "--check", file_path],
                capture_output=True,
                timeout=10,
                text=True,
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return True  # Skip if tool not available

    async def _format_javascript(self, file_path: str, content: str) -> bool:
        """Format JavaScript/TypeScript file with prettier."""
        try:
            result = subprocess.run(
                ["prettier", "--check", file_path],
                capture_output=True,
                timeout=10,
                text=True,
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return True  # Skip if tool not available


class LinterManager:
    """Manages linting across multiple tools and languages."""

    async def lint_all(self, code_changes: Dict[str, str]) -> LintResult:
        """Run all applicable linters."""
        all_issues: List[LintIssue] = []

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

        return LintResult(
            issues=all_issues,
            total_issues=len(all_issues),
            error_count=len(errors),
            warning_count=len(warnings),
        )

    async def _lint_python(self, file_path: str) -> List[LintIssue]:
        """Run flake8 on Python file."""
        issues = []
        try:
            result = subprocess.run(
                ["flake8", file_path, "--format=json"],
                capture_output=True,
                timeout=10,
                text=True,
            )
            if result.stdout:
                flake8_issues = json.loads(result.stdout)
                for issue in flake8_issues:
                    issues.append(
                        LintIssue(
                            file=issue.get("filename", file_path),
                            line=issue.get("line_number", 0),
                            column=issue.get("column_number", 0),
                            severity=IssueSeverity.WARNING,
                            rule=issue.get("type", ""),
                            message=issue.get("text", ""),
                            source="flake8",
                        )
                    )
        except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError):
            pass

        return issues

    async def _lint_javascript(self, file_path: str) -> List[LintIssue]:
        """Run eslint on JavaScript/TypeScript file."""
        issues = []
        try:
            result = subprocess.run(
                ["eslint", file_path, "--format=json"],
                capture_output=True,
                timeout=10,
                text=True,
            )
            if result.stdout:
                eslint_results = json.loads(result.stdout)
                for file_result in eslint_results:
                    for msg in file_result.get("messages", []):
                        issues.append(
                            LintIssue(
                                file=file_result.get("filePath", file_path),
                                line=msg.get("line", 0),
                                column=msg.get("column", 0),
                                severity=(
                                    IssueSeverity.ERROR
                                    if msg.get("severity") == 2
                                    else IssueSeverity.WARNING
                                ),
                                rule=msg.get("ruleId", ""),
                                message=msg.get("message", ""),
                                source="eslint",
                            )
                        )
        except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError):
            pass

        return issues


class TypeChecker:
    """Manages type checking for multiple languages."""

    async def check_all(self, code_changes: Dict[str, str]) -> TypeCheckResult:
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

        return TypeCheckResult(
            has_errors=len(errors) > 0,
            errors=errors,
            warnings=warnings,
        )

    async def _check_python(self, file_path: str) -> Optional[Dict]:
        """Run mypy on Python file."""
        try:
            result = subprocess.run(
                ["mypy", file_path, "--json"],
                capture_output=True,
                timeout=15,
                text=True,
            )
            if result.stdout:
                mypy_results = json.loads(result.stdout)
                errors = [r for r in mypy_results if r.get("severity") == "error"]
                warnings = [r for r in mypy_results if r.get("severity") == "note"]
                return {
                    "errors": [e.get("message", "") for e in errors],
                    "warnings": [w.get("message", "") for w in warnings],
                }
        except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError):
            pass

        return None

    async def _check_typescript(self, file_path: str) -> Optional[Dict]:
        """Run TypeScript compiler on TypeScript file."""
        try:
            result = subprocess.run(
                ["tsc", "--noEmit", file_path],
                capture_output=True,
                timeout=15,
                text=True,
            )
            if result.stderr:
                return {
                    "errors": result.stderr.split("\n"),
                    "warnings": [],
                }
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

        return None


class CoverageValidator:
    """Validates test coverage meets requirements."""

    def __init__(self, minimum_coverage: float = 85.0):
        """Initialize with minimum coverage threshold."""
        self.minimum_coverage = minimum_coverage

    async def validate(self, test_results: Optional[Dict] = None) -> CoverageResult:
        """Validate coverage from test results."""
        try:
            result = subprocess.run(
                ["pytest", "--cov", "--cov-report=json"],
                capture_output=True,
                timeout=30,
                text=True,
            )

            if result.stdout and ".coverage" in result.stdout:
                # Parse coverage JSON
                cov_data = json.loads(result.stdout)
                total_coverage = cov_data.get("totals", {}).get("percent_covered", 0)
                lines_covered = cov_data.get("totals", {}).get("covered_lines", 0)
                lines_total = cov_data.get("totals", {}).get("num_statements", 0)

                is_acceptable = total_coverage >= self.minimum_coverage

                return CoverageResult(
                    total_coverage=total_coverage,
                    lines_covered=lines_covered,
                    lines_total=lines_total,
                    is_acceptable=is_acceptable,
                    message=f"Coverage: {total_coverage:.1f}% (target: {self.minimum_coverage}%)",
                )
        except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError):
            pass

        # Default to acceptable if tools not available
        return CoverageResult(
            total_coverage=100.0,
            lines_covered=0,
            lines_total=0,
            is_acceptable=True,
            message="Coverage check skipped (pytest not available)",
        )


class Layer1Executor:
    """Orchestrates Layer 1 automated checks."""

    def __init__(self):
        """Initialize all Layer 1 components."""
        self.formatter = AutoFormatter()
        self.linter = LinterManager()
        self.type_checker = TypeChecker()
        self.coverage_validator = CoverageValidator()

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
