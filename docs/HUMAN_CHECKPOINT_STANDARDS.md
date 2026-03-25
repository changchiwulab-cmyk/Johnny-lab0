# Human Checkpoint Standards (Layer 3)

**Version**: 1.0
**Date**: 2026-03-25
**Status**: Active

---

## Overview

Layer 3 defines when automated review must pause for human decision-making. The goal is to focus human attention on high-impact decisions while Layer 1 and Layer 2 handle routine quality and security checks.

---

## Trigger Conditions

Human review is **required** when any of the following conditions are met:

### 1. Architecture Decisions

- New external dependency added to `package.json`
- API endpoint created or modified
- Database schema changes
- New microservice or module boundary introduced
- Infrastructure configuration changes (CI/CD, deployment)

### 2. Security-Critical Code

- Authentication or authorization logic modified
- Cryptographic operations added or changed
- Secrets/credentials handling (even through env vars)
- CORS or CSP policy changes
- User input validation at system boundaries

### 3. Business Logic

- Payment or billing logic changes
- User-facing feature flag toggles
- Data migration scripts
- Compliance-relevant calculations (tax, regulatory)

### 4. Compliance

- License changes in dependencies
- Data privacy handling (PII, GDPR)
- Audit trail modifications
- Access control policy changes

---

## Escalation Protocol

```
Layer 2 detects anomaly
    |
    v
Severity = critical or blocker?
    |
    +-- YES --> Create human checkpoint
    |           - Add PR label: needs-human-review
    |           - Request review from CODEOWNERS
    |           - Block merge until approved
    |
    +-- NO --> Log warning, continue pipeline
```

### Escalation from Layer 2 Anomalies

| Anomaly Severity | Action                                                   |
| ---------------- | -------------------------------------------------------- |
| `info`           | Log only, no escalation                                  |
| `warning`        | Include in PR summary, no block                          |
| `critical`       | Create human checkpoint, block merge                     |
| `blocker`        | Create human checkpoint, block merge, notify immediately |

---

## Decision Template

When a human reviewer is triggered, they should document their decision:

```markdown
### Human Review Decision

- **Checkpoint ID**: [auto-generated]
- **Trigger**: [what caused escalation]
- **Decision**: APPROVE / REQUEST_CHANGES / DEFER
- **Rationale**: [1-2 sentences explaining the decision]
- **Conditions**: [any conditions for approval, e.g. "approved after security scan"]
- **Reviewer**: [name]
- **Date**: [ISO timestamp]
```

---

## SLA (Service Level Agreement)

| Priority | Target Response Time |
| -------- | -------------------- |
| Blocker  | < 15 minutes         |
| Critical | < 30 minutes         |
| Standard | < 2 hours            |

**Goal**: Average review cycle < 30 minutes (from Trend 4 KPI).

---

## Approver Requirements

| Decision Type     | Required Approvers | Approver Role                 |
| ----------------- | ------------------ | ----------------------------- |
| Architecture      | 2                  | Tech Lead + Senior Engineer   |
| Security-Critical | 2                  | Security Engineer + Tech Lead |
| Business Logic    | 1                  | Product Owner or Tech Lead    |
| Compliance        | 2                  | Legal + Security Engineer     |

---

## Integration with CI/CD

The GitHub Actions workflow (`automated-review.yml`) implements Layer 3 as follows:

1. **File pattern detection**: When changed files match sensitive patterns (auth, config, migrations), the `layer3-human-gate` job activates
2. **PR labeling**: Adds `needs-human-review` label automatically
3. **Review request**: Requests review from designated CODEOWNERS
4. **Merge protection**: Branch protection rules prevent merge without required approvals
