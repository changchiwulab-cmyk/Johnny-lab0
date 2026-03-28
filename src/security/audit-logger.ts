import { createChildLogger } from "../utils/logger";
import * as fs from "fs";
import * as path from "path";

const logger = createChildLogger("security:audit");

export interface AuditEntry {
  timestamp: string;
  eventType: string;
  user: string;
  role: string;
  action: string;
  resource: string;
  decision: string;
  details?: Record<string, unknown>;
  ip?: string;
  sessionId?: string;
}

export class AuditLogger {
  private logDir: string;
  private entries: AuditEntry[] = [];

  constructor(logDir: string = "./audit-logs") {
    this.logDir = logDir;
  }

  log(entry: Omit<AuditEntry, "timestamp">): AuditEntry {
    const fullEntry: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    this.entries.push(fullEntry);
    logger.info(
      `AUDIT: [${fullEntry.eventType}] ${fullEntry.user}(${fullEntry.role}) ` +
        `${fullEntry.action} ${fullEntry.resource} => ${fullEntry.decision}`,
    );

    return fullEntry;
  }

  logAccess(user: string, role: string, resource: string, allowed: boolean): AuditEntry {
    return this.log({
      eventType: "ACCESS",
      user,
      role,
      action: "access",
      resource,
      decision: allowed ? "ALLOW" : "DENY",
    });
  }

  logSecurityEvent(user: string, role: string, eventType: string, details: Record<string, unknown>): AuditEntry {
    return this.log({
      eventType: `SECURITY:${eventType}`,
      user,
      role,
      action: eventType,
      resource: String(details.resource || "unknown"),
      decision: "LOGGED",
      details,
    });
  }

  async flush(): Promise<void> {
    if (this.entries.length === 0) return;

    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      const date = new Date().toISOString().split("T")[0];
      const logFile = path.join(this.logDir, `audit-${date}.jsonl`);

      const lines = this.entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
      fs.appendFileSync(logFile, lines);

      logger.info(`Flushed ${this.entries.length} audit entries to ${logFile}`);
      this.entries = [];
    } catch (err) {
      logger.error(`Failed to flush audit logs: ${err}`);
    }
  }

  getEntries(): AuditEntry[] {
    return [...this.entries];
  }

  query(filter: {
    user?: string;
    eventType?: string;
    startTime?: string;
    endTime?: string;
  }): AuditEntry[] {
    return this.entries.filter((entry) => {
      if (filter.user && entry.user !== filter.user) return false;
      if (filter.eventType && !entry.eventType.includes(filter.eventType)) return false;
      if (filter.startTime && entry.timestamp < filter.startTime) return false;
      if (filter.endTime && entry.timestamp > filter.endTime) return false;
      return true;
    });
  }

  getStats(): { total: number; byType: Record<string, number>; byDecision: Record<string, number> } {
    const byType: Record<string, number> = {};
    const byDecision: Record<string, number> = {};

    for (const entry of this.entries) {
      byType[entry.eventType] = (byType[entry.eventType] || 0) + 1;
      byDecision[entry.decision] = (byDecision[entry.decision] || 0) + 1;
    }

    return { total: this.entries.length, byType, byDecision };
  }
}
