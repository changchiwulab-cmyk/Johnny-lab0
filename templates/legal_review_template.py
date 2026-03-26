"""Legal contract review template."""

import re
from typing import Dict, List
from templates.base_template import BaseTemplate, ValidationResult, ExecutionResult, ValidationError


class LegalReviewTemplate(BaseTemplate):
    """Template for automated legal contract review."""

    def __init__(self):
        super().__init__(
            name="legal_review",
            description="Automated legal contract review and risk analysis",
        )
        self.risk_keywords = {
            "critical": [
                "liability", "indemnify", "breach", "termination",
                "confidential", "proprietary", "patent"
            ],
            "high": [
                "payment", "warranty", "limitation", "dispute",
                "arbitration", "governing law", "jurisdiction"
            ],
            "medium": [
                "schedule", "deliverable", "timeline", "acceptance",
                "modification", "amendment"
            ],
        }

    async def validate_input(self, data: Dict) -> ValidationResult:
        """Validate input contract data."""
        errors = []

        if "contract_text" not in data:
            errors.append(ValidationError(
                field="contract_text",
                message="Contract text is required",
                code="missing_field"
            ))

        if "template_name" not in data:
            errors.append(ValidationError(
                field="template_name",
                message="Template name is required",
                code="missing_field"
            ))

        if errors:
            return ValidationResult(valid=False, errors=errors)

        return ValidationResult(valid=True)

    async def execute(self, data: Dict) -> ExecutionResult:
        """Execute legal review."""
        try:
            contract_text = data.get("contract_text", "")
            template_name = data.get("template_name", "standard")

            # Extract clauses
            clauses = self._extract_clauses(contract_text)

            # Detect risks
            risks = self._detect_risks(contract_text)

            # Compare with template
            deviations = self._compare_with_template(clauses, template_name)

            output = {
                "clauses_found": len(clauses),
                "clauses": clauses,
                "risks": risks,
                "deviations_from_template": deviations,
                "summary": self._generate_summary(clauses, risks),
            }

            return ExecutionResult(
                status="success",
                output=output,
                execution_time=0,
            )

        except Exception as e:
            return ExecutionResult(
                status="failed",
                output={},
                execution_time=0,
                errors=[str(e)],
            )

    async def generate_report(self, output: Dict) -> str:
        """Generate legal review report."""
        report = []
        report.append("=" * 60)
        report.append("LEGAL CONTRACT REVIEW REPORT")
        report.append("=" * 60)

        # Summary
        report.append("\n## EXECUTIVE SUMMARY")
        summary = output.get("summary", {})
        report.append(f"Clauses Found: {summary.get('total_clauses', 0)}")
        report.append(f"Critical Risks: {summary.get('critical_risks', 0)}")
        report.append(f"High Risks: {summary.get('high_risks', 0)}")
        report.append(f"Template Deviations: {summary.get('deviations', 0)}")

        # Risks
        report.append("\n## DETECTED RISKS")
        risks = output.get("risks", [])
        for risk in risks:
            report.append(
                f"  [{risk['severity'].upper()}] {risk['keyword']} "
                f"(Line {risk['line_number']})"
            )

        # Deviations
        report.append("\n## TEMPLATE DEVIATIONS")
        deviations = output.get("deviations_from_template", [])
        for dev in deviations:
            report.append(f"  - {dev}")

        report.append("\n" + "=" * 60)
        return "\n".join(report)

    def _extract_clauses(self, contract_text: str) -> List[Dict]:
        """Extract clauses from contract text."""
        clauses = []
        lines = contract_text.split("\n")

        for i, line in enumerate(lines):
            if any(keyword in line.lower() for keyword in [
                "clause", "section", "article", "term", "condition"
            ]):
                clauses.append({
                    "number": len(clauses) + 1,
                    "line": i + 1,
                    "text": line.strip(),
                })

        return clauses

    def _detect_risks(self, contract_text: str) -> List[Dict]:
        """Detect risk keywords in contract."""
        risks = []
        lines = contract_text.split("\n")

        for severity, keywords in self.risk_keywords.items():
            for line_num, line in enumerate(lines, 1):
                for keyword in keywords:
                    if keyword.lower() in line.lower():
                        risks.append({
                            "severity": severity,
                            "keyword": keyword,
                            "line_number": line_num,
                            "context": line.strip()[:80],
                        })

        # Remove duplicates
        seen = set()
        unique_risks = []
        for risk in risks:
            key = (risk["severity"], risk["keyword"], risk["line_number"])
            if key not in seen:
                seen.add(key)
                unique_risks.append(risk)

        return unique_risks

    def _compare_with_template(self, clauses: List[Dict], template_name: str) -> List[str]:
        """Compare extracted clauses with template."""
        required_clauses = {
            "standard": [
                "payment terms", "warranty", "limitation of liability",
                "confidentiality", "termination"
            ],
            "service_agreement": [
                "service level", "support", "updates", "maintenance",
                "payment", "termination"
            ],
            "nda": [
                "definition of confidential", "obligations",
                "return of materials", "duration", "remedies"
            ],
        }

        required = required_clauses.get(template_name, [])
        clause_texts = [c["text"].lower() for c in clauses]

        deviations = []
        for required_clause in required:
            if not any(required_clause.lower() in text for text in clause_texts):
                deviations.append(f"Missing: {required_clause}")

        return deviations

    def _generate_summary(self, clauses: List[Dict], risks: List[Dict]) -> Dict:
        """Generate summary of review."""
        critical_risks = sum(1 for r in risks if r["severity"] == "critical")
        high_risks = sum(1 for r in risks if r["severity"] == "high")

        return {
            "total_clauses": len(clauses),
            "critical_risks": critical_risks,
            "high_risks": high_risks,
            "medium_risks": sum(1 for r in risks if r["severity"] == "medium"),
            "deviations": len([r for r in risks if r["severity"] == "critical"]),
            "overall_risk_level": (
                "critical" if critical_risks > 0
                else "high" if high_risks > 0
                else "medium" if risks else "low"
            ),
        }
