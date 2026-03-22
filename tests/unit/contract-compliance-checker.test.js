const ContractComplianceChecker = require('../../agents/contract-compliance-checker');

describe('ContractComplianceChecker', () => {
  let checker;

  beforeAll(() => {
    checker = new ContractComplianceChecker();
  });

  describe('constructor', () => {
    it('should initialize with correct name and version', () => {
      expect(checker.name).toBe('ContractComplianceChecker');
      expect(checker.version).toBe('1.0.0');
    });

    it('should load compliance rules', () => {
      expect(checker.complianceRules).toBeDefined();
    });
  });

  describe('checkDataProtectionCompliance()', () => {
    it('should flag CCPA missing for California jurisdiction', () => {
      const terms = { basic_info: { jurisdiction: 'California' } };
      const issues = checker.checkDataProtectionCompliance(terms, 'California');
      const ccpaIssue = issues.find((i) => i.check_id === 'COMP-001');
      expect(ccpaIssue).toBeDefined();
      expect(ccpaIssue.severity).toBe('HIGH');
    });

    it('should not flag CCPA when CCPA clause exists', () => {
      const terms = { CCPA: 'compliance clause included' };
      const issues = checker.checkDataProtectionCompliance(terms, 'California');
      const ccpaIssue = issues.find((i) => i.check_id === 'COMP-001');
      expect(ccpaIssue).toBeUndefined();
    });

    it('should flag GDPR missing for EU jurisdiction', () => {
      const terms = { basic_info: {} };
      const issues = checker.checkDataProtectionCompliance(terms, 'EU');
      const gdprIssue = issues.find((i) => i.check_id === 'COMP-002');
      expect(gdprIssue).toBeDefined();
      expect(gdprIssue.severity).toBe('HIGH');
    });

    it('should flag general data protection when missing', () => {
      const terms = { basic_info: {} };
      const issues = checker.checkDataProtectionCompliance(terms, 'Texas');
      const dataIssue = issues.find((i) => i.check_id === 'COMP-003');
      expect(dataIssue).toBeDefined();
      expect(dataIssue.severity).toBe('MEDIUM');
    });

    it('should not flag data protection when security measures mentioned', () => {
      const terms = { data_security: 'encryption at rest and in transit' };
      const issues = checker.checkDataProtectionCompliance(terms, 'Texas');
      const dataIssue = issues.find((i) => i.check_id === 'COMP-003');
      expect(dataIssue).toBeUndefined();
    });
  });

  describe('checkLiabilityCompliance()', () => {
    it('should flag when liability not mentioned', () => {
      const terms = { basic_info: {} };
      const issues = checker.checkLiabilityCompliance(terms);
      const liabilityIssue = issues.find((i) => i.check_id === 'COMP-004');
      expect(liabilityIssue).toBeDefined();
    });

    it('should not flag when liability is mentioned', () => {
      const terms = { liability: 'limited to $1M', indemnification: 'mutual' };
      const issues = checker.checkLiabilityCompliance(terms);
      const liabilityIssue = issues.find((i) => i.check_id === 'COMP-004');
      expect(liabilityIssue).toBeUndefined();
    });

    it('should flag when consequential damages exclusion missing', () => {
      const terms = { liability: 'limited' };
      const issues = checker.checkLiabilityCompliance(terms);
      const consequentialIssue = issues.find((i) => i.check_id === 'COMP-005');
      expect(consequentialIssue).toBeDefined();
    });
  });

  describe('checkPrivacyCompliance()', () => {
    it('should flag when privacy not addressed', () => {
      const terms = { basic_info: {} };
      const issues = checker.checkPrivacyCompliance(terms, 'California');
      const privacyIssue = issues.find((i) => i.check_id === 'COMP-006');
      expect(privacyIssue).toBeDefined();
    });

    it('should not flag when personal data is addressed', () => {
      const terms = { 'personal data': 'handling procedures defined', privacy: 'policy included' };
      const issues = checker.checkPrivacyCompliance(terms, 'California');
      const privacyIssue = issues.find((i) => i.check_id === 'COMP-006');
      expect(privacyIssue).toBeUndefined();
    });

    it('should flag when privacy notice missing', () => {
      const terms = { basic_info: {} };
      const issues = checker.checkPrivacyCompliance(terms, 'California');
      const noticeIssue = issues.find((i) => i.check_id === 'COMP-007');
      expect(noticeIssue).toBeDefined();
      expect(noticeIssue.severity).toBe('LOW');
    });
  });

  describe('checkIPCompliance()', () => {
    it('should flag when IP not mentioned', () => {
      const terms = { basic_info: {} };
      const issues = checker.checkIPCompliance(terms);
      const ipIssue = issues.find((i) => i.check_id === 'COMP-008');
      expect(ipIssue).toBeDefined();
    });

    it('should not flag when IP clause exists', () => {
      const terms = { 'intellectual property': 'all rights reserved', IP: 'owned' };
      const issues = checker.checkIPCompliance(terms);
      const ipIssue = issues.find((i) => i.check_id === 'COMP-008');
      expect(ipIssue).toBeUndefined();
    });

    it('should flag software IP when software mentioned but no license', () => {
      const terms = { software: 'custom code', source_code: 'provided' };
      const issues = checker.checkIPCompliance(terms);
      const swIssue = issues.find((i) => i.check_id === 'COMP-009');
      expect(swIssue).toBeDefined();
      expect(swIssue.severity).toBe('HIGH');
    });
  });

  describe('checkDisputeResolutionCompliance()', () => {
    it('should flag when dispute resolution missing', () => {
      const terms = { basic_info: {} };
      const issues = checker.checkDisputeResolutionCompliance(terms);
      const disputeIssue = issues.find((i) => i.check_id === 'COMP-010');
      expect(disputeIssue).toBeDefined();
    });

    it('should flag when jurisdiction not specified', () => {
      const terms = { basic_info: {} };
      const issues = checker.checkDisputeResolutionCompliance(terms);
      const jurisdictionIssue = issues.find((i) => i.check_id === 'COMP-011');
      expect(jurisdictionIssue).toBeDefined();
    });

    it('should not flag jurisdiction when specified', () => {
      const terms = {
        basic_info: { jurisdiction: 'California' },
        arbitration: 'binding arbitration',
      };
      const issues = checker.checkDisputeResolutionCompliance(terms);
      const jurisdictionIssue = issues.find((i) => i.check_id === 'COMP-011');
      expect(jurisdictionIssue).toBeUndefined();
    });
  });

  describe('checkSLACompliance()', () => {
    it('should flag when SLO not defined', () => {
      const terms = { basic_info: {} };
      const issues = checker.checkSLACompliance(terms);
      const sloIssue = issues.find((i) => i.check_id === 'COMP-012');
      expect(sloIssue).toBeDefined();
      expect(sloIssue.severity).toBe('HIGH');
      expect(sloIssue.category).toBe('sla_requirements');
    });

    it('should not flag SLO when service level terms exist', () => {
      const terms = { 'service level': '99.9% uptime SLO defined' };
      const issues = checker.checkSLACompliance(terms);
      const sloIssue = issues.find((i) => i.check_id === 'COMP-012');
      expect(sloIssue).toBeUndefined();
    });

    it('should flag when SLA breach remedies not specified', () => {
      const terms = { 'service level': 'SLO defined' };
      const issues = checker.checkSLACompliance(terms);
      const remedyIssue = issues.find((i) => i.check_id === 'COMP-013');
      expect(remedyIssue).toBeDefined();
      expect(remedyIssue.severity).toBe('MEDIUM');
      expect(remedyIssue.category).toBe('sla_remedies');
    });

    it('should not flag remedies when penalty/credit exists', () => {
      const terms = { 'service level': 'SLO defined', penalty: 'credit issued' };
      const issues = checker.checkSLACompliance(terms);
      const remedyIssue = issues.find((i) => i.check_id === 'COMP-013');
      expect(remedyIssue).toBeUndefined();
    });

    it('should return empty when all SLA requirements met', () => {
      const terms = {
        'service level': '99.9% uptime SLO',
        penalty: 'service credit for downtime',
      };
      const issues = checker.checkSLACompliance(terms);
      expect(issues).toEqual([]);
    });
  });

  describe('checkNDACompliance()', () => {
    it('should flag when confidential information not defined', () => {
      const terms = { basic_info: {} };
      const issues = checker.checkNDACompliance(terms);
      const defIssue = issues.find((i) => i.check_id === 'COMP-014');
      expect(defIssue).toBeDefined();
      expect(defIssue.severity).toBe('MEDIUM');
      expect(defIssue.category).toBe('nda_definition');
    });

    it('should not flag when confidential information is defined', () => {
      const terms = { 'confidential information': 'means all non-public data', proprietary: 'info' };
      const issues = checker.checkNDACompliance(terms);
      const defIssue = issues.find((i) => i.check_id === 'COMP-014');
      expect(defIssue).toBeUndefined();
    });

    it('should flag when permitted use not restricted', () => {
      const terms = { 'confidential information': 'defined' };
      const issues = checker.checkNDACompliance(terms);
      const useIssue = issues.find((i) => i.check_id === 'COMP-015');
      expect(useIssue).toBeDefined();
      expect(useIssue.severity).toBe('MEDIUM');
      expect(useIssue.category).toBe('nda_permitted_use');
    });

    it('should not flag when permitted use is restricted', () => {
      const terms = {
        'confidential information': 'defined',
        'permitted use': 'limited to evaluation purpose',
      };
      const issues = checker.checkNDACompliance(terms);
      const useIssue = issues.find((i) => i.check_id === 'COMP-015');
      expect(useIssue).toBeUndefined();
    });

    it('should return empty when all NDA requirements met', () => {
      const terms = {
        'confidential information': 'means all proprietary data',
        'permitted use': 'limited to evaluation purpose only',
        authorization: 'required',
      };
      const issues = checker.checkNDACompliance(terms);
      expect(issues).toEqual([]);
    });
  });

  describe('checkPurchaseCompliance()', () => {
    it('should flag when warranty not specified', () => {
      const terms = { basic_info: {} };
      const issues = checker.checkPurchaseCompliance(terms);
      const warrantyIssue = issues.find((i) => i.check_id === 'COMP-016');
      expect(warrantyIssue).toBeDefined();
      expect(warrantyIssue.severity).toBe('MEDIUM');
      expect(warrantyIssue.category).toBe('purchase_warranty');
    });

    it('should not flag when warranty exists', () => {
      const terms = { warranty: '12 months parts and labor' };
      const issues = checker.checkPurchaseCompliance(terms);
      const warrantyIssue = issues.find((i) => i.check_id === 'COMP-016');
      expect(warrantyIssue).toBeUndefined();
    });

    it('should flag when delivery/payment terms missing', () => {
      const terms = { warranty: 'provided' };
      const issues = checker.checkPurchaseCompliance(terms);
      const deliveryIssue = issues.find((i) => i.check_id === 'COMP-017');
      expect(deliveryIssue).toBeDefined();
      expect(deliveryIssue.severity).toBe('MEDIUM');
      expect(deliveryIssue.category).toBe('purchase_terms');
    });

    it('should not flag when delivery terms exist', () => {
      const terms = { warranty: 'provided', delivery: 'FOB destination', payment: 'Net 30' };
      const issues = checker.checkPurchaseCompliance(terms);
      const deliveryIssue = issues.find((i) => i.check_id === 'COMP-017');
      expect(deliveryIssue).toBeUndefined();
    });

    it('should return empty when all purchase requirements met', () => {
      const terms = {
        warranty: '12 months guarantee',
        delivery: 'FOB destination within 14 days',
        invoice: 'Net 30 payment terms',
      };
      const issues = checker.checkPurchaseCompliance(terms);
      expect(issues).toEqual([]);
    });
  });

  describe('checkIndustrySpecificCompliance()', () => {
    it('should check SLA compliance for SLA contracts', () => {
      const terms = { metadata: { contract_type: 'SLA' } };
      const issues = checker.checkIndustrySpecificCompliance(terms, 'California');
      expect(issues.some((i) => i.check_id === 'COMP-012')).toBe(true);
      expect(issues.some((i) => i.category === 'sla_requirements')).toBe(true);
    });

    it('should check NDA compliance for NDA contracts', () => {
      const terms = { metadata: { contract_type: 'NDA' } };
      const issues = checker.checkIndustrySpecificCompliance(terms, 'California');
      expect(issues.some((i) => i.check_id === 'COMP-014')).toBe(true);
    });

    it('should check Purchase compliance for Purchase contracts', () => {
      const terms = { metadata: { contract_type: 'Purchase' } };
      const issues = checker.checkIndustrySpecificCompliance(terms, 'California');
      expect(issues.some((i) => i.check_id === 'COMP-016')).toBe(true);
    });

    it('should return empty for Other contract type', () => {
      const terms = { metadata: { contract_type: 'Other' } };
      const issues = checker.checkIndustrySpecificCompliance(terms, 'California');
      expect(issues).toEqual([]);
    });
  });

  describe('check() - main method', () => {
    it('should return complete compliance result', async () => {
      const terms = {
        metadata: { contract_type: 'NDA' },
        basic_info: { jurisdiction: 'California' },
      };

      const result = await checker.check(terms, 'California');

      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('compliance_checks');
      expect(result.check_status).toBe('completed');
      expect(result.metadata.checked_by).toBe('ContractComplianceChecker');
      expect(result.metadata.jurisdiction).toBe('California');
    });

    it('should correctly count severity levels', async () => {
      const terms = {
        metadata: { contract_type: 'NDA' },
        basic_info: {},
      };

      const result = await checker.check(terms, 'California');
      const checks = result.compliance_checks;

      expect(result.metadata.total_issues).toBe(checks.length);
      expect(result.metadata.critical).toBe(
        checks.filter((c) => c.severity === 'CRITICAL').length
      );
      expect(result.metadata.high).toBe(
        checks.filter((c) => c.severity === 'HIGH').length
      );
      expect(result.metadata.medium).toBe(
        checks.filter((c) => c.severity === 'MEDIUM').length
      );
      expect(result.metadata.low).toBe(
        checks.filter((c) => c.severity === 'LOW').length
      );
    });

    it('should sort issues by severity (CRITICAL first)', async () => {
      const terms = {
        metadata: { contract_type: 'SLA' },
        basic_info: {},
        software: 'custom code',
      };

      const result = await checker.check(terms, 'California');
      const severities = result.compliance_checks.map((c) => c.severity);
      const severityMap = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

      for (let i = 0; i < severities.length - 1; i++) {
        expect(severityMap[severities[i]]).toBeGreaterThanOrEqual(
          severityMap[severities[i + 1]]
        );
      }
    });
  });

  describe('getDefaultComplianceRules()', () => {
    it('should return rules with data_protection, liability, and privacy', () => {
      const rules = checker.getDefaultComplianceRules();
      expect(rules).toHaveProperty('data_protection');
      expect(rules).toHaveProperty('liability');
      expect(rules).toHaveProperty('privacy');
    });
  });
});
