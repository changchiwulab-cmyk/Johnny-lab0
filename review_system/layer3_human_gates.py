"""Layer 3: Human approval gates and risk assessment."""

from dataclasses import dataclass, field
from typing import List, Set
from enum import Enum
from review_system.layer1_auto import Layer1Report
from review_system.layer2_analyzer import Layer2Report, RiskLevel


class ApprovalCategory(Enum):
    """Categories of changes that may require approval."""
    ARCHITECTURE = "architecture"
    SECURITY = "security"
    BUSINESS_LOGIC = "business_logic"
    API = "api"
    DATABASE = "database"
    DEPENDENCY = "dependency"
    UNKNOWN = "unknown"


@dataclass
class ApprovalRequirement:
    """An approval requirement for a change."""
    category: ApprovalCategory
    reason: str
    required_roles: Set[str]
    priority: int  # 1-5, higher = more urgent


@dataclass
class ApprovalRequest:
    """Request for human approval of a code change."""
    risk_level: RiskLevel
    categories: List[ApprovalCategory]
    auto_approve: bool
    requirements: List[ApprovalRequirement] = field(default_factory=list)
    checklist: List[str] = field(default_factory=list)
    required_approvers: Set[str] = field(default_factory=set)
    estimated_review_time: int = 0  # minutes


@dataclass
class RiskAssessment:
    """Assessment of change risk."""
    base_risk: RiskLevel
    complexity_risk: RiskLevel
    security_risk: RiskLevel
    performance_risk: RiskLevel
    final_risk: RiskLevel
    categories: List[ApprovalCategory]


class RiskAssessor:
    """Assesses risk of code changes."""

    ARCHITECTURE_KEYWORDS = {
        "design", "pattern", "refactor", "structure", "interface",
        "abstract", "inherit", "module", "package", "layer"
    }
    SECURITY_KEYWORDS = {
        "auth", "crypto", "permission", "password", "token", "secret",
        "secure", "encrypt", "hash", "verify", "validate"
    }
    BUSINESS_LOGIC_KEYWORDS = {
        "rule", "validation", "calc", "compute", "formula", "logic",
        "condition", "decision", "process"
    }
    API_KEYWORDS = {
        "endpoint", "route", "api", "controller", "request", "response",
        "handler", "handler", "middleware"
    }
    DATABASE_KEYWORDS = {
        "schema", "migration", "table", "column", "index", "query",
        "database", "model", "orm"
    }

    def assess_change(
        self,
        code_change: str,
        l1_report: Layer1Report,
        l2_report: Layer2Report,
    ) -> RiskAssessment:
        """Assess the risk of a code change."""
        # Start with base risk from Layer 2
        base_risk = l2_report.status == "fail" and RiskLevel.CRITICAL or RiskLevel.LOW

        # Adjust based on individual components
        complexity_risk = l2_report.complexity.overall_risk
        security_risk = l2_report.security.overall_risk
        performance_risk = l2_report.performance.overall_risk

        # Determine final risk (take maximum)
        risk_levels = [base_risk, complexity_risk, security_risk, performance_risk]
        risk_order = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL]
        final_risk = max(risk_levels, key=lambda r: risk_order.index(r))

        # Detect change categories
        categories = self._detect_categories(code_change)

        return RiskAssessment(
            base_risk=base_risk,
            complexity_risk=complexity_risk,
            security_risk=security_risk,
            performance_risk=performance_risk,
            final_risk=final_risk,
            categories=categories,
        )

    def _detect_categories(self, code_change: str) -> List[ApprovalCategory]:
        """Detect change categories from code content."""
        code_lower = code_change.lower()
        categories = []

        if any(keyword in code_lower for keyword in self.ARCHITECTURE_KEYWORDS):
            categories.append(ApprovalCategory.ARCHITECTURE)
        if any(keyword in code_lower for keyword in self.SECURITY_KEYWORDS):
            categories.append(ApprovalCategory.SECURITY)
        if any(keyword in code_lower for keyword in self.BUSINESS_LOGIC_KEYWORDS):
            categories.append(ApprovalCategory.BUSINESS_LOGIC)
        if any(keyword in code_lower for keyword in self.API_KEYWORDS):
            categories.append(ApprovalCategory.API)
        if any(keyword in code_lower for keyword in self.DATABASE_KEYWORDS):
            categories.append(ApprovalCategory.DATABASE)

        if not categories:
            categories.append(ApprovalCategory.UNKNOWN)

        return categories


