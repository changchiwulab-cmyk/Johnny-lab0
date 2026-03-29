"""統一的結果和報告數據模型。

這個模塊統一了來自不同模塊的結果類型，
提供一致的序列化/反序列化和訪問模式。

支持的結果類型：
- CheckResult: 格式化、linting、類型檢查、覆蓋率檢查
- AnalysisReport: 複雜度、安全、性能、依賴項分析
- SecurityScanResult: 代碼、依賴項、威脅掃描
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum
from datetime import datetime


# ============ 通用枚舉 ============

class IssueSeverity(Enum):
    """問題嚴重程度（統一）。"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class RiskLevel(Enum):
    """風險等級（統一）。"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ============ Layer 1: 檢查結果 ============

@dataclass
class Issue:
    """統一的單個問題表示（支持 lint, format, type check）。"""
    file: str
    line: Optional[int] = None
    column: Optional[int] = None
    severity: IssueSeverity = IssueSeverity.WARNING
    rule_id: Optional[str] = None
    message: str = ""
    source: str = ""  # "flake8", "black", "mypy", "prettier", "eslint" 等

    def to_dict(self) -> Dict:
        """轉換為字典。"""
        return {
            'file': self.file,
            'line': self.line,
            'column': self.column,
            'severity': self.severity.value,
            'rule_id': self.rule_id,
            'message': self.message,
            'source': self.source,
        }


@dataclass
class CheckResult:
    """統一的檢查結果（支持所有 Layer 1 檢查）。

    支持的檢查類型：
    - check_type="format": 代碼格式化
    - check_type="lint": 代碼質量檢查
    - check_type="type": 類型檢查
    - check_type="coverage": 測試覆蓋率
    """
    check_type: str  # "format", "lint", "type", "coverage"
    success: bool
    total_items: int = 0
    processed_items: int = 0
    issues: List[Issue] = field(default_factory=list)
    error_count: int = 0
    warning_count: int = 0

    # 特定檢查的額外字段
    files_modified: Optional[int] = None  # 用於 format
    files_failed: Optional[int] = None    # 用於 format
    total_coverage: Optional[float] = None  # 用於 coverage
    lines_covered: Optional[int] = None  # 用於 coverage
    lines_total: Optional[int] = None    # 用於 coverage
    is_acceptable: Optional[bool] = None  # 用於 coverage
    message: str = ""
    errors: List[str] = field(default_factory=list)

    # 向後兼容性 property
    @property
    def has_errors(self) -> bool:
        """用於 TypeCheckResult 兼容性。"""
        return self.check_type == "type" and self.error_count > 0

    @property
    def formatted(self) -> bool:
        """用於 FormatResult 兼容性。"""
        return self.check_type == "format" and self.success

    @property
    def info_count(self) -> int:
        """計算 info 級別的問題數。"""
        return sum(1 for issue in self.issues if issue.severity == IssueSeverity.INFO)

    @property
    def critical_count(self) -> int:
        """計算 critical 級別的問題數（ERROR 級別）。"""
        return sum(1 for issue in self.issues if issue.severity == IssueSeverity.ERROR)

    @property
    def total_issues(self) -> int:
        """總問題數。"""
        return len(self.issues)

    def to_dict(self) -> Dict:
        """序列化為字典。"""
        return {
            'check_type': self.check_type,
            'success': self.success,
            'total_items': self.total_items,
            'processed_items': self.processed_items,
            'issues': [issue.to_dict() for issue in self.issues],
            'error_count': self.error_count,
            'warning_count': self.warning_count,
            'info_count': self.info_count,
            'message': self.message,
            'extra_data': {
                'files_modified': self.files_modified,
                'files_failed': self.files_failed,
                'total_coverage': self.total_coverage,
                'lines_covered': self.lines_covered,
                'lines_total': self.lines_total,
                'is_acceptable': self.is_acceptable,
            }
        }


# ============ Layer 2: 分析報告 ============

@dataclass
class Metric:
    """統一的指標表示。"""
    name: str
    value: float
    threshold: Optional[float] = None
    unit: str = ""
    is_exceeded: bool = False

    def to_dict(self) -> Dict:
        return {
            'name': self.name,
            'value': self.value,
            'threshold': self.threshold,
            'unit': self.unit,
            'is_exceeded': self.is_exceeded,
        }


@dataclass
class Finding:
    """統一的發現表示（支持安全、性能、複雜度）。"""
    finding_type: str  # "security", "performance", "complexity", "dependency"
    severity: RiskLevel
    category: str
    description: str
    location: Optional[str] = None  # 文件:行号
    line: Optional[int] = None
    confidence: float = 0.9  # 0.0-1.0，用於安全發現
    cve_id: Optional[str] = None  # 用於依賴漏洞
    remediation: Optional[str] = None
    pattern: Optional[str] = None  # 用於安全檢測

    def to_dict(self) -> Dict:
        return {
            'finding_type': self.finding_type,
            'severity': self.severity.value,
            'category': self.category,
            'description': self.description,
            'location': self.location,
            'line': self.line,
            'confidence': self.confidence,
            'cve_id': self.cve_id,
            'remediation': self.remediation,
            'pattern': self.pattern,
        }


@dataclass
class AnalysisReport:
    """統一的分析報告（支持所有 Layer 2 分析）。

    支持的分析類型：
    - analysis_type="complexity": 複雜度分析
    - analysis_type="security": 安全分析
    - analysis_type="performance": 性能分析
    - analysis_type="dependency": 依賴審計
    """
    analysis_type: str  # "complexity", "security", "performance", "dependency"
    total_issues: int
    findings: List[Finding] = field(default_factory=list)
    metrics: List[Metric] = field(default_factory=list)
    overall_risk: RiskLevel = RiskLevel.LOW

    # 計數字段
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0

    # 特定分析的額外字段
    functions_over_threshold: List[str] = field(default_factory=list)  # 複雜度
    packages_affected: Optional[int] = None  # 依賴

    # 向後兼容性 property
    @property
    def issues(self) -> List[Finding]:
        """用於各種 Report 兼容性。"""
        return self.findings

    @property
    def vulnerabilities(self) -> List[Finding]:
        """用於 DependencyAuditReport 兼容性。"""
        return self.findings

    @property
    def status(self) -> str:
        """判定狀態。"""
        if self.overall_risk == RiskLevel.CRITICAL:
            return "fail"
        elif self.overall_risk == RiskLevel.HIGH:
            return "warning"
        else:
            return "pass"

    def to_dict(self) -> Dict:
        """序列化為字典。"""
        return {
            'analysis_type': self.analysis_type,
            'total_issues': self.total_issues,
            'findings': [f.to_dict() for f in self.findings],
            'metrics': [m.to_dict() for m in self.metrics],
            'overall_risk': self.overall_risk.value,
            'critical_count': self.critical_count,
            'high_count': self.high_count,
            'medium_count': self.medium_count,
            'low_count': self.low_count,
            'functions_over_threshold': self.functions_over_threshold,
            'packages_affected': self.packages_affected,
        }


# ============ 安全掃描結果 ============

@dataclass
class SecurityScanResult:
    """統一的安全掃描結果。

    支持的掃描類型：
    - scan_type="code": 代碼漏洞和秘密檢測
    - scan_type="dependency": 依賴漏洞
    - scan_type="threat": 威脅檢測
    """
    scan_type: str  # "code", "dependency", "threat"
    findings: List[Finding] = field(default_factory=list)
    total_vulnerabilities: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    scan_timestamp: datetime = field(default_factory=datetime.utcnow)
    scan_duration_seconds: float = 0.0
    overall_risk_level: RiskLevel = RiskLevel.LOW

    # 向後兼容性
    @property
    def threats(self) -> List[Finding]:
        """用於 ThreatDetectionResult 兼容性。"""
        return self.findings

    @property
    def total_count(self) -> int:
        """用於兼容性。"""
        return self.total_vulnerabilities

    @property
    def status(self) -> str:
        """判定狀態。"""
        if self.overall_risk_level == RiskLevel.CRITICAL:
            return "fail"
        elif self.overall_risk_level == RiskLevel.HIGH:
            return "warning"
        else:
            return "pass"

    def to_dict(self) -> Dict:
        """序列化為字典。"""
        return {
            'scan_type': self.scan_type,
            'findings': [f.to_dict() for f in self.findings],
            'total_vulnerabilities': self.total_vulnerabilities,
            'critical_count': self.critical_count,
            'high_count': self.high_count,
            'medium_count': self.medium_count,
            'low_count': self.low_count,
            'scan_timestamp': self.scan_timestamp.isoformat(),
            'scan_duration_seconds': self.scan_duration_seconds,
            'overall_risk_level': self.overall_risk_level.value,
        }


# ============ 合併報告 ============

@dataclass
class Layer1Report:
    """Layer 1 合併報告（使用新的 CheckResult）。"""
    formatted: CheckResult
    linted: CheckResult
    type_checked: CheckResult
    coverage: CheckResult
    status: str  # "pass", "warning", "fail"

    @property
    def total_issues(self) -> int:
        """計算總問題數。"""
        return (
            self.formatted.total_issues +
            self.linted.total_issues +
            self.type_checked.total_issues
        )

    @property
    def overall_risk(self) -> str:
        """判定整體風險級別。"""
        if self.status == "fail":
            return "CRITICAL"
        elif self.status == "warning":
            return "HIGH"
        else:
            return "LOW"

    @classmethod
    def synthesize(cls, results: tuple) -> "Layer1Report":
        """從 CheckResult 合併。"""
        formatted, linted, type_checked, coverage = results

        # 判定整體狀態
        if (formatted.success is False or
            type_checked.has_errors or
            (coverage.is_acceptable is not None and not coverage.is_acceptable)):
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

    def to_dict(self) -> Dict:
        """序列化為字典。"""
        return {
            'formatted': self.formatted.to_dict(),
            'linted': self.linted.to_dict(),
            'type_checked': self.type_checked.to_dict(),
            'coverage': self.coverage.to_dict(),
            'status': self.status,
            'total_issues': self.total_issues,
            'overall_risk': self.overall_risk,
        }


@dataclass
class Layer2Report:
    """Layer 2 合併報告（使用新的 AnalysisReport）。"""
    complexity: AnalysisReport
    security: AnalysisReport
    performance: AnalysisReport
    dependencies: AnalysisReport
    status: str  # "pass", "warning", "fail"

    @property
    def total_issues(self) -> int:
        """計算總問題數。"""
        return (
            self.complexity.total_issues +
            self.security.total_issues +
            self.performance.total_issues +
            self.dependencies.total_issues
        )

    @property
    def overall_risk(self) -> RiskLevel:
        """判定整體風險級別。"""
        risks = [
            self.complexity.overall_risk,
            self.security.overall_risk,
            self.performance.overall_risk,
            self.dependencies.overall_risk,
        ]
        # 返回最高風險
        risk_order = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL]
        for risk in risk_order[::-1]:
            if risk in risks:
                return risk
        return RiskLevel.LOW

    @classmethod
    def synthesize(cls, results: tuple) -> "Layer2Report":
        """從 AnalysisReport 合併。"""
        complexity, security, performance, dependencies = results

        # 根據最高風險確定狀態
        max_risk = max(
            [complexity.overall_risk,
             security.overall_risk,
             performance.overall_risk,
             dependencies.overall_risk],
            key=lambda r: [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL].index(r),
        )

        if max_risk == RiskLevel.CRITICAL:
            status = "fail"
        elif max_risk == RiskLevel.HIGH:
            status = "warning"
        else:
            status = "pass"

        return cls(
            complexity=complexity,
            security=security,
            performance=performance,
            dependencies=dependencies,
            status=status,
        )

    def to_dict(self) -> Dict:
        """序列化為字典。"""
        return {
            'complexity': self.complexity.to_dict(),
            'security': self.security.to_dict(),
            'performance': self.performance.to_dict(),
            'dependencies': self.dependencies.to_dict(),
            'status': self.status,
            'total_issues': self.total_issues,
            'overall_risk': self.overall_risk.value,
        }
