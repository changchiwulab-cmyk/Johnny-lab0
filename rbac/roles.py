"""Role definitions for cross-team enablement with RBAC."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Set, Dict, Optional
from config_manager import get_config


class Permission(Enum):
    """Permission types for RBAC system."""
    READ = "Read"
    WRITE = "Write"
    EDIT = "Edit"
    BASH_NPM = "Bash(npm:*)"
    BASH_GIT = "Bash(git:*)"
    BASH_AUDIT = "Bash(audit|scan)"
    BASH_SEARCH = "Bash(search)"
    BASH_ALL = "Bash(*)"


@dataclass(frozen=True)
class Role:
    """Represents a user role with permissions."""
    name: str
    permissions: frozenset
    description: str
    department: str
    max_concurrent_tasks: int = 10
    allowed_templates: frozenset = field(default_factory=frozenset)


class RoleManager:
    """Manages role definitions and role hierarchy."""

    # Role registry - dynamically loaded from config
    ROLES: Dict[str, Role] = {}

    @classmethod
    def _load_roles_from_config(cls) -> Dict[str, Role]:
        """Load roles from ConfigManager."""
        try:
            config = get_config()
            rbac_config = config.get_rbac_config()
            roles = {}

            for role_name, role_cfg in rbac_config.roles.items():
                # Convert permission strings to Permission enums
                permissions = set()
                for perm_str in role_cfg.permissions:
                    # Try to find matching Permission enum value
                    try:
                        # Try direct enum name match (uppercase)
                        perm_enum = Permission[perm_str.upper().replace("-", "_").replace("(", "").replace(")", "").replace("*", "ALL")]
                        permissions.add(perm_enum)
                    except (KeyError, ValueError):
                        # If direct match fails, try to find by value
                        for perm in Permission:
                            if perm.value == perm_str:
                                permissions.add(perm)
                                break

                roles[role_name] = Role(
                    name=role_cfg.name,
                    permissions=frozenset(permissions),
                    description=f"{role_cfg.name} - {role_cfg.department}",
                    department=role_cfg.department,
                    max_concurrent_tasks=role_cfg.max_concurrent_tasks,
                    allowed_templates=frozenset(role_cfg.allowed_templates or []),
                )

            return roles
        except Exception as e:
            # Fallback to empty dict if config loading fails
            print(f"Warning: Failed to load roles from config: {e}")
            return {}

    @classmethod
    def _init_default_roles(cls):
        """Initialize with default roles if config is empty."""
        if not cls.ROLES:
            cls.ROLES = {
                "developer": Role(
                    name="developer",
                    permissions=frozenset({
                        Permission.READ,
                        Permission.WRITE,
                        Permission.EDIT,
                        Permission.BASH_ALL,
                    }),
                    description="Full development access",
                    department="engineering",
                    max_concurrent_tasks=20,
                    allowed_templates=frozenset({"legal_review", "ops_automation", "marketing_report"}),
                ),
                "engineer_lead": Role(
                    name="engineer_lead",
                    permissions=frozenset({
                        Permission.READ,
                        Permission.WRITE,
                        Permission.EDIT,
                        Permission.BASH_ALL,
                    }),
                    description="Engineering team lead with full access",
                    department="engineering",
                    max_concurrent_tasks=20,
                    allowed_templates=frozenset({"legal_review", "ops_automation", "marketing_report"}),
                ),
                "security_team": Role(
                    name="security_team",
                    permissions=frozenset({Permission.READ, Permission.BASH_AUDIT, Permission.BASH_SEARCH}),
                    description="Security team member with audit access",
                    department="security",
                    max_concurrent_tasks=10,
                    allowed_templates=frozenset({"legal_review"}),
                ),
                "legal_team": Role(
                    name="legal_team",
                    permissions=frozenset({Permission.READ, Permission.EDIT}),
                    description="Legal team member with document editing",
                    department="legal",
                    max_concurrent_tasks=5,
                    allowed_templates=frozenset({"legal_review"}),
                ),
                "operations": Role(
                    name="operations",
                    permissions=frozenset({Permission.READ, Permission.EDIT, Permission.BASH_NPM}),
                    description="Operations team with automation access",
                    department="operations",
                    max_concurrent_tasks=10,
                    allowed_templates=frozenset({"ops_automation"}),
                ),
                "marketing": Role(
                    name="marketing",
                    permissions=frozenset({Permission.READ, Permission.EDIT}),
                    description="Marketing team with reporting access",
                    department="marketing",
                    max_concurrent_tasks=5,
                    allowed_templates=frozenset({"marketing_report"}),
                ),
            }

    @classmethod
    def _ensure_initialized(cls):
        """Ensure roles are loaded."""
        if not cls.ROLES:
            # Try to load from config, fallback to defaults
            loaded = cls._load_roles_from_config()
            if loaded:
                cls.ROLES = loaded
            else:
                cls._init_default_roles()

    @classmethod
    def get_role(cls, role_name: str) -> Optional[Role]:
        """Get a role by name."""
        cls._ensure_initialized()
        return cls.ROLES.get(role_name)

    @classmethod
    def get_all_roles(cls) -> Set[Role]:
        """Get all registered roles."""
        cls._ensure_initialized()
        return set(cls.ROLES.values())

    @classmethod
    def get_roles_by_department(cls, department: str) -> Set[Role]:
        """Get all roles in a specific department."""
        cls._ensure_initialized()
        return {
            role for role in cls.ROLES.values() if role.department == department
        }

    @classmethod
    def get_roles_with_permission(cls, permission: Permission) -> Set[Role]:
        """Get all roles that have a specific permission."""
        cls._ensure_initialized()
        return {
            role for role in cls.ROLES.values() if permission in role.permissions
        }

    @classmethod
    def get_roles_with_template(cls, template_name: str) -> Set[Role]:
        """Get all roles that can access a specific template."""
        cls._ensure_initialized()
        return {
            role for role in cls.ROLES.values()
            if template_name in role.allowed_templates
        }

    @classmethod
    def add_custom_role(cls, role: Role) -> bool:
        """Add a custom role to the registry."""
        cls._ensure_initialized()
        if role.name in cls.ROLES:
            return False  # Role already exists
        cls.ROLES[role.name] = role
        return True

    @classmethod
    def update_role(cls, role_name: str, updates: dict) -> bool:
        """Update an existing role."""
        import dataclasses
        cls._ensure_initialized()
        if role_name not in cls.ROLES:
            return False

        role = cls.ROLES[role_name]
        valid_updates = {k: v for k, v in updates.items() if hasattr(role, k)}
        if valid_updates:
            cls.ROLES[role_name] = dataclasses.replace(role, **valid_updates)
        return True

    @classmethod
    def remove_role(cls, role_name: str) -> bool:
        """Remove a role from the registry."""
        cls._ensure_initialized()
        if role_name in cls.ROLES:
            del cls.ROLES[role_name]
            return True
        return False


# Initialize roles when module is imported
RoleManager._ensure_initialized()
