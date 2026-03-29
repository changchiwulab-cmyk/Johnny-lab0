"""Unified configuration management for Johnny-lab0."""

from config_manager.manager import ConfigManager
from config_manager.models import ReviewConfig, RBACConfig, SecurityConfig

__all__ = [
    "ConfigManager",
    "ReviewConfig",
    "RBACConfig",
    "SecurityConfig",
]

# Singleton instance
_config_manager = None


def get_config() -> ConfigManager:
    """Get the global ConfigManager instance."""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager
