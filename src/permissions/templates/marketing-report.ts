import { WorkflowTemplate } from "./legal-review";

export const marketingReportTemplate: WorkflowTemplate = {
  id: "marketing-data-report",
  name: "數據報告生成",
  description: "市場部門自動化數據報告生成：數據收集、分析、可視化、報告輸出",
  department: "marketing",
  steps: [
    {
      id: "mkt-1",
      name: "定義報告需求",
      description: "市場人員指定報告類型與時間範圍",
      requiredRole: "marketing",
      actions: ["read:*.{md,json,csv}"],
      autoExecute: false,
    },
    {
      id: "mkt-2",
      name: "數據收集",
      description: "從數據源收集原始數據",
      requiredRole: "marketing",
      actions: ["read:*.{json,csv}", "execute:reports:*"],
      autoExecute: true,
    },
    {
      id: "mkt-3",
      name: "數據分析",
      description: "統計分析、趨勢計算、異常檢測",
      requiredRole: "marketing",
      actions: ["read:*.{json,csv}", "execute:reports:*"],
      autoExecute: true,
    },
    {
      id: "mkt-4",
      name: "生成報告",
      description: "輸出結構化報告（Markdown + 數據表格）",
      requiredRole: "marketing",
      actions: ["edit:reports/**", "execute:reports:*"],
      autoExecute: true,
    },
    {
      id: "mkt-5",
      name: "審閱發布",
      description: "市場主管審閱並發布報告",
      requiredRole: "marketing",
      actions: ["read:reports/**", "edit:reports/**"],
      autoExecute: false,
    },
  ],
};
