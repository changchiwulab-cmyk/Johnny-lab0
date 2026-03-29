"""Threat detection engine for security-first architecture."""

import re
from typing import List, Dict, Optional
from shared.result_models import Finding, RiskLevel
from shared.security_patterns import SecurityPatterns, SecurityLevel


class ThreatDetector:
    """Detects security threats in code using unified security patterns."""

    def __init__(self):
        """Initialize threat detector with unified patterns."""
        self.detected_threats = []
        # Use shared patterns
        self.vulnerability_patterns = SecurityPatterns.VULNERABILITY_PATTERNS
        self.secret_patterns = SecurityPatterns.SECRET_PATTERNS

    def detect_code_vulnerabilities(
        self, code: str, language: str = "python"
    ) -> List[Finding]:
        """Detect code vulnerabilities using shared patterns (CPU-bound, synchronous)."""
        threats = []
        lines = code.split("\n")

        # Map SecurityLevel to RiskLevel
        severity_map = {
            SecurityLevel.CRITICAL: RiskLevel.CRITICAL,
            SecurityLevel.HIGH: RiskLevel.HIGH,
            SecurityLevel.MEDIUM: RiskLevel.MEDIUM,
            SecurityLevel.LOW: RiskLevel.LOW,
        }

        for category, config in self.vulnerability_patterns.items():
            for pattern in config["patterns"]:
                for line_num, line in enumerate(lines, 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        threats.append(
                            Finding(
                                finding_type="security",
                                severity=severity_map.get(config["severity"], RiskLevel.MEDIUM),
                                category=category,
                                description=f"Potential {category} detected",
                                line=line_num,
                                pattern=pattern,
                                confidence=config["confidence"],
                                remediation=config["remediation"],
                            )
                        )

        return threats

    def detect_secrets(self, code: str) -> List[Finding]:
        """Detect hardcoded secrets using shared patterns (CPU-bound, synchronous)."""
        threats = []
        lines = code.split("\n")

        for secret_type, config in self.secret_patterns.items():
            pattern = config["pattern"] if isinstance(config, dict) else config
            for line_num, line in enumerate(lines, 1):
                if re.search(pattern, line):
                    # Get config details
                    config_dict = config if isinstance(config, dict) else {}
                    threats.append(
                        Finding(
                            finding_type="security",
                            severity=RiskLevel.CRITICAL,
                            category=f"hardcoded_{secret_type}",
                            description=f"Hardcoded {secret_type} detected",
                            line=line_num,
                            pattern=pattern,
                            confidence=config_dict.get("confidence", 0.95),
                            remediation=config_dict.get("remediation", "Remove and use environment variables"),
                        )
                    )

        return threats

    def detect_dependency_threats(self, dependencies: Dict) -> List[Finding]:
        """Detect threats in dependencies (synchronous)."""
        # Simplified version - would integrate with npm audit / pip audit in production
        threats = []

        # Check for known vulnerable packages
        vulnerable_packages = {
            "moment": {"cve": "CVE-2016-4055", "severity": RiskLevel.HIGH},
            "lodash": {"cve": "CVE-2021-23337", "severity": RiskLevel.HIGH},
            "django": {"cve": "CVE-2021-32558", "severity": RiskLevel.HIGH},
        }

        for package, version in dependencies.items():
            if package.lower() in vulnerable_packages:
                vuln = vulnerable_packages[package.lower()]
                threats.append(
                    Finding(
                        finding_type="dependency",
                        severity=vuln["severity"],
                        category="vulnerable_dependency",
                        description=f"Vulnerable package: {package} {version}",
                        cve_id=vuln["cve"],
                        remediation=f"Update {package} to patched version",
                    )
                )

        return threats

    def assess_threat_level(self, threats: List[Finding]) -> RiskLevel:
        """Assess overall threat level (synchronous)."""
        if not threats:
            return RiskLevel.LOW

        # Return highest severity found
        severity_order = {
            RiskLevel.CRITICAL: 4,
            RiskLevel.HIGH: 3,
            RiskLevel.MEDIUM: 2,
            RiskLevel.LOW: 1,
        }

        max_severity = max(threat.severity for threat in threats)
        return max_severity
