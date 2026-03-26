"""Threat detection engine for security-first architecture."""

import re
from dataclasses import dataclass
from enum import Enum
from typing import List, Dict, Optional
from datetime import datetime


class ThreatSeverity(Enum):
    """Threat severity levels."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


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
    """Detects security threats in code."""

    # Detection patterns
    VULNERABILITY_PATTERNS = {
        "sql_injection": {
            "patterns": [
                r"execute\s*\(\s*['\"].*\+",
                r"query\s*\(\s*['\"].*\+",
                r"SELECT\s+.*\+\s*['\"]",
                r"FROM\s+.*\+\s*['\"]",
            ],
            "severity": ThreatSeverity.CRITICAL,
            "remediation": "Use parameterized queries",
        },
        "xss": {
            "patterns": [
                r"innerHTML\s*=\s*[^'\"]*\$",
                r"eval\s*\(",
                r"document\.write\s*\(",
            ],
            "severity": ThreatSeverity.HIGH,
            "remediation": "Use textContent or sanitize HTML",
        },
        "command_injection": {
            "patterns": [
                r"exec\s*\(\s*['\"].*\+",
                r"system\s*\(\s*['\"].*\+",
                r"os\.popen\s*\(\s*['\"].*\+",
            ],
            "severity": ThreatSeverity.CRITICAL,
            "remediation": "Use subprocess with shell=False",
        },
        "weak_crypto": {
            "patterns": [
                r"md5\s*\(",
                r"sha1\s*\(",
                r"DES\s*\(",
                r"RC4\s*\(",
            ],
            "severity": ThreatSeverity.HIGH,
            "remediation": "Use SHA256 or stronger algorithms",
        },
        "unsafe_eval": {
            "patterns": [
                r"\beval\s*\(",
                r"\bexec\s*\(",
                r"__import__\s*\(",
            ],
            "severity": ThreatSeverity.CRITICAL,
            "remediation": "Replace eval with safer alternatives",
        },
    }

    SECRET_PATTERNS = {
        "api_key": r"['\"]?(api[_-]?key|apikey)['\"]?\s*[:=]\s*['\"][\w\-]{20,}['\"]",
        "password": r"['\"]?(password|passwd)['\"]?\s*[:=]\s*['\"][\w!@#$%^&*]{8,}['\"]",
        "aws_key": r"AKIA[0-9A-Z]{16}",
        "private_key": r"-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY",
    }

    def __init__(self):
        """Initialize threat detector."""
        self.detected_threats = []

    async def detect_code_vulnerabilities(
        self, code: str, language: str = "python"
    ) -> List[Threat]:
        """Detect code vulnerabilities."""
        threats = []
        lines = code.split("\n")

        for category, config in self.VULNERABILITY_PATTERNS.items():
            for pattern in config["patterns"]:
                for line_num, line in enumerate(lines, 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        threats.append(
                            Threat(
                                severity=config["severity"],
                                category=category,
                                description=f"Potential {category} detected",
                                line=line_num,
                                pattern=pattern,
                                confidence=0.85,
                                remediation=config["remediation"],
                            )
                        )

        return threats

    async def detect_secrets(self, code: str) -> List[Threat]:
        """Detect hardcoded secrets."""
        threats = []
        lines = code.split("\n")

        for secret_type, pattern in self.SECRET_PATTERNS.items():
            for line_num, line in enumerate(lines, 1):
                if re.search(pattern, line):
                    threats.append(
                        Threat(
                            severity=ThreatSeverity.CRITICAL,
                            category=f"hardcoded_{secret_type}",
                            description=f"Hardcoded {secret_type} detected",
                            line=line_num,
                            pattern=pattern,
                            confidence=0.95,
                            remediation="Remove and use environment variables",
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
