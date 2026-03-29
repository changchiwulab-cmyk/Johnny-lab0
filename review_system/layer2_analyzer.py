"""Layer 2: Anomaly detection (complexity, security, performance)."""

import asyncio
import re
from typing import Dict, List, Optional, Tuple
from shared.result_models import (
    AnalysisReport, Finding, Metric, RiskLevel, Layer2Report
)
from shared.security_patterns import SecurityPatterns, SecurityLevel
from shared.subprocess_utils import SubprocessRunner
from config_manager.models import ReviewConfig, ComplexityConfig


class ComplexityAnalyzer:
    """Analyzes code complexity metrics."""

    def __init__(self, config: Optional[ComplexityConfig] = None):
        """Initialize with config or defaults."""
        if config:
            self.cyclomatic_threshold = config.cyclomatic_max
            self.cognitive_threshold = config.cognitive_max
        else:
            self.cyclomatic_threshold = 10.0
            self.cognitive_threshold = 15.0

    async def analyze_all(self, code_changes: Dict[str, str]) -> AnalysisReport:
        """Analyze complexity of all code changes."""
        python_files = [f for f in code_changes.keys() if f.endswith(".py")]

        if not python_files:
            return AnalysisReport(
                analysis_type="complexity",
                total_issues=0,
                metrics=[
                    Metric("cyclomatic", 0, self.cyclomatic_threshold, False),
                    Metric("cognitive", 0, self.cognitive_threshold, False),
                ],
                overall_risk=RiskLevel.LOW,
            )

        # Use radon for Python complexity analysis
        try:
            cyclomatic_avg = await self._calculate_cyclomatic(python_files)
            cognitive_avg = await self._calculate_cognitive(python_files)
        except Exception:
            # Default if tools unavailable
            cyclomatic_avg = 5.0
            cognitive_avg = 10.0

        cyclomatic_metric = Metric(
            "cyclomatic",
            cyclomatic_avg,
            self.cyclomatic_threshold,
            cyclomatic_avg > self.cyclomatic_threshold,
        )
        cognitive_metric = Metric(
            "cognitive",
            cognitive_avg,
            self.cognitive_threshold,
            cognitive_avg > self.cognitive_threshold,
        )

        # Determine risk level
        if cyclomatic_avg > self.cyclomatic_threshold or cognitive_avg > self.cognitive_threshold:
            risk = RiskLevel.HIGH
        elif cyclomatic_avg > self.cyclomatic_threshold * 0.8:
            risk = RiskLevel.MEDIUM
        else:
            risk = RiskLevel.LOW

        return AnalysisReport(
            analysis_type="complexity",
            total_issues=0,
            metrics=[cyclomatic_metric, cognitive_metric],
            overall_risk=risk,
        )

    async def _calculate_cyclomatic(self, files: List[str]) -> float:
        """Calculate average cyclomatic complexity."""
        result = await SubprocessRunner.run_with_text_output(
            ["radon", "cc"] + files + ["--average"],
            timeout=15,
        )

        if result:
            lines = result.strip().split("\n")
            for line in lines:
                if "Average complexity" in line:
                    # Extract value
                    match = re.search(r"([\d.]+)", line)
                    if match:
                        return float(match.group(1))

        return 5.0  # Default

    async def _calculate_cognitive(self, files: List[str]) -> float:
        """Calculate average cognitive complexity."""
        result = await SubprocessRunner.run_with_text_output(
            ["radon", "mi"] + files + ["-s"],
            timeout=15,
        )

        if result:
            # Extract maintainability index
            match = re.search(r"Maintainability Index: ([\d.]+)", result)
            if match:
                mi = float(match.group(1))
                # Convert MI to cognitive complexity estimate
                return max(1.0, (100.0 - mi) / 5.0)

        return 10.0  # Default


