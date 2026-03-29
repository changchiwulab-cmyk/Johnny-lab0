"""Tests for RBAC system."""

import pytest
from rbac.roles import Role, RoleManager, Permission
from rbac.permissions import PermissionMatrix
from rbac.enforcer import RBACEnforcer, AccessRequest
from rbac.audit_logger import AuditLogger


class TestRoleManager:
    """Test role definitions and management."""

    def test_get_role_developer(self):
        """Test getting developer role."""
        role = RoleManager.get_role("developer")
        assert role is not None
        assert role.name == "developer"
        assert Permission.BASH_ALL in role.permissions

    def test_get_all_roles(self):
        """Test getting all roles."""
        roles = RoleManager.get_all_roles()
        assert len(roles) >= 6

    def test_get_roles_by_department(self):
        """Test filtering roles by department."""
        eng_roles = RoleManager.get_roles_by_department("engineering")
        assert len(eng_roles) > 0

    def test_get_roles_with_permission(self):
        """Test filtering roles by permission."""
        roles = RoleManager.get_roles_with_permission(Permission.BASH_ALL)
        assert len(roles) > 0

    def test_add_custom_role(self):
        """Test adding custom role."""
        custom_role = Role(
            name="custom_test",
            permissions={Permission.READ},
            description="Test role",
            department="test"
        )
        success = RoleManager.add_custom_role(custom_role)
        assert success
        # Cleanup
        RoleManager.remove_role("custom_test")


class TestPermissionMatrix:
    """Test permission validation."""

    def test_developer_can_write(self):
        """Test developer can write code."""
        role = RoleManager.get_role("developer")
        assert PermissionMatrix.can_perform_action(role, "write")

    def test_legal_cannot_bash(self):
        """Test legal team cannot run bash."""
        role = RoleManager.get_role("legal_team")
        assert not PermissionMatrix.can_perform_action(role, "bash")

    def test_operations_can_npm(self):
        """Test operations role exists."""
        role = RoleManager.get_role("operations")
        assert role is not None
        assert role.name == "operations"
        assert role.department == "operations"

    def test_get_allowed_actions(self):
        """Test getting allowed actions."""
        role = RoleManager.get_role("developer")
        actions = PermissionMatrix.get_allowed_actions(role)
        assert "write" in actions
        assert "bash" in actions


class TestRBACEnforcer:
    """Test access control enforcement."""

    def test_enforcer_initialization(self):
        """Test enforcer initializes correctly."""
        enforcer = RBACEnforcer()
        assert enforcer is not None

    def test_allow_developer_action(self):
        """Test developer action is allowed."""
        enforcer = RBACEnforcer()
        request = AccessRequest(
            user_id="user1",
            user_role="developer",
            action="write",
            resource="code.py"
        )
        decision = enforcer.validate_access(request)
        assert decision.allowed

    def test_deny_legal_bash(self):
        """Test legal team cannot bash."""
        enforcer = RBACEnforcer()
        request = AccessRequest(
            user_id="user2",
            user_role="legal_team",
            action="bash",
            resource="npm install"
        )
        decision = enforcer.validate_access(request)
        assert not decision.allowed

    def test_get_user_capabilities(self):
        """Test getting user capabilities."""
        enforcer = RBACEnforcer()
        caps = enforcer.get_user_capabilities("developer")
        assert caps["role_name"] == "developer"
        assert len(caps["permissions"]) > 0

    def test_check_template_access(self):
        """Test template access control."""
        enforcer = RBACEnforcer()
        assert enforcer.check_template_access("developer", "legal_review")
        assert not enforcer.check_template_access("marketing", "legal_review")

    def test_rate_limiting(self):
        """Test concurrent task rate limiting."""
        enforcer = RBACEnforcer()
        # Should be within limit initially
        assert enforcer.enforce_rate_limit("user1", "developer")


class TestAuditLogger:
    """Test audit logging."""

    def test_log_access(self):
        """Test logging access attempts."""
        logger = AuditLogger()
        request = AccessRequest("user1", "developer", "write")
        from rbac.enforcer import AccessDecision
        from datetime import datetime
        decision = AccessDecision(True, "Allowed", datetime.utcnow())

        logger.log_access(request, decision)
        assert len(logger.logs) == 1

    def test_query_logs(self):
        """Test querying audit logs."""
        logger = AuditLogger()
        request = AccessRequest("user1", "developer", "write")
        from rbac.enforcer import AccessDecision
        from datetime import datetime
        decision = AccessDecision(True, "Allowed", datetime.utcnow())
        logger.log_access(request, decision)

        results = logger.query(user_id="user1")
        assert len(results) == 1

    def test_statistics(self):
        """Test audit log statistics."""
        logger = AuditLogger()
        stats = logger.get_statistics()
        assert "total_entries" in stats
        assert stats["total_entries"] == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
