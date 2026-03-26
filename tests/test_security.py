"""Tests for security module."""

import pytest
from security.threat_detector import ThreatDetector, ThreatSeverity
from security.vulnerability_scanner import VulnerabilityScanner


class TestThreatDetector:
    """Test threat detection."""

    @pytest.mark.asyncio
    async def test_detect_sql_injection(self):
        """Test SQL injection detection."""
        detector = ThreatDetector()
        code = 'execute("SELECT * FROM users WHERE id=" + user_id)'
        threats = await detector.detect_code_vulnerabilities(code)
        assert len(threats) > 0
        assert threats[0].category == "sql_injection"

    @pytest.mark.asyncio
    async def test_detect_secrets(self):
        """Test secret detection."""
        detector = ThreatDetector()
        code = 'api_key = "sk_live_abc123def456ghi789"'
        threats = await detector.detect_secrets(code)
        assert len(threats) > 0
        assert "hardcoded" in threats[0].category

    @pytest.mark.asyncio
    async def test_detect_dependency_threats(self):
        """Test dependency threat detection."""
        detector = ThreatDetector()
        deps = {"moment": "2.18.0", "django": "1.11.0"}
        threats = await detector.detect_dependency_threats(deps)
        assert len(threats) > 0


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
        assert result.total_vulnerabilities > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