class ApprovalGatekeeper:
    """Manages approval gates and requirements."""

    def __init__(self):
        """Initialize approval rules."""
        self.approval_rules = {
            RiskLevel.CRITICAL: {
                "auto_approve": False,
                "required_roles": {"tech_lead", "security_team"},
                "min_reviewers": 2,
                "time_estimate": 60,
            },
            RiskLevel.HIGH: {
                "auto_approve": False,
                "required_roles": {"lead_engineer"},
                "min_reviewers": 1,
                "time_estimate": 30,
            },
            RiskLevel.MEDIUM: {
                "auto_approve": False,
                "required_roles": {"engineer"},
                "min_reviewers": 1,
                "time_estimate": 15,
            },
            RiskLevel.LOW: {
                "auto_approve": True,
                "required_roles": set(),
                "min_reviewers": 0,
                "time_estimate": 5,
            },
        }

        self.category_overrides = {
            ApprovalCategory.SECURITY: {"security_team"},
            ApprovalCategory.ARCHITECTURE: {"architecture_team", "tech_lead"},
            ApprovalCategory.API: {"api_lead"},
            ApprovalCategory.DATABASE: {"dba_team"},
            ApprovalCategory.DEPENDENCY: {"dependency_team"},
        }

    def generate_approval_request(
        self,
        assessment: RiskAssessment,
    ) -> ApprovalRequest:
        """Generate an approval request based on risk assessment."""
        risk_level = assessment.final_risk
        categories = assessment.categories

        # Get base approval requirements
        rules = self.approval_rules.get(risk_level, self.approval_rules[RiskLevel.LOW])
        auto_approve = rules["auto_approve"]
        required_roles = set(rules["required_roles"])
        time_estimate = rules["time_estimate"]

        # Apply category overrides
        for category in categories:
            override_roles = self.category_overrides.get(category)
            if override_roles:
                required_roles.update(override_roles)
                auto_approve = False  # Override auto-approve if category requires review

        # Create approval requirements
        requirements = self._create_requirements(risk_level, categories)

        # Generate checklist
        checklist = self._generate_checklist(risk_level, categories)

        return ApprovalRequest(
            risk_level=risk_level,
            categories=categories,
            auto_approve=auto_approve,
            requirements=requirements,
            checklist=checklist,
            required_approvers=required_roles,
            estimated_review_time=time_estimate,
        )

    def _create_requirements(
        self,
        risk_level: RiskLevel,
        categories: List[ApprovalCategory],
    ) -> List[ApprovalRequirement]:
        """Create specific approval requirements."""
        requirements = []

        # Risk-based requirements
        if risk_level == RiskLevel.CRITICAL:
            requirements.append(
                ApprovalRequirement(
                    category=ApprovalCategory.SECURITY,
                    reason="Critical risk detected",
                    required_roles={"tech_lead", "security_team"},
                    priority=5,
                )
            )
        elif risk_level == RiskLevel.HIGH:
            requirements.append(
                ApprovalRequirement(
                    category=ApprovalCategory.UNKNOWN,
                    reason="High risk change detected",
                    required_roles={"lead_engineer"},
                    priority=4,
                )
            )

        # Category-based requirements
        category_requirements = {
            ApprovalCategory.SECURITY: ApprovalRequirement(
                category=ApprovalCategory.SECURITY,
                reason="Security-critical code change",
                required_roles={"security_team"},
                priority=5,
            ),
            ApprovalCategory.API: ApprovalRequirement(
                category=ApprovalCategory.API,
                reason="API interface change",
                required_roles={"api_lead"},
                priority=4,
            ),
            ApprovalCategory.ARCHITECTURE: ApprovalRequirement(
                category=ApprovalCategory.ARCHITECTURE,
                reason="Architectural decision",
                required_roles={"architecture_team"},
                priority=4,
            ),
            ApprovalCategory.DATABASE: ApprovalRequirement(
                category=ApprovalCategory.DATABASE,
                reason="Database schema change",
                required_roles={"dba_team"},
                priority=4,
            ),
        }

        for category in categories:
            if category in category_requirements and category not in [r.category for r in requirements]:
                requirements.append(category_requirements[category])

        return requirements

    def _generate_checklist(
        self,
        risk_level: RiskLevel,
        categories: List[ApprovalCategory],
    ) -> List[str]:
        """Generate a review checklist."""
        checklist = [
            "☐ Code follows project style guidelines",
            "☐ Changes are well-documented",
            "☐ No hard-coded values or credentials",
        ]

        if risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
            checklist.extend([
                "☐ Tests provide adequate coverage",
                "☐ No performance regressions",
                "☐ Backward compatibility verified",
            ])

        if ApprovalCategory.SECURITY in categories:
            checklist.extend([
                "☐ Security vulnerabilities addressed",
                "☐ Input validation implemented",
                "☐ No privilege escalation risks",
            ])

        if ApprovalCategory.API in categories:
            checklist.extend([
                "☐ API contract documented",
                "☐ Error handling implemented",
                "☐ Deprecation warnings added (if breaking change)",
            ])

        if ApprovalCategory.DATABASE in categories:
            checklist.extend([
                "☐ Migration script tested",
                "☐ Rollback plan documented",
                "☐ Index strategy reviewed",
            ])

        return checklist


class Layer3Executor:
    """Orchestrates Layer 3 human gates."""

    def __init__(self):
        """Initialize Layer 3 components."""
        self.risk_assessor = RiskAssessor()
        self.gatekeeper = ApprovalGatekeeper()

    def execute(
        self,
        code_change: str,
        l1_report: Layer1Report,
        l2_report: Layer2Report,
    ) -> ApprovalRequest:
        """Generate approval request based on all layers."""
        # Assess risk
        assessment = self.risk_assessor.assess_change(code_change, l1_report, l2_report)

        # Generate approval request
        request = self.gatekeeper.generate_approval_request(assessment)

        return request
