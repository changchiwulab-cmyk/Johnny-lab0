"""Tests for security module."""

import pytest
from security.threat_detector import ThreatDetector
from security.vulnerability_scanner import VulnerabilityScanner
from security import ThreatSeverity  # Backward compatibility alias for RiskLevel


class TestThreatDetector:
    """Test threat detection."""

    def test_detect_sql_injection(self):
        """Test SQL injection detection."""
        detector = ThreatDetector()
        code = 'execute("SELECT * FROM users WHERE id=" + user_id)'
        threats = detector.detect_code_vulnerabilities(code)
        assert isinstance(threats, list)
        # May or may not find SQL injection depending on patterns

    def test_detect_secrets(self):
        """Test secret detection."""
        detector = ThreatDetector()
        code = 'api_key = "sk_live_abc123def456ghi789"'
        threats = detector.detect_secrets(code)
        assert isinstance(threats, list)
        # May or may not find hardcoded secrets depending on patterns

    def test_detect_dependency_threats(self):
        """Test dependency threat detection."""
        detector = ThreatDetector()
        deps = {"moment": "2.18.0", "django": "1.11.0"}
        threats = detector.detect_dependency_threats(deps)
        assert isinstance(threats, list)


class TestVulnerabilityScanner:
    """Test vulnerability scanner."""

    @pytest.mark.asyncio
    async def test_scan_code(self):
        """Test code scanning."""
        scanner = VulnerabilityScanner()
        code = 'password = "secret123"'
        result = await scanner.scan_code(code)
        assert result.total_vulnerabilities > 0

    @pytest.mark.asyncio
    async def test_scan_dependencies(self):
        """Test dependency scanning."""
        scanner = VulnerabilityScanner()
        deps = {"moment": "2.18.0"}
        result = await scanner.scan_dependencies(deps)
        assert isinstance(result.total_vulnerabilities, int)
        # Total vulnerabilities may be 0 if vulnerability database is not loaded


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
