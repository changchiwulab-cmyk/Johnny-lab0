"""Security-first architecture module."""

from security.threat_detector import ThreatDetector
from security.vulnerability_scanner import VulnerabilityScanner
from shared.result_models import Finding as Threat, RiskLevel as ThreatSeverity  # Backward compatibility aliases

__all__ = [
    "ThreatDetector",
    "Threat",  # Backward compatibility alias for Finding
    "ThreatSeverity",  # Backward compatibility alias for RiskLevel
    "VulnerabilityScanner",
]
