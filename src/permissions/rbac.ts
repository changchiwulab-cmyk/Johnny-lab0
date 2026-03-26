import { Action, Permission, Role, RoleName, ROLES } from "./roles";
import { createChildLogger } from "../utils/logger";

const logger = createChildLogger("permissions:rbac");

export interface AccessRequest {
  role: RoleName;
  action: Action;
  resource: string;
}

export interface AccessDecision {
  allowed: boolean;
  role: RoleName;
  action: Action;
  resource: string;
  matchedRule?: string;
  reason: string;
}

export class RBAC {
  private roles: Map<RoleName, Role>;

  constructor() {
    this.roles = new Map(Object.entries(ROLES) as [RoleName, Role][]);
  }

  checkPermission(request: AccessRequest): AccessDecision {
    const role = this.roles.get(request.role);
    if (!role) {
      return {
        allowed: false,
        ...request,
        reason: `Unknown role: ${request.role}`,
      };
    }

    for (const permission of role.permissions) {
      if (permission.action === request.action && this.matchResource(permission.resourcePattern, request.resource)) {
        logger.info(`ALLOW: ${request.role} ${request.action} ${request.resource}`);
        return {
          allowed: true,
          ...request,
          matchedRule: `${permission.action}:${permission.resourcePattern}`,
          reason: "Permission granted by role policy",
        };
      }
    }

    logger.warn(`DENY: ${request.role} ${request.action} ${request.resource}`);
    return {
      allowed: false,
      ...request,
      reason: `No matching permission for ${request.action} on ${request.resource}`,
    };
  }

  getRole(name: RoleName): Role | undefined {
    return this.roles.get(name);
  }

  listRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  listPermissions(roleName: RoleName): Permission[] {
    return this.roles.get(roleName)?.permissions ?? [];
  }

  private matchResource(pattern: string, resource: string): boolean {
    if (pattern === "*") return true;

    const regexStr = pattern
      .replace(/\./g, "\\.")
      .replace(/\*\*/g, "<<GLOBSTAR>>")
      .replace(/\*/g, "[^/]*")
      .replace(/<<GLOBSTAR>>/g, ".*")
      .replace(/\{([^}]+)\}/g, (_match, group) => `(${group.split(",").join("|")})`);

    return new RegExp(`^${regexStr}$`).test(resource);
  }
}
