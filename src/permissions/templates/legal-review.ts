import { RoleName } from "../roles";

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  requiredRole: RoleName;
  actions: string[];
  autoExecute: boolean;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  department: string;
  steps: WorkflowStep[];
}

export const legalReviewTemplate: WorkflowTemplate = {
  id: "legal-contract-review",
  name: "合同自動審查",
  description: "法務部門合同審查自動化流程：提取條款、對比模板、標記風險、生成報告",
  department: "legal",
  steps: [
    {
      id: "lr-1",
      name: "上傳合同",
      description: "法務人員上傳合同文件 (PDF/DOCX)",
      requiredRole: "legal",
      actions: ["read:contracts/*", "write:contracts/inbox/*"],
      autoExecute: false,
    },
    {
      id: "lr-2",
      name: "提取關鍵條款",
      description: "自動提取合同中的關鍵條款與數據",
      requiredRole: "legal",
      actions: ["read:contracts/*", "execute:search:*"],
      autoExecute: true,
    },
    {
      id: "lr-3",
      name: "模板對比",
      description: "與標準合同模板進行差異對比",
      requiredRole: "legal",
      actions: ["read:templates/*", "read:contracts/*"],
      autoExecute: true,
    },
    {
      id: "lr-4",
      name: "風險標記",
      description: "標記偏離標準條款的高風險項目",
      requiredRole: "legal",
      actions: ["read:contracts/*", "edit:*.md"],
      autoExecute: true,
    },
    {
      id: "lr-5",
      name: "生成審查報告",
      description: "生成結構化審查報告供律師確認",
      requiredRole: "legal",
      actions: ["edit:*.md"],
      autoExecute: true,
    },
    {
      id: "lr-6",
      name: "律師審批",
      description: "律師檢查報告並做出最終決策",
      requiredRole: "legal",
      actions: ["read:*", "edit:*.md"],
      autoExecute: false,
    },
  ],
};
