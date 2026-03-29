"""Unified security detection patterns for threat detection and anomaly analysis."""

from enum import Enum


class SecurityLevel(Enum):
    """Security severity levels."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class SecurityPatterns:
    """Centralized repository of security detection patterns."""

    # Code vulnerability patterns
    VULNERABILITY_PATTERNS = {
        "sql_injection": {
            "patterns": [
                r"execute\s*\(\s*['\"].*\+",
                r"query\s*\(\s*['\"].*\+",
                r"SELECT\s+.*\+\s*['\"]",
                r"FROM\s+.*\+\s*['\"]",
                r"sql\s*=\s*.*\+.*",
                r"query\s*=\s*.*f['\"].*\{",
            ],
            "severity": SecurityLevel.CRITICAL,
            "confidence": 0.85,
            "remediation": "Use parameterized queries",
        },
        "xss": {
            "patterns": [
                r"innerHTML\s*=\s*[^'\"]*\$",
                r"eval\s*\(",
                r"document\.write\s*\(",
            ],
            "severity": SecurityLevel.HIGH,
            "confidence": 0.85,
            "remediation": "Use textContent or sanitize HTML",
        },
        "command_injection": {
            "patterns": [
                r"exec\s*\(\s*['\"].*\+",
                r"system\s*\(\s*['\"].*\+",
                r"os\.popen\s*\(\s*['\"].*\+",
            ],
            "severity": SecurityLevel.CRITICAL,
            "confidence": 0.85,
            "remediation": "Use subprocess with shell=False",
        },
        "weak_crypto": {
            "patterns": [
                r"md5\s*\(",
                r"sha1\s*\(",
                r"DES\s*\(",
                r"RC4\s*\(",
            ],
            "severity": SecurityLevel.HIGH,
            "confidence": 0.90,
            "remediation": "Use SHA256 or stronger algorithms",
        },
        "unsafe_eval": {
            "patterns": [
                r"\beval\s*\(",
                r"\bexec\s*\(",
                r"__import__\s*\(",
            ],
            "severity": SecurityLevel.CRITICAL,
            "confidence": 0.98,
            "remediation": "Replace eval with safer alternatives",
        },
        "hardcoded_secrets": {
            "patterns": [
                r"password\s*=\s*['\"][\w@]+['\"]",
                r"api_key\s*=\s*['\"][\w\-]+['\"]",
                r"secret\s*=\s*['\"][\w\-]+['\"]",
            ],
            "severity": SecurityLevel.CRITICAL,
            "confidence": 0.95,
            "remediation": "Use environment variables",
        },
    }

    # Secret detection patterns
    SECRET_PATTERNS = {
        "api_key": {
            "pattern": r"['\"]?(api[_-]?key|apikey)['\"]?\s*[:=]\s*['\"][\w\-]{20,}['\"]",
            "severity": SecurityLevel.CRITICAL,
            "confidence": 0.95,
            "remediation": "Remove and use environment variables",
        },
        "password": {
            "pattern": r"['\"]?(password|passwd)['\"]?\s*[:=]\s*['\"][\w!@#$%^&*]{8,}['\"]",
            "severity": SecurityLevel.CRITICAL,
            "confidence": 0.95,
            "remediation": "Remove and use environment variables",
        },
        "aws_key": {
            "pattern": r"AKIA[0-9A-Z]{16}",
            "severity": SecurityLevel.CRITICAL,
            "confidence": 0.98,
            "remediation": "Revoke and rotate AWS keys",
        },
        "private_key": {
            "pattern": r"-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY",
            "severity": SecurityLevel.CRITICAL,
            "confidence": 0.98,
            "remediation": "Revoke and regenerate private key",
        },
    }

    @staticmethod
    def get_vulnerability_pattern(category: str) -> dict:
        """Get a specific vulnerability pattern by category."""
        return SecurityPatterns.VULNERABILITY_PATTERNS.get(category, {})

    @staticmethod
    def get_secret_pattern(secret_type: str) -> dict:
        """Get a specific secret pattern by type."""
        return SecurityPatterns.SECRET_PATTERNS.get(secret_type, {})

    @staticmethod
    def all_vulnerability_categories() -> list:
        """Get all vulnerability categories."""
        return list(SecurityPatterns.VULNERABILITY_PATTERNS.keys())

    @staticmethod
    def all_secret_types() -> list:
        """Get all secret types."""
        return list(SecurityPatterns.SECRET_PATTERNS.keys())
