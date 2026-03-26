# RBAC System Guide (Trend 7 - W5-W6)

## Overview

Role-Based Access Control (RBAC) system for cross-team enablement, allowing non-technical departments (legal, operations, marketing) to use specialized automation templates.

## Roles

### Developer
- **Department**: Engineering
- **Permissions**: Full access (Read, Write, Edit, Bash)
- **Templates**: All
- **Max Concurrent Tasks**: 20

### Engineer Lead
- **Department**: Engineering
- **Permissions**: Full access
- **Templates**: All
- **Max Concurrent Tasks**: 20

### Security Team
- **Department**: Security
- **Permissions**: Read, Audit/Scan
- **Templates**: Legal Review
- **Max Concurrent Tasks**: 10

### Legal Team
- **Department**: Legal
- **Permissions**: Read, Edit
- **Templates**: Legal Review
- **Max Concurrent Tasks**: 5

### Operations
- **Department**: Operations
- **Permissions**: Read, Edit, Bash(npm)
- **Templates**: Operations Automation
- **Max Concurrent Tasks**: 10

### Marketing
- **Department**: Marketing
- **Permissions**: Read, Edit
- **Templates**: Marketing Reports
- **Max Concurrent Tasks**: 5

## Usage

### Check Access
```python
from rbac import RBACEnforcer, AccessRequest

enforcer = RBACEnforcer()
request = AccessRequest(
    user_id="user123",
    user_role="legal_team",
    action="edit",
    resource="contract.md"
)
decision = enforcer.validate_access(request)
print(f"Access: {decision.allowed}")  # True
```

### Execute Template
```python
from templates import LegalReviewTemplate
import asyncio

async def review_contract():
    template = LegalReviewTemplate()
    result = await template.run({
        "contract_text": "...",
        "template_name": "standard"
    })
    print(result.output["summary"])

asyncio.run(review_contract())
```

### Check User Capabilities
```python
capabilities = enforcer.get_user_capabilities("legal_team")
print(f"Allowed Actions: {capabilities['allowed_actions']}")
print(f"Templates: {capabilities['allowed_templates']}")
```

## Audit Logging

All access attempts are logged for compliance:

```python
trail = enforcer.get_audit_trail(user_id="user123", limit=100)
for entry in trail:
    print(f"{entry['action']} - {entry['allowed']}")
```

## Configuration

See `role_config.json` for detailed configuration of:
- Role definitions
- Permission mappings
- Template access control
- Enforcement rules

## Integration with W1-W4

- **W1-W2 Orchestrator**: RBAC validates agent execution
- **W3-W4 Review System**: Templates output reviewed by layer 1-3
- **Combined**: Non-technical users get guided templates → auto-reviewed → delivered

## Success Metrics

- ✅ 5+ departments enabled
- ✅ RBAC coverage 100%
- ✅ Audit trail complete
- ✅ Template execution < 2 minutes
- ✅ Test coverage > 90%
