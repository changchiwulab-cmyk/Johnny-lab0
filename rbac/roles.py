"""Role definitions for cross-team enablement with RBAC."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Set


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


@dataclass
class Role:
    """Represents a user role with permissions."""
    name: str
    permissions: Set[Permission]
    description: str
    department: str
    max_concurrent_tasks: int = 10
    allowed_templates: Set[str] = field(default_factory=set)


class RoleManager:
    """Manages role definitions and role hierarchy."""

    # Standard roles with permissions
    DEVELOPER = Role(
        name="developer",
        permissions={
            Permission.READ,
            Permission.WRITE,
            Permission.EDIT,
            Permission.BASH_ALL,
            Permission.BASH_GIT,
        },
        description="Full development access",
        department="engineering",
        max_concurrent_tasks=20,
        allowed_templates={
            "legal_review",
            "ops_automation",
            "marketing_report",
            "custom_template",
        },
    )

    ENGINEER_LEAD = Role(
        name="engineer_lead",
        permissions={
            Permission.READ,
            Permission.WRITE,
            Permission.EDIT,
            Permission.BASH_ALL,
            Permission.BASH_GIT,
        },
        description="Engineering team lead with full access",
        department="engineering",
        max_concurrent_tasks=20,
        allowed_templates={
            "legal_review",
            "ops_automation",
            "marketing_report",
            "custom_template",
        },
    )

    SECURITY_TEAM = Role(
        name="security_team",
        permissions={
            Permission.READ,
            Permission.BASH_AUDIT,
            Permission.BASH_SEARCH,
        },
        description="Security team member with audit access",
        department="security",
        max_concurrent_tasks=10,
        allowed_templates={"legal_review"},
    )

    LEGAL_TEAM = Role(
        name="legal_team",
        permissions={
            Permission.READ,
            Permission.EDIT,
        },
        description="Legal team member with document editing",
        department="legal",
        max_concurrent_tasks=5,
        allowed_templates={"legal_review"},
    )

    OPERATIONS = Role(
        name="operations",
        permissions={
            Permission.READ,
            Permission.EDIT,
            Permission.BASH_NPM,
        },
        description="Operations team with automation access",
        department="operations",
        max_concurrent_tasks=10,
        allowed_templates={"ops_automation"},
    )

    MARKETING = Role(
        name="marketing",
        permissions={
            Permission.READ,
            Permission.EDIT,
        },
        description="Marketing team with reporting access",
        department="marketing",
        max_concurrent_tasks=5,
        allowed_templates={"marketing_report"},
    )

    # Role registry
    ROLES = {
        "developer": DEVELOPER,
        "engineer_lead": ENGINEER_LEAD,
        "security_team": SECURITY_TEAM,
        "legal_team": LEGAL_TEAM,
        "operations": OPERATIONS,
        "marketing": MARKETING,
    }

    @classmethod
    def get_role(cls, role_name: str) -> Role:
        """Get a role by name."""
        return cls.ROLES.get(role_name)

    @classmethod
    def get_all_roles(cls) -> Set[Role]:
        """Get all registered roles."""
        return set(cls.ROLES.values())

    @classmethod
    def get_roles_by_department(cls, department: str) -> Set[Role]:
        """Get all roles in a specific department."""
        return {
            role for role in cls.ROLES.values() if role.department == department
        }

    @classmethod
    def get_roles_with_permission(cls, permission: Permission) -> Set[Role]:
        """Get all roles that have a specific permission."""
        return {
            role for role in cls.ROLES.values() if permission in role.permissions
        }

    @classmethod
    def get_roles_with_template(cls, template_name: str) -> Set[Role]:
        """Get all roles that can access a specific template."""
        return {
            role for role in cls.ROLES.values()
            if template_name in role.allowed_templates
        }

    @classmethod
    def add_custom_role(cls, role: Role) -> bool:
        """Add a custom role to the registry."""
        if role.name in cls.ROLES:
            return False  # Role already exists
        cls.ROLES[role.name] = role
        return True

    @classmethod
    def update_role(cls, role_name: str, updates: dict) -> bool:
        """Update an existing role."""
        if role_name not in cls.ROLES:
            return False

        role = cls.ROLES[role_name]
        for key, value in updates.items():
            if hasattr(role, key):
                setattr(role, key, value)
        return True

    @classmethod
    def remove_role(cls, role_name: str) -> bool:
        """Remove a role from the registry."""
        if role_name in cls.ROLES:
            del cls.ROLES[role_name]
            return True
        return False
