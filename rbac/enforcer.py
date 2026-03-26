"""RBAC enforcement and access control logic."""

from dataclasses import dataclass
from typing import Dict, Optional
from datetime import datetime
from rbac.roles import Role, RoleManager, Permission
from rbac.permissions import PermissionMatrix
from rbac.audit_logger import AuditLogger


@dataclass
class AccessRequest:
    """Represents an access request."""
    user_id: str
    user_role: str
    action: str
    resource: Optional[str] = None
    context: Dict = None


@dataclass
class AccessDecision:
    """Result of access control decision."""
    allowed: bool
    reason: str
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


class RBACEnforcer:
    """Enforces RBAC rules and access control."""

    def __init__(self, audit_logger: Optional[AuditLogger] = None):
        """Initialize enforcer with optional audit logger."""
        self.audit_logger = audit_logger or AuditLogger()
        self.permission_matrix = PermissionMatrix()

    def validate_access(self, request: AccessRequest) -> AccessDecision:
        """
        Validate if a user can perform an action.

        Args:
            request: Access request

        Returns:
            AccessDecision with allow/deny reasoning
        """
        # Get role
        role = RoleManager.get_role(request.user_role)
        if not role:
            decision = AccessDecision(
                allowed=False,
                reason=f"Unknown role: {request.user_role}",
            )
            self.audit_logger.log_access(request, decision)
            return decision

        # Special case: bash commands
        if request.action.lower().startswith("bash"):
            allowed = self.permission_matrix.validate_bash_command(role, request.resource)
            decision = AccessDecision(
                allowed=allowed,
                reason=(
                    f"Bash command allowed"
                    if allowed
                    else f"Bash command denied for role {role.name}"
                ),
            )
        else:
            # Standard action validation
            allowed = self.permission_matrix.can_perform_action(
                role, request.action, request.resource
            )
            decision = AccessDecision(
                allowed=allowed,
                reason=(
                    f"Action '{request.action}' allowed"
                    if allowed
                    else f"Action '{request.action}' denied for role {role.name}"
                ),
            )

        # Log access attempt
        self.audit_logger.log_access(request, decision)

        return decision

    def check_template_access(self, user_role: str, template_name: str) -> bool:
        """Check if user role can access a specific template."""
        role = RoleManager.get_role(user_role)
        if not role:
            return False

        return template_name in role.allowed_templates

    def get_user_capabilities(self, user_role: str) -> Dict:
        """Get all capabilities available to a role."""
        role = RoleManager.get_role(user_role)
        if not role:
            return {}

        return {
            "role_name": role.name,
            "department": role.department,
            "description": role.description,
            "max_concurrent_tasks": role.max_concurrent_tasks,
            "permissions": [p.value for p in role.permissions],
            "allowed_actions": list(self.permission_matrix.get_allowed_actions(role)),
            "allowed_templates": list(role.allowed_templates),
            "resource_restrictions": {
                action: list(self.permission_matrix.get_allowed_resources(role, action))
                for action in self.permission_matrix.get_allowed_actions(role)
            },
        }

    def get_audit_trail(self, **filters) -> list:
        """Get audit trail for access attempts."""
        return self.audit_logger.query(**filters)

    def enforce_rate_limit(self, user_id: str, user_role: str) -> bool:
        """Check if user is within rate limits for their role."""
        role = RoleManager.get_role(user_role)
        if not role:
            return False

        concurrent_tasks = self.audit_logger.get_concurrent_task_count(user_id)
        return concurrent_tasks < role.max_concurrent_tasks

    def grant_temporary_permission(
        self,
        user_id: str,
        permission: str,
        duration_minutes: int = 60,
    ) -> bool:
        """
        Grant temporary elevated permission to a user.

        Note: This requires special audit logging.
        """
        # Log the permission grant
        self.audit_logger.log_permission_change(
            user_id=user_id,
            permission=permission,
            action="grant_temporary",
            duration_minutes=duration_minutes,
        )
        # In production, this would update a cache with expiration
        return True

    def revoke_permission(self, user_id: str, permission: str) -> bool:
        """Revoke a user's permission."""
        self.audit_logger.log_permission_change(
            user_id=user_id,
            permission=permission,
            action="revoke",
        )
        return True

    def validate_action_batch(self, requests: list) -> Dict:
        """Validate multiple actions in batch."""
        results = {}
        for i, request in enumerate(requests):
            decision = self.validate_access(request)
            results[f"action_{i}"] = {
                "allowed": decision.allowed,
                "reason": decision.reason,
            }
        return results

    def get_compliance_report(self, days: int = 30) -> Dict:
        """Generate compliance report for audit trail."""
        trail = self.audit_logger.get_recent_actions(days=days)

        total_requests = len(trail)
        allowed_count = sum(1 for entry in trail if entry.get("allowed", False))
        denied_count = total_requests - allowed_count

        denied_by_role = {}
        for entry in trail:
            if not entry.get("allowed"):
                role = entry.get("user_role", "unknown")
                denied_by_role[role] = denied_by_role.get(role, 0) + 1

        return {
            "period_days": days,
            "total_access_requests": total_requests,
            "allowed": allowed_count,
            "denied": denied_count,
            "allow_rate": (
                (allowed_count / total_requests * 100) if total_requests > 0 else 0
            ),
            "denied_by_role": denied_by_role,
        }
