# Anomaly Escalation Protocol

**Version**: 1.0
**Date**: 2026-03-25
**Status**: Active

---

## Overview

This document defines how anomalies detected by Layer 2 (Security & Anomaly Detection) are classified, routed, and resolved. The goal is to ensure critical issues reach human reviewers quickly while avoiding alert fatigue from low-severity findings.

---

## Severity Levels

| Level        | Definition                      | Example                                   | Auto-Action                         |
| ------------ | ------------------------------- | ----------------------------------------- | ----------------------------------- |
| **info**     | Minor observation, no risk      | Unused import detected                    | Log only                            |
| **warning**  | Potential issue, non-blocking   | Code complexity > 10, outdated dependency | Include in PR summary               |
| **critical** | Confirmed risk, blocks merge    | Known CVE in dependency, secret in code   | Block merge, request human review   |
| **blocker**  | Immediate threat, halt pipeline | Active exploit vector, leaked credentials | Block merge, immediate notification |

---

## Routing Rules

### By Category

| Category       | Owner             | Escalation Path                         |
| -------------- | ----------------- | --------------------------------------- |
| **security**   | Security Engineer | Slack #security-alerts -> Security Lead |
| **complexity** | Tech Lead         | PR comment -> Code review               |
| **dependency** | DevOps Engineer   | PR comment -> Dependency update PR      |
| **coverage**   | QA Lead           | PR comment -> Test plan update          |

### By Severity

```
info     --> Log to review-metrics.json
warning  --> PR comment + include in summary
critical --> PR label + review request + block merge
blocker  --> PR label + review request + block merge + immediate notification
```

---

## Response Time Expectations

| Severity | Initial Response  | Resolution          |
| -------- | ----------------- | ------------------- |
| info     | N/A               | N/A                 |
| warning  | Next review cycle | Before next release |
| critical | < 30 minutes      | Before merge        |
| blocker  | < 15 minutes      | Immediately         |

---

## GitHub PR Integration

### Labels

The CI workflow automatically applies labels based on anomaly severity:

| Label                | Color  | Applied When                                         |
| -------------------- | ------ | ---------------------------------------------------- |
| `review:passed`      | green  | All layers pass                                      |
| `review:warning`     | yellow | Layer 2 warnings found                               |
| `needs-human-review` | red    | Critical/blocker anomalies or sensitive file changes |

### Automated PR Comment

When anomalies are found, the CI posts a structured comment:

```markdown
## Automated Review Report

### Layer 1: Quality ✅/❌

- Formatting: PASS/FAIL
- Linting: PASS/FAIL
- Type Check: PASS/FAIL
- Coverage: XX% (threshold: 80%)

### Layer 2: Security ⚠️

- npm audit: X vulnerabilities
- Secret scan: PASS/FAIL
- Complexity: X warnings
- Dependencies: PASS/FAIL

### Layer 3: Human Review Required? YES/NO

- Trigger: [reason]
```

---

## Escalation Flow Diagram

```
Code Change Submitted
        |
        v
  [Layer 1: Quality]
        |
   Pass? --NO--> Block merge, require fixes
        |
       YES
        |
        v
  [Layer 2: Security & Anomaly]
        |
   Anomalies found?
        |
   +----+----+
   |         |
  YES        NO
   |         |
   v         v
 Classify   [Layer 3 check]
 severity    file patterns
   |         |
   +----+----+
        |
   Needs human? --NO--> Auto-merge eligible
        |
       YES
        |
        v
  Request human review
  Add label + notify
        |
        v
  Human decision
  (see HUMAN_CHECKPOINT_STANDARDS.md)
        |
        v
  Approved? --NO--> Request changes
        |
       YES
        |
        v
  Merge allowed
```
