const ContractRecommendationsGenerator = require('../../agents/contract-recommendations-generator');

describe('ContractRecommendationsGenerator', () => {
  let generator;
  let sampleRisks;
  let sampleCompliance;
  let sampleTerms;

  beforeAll(() => {
    generator = new ContractRecommendationsGenerator();

    sampleRisks = {
      metadata: {
        total_risks: 3,
        high_severity: 1,
        medium_severity: 1,
        low_severity: 1,
      },
      risks: [
        {
          risk_id: 'RISK-001',
          type: 'liability_cap_missing',
          severity: 'HIGH',
          description: '責任上限未明確指定',
          impact: '公司責任可能無限',
          recommendation: '應明確限定責任金額',
        },
        {
          risk_id: 'RISK-005',
          type: 'confidentiality_period_short',
          severity: 'MEDIUM',
          description: '保密期限短',
          current_value: '1 years',
          recommended_value: '5 years',
          impact: '信息保護不足',
          recommendation: '延長保密期',
        },
        {
          risk_id: 'RISK-007',
          type: 'payment_terms_long',
          severity: 'LOW',
          description: '支付期限長',
          current_value: '120 天',
          impact: '延長資金周期',
          recommendation: '縮短支付期',
        },
      ],
    };

    sampleCompliance = {
      metadata: {
        total_issues: 3,
        critical: 0,
        high: 1,
        medium: 1,
        low: 1,
      },
      compliance_checks: [
        {
          check_id: 'COMP-001',
          category: 'data_protection',
          severity: 'HIGH',
          requirement: 'CCPA compliance required',
          status: 'MISSING',
          description: 'CCPA 合規條款缺失',
          recommendation: '添加 CCPA 合規條款',
          jurisdiction_requirement: 'CCPA',
        },
        {
          check_id: 'COMP-006',
          category: 'privacy',
          severity: 'MEDIUM',
          requirement: 'Privacy must be addressed',
          status: 'MISSING',
          description: '隱私條款缺失',
          recommendation: '添加隱私條款',
        },
        {
          check_id: 'COMP-007',
          category: 'privacy_notice',
          severity: 'LOW',
          requirement: 'Privacy notice should be provided',
          status: 'MISSING',
          description: '隱私通知缺失',
          recommendation: '提供隱私通知',
        },
      ],
    };

    sampleTerms = {
      basic_info: {
        parties: ['Acme Corp', 'Beta Inc'],
        jurisdiction: 'California',
      },
      key_terms: {
        liability_cap: { numeric_value: null },
      },
    };
  });

  describe('constructor', () => {
    it('should initialize with correct name and version', () => {
      expect(generator.name).toBe('ContractRecommendationsGenerator');
      expect(generator.version).toBe('1.0.0');
    });
  });

  describe('generateExecutiveSummary()', () => {
    it('should summarize total issues', () => {
      const summary = generator.generateExecutiveSummary(sampleRisks, sampleCompliance);
      expect(summary).toContain('6');
    });

    it('should mention critical items when present', () => {
      const summary = generator.generateExecutiveSummary(sampleRisks, sampleCompliance);
      expect(summary).toContain('立即處理');
    });

    it('should mention medium items when present', () => {
      const summary = generator.generateExecutiveSummary(sampleRisks, sampleCompliance);
      expect(summary).toContain('應該處理');
    });

    it('should mention optional improvements when low items present', () => {
      const summary = generator.generateExecutiveSummary(sampleRisks, sampleCompliance);
      expect(summary).toContain('可選改進');
    });

    it('should handle zero issues gracefully', () => {
      const emptyRisks = { metadata: { total_risks: 0, high_severity: 0, medium_severity: 0, low_severity: 0 } };
      const emptyCompliance = { metadata: { total_issues: 0, critical: 0, high: 0, medium: 0, low: 0 } };
      const summary = generator.generateExecutiveSummary(emptyRisks, emptyCompliance);
      expect(summary).toContain('0');
    });
  });

  describe('generateCriticalActions()', () => {
    it('should generate actions from HIGH severity risks', () => {
      const actions = generator.generateCriticalActions(sampleRisks, sampleCompliance);
      const riskActions = actions.filter((a) => a.action_id.startsWith('RISK'));
      expect(riskActions.length).toBeGreaterThan(0);
      expect(riskActions[0].priority).toBe('CRITICAL');
    });

    it('should generate actions from HIGH compliance checks', () => {
      const actions = generator.generateCriticalActions(sampleRisks, sampleCompliance);
      const compActions = actions.filter((a) => a.action_id.startsWith('COMP'));
      expect(compActions.length).toBeGreaterThan(0);
    });

    it('should include action items', () => {
      const actions = generator.generateCriticalActions(sampleRisks, sampleCompliance);
      actions.forEach((action) => {
        expect(action.action_items).toBeDefined();
        expect(action.action_items.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty risks and compliance', () => {
      const emptyRisks = { risks: [] };
      const emptyCompliance = { compliance_checks: [] };
      const actions = generator.generateCriticalActions(emptyRisks, emptyCompliance);
      expect(actions).toEqual([]);
    });
  });

  describe('generateNegotiationPoints()', () => {
    it('should generate negotiation points from risks', () => {
      const points = generator.generateNegotiationPoints(
        sampleRisks,
        sampleCompliance,
        sampleTerms
      );
      expect(points.length).toBeGreaterThan(0);
      expect(points[0]).toHaveProperty('point_id');
      expect(points[0]).toHaveProperty('topic');
      expect(points[0]).toHaveProperty('our_position');
    });

    it('should include opening offer and fallback', () => {
      const points = generator.generateNegotiationPoints(
        sampleRisks,
        sampleCompliance,
        sampleTerms
      );
      points.forEach((point) => {
        expect(point).toHaveProperty('opening_offer');
        expect(point).toHaveProperty('fallback_position');
        expect(point).toHaveProperty('walk_away_point');
      });
    });

    it('should handle empty risks', () => {
      const points = generator.generateNegotiationPoints(
        { risks: [] },
        sampleCompliance,
        sampleTerms
      );
      expect(points).toEqual([]);
    });
  });

  describe('generateOpeningOffer()', () => {
    it('should generate specific offer for liability_cap_low', () => {
      const risk = {
        type: 'liability_cap_low',
        current_value: '$1,000,000',
        recommended_value: '$5,000,000',
      };
      const offer = generator.generateOpeningOffer(risk);
      expect(offer).toContain('責任上限');
    });

    it('should fall back to recommendation for other types', () => {
      const risk = { type: 'other', recommendation: 'some recommendation' };
      expect(generator.generateOpeningOffer(risk)).toBe('some recommendation');
    });
  });

  describe('generateFallbackPosition()', () => {
    it('should return specific fallback for liability_cap_low', () => {
      const fallback = generator.generateFallbackPosition({ type: 'liability_cap_low' });
      expect(fallback).toContain('75%');
    });

    it('should return generic fallback for other types', () => {
      const fallback = generator.generateFallbackPosition({ type: 'other' });
      expect(fallback).toContain('Acceptable');
    });
  });

  describe('generateWalkAwayPoint()', () => {
    it('should escalate for HIGH severity', () => {
      const point = generator.generateWalkAwayPoint({ severity: 'HIGH' });
      expect(point).toContain('escalate');
    });

    it('should be more lenient for lower severity', () => {
      const point = generator.generateWalkAwayPoint({ severity: 'LOW' });
      expect(point).toContain('accept');
    });
  });

  describe('generateComplianceImprovements()', () => {
    it('should generate improvements from MISSING compliance checks', () => {
      const improvements = generator.generateComplianceImprovements(sampleCompliance);
      expect(improvements.length).toBe(3);
      improvements.forEach((imp) => {
        expect(imp).toHaveProperty('improvement_id');
        expect(imp).toHaveProperty('category');
        expect(imp).toHaveProperty('recommended_action');
        expect(imp).toHaveProperty('template_clause');
      });
    });

    it('should handle empty compliance checks', () => {
      const improvements = generator.generateComplianceImprovements({
        compliance_checks: [],
      });
      expect(improvements).toEqual([]);
    });

    it('should set priority based on severity', () => {
      const improvements = generator.generateComplianceImprovements(sampleCompliance);
      const highPriority = improvements.find((i) => i.category === 'data_protection');
      expect(highPriority.priority).toBe('High');
    });
  });

  describe('generateTemplateClause()', () => {
    it('should return data_protection template', () => {
      const clause = generator.generateTemplateClause({ category: 'data_protection' });
      expect(clause).toContain('數據保護');
    });

    it('should return liability template', () => {
      const clause = generator.generateTemplateClause({ category: 'liability' });
      expect(clause).toContain('責任限制');
    });

    it('should return fallback for unknown category', () => {
      const clause = generator.generateTemplateClause({ category: 'unknown_category' });
      expect(clause).toContain('標準條款模板');
    });
  });

  describe('generateImplementationPlan()', () => {
    it('should return 3-phase plan', () => {
      const plan = generator.generateImplementationPlan(sampleRisks, sampleCompliance);
      expect(plan).toHaveProperty('phase_1');
      expect(plan).toHaveProperty('phase_2');
      expect(plan).toHaveProperty('phase_3');
    });

    it('should have tasks in each phase', () => {
      const plan = generator.generateImplementationPlan(sampleRisks, sampleCompliance);
      expect(plan.phase_1.tasks.length).toBeGreaterThan(0);
      expect(plan.phase_2.tasks.length).toBeGreaterThan(0);
      expect(plan.phase_3.tasks.length).toBeGreaterThan(0);
    });
  });

  describe('generateNextSteps()', () => {
    it('should return ordered steps', () => {
      const steps = generator.generateNextSteps(sampleRisks, sampleCompliance);
      expect(steps.length).toBe(5);
      expect(steps[0].step).toBe(1);
      expect(steps[4].step).toBe(5);
    });
  });

  describe('generate() - main method', () => {
    it('should return complete recommendations', async () => {
      const result = await generator.generate(sampleRisks, sampleCompliance, sampleTerms);

      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('executive_summary');
      expect(result).toHaveProperty('critical_actions');
      expect(result).toHaveProperty('negotiation_points');
      expect(result).toHaveProperty('compliance_improvements');
      expect(result).toHaveProperty('implementation_plan');
      expect(result).toHaveProperty('next_steps');
      expect(result.metadata.generated_by).toBe('ContractRecommendationsGenerator');
    });

    it('should calculate total_recommendations correctly', async () => {
      const result = await generator.generate(sampleRisks, sampleCompliance, sampleTerms);
      const expectedTotal =
        result.critical_actions.length +
        result.negotiation_points.length +
        result.compliance_improvements.length;
      expect(result.metadata.total_recommendations).toBe(expectedTotal);
    });

    it('should calculate critical_actions count correctly', async () => {
      const result = await generator.generate(sampleRisks, sampleCompliance, sampleTerms);
      const criticalCount = result.critical_actions.filter(
        (a) => a.priority === 'CRITICAL'
      ).length;
      expect(result.metadata.critical_actions).toBe(criticalCount);
    });
  });
});
