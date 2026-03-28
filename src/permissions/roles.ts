export type RoleName = "developer" | "operations" | "legal" | "security" | "marketing";

export type Action = "read" | "write" | "edit" | "execute" | "delete" | "admin";

export interface Permission {
  action: Action;
  resourcePattern: string;
}

export interface Role {
  name: RoleName;
  displayName: string;
  description: string;
  permissions: Permission[];
  maxRiskLevel: "low" | "medium" | "high";
}

export const ROLES: Record<RoleName, Role> = {
  developer: {
    name: "developer",
    displayName: "開發者",
    description: "Full access to code, tests, and development tools",
    permissions: [
      { action: "read", resourcePattern: "*" },
      { action: "write", resourcePattern: "src/**" },
      { action: "write", resourcePattern: "tests/**" },
      { action: "edit", resourcePattern: "*.{ts,js,json,md}" },
      { action: "execute", resourcePattern: "npm:*" },
      { action: "execute", resourcePattern: "git:*" },
      { action: "execute", resourcePattern: "test:*" },
      { action: "delete", resourcePattern: "src/**" },
    ],
    maxRiskLevel: "high",
  },
  operations: {
    name: "operations",
    displayName: "運營",
    description: "Access to config files, automation scripts, and operational tools",
    permissions: [
      { action: "read", resourcePattern: "*" },
      { action: "edit", resourcePattern: "*.{md,json,yaml}" },
      { action: "execute", resourcePattern: "npm:run" },
      { action: "execute", resourcePattern: "scripts/*" },
    ],
    maxRiskLevel: "medium",
  },
  legal: {
    name: "legal",
    displayName: "法務",
    description: "Read access to documents with edit on markdown files",
    permissions: [
      { action: "read", resourcePattern: "*" },
      { action: "edit", resourcePattern: "*.md" },
      { action: "execute", resourcePattern: "search:*" },
    ],
    maxRiskLevel: "low",
  },
  security: {
    name: "security",
    displayName: "安全",
    description: "Read access with audit and scanning capabilities",
    permissions: [
      { action: "read", resourcePattern: "*" },
      { action: "execute", resourcePattern: "audit:*" },
      { action: "execute", resourcePattern: "scan:*" },
      { action: "execute", resourcePattern: "npm:audit" },
    ],
    maxRiskLevel: "high",
  },
  marketing: {
    name: "marketing",
    displayName: "市場",
    description: "Access to reports, data visualization, and documentation",
    permissions: [
      { action: "read", resourcePattern: "*.{md,json,csv}" },
      { action: "edit", resourcePattern: "reports/**" },
      { action: "execute", resourcePattern: "reports:*" },
    ],
    maxRiskLevel: "low",
  },
};
