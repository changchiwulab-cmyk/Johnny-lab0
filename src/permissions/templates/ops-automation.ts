import { WorkflowTemplate } from "./legal-review";

export const opsAutomationTemplate: WorkflowTemplate = {
  id: "ops-process-automation",
  name: "流程自動化",
  description: "運營部門流程自動化：員工入職、數據同步、報告生成",
  department: "operations",
  steps: [
    {
      id: "ops-1",
      name: "觸發自動化",
      description: "透過事件或排程觸發自動化流程",
      requiredRole: "operations",
      actions: ["execute:scripts/*"],
      autoExecute: false,
    },
    {
      id: "ops-2",
      name: "數據收集",
      description: "從各系統收集所需數據",
      requiredRole: "operations",
      actions: ["read:*", "execute:npm:run"],
      autoExecute: true,
    },
    {
      id: "ops-3",
      name: "數據轉換",
      description: "清洗、轉換、格式化數據",
      requiredRole: "operations",
      actions: ["read:*", "edit:*.{json,yaml}"],
      autoExecute: true,
    },
    {
      id: "ops-4",
      name: "執行操作",
      description: "執行自動化腳本完成目標操作",
      requiredRole: "operations",
      actions: ["execute:scripts/*", "edit:*.{md,json,yaml}"],
      autoExecute: true,
    },
    {
      id: "ops-5",
      name: "驗證結果",
      description: "驗證自動化操作結果",
      requiredRole: "operations",
      actions: ["read:*"],
      autoExecute: true,
    },
    {
      id: "ops-6",
      name: "人工確認",
      description: "運營人員確認結果並完成流程",
      requiredRole: "operations",
      actions: ["read:*", "edit:*.md"],
      autoExecute: false,
    },
  ],
};
