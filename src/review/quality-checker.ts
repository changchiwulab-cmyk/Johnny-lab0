import { execSync } from "child_process";
import { createChildLogger } from "../utils/logger";

const logger = createChildLogger("review:quality");

export interface QualityResult {
  passed: boolean;
  checks: QualityCheck[];
  score: number;
}

interface QualityCheck {
  name: string;
  passed: boolean;
  message: string;
  autoFixed: boolean;
}

export class QualityChecker {
  checkFormatting(filePath: string): QualityCheck {
    try {
      execSync(`npx prettier --check "${filePath}" 2>/dev/null`, { stdio: "pipe" });
      return { name: "Formatting (Prettier)", passed: true, message: "Code is formatted", autoFixed: false };
    } catch {
      logger.warn(`Formatting issue in ${filePath}`);
      return { name: "Formatting (Prettier)", passed: false, message: "Formatting issues found", autoFixed: false };
    }
  }

  checkLinting(filePath: string): QualityCheck {
    try {
      execSync(`npx eslint "${filePath}" 2>/dev/null`, { stdio: "pipe" });
      return { name: "Linting (ESLint)", passed: true, message: "No linting errors", autoFixed: false };
    } catch {
      logger.warn(`Linting issue in ${filePath}`);
      return { name: "Linting (ESLint)", passed: false, message: "Linting errors found", autoFixed: false };
    }
  }

  checkTypeScript(filePath: string): QualityCheck {
    try {
      execSync(`npx tsc --noEmit "${filePath}" 2>/dev/null`, { stdio: "pipe" });
      return { name: "Type Check (TypeScript)", passed: true, message: "No type errors", autoFixed: false };
    } catch {
      logger.warn(`Type error in ${filePath}`);
      return { name: "Type Check (TypeScript)", passed: false, message: "Type errors found", autoFixed: false };
    }
  }

  checkComplexity(content: string): QualityCheck {
    const lines = content.split("\n");
    const longFunctions = lines.filter((l) => l.includes("function") || l.includes("=>")).length;
    const nestingDepth = Math.max(...lines.map((l) => l.search(/\S/) / 2));
    const isComplex = nestingDepth > 5 || longFunctions > 20;

    return {
      name: "Complexity Check",
      passed: !isComplex,
      message: isComplex
        ? `High complexity: nesting=${nestingDepth}, functions=${longFunctions}`
        : "Complexity within limits",
      autoFixed: false,
    };
  }

  runAll(filePath: string, content: string): QualityResult {
    logger.info(`Running quality checks on ${filePath}`);

    const checks = [
      this.checkFormatting(filePath),
      this.checkLinting(filePath),
      this.checkTypeScript(filePath),
      this.checkComplexity(content),
    ];

    const passed = checks.every((c) => c.passed);
    const score = Math.round((checks.filter((c) => c.passed).length / checks.length) * 100);

    logger.info(`Quality score: ${score}% (${passed ? "PASS" : "FAIL"})`);
    return { passed, checks, score };
  }
}
