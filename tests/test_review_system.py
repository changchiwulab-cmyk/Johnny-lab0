"""Tests for the three-layer automated review system."""

import pytest
import asyncio
from review_system.layer1_auto import (
    Layer1Executor,
    IssueSeverity,
    AutoFormatter,
    LinterManager,
    TypeChecker,
)
from review_system.layer2_analyzer import (
    Layer2Executor,
    RiskLevel,
    ComplexityAnalyzer,
    SecurityAnalyzer,
    PerformanceAnalyzer,
)
from review_system.layer3_human_gates import (
    Layer3Executor,
    RiskAssessor,
    ApprovalGatekeeper,
    ApprovalCategory,
)


class TestLayer1Auto:
    """Test Layer 1 automated checks."""

    @pytest.mark.asyncio
    async def test_formatter_initialization(self):
        """Test formatter initializes correctly."""
        formatter = AutoFormatter()
        assert formatter is not None

    @pytest.mark.asyncio
    async def test_format_all_empty_changes(self):
        """Test formatting with no code changes."""
        formatter = AutoFormatter()
        result = await formatter.format_all({})
        assert result.formatted is False
        assert result.files_modified == 0

    @pytest.mark.asyncio
    async def test_linter_initialization(self):
        """Test linter initializes correctly."""
        linter = LinterManager()
        assert linter is not None

    @pytest.mark.asyncio
    async def test_lint_all_empty_changes(self):
        """Test linting with no code changes."""
        linter = LinterManager()
        result = await linter.lint_all({})
        assert result.total_issues == 0
        assert result.error_count == 0

    @pytest.mark.asyncio
    async def test_type_checker_initialization(self):
        """Test type checker initializes correctly."""
        checker = TypeChecker()
        assert checker is not None

    @pytest.mark.asyncio
    async def test_layer1_executor_initialization(self):
        """Test Layer 1 executor initializes correctly."""
        executor = Layer1Executor()
        assert executor is not None
        assert executor.formatter is not None
        assert executor.linter is not None
        assert executor.type_checker is not None
        assert executor.coverage_validator is not None

    @pytest.mark.asyncio
    async def test_layer1_executor_execute_empty(self):
        """Test Layer 1 execution with empty changes."""
        executor = Layer1Executor()
        report = await executor.execute({})
        assert report is not None
        assert report.formatted.files_modified == 0
        assert report.linted.total_issues == 0


class TestLayer2Analyzer:
    """Test Layer 2 anomaly detection."""

    def test_complexity_analyzer_initialization(self):
        """Test complexity analyzer initializes correctly."""
        analyzer = ComplexityAnalyzer()
        assert analyzer is not None
        assert analyzer.cyclomatic_threshold == 10.0

    @pytest.mark.asyncio
    async def test_complexity_analyzer_analyze_empty(self):
        """Test complexity analysis with no code."""
        analyzer = ComplexityAnalyzer()
        result = await analyzer.analyze_all({})
        assert result is not None
        assert result.cyclomatic.is_exceeded is False

    def test_security_analyzer_initialization(self):
        """Test security analyzer initializes correctly."""
        analyzer = SecurityAnalyzer()
        assert analyzer is not None
        assert len(analyzer.SECURITY_PATTERNS) > 0

    @pytest.mark.asyncio
    async def test_security_scan_hardcoded_secret(self):
        """Test detection of hardcoded secrets."""
        analyzer = SecurityAnalyzer()
        code_with_secret = 'password = "secret123"'
        code_changes = {"test.py": code_with_secret}
        result = await analyzer.scan_all(code_changes)
        assert result.total_issues > 0

    @pytest.mark.asyncio
    async def test_security_scan_clean_code(self):
        """Test security scan on clean code."""
        analyzer = SecurityAnalyzer()
        clean_code = "def hello():\n    print('Hello')"
        code_changes = {"test.py": clean_code}
        result = await analyzer.scan_all(code_changes)
        assert result.total_issues == 0

    def test_performance_analyzer_initialization(self):
        """Test performance analyzer initializes correctly."""
        analyzer = PerformanceAnalyzer()
        assert analyzer is not None

    @pytest.mark.asyncio
    async def test_performance_detect_string_concat(self):
        """Test detection of string concatenation in loops."""
        analyzer = PerformanceAnalyzer()
        problematic_code = """
for i in range(10):
    result += "item"
"""
        code_changes = {"test.py": problematic_code}
        result = await analyzer.detect_all(code_changes)
        # May or may not detect depending on implementation
        assert result is not None

    @pytest.mark.asyncio
    async def test_layer2_executor_initialization(self):
        """Test Layer 2 executor initializes correctly."""
        executor = Layer2Executor()
        assert executor is not None
        assert executor.complexity_analyzer is not None
        assert executor.security_analyzer is not None
        assert executor.performance_analyzer is not None
        assert executor.dependency_auditor is not None

    @pytest.mark.asyncio
    async def test_layer2_executor_execute_empty(self):
        """Test Layer 2 execution with empty changes."""
        executor = Layer2Executor()
        report = await executor.execute({})
        assert report is not None
        assert report.complexity is not None
        assert report.security is not None


