import { createChildLogger } from "../utils/logger";

const logger = createChildLogger("security:decision-tree");

export type DecisionAction = "allow" | "deny" | "require_approval" | "log_and_allow";

export interface OperationContext {
  type: string;
  resource: string;
  user: string;
  role: string;
  environment: "development" | "staging" | "production";
  metadata?: Record<string, string>;
}

export interface SecurityDecision {
  action: DecisionAction;
  reason: string;
  requiresApproval: boolean;
  approver?: string;
  auditRequired: boolean;
}

interface DecisionNode {
  condition: (ctx: OperationContext) => boolean;
  label: string;
  trueNode: DecisionNode | SecurityDecision;
  falseNode: DecisionNode | SecurityDecision;
}

function isDecision(node: DecisionNode | SecurityDecision): node is SecurityDecision {
  return "action" in node;
}

export class SecurityDecisionTree {
  private root: DecisionNode;

  constructor() {
    this.root = this.buildTree();
  }

  evaluate(context: OperationContext): SecurityDecision {
    logger.info(`Evaluating: ${context.type} on ${context.resource} by ${context.user} (${context.role})`);

    const decision = this.traverse(this.root, context);
    logger.info(`Decision: ${decision.action} - ${decision.reason}`);

    return decision;
  }

  private traverse(node: DecisionNode, context: OperationContext): SecurityDecision {
    const result = node.condition(context);
    const next = result ? node.trueNode : node.falseNode;

    if (isDecision(next)) {
      return next;
    }
    return this.traverse(next, context);
  }

  private buildTree(): DecisionNode {
    return {
      label: "Involves secrets or passwords?",
      condition: (ctx) =>
        /secret|password|key|token|credential/i.test(ctx.resource) ||
        /secret|password|key|token|credential/i.test(ctx.type),
      trueNode: {
        action: "require_approval",
        reason: "Operation involves secrets/credentials - requires human approval",
        requiresApproval: true,
        approver: "security-team",
        auditRequired: true,
      },
      falseNode: {
        label: "Affects production environment?",
        condition: (ctx) => ctx.environment === "production",
        trueNode: {
          label: "Is destructive operation?",
          condition: (ctx) =>
            /delete|drop|remove|destroy|reset|truncate/i.test(ctx.type),
          trueNode: {
            action: "deny",
            reason: "Destructive operations in production are denied by default",
            requiresApproval: false,
            auditRequired: true,
          },
          falseNode: {
            action: "require_approval",
            reason: "Production changes require approval",
            requiresApproval: true,
            approver: "ops-lead",
            auditRequired: true,
          },
        },
        falseNode: {
          label: "Modifies security configuration?",
          condition: (ctx) =>
            /security|auth|permission|rbac|acl|firewall/i.test(ctx.resource),
          trueNode: {
            action: "require_approval",
            reason: "Security configuration changes require review",
            requiresApproval: true,
            approver: "security-team",
            auditRequired: true,
          },
          falseNode: {
            label: "Is delete/archive operation?",
            condition: (ctx) =>
              /delete|archive|purge/i.test(ctx.type),
            trueNode: {
              action: "log_and_allow",
              reason: "Delete/archive allowed with audit logging",
              requiresApproval: false,
              auditRequired: true,
            },
            falseNode: {
              action: "allow",
              reason: "Standard read/write operation permitted",
              requiresApproval: false,
              auditRequired: false,
            },
          },
        },
      },
    };
  }
}