class SecurityAnalyzer:
    """Detects security vulnerabilities in code using shared patterns."""

    def __init__(self):
        """Initialize with unified security patterns."""
        self.vulnerability_patterns = SecurityPatterns.VULNERABILITY_PATTERNS

    async def scan_all(self, code_changes: Dict[str, str]) -> AnalysisReport:
        """Scan all code changes for security issues (CPU-bound, synchronous)."""
        findings: List[Finding] = []

        for file_path, content in code_changes.items():
            file_findings = self._scan_content(content, file_path)
            findings.extend(file_findings)

        # Count severity levels
        critical = [f for f in findings if f.severity == RiskLevel.CRITICAL]
        high = [f for f in findings if f.severity == RiskLevel.HIGH]

        # Determine overall risk
        if critical:
            overall_risk = RiskLevel.CRITICAL
        elif high:
            overall_risk = RiskLevel.HIGH
        elif findings:
            overall_risk = RiskLevel.MEDIUM
        else:
            overall_risk = RiskLevel.LOW

        return AnalysisReport(
            analysis_type="security",
            findings=findings,
            total_issues=len(findings),
            critical_count=len(critical),
            high_count=len(high),
            overall_risk=overall_risk,
        )

    def _scan_content(self, content: str, file_path: str) -> List[Finding]:
        """Scan code content for security patterns."""
        findings = []
        lines = content.split("\n")

        for category, config in self.vulnerability_patterns.items():
            for pattern in config["patterns"]:
                for line_num, line in enumerate(lines, 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        # Convert SecurityLevel to RiskLevel
                        severity_map = {
                            SecurityLevel.CRITICAL: RiskLevel.CRITICAL,
                            SecurityLevel.HIGH: RiskLevel.HIGH,
                            SecurityLevel.MEDIUM: RiskLevel.MEDIUM,
                            SecurityLevel.LOW: RiskLevel.LOW,
                        }
                        risk_level = severity_map.get(config["severity"], RiskLevel.MEDIUM)

                        findings.append(
                            Finding(
                                finding_type="security",
                                severity=risk_level,
                                category=category,
                                description=f"Potential {category} vulnerability detected",
                                line=line_num,
                                pattern=pattern,
                                confidence=config["confidence"],
                            )
                        )

        return findings


class PerformanceAnalyzer:
    """Detects performance issues in code."""

    async def detect_all(self, code_changes: Dict[str, str]) -> AnalysisReport:
        """Detect performance issues in code changes."""
        issues: List[Finding] = []

        for file_path, content in code_changes.items():
            file_issues = self._detect_patterns(content, file_path)
            issues.extend(file_issues)

        # Determine overall risk
        if any(i.severity == RiskLevel.HIGH for i in issues):
            overall_risk = RiskLevel.HIGH
        elif any(i.severity == RiskLevel.MEDIUM for i in issues):
            overall_risk = RiskLevel.MEDIUM
        else:
            overall_risk = RiskLevel.LOW

        return AnalysisReport(
            analysis_type="performance",
            findings=issues,
            total_issues=len(issues),
            overall_risk=overall_risk,
        )

    def _detect_patterns(self, content: str, file_path: str) -> List[Finding]:
        """Detect performance anti-patterns."""
        issues = []
        lines = content.split("\n")

        # Check for string concatenation in loops
        for i, line in enumerate(lines, 1):
            if "for " in line or "while " in line:
                # Check next lines for string concatenation
                for j in range(i, min(i + 10, len(lines))):
                    if "+=" in lines[j] and ('"' in lines[j] or "'" in lines[j]):
                        issues.append(
                            Finding(
                                finding_type="performance",
                                severity=RiskLevel.MEDIUM,
                                category="string_concat_in_loop",
                                description="String concatenation in loop detected (use list.join())",
                                location=f"{file_path}:{i}",
                                line=i,
                            )
                        )
                        break

            # Check for N+1 query patterns
            if "for " in line and "query" in content:
                for j in range(max(0, i - 5), min(i + 5, len(lines))):
                    if ".query(" in lines[j] or ".execute(" in lines[j]:
                        issues.append(
                            Finding(
                                finding_type="performance",
                                severity=RiskLevel.HIGH,
                                category="potential_nplus1",
                                description="Potential N+1 query pattern detected",
                                location=f"{file_path}:{i}",
                                line=i,
                            )
                        )
                        break

        return issues


class DependencyAuditor:
    """Audits project dependencies for vulnerabilities."""

    async def audit(self, project_root: str) -> AnalysisReport:
        """Audit dependencies for vulnerabilities."""
        vulnerabilities: List[Finding] = []

        # Try npm audit for Node.js dependencies
        npm_vulns = await self._audit_npm(project_root)
        vulnerabilities.extend(npm_vulns)

        # Try pip audit for Python dependencies
        pip_vulns = await self._audit_pip(project_root)
        vulnerabilities.extend(pip_vulns)

        # Count severity levels
        critical = [v for v in vulnerabilities if v.severity == RiskLevel.CRITICAL]
        high = [v for v in vulnerabilities if v.severity == RiskLevel.HIGH]

        # Determine overall risk
        if critical:
            overall_risk = RiskLevel.CRITICAL
        elif high:
            overall_risk = RiskLevel.HIGH
        elif vulnerabilities:
            overall_risk = RiskLevel.MEDIUM
        else:
            overall_risk = RiskLevel.LOW

        return AnalysisReport(
            analysis_type="dependency",
            findings=vulnerabilities,
            total_issues=len(vulnerabilities),
            critical_count=len(critical),
            high_count=len(high),
            overall_risk=overall_risk,
        )

    async def _audit_npm(self, project_root: str) -> List[Finding]:
        """Audit Node.js dependencies with npm audit."""
        vulnerabilities = []
        audit_data = await SubprocessRunner.run_with_json_output(
            ["npm", "audit", "--json"],
            tool_name="npm",
        )

        if audit_data:
            for vuln_key, vuln_data in audit_data.get("vulnerabilities", {}).items():
                severity_map = {"critical": RiskLevel.CRITICAL, "high": RiskLevel.HIGH}
                vulnerabilities.append(
                    Finding(
                        finding_type="dependency",
                        severity=severity_map.get(vuln_data.get("severity"), RiskLevel.MEDIUM),
                        category="npm_vulnerability",
                        description=vuln_data.get("title", ""),
                        cve_id=vuln_data.get("cves", [""])[0] if vuln_data.get("cves") else "",
                    )
                )

        return vulnerabilities

    async def _audit_pip(self, project_root: str) -> List[Finding]:
        """Audit Python dependencies with pip audit."""
        vulnerabilities = []
        audit_data = await SubprocessRunner.run_with_json_output(
            ["pip-audit", "--format", "json"],
            tool_name="pip",
        )

        if audit_data:
            for vuln in audit_data.get("vulnerabilities", []):
                vulnerabilities.append(
                    Finding(
                        finding_type="dependency",
                        severity=RiskLevel.HIGH,
                        category="pip_vulnerability",
                        description=vuln.get("description", ""),
                        cve_id=vuln.get("cve", ""),
                    )
                )

        return vulnerabilities


class Layer2Executor:
    """Orchestrates Layer 2 anomaly detection."""

    def __init__(self, config: Optional[ReviewConfig] = None):
        """Initialize with optional configuration."""
        self.config = config

        # Use config for complexity thresholds if provided
        complexity_config = config.layer2.complexity if config else None
        self.complexity_analyzer = ComplexityAnalyzer(complexity_config)

        self.security_analyzer = SecurityAnalyzer()
        self.performance_analyzer = PerformanceAnalyzer()
        self.dependency_auditor = DependencyAuditor()

    async def execute(self, code_changes: Dict[str, str], project_root: str = ".") -> Layer2Report:
        """Run all Layer 2 anomaly detection in parallel."""
        tasks = [
            self.complexity_analyzer.analyze_all(code_changes),
            self.security_analyzer.scan_all(code_changes),
            self.performance_analyzer.detect_all(code_changes),
            self.dependency_auditor.audit(project_root),
        ]

        results = await asyncio.gather(*tasks)
        return Layer2Report.synthesize(tuple(results))