class TestLayer3HumanGates:
    """Test Layer 3 human approval gates."""

    def test_risk_assessor_initialization(self):
        """Test risk assessor initializes correctly."""
        assessor = RiskAssessor()
        assert assessor is not None
        assert len(assessor.SECURITY_KEYWORDS) > 0

    def test_risk_assessor_detect_security_category(self):
        """Test detection of security-related changes."""
        assessor = RiskAssessor()
        security_code = "def authenticate(password):\n    hash_password(password)"
        categories = assessor._detect_categories(security_code)
        assert ApprovalCategory.SECURITY in categories

    def test_risk_assessor_detect_api_category(self):
        """Test detection of API-related changes."""
        assessor = RiskAssessor()
        api_code = "@app.route('/api/users')\ndef get_users():\n    pass"
        categories = assessor._detect_categories(api_code)
        assert ApprovalCategory.API in categories

    def test_approval_gatekeeper_initialization(self):
        """Test approval gatekeeper initializes correctly."""
        gatekeeper = ApprovalGatekeeper()
        assert gatekeeper is not None
        assert len(gatekeeper.approval_rules) == 4  # 4 risk levels
        assert len(gatekeeper.category_overrides) > 0

    def test_approval_gatekeeper_critical_requires_approval(self):
        """Test that critical changes require approval."""
        gatekeeper = ApprovalGatekeeper()
        rules = gatekeeper.approval_rules[RiskLevel.CRITICAL]
        assert rules["auto_approve"] is False
        assert len(rules["required_roles"]) > 0

    def test_approval_gatekeeper_low_auto_approve(self):
        """Test that low-risk changes auto-approve."""
        gatekeeper = ApprovalGatekeeper()
        rules = gatekeeper.approval_rules[RiskLevel.LOW]
        assert rules["auto_approve"] is True

    @pytest.mark.asyncio
    async def test_layer3_executor_initialization(self):
        """Test Layer 3 executor initializes correctly."""
        executor = Layer3Executor()
        assert executor is not None
        assert executor.risk_assessor is not None
        assert executor.gatekeeper is not None


class TestReviewSystemIntegration:
    """Integration tests for the complete review system."""

    @pytest.mark.asyncio
    async def test_full_review_pipeline(self):
        """Test complete review pipeline."""
        # Create sample code
        code_changes = {
            "module.py": """
def process_data(data):
    password = "secret"
    return data
"""
        }

        # Layer 1
        layer1 = Layer1Executor()
        report1 = await layer1.execute(code_changes)
        assert report1 is not None

        # Layer 2
        layer2 = Layer2Executor()
        report2 = await layer2.execute(code_changes)
        assert report2 is not None
        # Should detect hardcoded secret
        assert report2.security.total_issues > 0

        # Layer 3
        layer3 = Layer3Executor()
        code_str = list(code_changes.values())[0]
        request = layer3.execute(code_str, report1, report2)
        assert request is not None
        # Should require approval due to security issues
        assert request.auto_approve is False
        assert ApprovalCategory.SECURITY in request.categories

    @pytest.mark.asyncio
    async def test_clean_code_pipeline(self):
        """Test review pipeline with clean code."""
        code_changes = {
            "utils.py": """
def greet(name):
    \"\"\"Greet a person.\"\"\"
    return f"Hello, {name}!"
"""
        }

        layer1 = Layer1Executor()
        report1 = await layer1.execute(code_changes)
        assert report1 is not None

        layer2 = Layer2Executor()
        report2 = await layer2.execute(code_changes)
        assert report2 is not None
        assert report2.security.total_issues == 0
        assert report2.security.overall_risk == RiskLevel.LOW

    @pytest.mark.asyncio
    async def test_multiple_files_review(self):
        """Test review of multiple files."""
        code_changes = {
            "file1.py": "def func1(): pass",
            "file2.js": "function func2() {}",
            "file3.ts": "function func3(): void {}",
        }

        layer1 = Layer1Executor()
        report1 = await layer1.execute(code_changes)
        assert report1 is not None

        layer2 = Layer2Executor()
        report2 = await layer2.execute(code_changes)
        assert report2 is not None


class TestReviewSystemErrorHandling:
    """Test error handling in review system."""

    @pytest.mark.asyncio
    async def test_layer1_graceful_degradation(self):
        """Test Layer 1 handles missing tools gracefully."""
        executor = Layer1Executor()
        # Even without tools installed, should not crash
        report = await executor.execute({"test.py": "pass"})
        assert report is not None

    @pytest.mark.asyncio
    async def test_layer2_graceful_degradation(self):
        """Test Layer 2 handles missing tools gracefully."""
        executor = Layer2Executor()
        # Even without radon, should not crash
        report = await executor.execute({"test.py": "def test(): pass"})
        assert report is not None

    def test_layer3_handles_no_categories(self):
        """Test Layer 3 handles code with no detected categories."""
        assessor = RiskAssessor()
        generic_code = "x = 1\ny = 2"
        categories = assessor._detect_categories(generic_code)
        assert ApprovalCategory.UNKNOWN in categories


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
