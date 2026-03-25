"""
Root pytest configuration for Johnny-lab0.

Provides shared fixtures aligned with the 2026 Agentic Coding Framework:
- Multi-agent coordination (Trend 2)
- Human oversight automation (Trend 4)
- Code democratization (Trend 7)
- Security-first architecture (Trend 8)
"""

import pytest


# ---------------------------------------------------------------------------
# Environment & configuration fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _agentic_env(monkeypatch):
    """Inject default agentic environment variables for every test."""
    monkeypatch.setenv("AGENTIC_MODE", "multi-agent-coordination")
    monkeypatch.setenv("SECURITY_LEVEL", "priority-first")
    monkeypatch.setenv("AUTO_REVIEW", "enabled")


@pytest.fixture
def agent_config():
    """Return a baseline multi-agent coordination config dict."""
    return {
        "orchestrator": {
            "max_agents": 8,
            "parallel": True,
            "timeout_seconds": 300,
        },
        "agents": [
            {"role": "implementation", "enabled": True},
            {"role": "testing", "enabled": True},
            {"role": "documentation", "enabled": True},
            {"role": "security", "enabled": True},
        ],
    }


@pytest.fixture
def security_context():
    """Provide a security-first architecture test context."""
    return {
        "scan_owasp_top10": True,
        "detect_secrets": True,
        "dependency_audit": True,
        "rbac_enabled": True,
        "audit_log": [],
    }


@pytest.fixture
def review_levels():
    """Return the three-tier automated review pyramid."""
    return {
        "level_1_automated": [
            "formatting",
            "linting",
            "type_checking",
            "coverage",
        ],
        "level_2_flagging": [
            "complexity_anomaly",
            "security_warning",
            "performance_alert",
            "dependency_conflict",
        ],
        "level_3_human": [
            "architecture_change",
            "security_critical_path",
            "business_logic",
            "compliance_decision",
        ],
    }


# ---------------------------------------------------------------------------
# Pytest configuration
# ---------------------------------------------------------------------------

def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "slow: marks tests as slow-running")
    config.addinivalue_line("markers", "security: security-related tests")
    config.addinivalue_line("markers", "integration: integration tests requiring external services")
    config.addinivalue_line("markers", "agents: multi-agent coordination tests")
