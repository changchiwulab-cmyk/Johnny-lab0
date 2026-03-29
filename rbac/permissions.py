"""Permission matrix and validation for RBAC."""

import re
from dataclasses import dataclass
from typing import Dict, Set
from rbac.roles import Permission, Role


@dataclass
class ResourcePattern:
    """Represents a resource access pattern."""
    pattern: str  # e.g., "*.py", "/etc/*", ".json"
    is_glob: bool = False


class PermissionMatrix:
    """Manages permission validation and access control."""

    # Permission-to-actions mapping
    PERMISSION_ACTIONS = {
        Permission.READ: {"read", "list", "view"},
        Permission.WRITE: {"write", "create", "append"},
        Permission.EDIT: {"edit", "modify", "update"},
        Permission.BASH_NPM: {"bash", "npm", "yarn"},
        Permission.BASH_GIT: {"bash", "git"},
        Permission.BASH_AUDIT: {"bash", "audit", "scan", "check"},
        Permission.BASH_SEARCH: {"bash", "search", "grep", "find"},
        Permission.BASH_ALL: {"bash", "*"},
    }

    # Resource access patterns
    RESOURCE_PATTERNS = {
        Permission.EDIT: [
            ResourcePattern("*.md"),
            ResourcePattern("*.json"),
            ResourcePattern(".claude/settings*"),
        ],
        Permission.BASH_NPM: [
            ResourcePattern("package*.json"),
            ResourcePattern("*.json"),
        ],
        Permission.BASH_GIT: [
            ResourcePattern(".git/*"),
            ResourcePattern(".gitignore"),
        ],
    }

    @classmethod
    def can_perform_action(
        cls,
        role: Role,
        action: str,
        resource: str = None,
    ) -> bool:
        """
        Check if a role can perform an action on a resource.

        Args:
            role: User role
            action: Action to perform (read, write, edit, bash, etc.)
            resource: Resource path (file, command, etc.)

        Returns:
            True if action is allowed, False otherwise
        """
        action_lower = action.lower()

        # Check each permission
        for permission in role.permissions:
            allowed_actions = cls.PERMISSION_ACTIONS.get(permission, set())

            # Check if action matches permission
            if action_lower in allowed_actions or "*" in allowed_actions:
                # If resource specified, validate it matches the permission
                if resource:
                    if cls._resource_matches_permission(permission, resource):
                        return True
                else:
                    return True

        return False

    @classmethod
    def get_allowed_actions(cls, role: Role) -> Set[str]:
        """Get all actions allowed by a role."""
        allowed = set()
        for permission in role.permissions:
            allowed.update(cls.PERMISSION_ACTIONS.get(permission, set()))
        return allowed

    @classmethod
    def get_allowed_resources(cls, role: Role, action: str) -> Set[str]:
        """Get all resources accessible for a specific action."""
        resources = set()

        for permission in role.permissions:
            if action.lower() in cls.PERMISSION_ACTIONS.get(permission, set()):
                patterns = cls.RESOURCE_PATTERNS.get(permission, [])
                for pattern in patterns:
                    resources.add(pattern.pattern)

        return resources

    @classmethod
    def _resource_matches_permission(cls, permission: Permission, resource: str) -> bool:
        """Check if a resource matches the permission's allowed patterns."""
        patterns = cls.RESOURCE_PATTERNS.get(permission)

        if not patterns:
            # No resource restrictions for this permission
            return True

        for pattern in patterns:
            if cls._glob_match(pattern.pattern, resource):
                return True

        return False

    @classmethod
    def _glob_match(cls, pattern: str, resource: str) -> bool:
        """Check if resource matches a glob pattern."""
        # Convert glob pattern to regex
        regex_pattern = pattern.replace(".", r"\.")
        regex_pattern = regex_pattern.replace("*", ".*")
        regex_pattern = f"^{regex_pattern}$"

        try:
            return bool(re.match(regex_pattern, resource))
        except re.error:
            return False

    @classmethod
    def validate_bash_command(cls, role: Role, command: str) -> bool:
        """Validate if role can execute a specific bash command."""
        command_lower = command.lower()

        # Extract command name
        command_name = command_lower.split()[0] if command_lower else ""

        # Check permissions
        if Permission.BASH_ALL in role.permissions:
            return True

        if command_name.startswith("npm") or command_name.startswith("yarn"):
            return Permission.BASH_NPM in role.permissions

        if command_name.startswith("git"):
            return Permission.BASH_GIT in role.permissions

        if any(cmd in command_name for cmd in ["audit", "scan", "check", "snyk"]):
            return Permission.BASH_AUDIT in role.permissions

        if any(cmd in command_name for cmd in ["grep", "find", "search"]):
            return Permission.BASH_SEARCH in role.permissions

        return False

    @classmethod
    def get_permission_tree(cls) -> Dict:
        """Get permission hierarchy tree."""
        return {
            "read": {
                "actions": cls.PERMISSION_ACTIONS[Permission.READ],
                "scope": "view-only",
            },
            "write": {
                "actions": cls.PERMISSION_ACTIONS[Permission.WRITE],
                "scope": "create-append",
            },
            "edit": {
                "actions": cls.PERMISSION_ACTIONS[Permission.EDIT],
                "scope": "modify-existing",
                "resources": [p.pattern for p in cls.RESOURCE_PATTERNS.get(Permission.EDIT, [])],
            },
            "bash": {
                "npm": {
                    "actions": cls.PERMISSION_ACTIONS[Permission.BASH_NPM],
                    "scope": "npm-yarn-commands",
                },
                "git": {
                    "actions": cls.PERMISSION_ACTIONS[Permission.BASH_GIT],
                    "scope": "git-commands",
                },
                "audit": {
                    "actions": cls.PERMISSION_ACTIONS[Permission.BASH_AUDIT],
                    "scope": "security-scanning",
                },
                "search": {
                    "actions": cls.PERMISSION_ACTIONS[Permission.BASH_SEARCH],
                    "scope": "search-commands",
                },
            },
        }
