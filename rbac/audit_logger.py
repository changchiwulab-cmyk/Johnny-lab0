"""Audit logging for RBAC system."""

import json
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from collections import defaultdict


@dataclass
class AuditEntry:
    """Single audit log entry."""
    timestamp: str
    user_id: str
    user_role: str
    action: str
    resource: Optional[str]
    allowed: bool
    reason: str
    context: Optional[Dict] = None


class AuditLogger:
    """Manages audit logging for access control."""

    def __init__(self, max_entries: int = 100000):
        """Initialize audit logger."""
        self.logs: List[AuditEntry] = []
        self.max_entries = max_entries
        self.permission_changes: List[Dict] = []
        self.concurrent_tasks: Dict[str, int] = defaultdict(int)

    def log_access(self, request, decision) -> None:
        """Log an access request and decision."""
        entry = AuditEntry(
            timestamp=decision.timestamp.isoformat(),
            user_id=request.user_id,
            user_role=request.user_role,
            action=request.action,
            resource=request.resource,
            allowed=decision.allowed,
            reason=decision.reason,
            context=request.context,
        )

        self.logs.append(entry)

        # Prune old entries if exceeding limit
        if len(self.logs) > self.max_entries:
            self.logs = self.logs[-self.max_entries :]

    def log_permission_change(
        self,
        user_id: str,
        permission: str,
        action: str,
        duration_minutes: int = None,
    ) -> None:
        """Log a permission grant or revocation."""
        change = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "permission": permission,
            "action": action,  # grant, revoke, grant_temporary
            "duration_minutes": duration_minutes,
        }
        self.permission_changes.append(change)

    def log_task_start(self, user_id: str, task_id: str) -> None:
        """Log start of a task for rate limiting."""
        self.concurrent_tasks[user_id] = self.concurrent_tasks.get(user_id, 0) + 1

    def log_task_end(self, user_id: str, task_id: str) -> None:
        """Log end of a task."""
        self.concurrent_tasks[user_id] = max(0, self.concurrent_tasks.get(user_id, 1) - 1)

    def get_concurrent_task_count(self, user_id: str) -> int:
        """Get number of concurrent tasks for a user."""
        return self.concurrent_tasks.get(user_id, 0)

    def query(self, **filters) -> List[Dict]:
        """
        Query audit logs with filters.

        Supported filters:
        - user_id: Filter by user
        - user_role: Filter by role
        - action: Filter by action
        - allowed: Filter by allow/deny (True/False)
        - start_time: Filter by start timestamp
        - end_time: Filter by end timestamp
        - resource: Filter by resource
        """
        results = []

        for entry in self.logs:
            # Apply filters
            if "user_id" in filters and entry.user_id != filters["user_id"]:
                continue
            if "user_role" in filters and entry.user_role != filters["user_role"]:
                continue
            if "action" in filters and entry.action != filters["action"]:
                continue
            if "allowed" in filters and entry.allowed != filters["allowed"]:
                continue
            if "resource" in filters and entry.resource != filters["resource"]:
                continue

            # Time range filtering
            if "start_time" in filters:
                entry_time = datetime.fromisoformat(entry.timestamp)
                if entry_time < filters["start_time"]:
                    continue
            if "end_time" in filters:
                entry_time = datetime.fromisoformat(entry.timestamp)
                if entry_time > filters["end_time"]:
                    continue

            results.append(asdict(entry))

        return results

    def get_recent_actions(self, days: int = 30) -> List[Dict]:
        """Get actions from the last N days."""
        cutoff_time = datetime.utcnow() - timedelta(days=days)
        return self.query(start_time=cutoff_time)

    def get_user_audit_trail(self, user_id: str, limit: int = 100) -> List[Dict]:
        """Get audit trail for a specific user."""
        entries = self.query(user_id=user_id)
        return entries[-limit:]  # Return last N entries

    def get_denied_actions(self, limit: int = 100) -> List[Dict]:
        """Get all denied access attempts."""
        entries = self.query(allowed=False)
        return entries[-limit:]

    def get_actions_by_role(self, user_role: str) -> List[Dict]:
        """Get all actions performed by a role."""
        return self.query(user_role=user_role)

    def export_logs(self, format: str = "json") -> str:
        """Export audit logs in specified format."""
        if format == "json":
            return json.dumps([asdict(entry) for entry in self.logs], indent=2)
        elif format == "csv":
            import csv
            import io

            output = io.StringIO()
            if self.logs:
                fieldnames = asdict(self.logs[0]).keys()
                writer = csv.DictWriter(output, fieldnames=fieldnames)
                writer.writeheader()
                for entry in self.logs:
                    writer.writerow(asdict(entry))
            return output.getvalue()
        else:
            raise ValueError(f"Unsupported format: {format}")

    def clear_old_logs(self, days: int = 90) -> int:
        """Remove logs older than specified days."""
        cutoff_time = datetime.utcnow() - timedelta(days=days)
        initial_count = len(self.logs)

        self.logs = [
            entry
            for entry in self.logs
            if datetime.fromisoformat(entry.timestamp) > cutoff_time
        ]

        removed_count = initial_count - len(self.logs)
        return removed_count

    def get_statistics(self) -> Dict:
        """Get statistics about audit logs."""
        if not self.logs:
            return {
                "total_entries": 0,
                "allowed_count": 0,
                "denied_count": 0,
            }

        allowed_count = sum(1 for entry in self.logs if entry.allowed)
        denied_count = len(self.logs) - allowed_count

        # Count by role
        by_role = defaultdict(int)
        for entry in self.logs:
            by_role[entry.user_role] += 1

        # Count by action
        by_action = defaultdict(int)
        for entry in self.logs:
            by_action[entry.action] += 1

        return {
            "total_entries": len(self.logs),
            "allowed_count": allowed_count,
            "denied_count": denied_count,
            "allow_rate": (
                (allowed_count / len(self.logs) * 100) if self.logs else 0
            ),
            "by_role": dict(by_role),
            "by_action": dict(by_action),
            "unique_users": len(set(entry.user_id for entry in self.logs)),
            "earliest_entry": (
                self.logs[0].timestamp if self.logs else None
            ),
            "latest_entry": (
                self.logs[-1].timestamp if self.logs else None
            ),
        }
