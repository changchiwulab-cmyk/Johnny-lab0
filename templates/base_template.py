"""Base template class for cross-team automation."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Optional, Any
from datetime import datetime
import asyncio


@dataclass
class ValidationError:
    """Validation error."""
    field: str
    message: str
    code: str


@dataclass
class ValidationResult:
    """Result of input validation."""
    valid: bool
    errors: list = field(default_factory=list)


@dataclass
class ExecutionResult:
    """Result of template execution."""
    status: str  # success, failed, partial
    output: Dict
    execution_time: float
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)


class BaseTemplate(ABC):
    """Abstract base template for automated tasks."""

    def __init__(self, name: str, description: str):
        """Initialize template."""
        self.name = name
        self.description = description
        self.execution_logs = []
        self.start_time = None

    @abstractmethod
    async def validate_input(self, data: Dict) -> ValidationResult:
        """
        Validate input data.

        Args:
            data: Input data to validate

        Returns:
            ValidationResult with validation status
        """
        pass

    @abstractmethod
    async def execute(self, data: Dict) -> ExecutionResult:
        """
        Execute the template.

        Args:
            data: Input data

        Returns:
            ExecutionResult with output
        """
        pass

    @abstractmethod
    async def generate_report(self, output: Dict) -> str:
        """
        Generate a report from execution output.

        Args:
            output: Execution output

        Returns:
            Report string
        """
        pass

    async def run(self, data: Dict, skip_validation: bool = False) -> ExecutionResult:
        """
        Run template with validation and execution.

        Args:
            data: Input data
            skip_validation: Skip validation if True

        Returns:
            ExecutionResult
        """
        self.start_time = datetime.utcnow()

        try:
            # Validate input
            if not skip_validation:
                validation = await self.validate_input(data)
                if not validation.valid:
                    return ExecutionResult(
                        status="failed",
                        output={},
                        execution_time=0,
                        errors=[e.message for e in validation.errors],
                    )

            # Execute template
            result = await self.execute(data)

            # Generate report
            if result.status == "success":
                report = await self.generate_report(result.output)
                result.output["report"] = report

            # Calculate execution time
            execution_time = (
                datetime.utcnow() - self.start_time
            ).total_seconds()
            result.execution_time = execution_time

            # Log execution
            self.log_execution(result)

            return result

        except Exception as e:
            execution_time = (
                datetime.utcnow() - self.start_time
            ).total_seconds()
            return ExecutionResult(
                status="failed",
                output={},
                execution_time=execution_time,
                errors=[str(e)],
            )

    def log_execution(self, result: ExecutionResult) -> None:
        """Log execution details."""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "template": self.name,
            "status": result.status,
            "execution_time": result.execution_time,
            "errors_count": len(result.errors),
            "warnings_count": len(result.warnings),
        }
        self.execution_logs.append(log_entry)

    def get_execution_history(self) -> list:
        """Get execution history for this template."""
        return self.execution_logs

    def get_statistics(self) -> Dict:
        """Get statistics about template executions."""
        if not self.execution_logs:
            return {
                "total_executions": 0,
                "success_count": 0,
                "failed_count": 0,
            }

        total = len(self.execution_logs)
        success_count = sum(
            1 for log in self.execution_logs if log["status"] == "success"
        )
        failed_count = total - success_count
        avg_time = (
            sum(log["execution_time"] for log in self.execution_logs) / total
        )

        return {
            "total_executions": total,
            "success_count": success_count,
            "failed_count": failed_count,
            "success_rate": (success_count / total * 100) if total > 0 else 0,
            "avg_execution_time": avg_time,
        }

    async def validate_and_execute(self, data: Dict) -> ExecutionResult:
        """
        Validate and execute in one call.

        Args:
            data: Input data

        Returns:
            ExecutionResult
        """
        return await self.run(data, skip_validation=False)
