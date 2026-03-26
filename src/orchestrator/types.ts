export type AgentRole = "implementation" | "testing" | "documentation" | "security";

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface Task {
  id: string;
  name: string;
  description: string;
  assignedTo?: AgentRole;
  status: TaskStatus;
  dependencies: string[];
  result?: TaskResult;
}

export interface TaskResult {
  success: boolean;
  output: string;
  artifacts: string[];
  duration: number;
  errors: string[];
}

export interface DAGNode {
  task: Task;
  children: string[];
  parents: string[];
}

export interface ExecutionPlan {
  phases: ExecutionPhase[];
  totalTasks: number;
}

export interface ExecutionPhase {
  phaseNumber: number;
  tasks: Task[];
  parallel: boolean;
}

export interface OrchestratorResult {
  success: boolean;
  phases: { phase: number; results: TaskResult[] }[];
  totalDuration: number;
  summary: string;
}
