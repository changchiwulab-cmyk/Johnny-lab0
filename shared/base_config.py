"""統一的配置基類。

所有配置類應該繼承 BaseConfig，
提供一致的配置屬性和方法。
"""

from dataclasses import dataclass
from typing import Dict


@dataclass
class BaseConfig:
    """所有配置類的基類。"""
    enabled: bool = True
    timeout: int = 10
    description: str = ""

    def to_dict(self) -> Dict:
        """轉換為字典。"""
        return {
            'enabled': self.enabled,
            'timeout': self.timeout,
            'description': self.description,
        }

    def is_enabled(self) -> bool:
        """檢查是否啟用。"""
        return self.enabled
