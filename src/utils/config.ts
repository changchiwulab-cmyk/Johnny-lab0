export interface AppConfig {
  agenticMode: string;
  securityLevel: string;
  autoReview: boolean;
  phase1Trends: string[];
  logLevel: string;
}

export function loadConfig(): AppConfig {
  return {
    agenticMode: process.env.AGENTIC_MODE || "multi-agent-coordination",
    securityLevel: process.env.SECURITY_LEVEL || "priority-first",
    autoReview: process.env.AUTO_REVIEW !== "disabled",
    phase1Trends: (process.env.PHASE_1_TRENDS || "Trend2,Trend4,Trend7,Trend8").split(","),
    logLevel: process.env.LOG_LEVEL || "info",
  };
}
