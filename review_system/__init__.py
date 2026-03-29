"""Automated code review system with three layers."""

from review_system.layer1_auto import Layer1Executor, Layer1Report
from review_system.layer2_analyzer import Layer2Executor, Layer2Report
from review_system.layer3_human_gates import (
    Layer3Executor,
    ApprovalRequest,
    ApprovalCategory,
)
from shared.result_models import (
    Issue as LintIssue,  # Backward compatibility alias
    CheckResult as FormatResult,  # Backward compatibility alias
    RiskLevel,
    IssueSeverity,
)

__all__ = [
    "Layer1Executor",
    "Layer1Report",
    "LintIssue",  # Backward compatibility alias for Issue
    "FormatResult",  # Backward compatibility alias for CheckResult
    "Layer2Executor",
    "Layer2Report",
    "RiskLevel",
    "IssueSeverity",
    "Layer3Executor",
    "ApprovalRequest",
    "ApprovalCategory",
]
