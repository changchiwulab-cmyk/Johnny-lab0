"""Threat detection engine for security-first architecture."""

import re
from dataclasses import dataclass
from enum import Enum
from typing import List, Dict, Optional
from datetime import datetime
from shared.security_patterns import SecurityPatterns, SecurityLevel


class ThreatSeverity(Enum):
    """Threat severity levels (aliases for SecurityLevel)."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

    @classmethod
    def from_security_level(cls, level: SecurityLevel) -> "ThreatSeverity":
        """Convert SecurityLevel to ThreatSeverity."""
        return cls(level.value)


@dataclass
class Threat:
    """Represents a detected security threat."""
    severity: ThreatSeverity
    category: str
    description: str
    line: Optional[int]
    pattern: str
    confidence: float  # 0.0-1.0
    cve_id: Optional[str] = None
    remediation: Optional[str] = None


@dataclass
class ThreatDetectionResult:
    """Result of threat detection analysis."""
    threats: List[Threat]
    total_count: int
    critical_count: int
    high_count: int
    overall_risk_level: ThreatSeverity
    scan_timestamp: datetime


class ThreatDetector:
    """Detects security threats in code using unified security patterns."""

    def __init__(self):
        """Initialize threat detector with unified patterns."""
        self.detected_threats = []
        # Use shared patterns
        self.vulnerability_patterns = SecurityPatterns.VULNERABILITY_PATTERNS
        self.secret_patterns = SecurityPatterns.SECRET_PATTERNS

    async def detect_code_vulnerabilities(
        self, code: str, language: str = "python"
    ) -> List[Threat]:
        """Detect code vulnerabilities using shared patterns."""
        threats = []
        lines = code.split("\n")

        for category, config in self.vulnerability_patterns.items():
            for pattern in config["patterns"]:
                for line_num, line in enumerate(lines, 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        threats.append(
                            Threat(
                                severity=ThreatSeverity.from_security_level(config["severity"]),
                                category=category,
                                description=f"Potential {category} detected",
                                line=line_num,
                                pattern=pattern,
                                confidence=config["confidence"],
                                remediation=config["remediation"],
                            )
                        )

        return threats

    async def detect_secrets(self, code: str) -> List[Threat]:
        """Detect hardcoded secrets using shared patterns."""
        threats = []
        lines = code.split("\n")

        for secret_type, config in self.secret_patterns.items():
            pattern = config["pattern"] if isinstance(config, dict) else config
            for line_num, line in enumerate(lines, 1):
                if re.search(pattern, line):
                    # Get config details
                    config_dict = config if isinstance(config, dict) else {}
                    threats.append(
                        Threat(
                            severity=ThreatSeverity.CRITICAL,
                            category=f"hardcoded_{secret_type}",
                            description=f"Hardcoded {secret_type} detected",
                            line=line_num,
                            pattern=pattern,
                            confidence=config_dict.get("confidence", 0.95),
                            remediation=config_dict.get("remediation", "Remove and use environment variables"),
                        )
                    )

        return threats

    async def detect_dependency_threats(self, dependencies: Dict) -> List[Threat]:
        """Detect threats in dependencies."""
        # Simplified version - would integrate with npm audit / pip audit in production
        threats = []

        # Check for known vulnerable packages
        vulnerable_packages = {
            "moment": {"cve": "CVE-2016-4055", "severity": ThreatSeverity.HIGH},
            "lodash": {"cve": "CVE-2021-23337", "severity": ThreatSeverity.HIGH},
            "django": {"cve": "CVE-2021-32558", "severity": ThreatSeverity.HIGH},
        }

        for package, version in dependencies.items():
            if package.lower() in vulnerable_packages:
                vuln = vulnerable_packages[package.lower()]
                threats.append(
                    Threat(
                        severity=vuln["severity"],
                        category="vulnerable_dependency",
                        description=f"Vulnerable package: {package} {version}",
                        line=None,
                        pattern=package,
                        confidence=0.99,
                        cve_id=vuln["cve"],
                        remediation=f"Update {package} to patched version",
                    )
                )

        return threats

    async def assess_threat_level(self, threats: List[Threat]) -> ThreatSeverity:
        """Assess overall threat level."""
        if not threats:
            return ThreatSeverity.LOW

        # Return highest severity found
        severity_order = {
            ThreatSeverity.CRITICAL: 4,
            ThreatSeverity.HIGH: 3,
            ThreatSeverity.MEDIUM: 2,
            ThreatSeverity.LOW: 1,
        }

        max_severity = max(threat.severity for threat in threats)
        return max_severity
