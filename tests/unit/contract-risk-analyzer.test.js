const ContractRiskAnalyzer = require('../../agents/contract-risk-analyzer');

describe('ContractRiskAnalyzer', () => {
  let analyzer;

  beforeAll(() => {
    analyzer = new ContractRiskAnalyzer();
  });

  describe('constructor', () => {
    it('should initialize with correct name and version', () => {
      expect(analyzer.name).toBe('ContractRiskAnalyzer');
      expect(analyzer.version).toBe('1.0.0');
    });

    it('should load rules engine', () => {
      expect(analyzer.rulesEngine).toBeDefined();
    });
  });

  describe('getIndustryStandard()', () => {
    it('should return NDA liability cap standard', () => {
      expect(analyzer.getIndustryStandard('NDA', 'liability_cap')).toBe(5000000);
    });

    it('should return SLA liability cap standard', () => {
      expect(analyzer.getIndustryStandard('SLA', 'liability_cap')).toBe(10000000);
    });

    it('should return default for unknown contract type', () => {
      expect(analyzer.getIndustryStandard('Unknown', 'liability_cap')).toBe(5000000);
    });

    it('should return default for unknown parameter', () => {
      const result = analyzer.getIndustryStandard('NDA', 'nonexistent');
      expect(result).toBe(1000000);
    });
  });

  describe('analyzeLiabilityCap()', () => {
    it('should return empty array when key_terms missing', () => {
      const risks = analyzer.analyzeLiabilityCap({}, 'NDA');
      expect(risks).toEqual([]);
    });

    it('should flag HIGH risk when liability cap is missing (null)', () => {
      const terms = {
        key_terms: {
          liability_cap: { numeric_value: null, description: 'Not specified' },
        },
      };
      const risks = analyzer.analyzeLiabilityCap(terms, 'NDA');
      expect(risks.length).toBe(1);
      expect(risks[0].severity).toBe('HIGH');
      expect(risks[0].risk_id).toBe('RISK-001');
    });

    it('should flag HIGH risk when cap is below 50% of standard', () => {
      const terms = {
        key_terms: {
          liability_cap: { numeric_value: 1000000, description: '$1,000,000' },
        },
      };
      const risks = analyzer.analyzeLiabilityCap(terms, 'NDA'); // standard is 5M, 50% = 2.5M
      expect(risks.length).toBe(1);
      expect(risks[0].severity).toBe('HIGH');
      expect(risks[0].risk_id).toBe('RISK-002');
    });

    it('should flag MEDIUM risk when cap is below standard but above 50%', () => {
      const terms = {
        key_terms: {
          liability_cap: { numeric_value: 3000000, description: '$3,000,000' },
        },
      };
      const risks = analyzer.analyzeLiabilityCap(terms, 'NDA'); // standard is 5M
      expect(risks.length).toBe(1);
      expect(risks[0].severity).toBe('MEDIUM');
      expect(risks[0].risk_id).toBe('RISK-003');
    });

    it('should return no risks when cap meets standard', () => {
      const terms = {
        key_terms: {
          liability_cap: { numeric_value: 5000000, description: '$5,000,000' },
        },
      };
      const risks = analyzer.analyzeLiabilityCap(terms, 'NDA');
      expect(risks.length).toBe(0);
    });
  });

  describe('analyzeConfidentialityPeriod()', () => {
    it('should return empty when key_terms missing', () => {
      expect(analyzer.analyzeConfidentialityPeriod({}, 'NDA')).toEqual([]);
    });

    it('should flag MEDIUM when period is missing', () => {
      const terms = {
        key_terms: {
          confidentiality_duration: { numeric_value: null },
        },
      };
      const risks = analyzer.analyzeConfidentialityPeriod(terms, 'NDA');
      expect(risks.length).toBe(1);
      expect(risks[0].severity).toBe('MEDIUM');
      expect(risks[0].risk_id).toBe('RISK-004');
    });

    it('should flag MEDIUM when period is too short', () => {
      const terms = {
        key_terms: {
          confidentiality_duration: { numeric_value: 1, unit: 'years' },
        },
      };
      const risks = analyzer.analyzeConfidentialityPeriod(terms, 'NDA'); // standard 5yr, 50% = 2.5
      expect(risks.length).toBe(1);
      expect(risks[0].risk_id).toBe('RISK-005');
    });

    it('should return no risks when period meets standard', () => {
      const terms = {
        key_terms: {
          confidentiality_duration: { numeric_value: 5, unit: 'years' },
        },
      };
      const risks = analyzer.analyzeConfidentialityPeriod(terms, 'NDA');
      expect(risks.length).toBe(0);
    });
  });

  describe('analyzePaymentTerms()', () => {
    it('should skip for non-Purchase/SLA types', () => {
      const terms = { key_terms: { payment_terms: { payment_days: 120 } } };
      expect(analyzer.analyzePaymentTerms(terms, 'NDA')).toEqual([]);
    });

    it('should flag MEDIUM when payment terms unclear for Purchase', () => {
      const terms = {
        key_terms: { payment_terms: { description: 'Not specified' } },
      };
      const risks = analyzer.analyzePaymentTerms(terms, 'Purchase');
      expect(risks.length).toBe(1);
      expect(risks[0].risk_id).toBe('RISK-006');
    });

    it('should flag LOW when payment period exceeds 90 days', () => {
      const terms = {
        key_terms: { payment_terms: { payment_days: 120 } },
      };
      const risks = analyzer.analyzePaymentTerms(terms, 'Purchase');
      expect(risks.length).toBe(1);
      expect(risks[0].severity).toBe('LOW');
      expect(risks[0].risk_id).toBe('RISK-007');
    });
  });

  describe('analyzeTerminationClause()', () => {
    it('should flag MEDIUM when notice period missing', () => {
      const terms = {
        key_terms: { termination_clause: { notice_period: null } },
      };
      const risks = analyzer.analyzeTerminationClause(terms, 'NDA');
      expect(risks.length).toBe(1);
      expect(risks[0].risk_id).toBe('RISK-008');
    });

    it('should flag MEDIUM when notice period is too short', () => {
      const terms = {
        key_terms: { termination_clause: { notice_period: 10 } },
      };
      const risks = analyzer.analyzeTerminationClause(terms, 'NDA');
      expect(risks.length).toBe(1);
      expect(risks[0].risk_id).toBe('RISK-009');
    });

    it('should return no risks when notice period is adequate', () => {
      const terms = {
        key_terms: { termination_clause: { notice_period: 60 } },
      };
      expect(analyzer.analyzeTerminationClause(terms, 'NDA')).toEqual([]);
    });
  });

  describe('analyzeTypeSpecificRisks()', () => {
    it('should analyze NDA-specific risks', () => {
      const terms = { key_terms: {} };
      const risks = analyzer.analyzeTypeSpecificRisks(terms, 'NDA');
      expect(risks.length).toBeGreaterThan(0);
      expect(risks.some((r) => r.risk_id === 'RISK-010')).toBe(true);
    });

    it('should analyze SLA-specific risks', () => {
      const terms = { key_terms: {} };
      const risks = analyzer.analyzeTypeSpecificRisks(terms, 'SLA');
      expect(risks.length).toBeGreaterThan(0);
      expect(risks.some((r) => r.risk_id === 'RISK-012')).toBe(true);
    });

    it('should analyze Purchase-specific risks', () => {
      const terms = { key_terms: {} };
      const risks = analyzer.analyzeTypeSpecificRisks(terms, 'Purchase');
      expect(risks.length).toBeGreaterThan(0);
    });

    it('should return empty for Other type', () => {
      const risks = analyzer.analyzeTypeSpecificRisks({ key_terms: {} }, 'Other');
      expect(risks).toEqual([]);
    });
  });

  describe('analyze() - main method', () => {
    it('should return complete analysis result', async () => {
      const terms = {
        key_terms: {
          liability_cap: { numeric_value: null },
          confidentiality_duration: { numeric_value: 1, unit: 'years' },
          termination_clause: { notice_period: 10 },
          payment_terms: { payment_days: 30 },
        },
      };

      const result = await analyzer.analyze(terms, 'NDA');

      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('risks');
      expect(result.analysis_status).toBe('completed');
      expect(result.metadata.analyzed_by).toBe('ContractRiskAnalyzer');
      expect(result.metadata.total_risks).toBe(result.risks.length);
    });

    it('should sort risks by severity (HIGH first)', async () => {
      const terms = {
        key_terms: {
          liability_cap: { numeric_value: null },
          confidentiality_duration: { numeric_value: null },
          termination_clause: { notice_period: 10 },
        },
      };

      const result = await analyzer.analyze(terms, 'NDA');
      const severities = result.risks.map((r) => r.severity);
      const highIndex = severities.indexOf('HIGH');
      const mediumIndex = severities.indexOf('MEDIUM');
      if (highIndex >= 0 && mediumIndex >= 0) {
        expect(highIndex).toBeLessThan(mediumIndex);
      }
    });

    it('should correctly count severity levels in metadata', async () => {
      const terms = {
        key_terms: {
          liability_cap: { numeric_value: null },
          confidentiality_duration: { numeric_value: 5, unit: 'years' },
          termination_clause: { notice_period: 60 },
        },
      };

      const result = await analyzer.analyze(terms, 'NDA');
      const highCount = result.risks.filter((r) => r.severity === 'HIGH').length;
      const mediumCount = result.risks.filter((r) => r.severity === 'MEDIUM').length;
      const lowCount = result.risks.filter((r) => r.severity === 'LOW').length;

      expect(result.metadata.high_severity).toBe(highCount);
      expect(result.metadata.medium_severity).toBe(mediumCount);
      expect(result.metadata.low_severity).toBe(lowCount);
    });
  });

  describe('getDefaultRules()', () => {
    it('should return rules with contract types', () => {
      const rules = analyzer.getDefaultRules();
      expect(rules.contract_types).toHaveProperty('NDA');
      expect(rules.contract_types).toHaveProperty('SLA');
      expect(rules.contract_types).toHaveProperty('Purchase');
    });
  });
});
