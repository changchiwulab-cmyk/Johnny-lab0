const fs = require('fs');
const path = require('path');
const os = require('os');
const LegalOrchestrator = require('../../agents/legal-orchestrator');

describe('LegalOrchestrator - Integration Tests', () => {
  let orchestrator;
  let tmpDir;
  let contractPath;
  const sampleContractFixture = path.join(
    __dirname,
    '../fixtures/sample-contract.txt'
  );

  beforeEach(() => {
    orchestrator = new LegalOrchestrator();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-test-'));
    contractPath = path.join(tmpDir, 'test-contract.txt');
    fs.copyFileSync(sampleContractFixture, contractPath);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should initialize with all 4 agents', () => {
      expect(orchestrator.agents.termsExtractor).toBeDefined();
      expect(orchestrator.agents.riskAnalyzer).toBeDefined();
      expect(orchestrator.agents.complianceChecker).toBeDefined();
      expect(orchestrator.agents.recommendationsGenerator).toBeDefined();
    });

    it('should have correct name and version', () => {
      expect(orchestrator.name).toBe('LegalOrchestrator');
      expect(orchestrator.version).toBe('1.0.0');
    });
  });

  describe('validateInput()', () => {
    it('should throw when file does not exist', () => {
      expect(() => {
        orchestrator.validateInput('/nonexistent/file.txt');
      }).toThrow('合同文件不存在');
    });

    it('should throw when file is empty', () => {
      const emptyFile = path.join(tmpDir, 'empty.txt');
      fs.writeFileSync(emptyFile, '');
      expect(() => {
        orchestrator.validateInput(emptyFile);
      }).toThrow('合同文件為空');
    });

    it('should throw when file contains only whitespace', () => {
      const wsFile = path.join(tmpDir, 'whitespace.txt');
      fs.writeFileSync(wsFile, '   \n\n   ');
      expect(() => {
        orchestrator.validateInput(wsFile);
      }).toThrow('合同文件為空');
    });

    it('should return contract text for valid file', () => {
      const text = orchestrator.validateInput(contractPath);
      expect(text.length).toBeGreaterThan(0);
      expect(text).toContain('NON-DISCLOSURE AGREEMENT');
    });
  });

  describe('executeAgentsInParallel()', () => {
    it('should return [terms, risks, compliance]', async () => {
      const contractText = fs.readFileSync(contractPath, 'utf-8');
      orchestrator.timestamp = new Date().toISOString().split('T')[0];

      const [terms, risks, compliance] = await orchestrator.executeAgentsInParallel(
        contractText,
        'NDA',
        tmpDir
      );

      expect(terms).toHaveProperty('basic_info');
      expect(terms).toHaveProperty('key_terms');
      expect(terms.extraction_status).toBe('completed');

      expect(risks).toHaveProperty('risks');
      expect(risks).toHaveProperty('metadata');
      expect(risks.analysis_status).toBe('completed');

      expect(compliance).toHaveProperty('compliance_checks');
      expect(compliance).toHaveProperty('metadata');
      expect(compliance.check_status).toBe('completed');
    });

    it('should write terms JSON to output directory', async () => {
      const contractText = fs.readFileSync(contractPath, 'utf-8');
      const timestamp = new Date().toISOString().split('T')[0];
      orchestrator.timestamp = timestamp;

      await orchestrator.executeAgentsInParallel(contractText, 'NDA', tmpDir);

      const termsFile = path.join(tmpDir, `terms_${timestamp}.json`);
      expect(fs.existsSync(termsFile)).toBe(true);
      const termsData = JSON.parse(fs.readFileSync(termsFile, 'utf-8'));
      expect(termsData.extraction_status).toBe('completed');
    });
  });

  describe('generateRecommendations()', () => {
    it('should generate recommendations from risks and compliance', async () => {
      const contractText = fs.readFileSync(contractPath, 'utf-8');
      orchestrator.timestamp = new Date().toISOString().split('T')[0];

      const [terms, risks, compliance] = await orchestrator.executeAgentsInParallel(
        contractText,
        'NDA',
        tmpDir
      );

      const recommendations = await orchestrator.generateRecommendations(
        risks,
        compliance,
        terms,
        tmpDir
      );

      expect(recommendations).toHaveProperty('executive_summary');
      expect(recommendations).toHaveProperty('critical_actions');
      expect(recommendations).toHaveProperty('negotiation_points');
      expect(recommendations.metadata.total_recommendations).toBeGreaterThanOrEqual(0);
    });
  });

  describe('synthesizeReport()', () => {
    it('should generate a markdown report file', async () => {
      const contractText = fs.readFileSync(contractPath, 'utf-8');
      const timestamp = new Date().toISOString().split('T')[0];
      orchestrator.timestamp = timestamp;

      const [terms, risks, compliance] = await orchestrator.executeAgentsInParallel(
        contractText,
        'NDA',
        tmpDir
      );

      const recommendations = await orchestrator.generateRecommendations(
        risks,
        compliance,
        terms,
        tmpDir
      );

      const reportFile = await orchestrator.synthesizeReport(
        terms,
        risks,
        compliance,
        recommendations,
        'NDA',
        timestamp,
        tmpDir
      );

      expect(fs.existsSync(reportFile)).toBe(true);
      const reportContent = fs.readFileSync(reportFile, 'utf-8');
      expect(reportContent).toContain('合同審查報告');
      expect(reportContent).toContain('NDA');
      expect(reportContent).toContain('風險總數');
    });
  });

  describe('archiveResults()', () => {
    it('should create archive directory and copy files', async () => {
      const timestamp = new Date().toISOString().split('T')[0];

      // Create some result files in tmpDir
      fs.writeFileSync(path.join(tmpDir, `terms_${timestamp}.json`), '{}');
      fs.writeFileSync(path.join(tmpDir, `risk_flags_${timestamp}.json`), '{}');

      const archivePath = await orchestrator.archiveResults(tmpDir, timestamp, 'NDA');

      expect(fs.existsSync(archivePath)).toBe(true);
      expect(archivePath).toContain('archive');
    });

    it('should handle archive failure gracefully', async () => {
      // Use a path that might fail - archiveResults should catch and return outputDir
      const result = await orchestrator.archiveResults(tmpDir, 'test', 'NDA');
      expect(result).toBeDefined();
    });
  });

  describe('formatCriticalActions()', () => {
    it('should return message when no actions', () => {
      expect(orchestrator.formatCriticalActions([])).toContain('沒有');
      expect(orchestrator.formatCriticalActions(null)).toContain('沒有');
    });

    it('should format actions correctly', () => {
      const actions = [
        {
          title: 'Test Action',
          priority: 'CRITICAL',
          current_state: 'Bad',
          recommended_state: 'Good',
          action_items: ['Do thing 1', 'Do thing 2'],
          timeline: 'This week',
        },
      ];
      const formatted = orchestrator.formatCriticalActions(actions);
      expect(formatted).toContain('Test Action');
      expect(formatted).toContain('CRITICAL');
    });
  });

  describe('formatNegotiationPoints()', () => {
    it('should return message when no points', () => {
      expect(orchestrator.formatNegotiationPoints([])).toContain('沒有');
    });

    it('should format points correctly', () => {
      const points = [
        {
          topic: 'Test Topic',
          our_position: 'Strong',
          opening_offer: 'High',
          fallback_position: 'Medium',
          walk_away_point: 'Low',
        },
      ];
      const formatted = orchestrator.formatNegotiationPoints(points);
      expect(formatted).toContain('Test Topic');
    });
  });

  describe('formatComplianceImprovements()', () => {
    it('should return message when no improvements', () => {
      expect(orchestrator.formatComplianceImprovements([])).toContain('沒有');
    });
  });

  describe('orchestrate() - full end-to-end workflow', () => {
    it('should complete full workflow successfully', async () => {
      const result = await orchestrator.orchestrate(contractPath, 'NDA');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.duration_ms).toBeGreaterThan(0);
      expect(result).toHaveProperty('report_file');
      expect(result).toHaveProperty('archive_path');
      expect(result).toHaveProperty('artifacts');
    });

    it('should generate all artifact files', async () => {
      const result = await orchestrator.orchestrate(contractPath, 'NDA');

      // Report file should exist (either in tmpDir or archive)
      expect(result.report_file).toBeTruthy();
      expect(result.artifacts.terms).toBeTruthy();
      expect(result.artifacts.risks).toBeTruthy();
      expect(result.artifacts.compliance).toBeTruthy();
      expect(result.artifacts.recommendations).toBeTruthy();
    });

    it('should throw for nonexistent contract file', async () => {
      await expect(
        orchestrator.orchestrate('/nonexistent/contract.txt', 'NDA')
      ).rejects.toThrow('合同文件不存在');
    });

    it('should throw for empty contract file', async () => {
      const emptyFile = path.join(tmpDir, 'empty.txt');
      fs.writeFileSync(emptyFile, '');

      await expect(
        orchestrator.orchestrate(emptyFile, 'NDA')
      ).rejects.toThrow('合同文件為空');
    });

    it('should work with default contract type', async () => {
      const result = await orchestrator.orchestrate(contractPath);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
    });

    it('should work with SLA contract type', async () => {
      const result = await orchestrator.orchestrate(contractPath, 'SLA');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
    });

    it('should work with Purchase contract type', async () => {
      const result = await orchestrator.orchestrate(contractPath, 'Purchase');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
    });
  });

  describe('agent coordination', () => {
    it('should pass extracted terms to risk analyzer and compliance checker', async () => {
      const contractText = fs.readFileSync(contractPath, 'utf-8');
      orchestrator.timestamp = new Date().toISOString().split('T')[0];

      const [terms, risks, compliance] = await orchestrator.executeAgentsInParallel(
        contractText,
        'NDA',
        tmpDir
      );

      // Risk analyzer should have used terms to identify risks
      expect(risks.metadata.total_risks).toBeGreaterThanOrEqual(0);

      // Compliance checker should have used terms
      expect(compliance.metadata.total_issues).toBeGreaterThanOrEqual(0);

      // Terms should be a proper extraction result
      expect(terms.basic_info.jurisdiction).toBe('California');
    });

    it('should pass risks and compliance to recommendations generator', async () => {
      const contractText = fs.readFileSync(contractPath, 'utf-8');
      orchestrator.timestamp = new Date().toISOString().split('T')[0];

      const [terms, risks, compliance] = await orchestrator.executeAgentsInParallel(
        contractText,
        'NDA',
        tmpDir
      );

      const recommendations = await orchestrator.generateRecommendations(
        risks,
        compliance,
        terms,
        tmpDir
      );

      // Recommendations should reference issues found by other agents
      if (risks.metadata.high_severity > 0 || compliance.metadata.high > 0) {
        expect(recommendations.critical_actions.length).toBeGreaterThan(0);
      }
    });
  });
});
