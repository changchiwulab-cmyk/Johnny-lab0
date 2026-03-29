"""Configuration manager for Johnny-lab0."""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
from config_manager.models import ReviewConfig, RBACConfig, SecurityConfig
from config_manager.models import (
    Layer1Config, Layer2Config, Layer3Config,
    CoverageConfig, ComplexityConfig, ApprovalRuleConfig,
    RoleConfig, EnforcementConfig,
    ThreatDetectionConfig, ScanningConfig, ComplianceConfig,
)


class ConfigManager:
    """Unified configuration manager for all modules."""

    def __init__(self, config_dir: str = ".", env: str = "dev"):
        """
        Initialize ConfigManager.

        Args:
            config_dir: Directory containing configuration JSON files
            env: Environment (dev, prod, test)
        """
        self.config_dir = Path(config_dir)
        self.env = env
        self._review_config: Optional[ReviewConfig] = None
        self._rbac_config: Optional[RBACConfig] = None
        self._security_config: Optional[SecurityConfig] = None

    def _load_json(self, filename: str) -> Dict[str, Any]:
        """Load JSON configuration file."""
        file_path = self.config_dir / filename
        if not file_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {file_path}")

        with open(file_path, 'r') as f:
            return json.load(f)

    def get_review_config(self) -> ReviewConfig:
        """Get review configuration (lazy loaded)."""
        if self._review_config is None:
            try:
                config_dict = self._load_json("review_config.json")
                self._review_config = self._parse_review_config(config_dict)
            except Exception as e:
                print(f"Warning: Failed to load review_config.json: {e}")
                self._review_config = ReviewConfig()  # Use defaults
        return self._review_config

    def get_rbac_config(self) -> RBACConfig:
        """Get RBAC configuration (lazy loaded)."""
        if self._rbac_config is None:
            try:
                config_dict = self._load_json("role_config.json")
                self._rbac_config = self._parse_rbac_config(config_dict)
            except Exception as e:
                print(f"Warning: Failed to load role_config.json: {e}")
                self._rbac_config = RBACConfig()  # Use defaults
        return self._rbac_config

    def get_security_config(self) -> SecurityConfig:
        """Get security configuration (lazy loaded)."""
        if self._security_config is None:
            try:
                config_dict = self._load_json("security_config.json")
                self._security_config = self._parse_security_config(config_dict)
            except Exception as e:
                print(f"Warning: Failed to load security_config.json: {e}")
                self._security_config = SecurityConfig()  # Use defaults
        return self._security_config

    @staticmethod
    def _parse_review_config(config_dict: Dict) -> ReviewConfig:
        """Parse review configuration from dictionary."""
        coverage_cfg = config_dict.get("layer1", {}).get("coverage", {})
        coverage = CoverageConfig(
            enabled=coverage_cfg.get("enabled", True),
            minimum_percentage=coverage_cfg.get("minimum_percentage", 85.0),
            fail_under=coverage_cfg.get("fail_under", 70.0),
            timeout=coverage_cfg.get("timeout", 30),
        )
        layer1 = Layer1Config(
            enabled=config_dict.get("layer1", {}).get("enabled", True),
            coverage=coverage,
        )

        complexity_cfg = config_dict.get("layer2", {}).get("complexity", {})
        complexity = ComplexityConfig(
            enabled=complexity_cfg.get("enabled", True),
            cyclomatic_max=complexity_cfg.get("cyclomatic_max", 10.0),
            cognitive_max=complexity_cfg.get("cognitive_max", 15.0),
            timeout=complexity_cfg.get("timeout", 15),
        )
        layer2 = Layer2Config(enabled=config_dict.get("layer2", {}).get("enabled", True), complexity=complexity)

        layer3_dict = config_dict.get("layer3", {})
        approval_rules = []
        for rule in layer3_dict.get("approval_rules", []):
            approval_rules.append(
                ApprovalRuleConfig(
                    name=rule.get("name", ""),
                    min_reviewers=rule.get("min_reviewers", 1),
                    required_roles=rule.get("required_roles", []),
                    categories=rule.get("categories", []),
                )
            )
        layer3 = Layer3Config(
            enabled=layer3_dict.get("enabled", True),
            approval_rules=approval_rules if approval_rules else None,
        )

        return ReviewConfig(layer1=layer1, layer2=layer2, layer3=layer3)

    @staticmethod
    def _parse_rbac_config(config_dict: Dict) -> RBACConfig:
        """Parse RBAC configuration from dictionary."""
        roles = {}
        for role_name, role_cfg in config_dict.get("roles", {}).items():
            roles[role_name] = RoleConfig(
                name=role_cfg.get("name", role_name),
                department=role_cfg.get("department", ""),
                permissions=role_cfg.get("permissions", []),
                max_concurrent_tasks=role_cfg.get("max_concurrent_tasks", 10),
                allowed_templates=role_cfg.get("allowed_templates", []),
            )

        enforcement_cfg = config_dict.get("enforcement", {})
        enforcement = EnforcementConfig(
            strict_mode=enforcement_cfg.get("strict_mode", True),
            audit_logging=enforcement_cfg.get("audit_logging", True),
            rate_limiting=enforcement_cfg.get("rate_limiting", False),
            cache_ttl_seconds=enforcement_cfg.get("cache_ttl_seconds", 3600),
        )

        return RBACConfig(roles=roles, enforcement=enforcement)

    @staticmethod
    def _parse_security_config(config_dict: Dict) -> SecurityConfig:
        """Parse security configuration from dictionary."""
        threat_cfg = config_dict.get("threat_detection", {})
        threat_detection = ThreatDetectionConfig(
            enabled=threat_cfg.get("enabled", True),
            patterns_enabled=threat_cfg.get("patterns_enabled", True),
            secret_detection=threat_cfg.get("secret_detection", True),
        )

        scanning_cfg = config_dict.get("scanning", {})
        scanning = ScanningConfig(
            npm_audit=scanning_cfg.get("npm_audit", False),
            pip_audit=scanning_cfg.get("pip_audit", False),
            code_scanning=scanning_cfg.get("code_scanning", True),
            dependency_scanning=scanning_cfg.get("dependency_scanning", False),
        )

        compliance_cfg = config_dict.get("compliance", {})
        compliance = ComplianceConfig(
            standards=compliance_cfg.get("standards", ["OWASP"]),
            coverage_target=compliance_cfg.get("coverage_target", 0.9),
        )

        return SecurityConfig(
            threat_detection=threat_detection,
            scanning=scanning,
            compliance=compliance,
        )

    def reload(self) -> None:
        """Reload all configurations."""
        self._review_config = None
        self._rbac_config = None
        self._security_config = None

    def get_config_summary(self) -> Dict[str, Any]:
        """Get a summary of all loaded configurations."""
        return {
            "environment": self.env,
            "config_dir": str(self.config_dir),
            "review_config": self.get_review_config().__dict__,
            "rbac_config": self.get_rbac_config().__dict__,
            "security_config": self.get_security_config().__dict__,
        }
