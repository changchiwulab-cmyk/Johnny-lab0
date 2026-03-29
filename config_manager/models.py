"""Pydantic models for configuration validation."""

from dataclasses import dataclass
from typing import Dict, List, Optional, Set
from enum import Enum


# ============= Review Configuration =============

class ToolConfig:
    """Generic tool configuration."""
    def __init__(self, enabled: bool = True, timeout: int = 10, ignore_codes: Optional[List[str]] = None):
        self.enabled = enabled
        self.timeout = timeout
        self.ignore_codes = ignore_codes or []


@dataclass
class CoverageConfig:
    """Coverage validation configuration."""
    enabled: bool = True
    minimum_percentage: float = 85.0
    fail_under: float = 70.0
    timeout: int = 30


@dataclass
class ComplexityConfig:
    """Code complexity analysis configuration."""
    enabled: bool = True
    cyclomatic_max: float = 10.0
    cognitive_max: float = 15.0
    timeout: int = 15


@dataclass
class ApprovalRuleConfig:
    """Approval rule configuration."""
    name: str
    min_reviewers: int
    required_roles: List[str]
    categories: List[str]


@dataclass
class Layer1Config:
    """Layer 1 (automated checks) configuration."""
    enabled: bool = True
    formatters_enabled: bool = True
    linters_enabled: bool = True
    type_checkers_enabled: bool = True
    coverage: CoverageConfig = None

    def __post_init__(self):
        if self.coverage is None:
            self.coverage = CoverageConfig()


@dataclass
class Layer2Config:
    """Layer 2 (anomaly detection) configuration."""
    enabled: bool = True
    complexity: ComplexityConfig = None

    def __post_init__(self):
        if self.complexity is None:
            self.complexity = ComplexityConfig()


@dataclass
class Layer3Config:
    """Layer 3 (human gates) configuration."""
    enabled: bool = True
    approval_rules: List[ApprovalRuleConfig] = None

    def __post_init__(self):
        if self.approval_rules is None:
            self.approval_rules = [
                ApprovalRuleConfig(
                    name="security",
                    min_reviewers=2,
                    required_roles=["security_team"],
                    categories=["security", "database"]
                ),
                ApprovalRuleConfig(
                    name="architecture",
                    min_reviewers=1,
                    required_roles=["engineer_lead"],
                    categories=["architecture"]
                ),
            ]


@dataclass
class ReviewConfig:
    """Complete review configuration."""
    layer1: Layer1Config = None
    layer2: Layer2Config = None
    layer3: Layer3Config = None

    def __post_init__(self):
        if self.layer1 is None:
            self.layer1 = Layer1Config()
        if self.layer2 is None:
            self.layer2 = Layer2Config()
        if self.layer3 is None:
            self.layer3 = Layer3Config()


# ============= RBAC Configuration =============

class Permission(Enum):
    """Permission types."""
    READ = "Read"
    WRITE = "Write"
    EDIT = "Edit"
    BASH_NPM = "Bash(npm:*)"
    BASH_GIT = "Bash(git:*)"
    BASH_AUDIT = "Bash(audit|scan)"
    BASH_SEARCH = "Bash(search)"
    BASH_ALL = "Bash(*)"


@dataclass
class RoleConfig:
    """Role configuration."""
    name: str
    department: str
    permissions: List[str]
    max_concurrent_tasks: int = 10
    allowed_templates: List[str] = None

    def __post_init__(self):
        if self.allowed_templates is None:
            self.allowed_templates = []


@dataclass
class EnforcementConfig:
    """RBAC enforcement configuration."""
    strict_mode: bool = True
    audit_logging: bool = True
    rate_limiting: bool = False
    cache_ttl_seconds: int = 3600


@dataclass
class RBACConfig:
    """Complete RBAC configuration."""
    roles: Dict[str, RoleConfig] = None
    enforcement: EnforcementConfig = None

    def __post_init__(self):
        if self.roles is None:
            self.roles = {}
        if self.enforcement is None:
            self.enforcement = EnforcementConfig()


# ============= Security Configuration =============

@dataclass
class ThreatDetectionConfig:
    """Threat detection configuration."""
    enabled: bool = True
    patterns_enabled: bool = True
    secret_detection: bool = True


@dataclass
class ScanningConfig:
    """Vulnerability scanning configuration."""
    npm_audit: bool = False
    pip_audit: bool = False
    code_scanning: bool = True
    dependency_scanning: bool = False


@dataclass
class ComplianceConfig:
    """Compliance configuration."""
    standards: List[str] = None
    coverage_target: float = 0.9

    def __post_init__(self):
        if self.standards is None:
            self.standards = ["OWASP"]


@dataclass
class SecurityConfig:
    """Complete security configuration."""
    threat_detection: ThreatDetectionConfig = None
    scanning: ScanningConfig = None
    compliance: ComplianceConfig = None

    def __post_init__(self):
        if self.threat_detection is None:
            self.threat_detection = ThreatDetectionConfig()
        if self.scanning is None:
            self.scanning = ScanningConfig()
        if self.compliance is None:
            self.compliance = ComplianceConfig()
