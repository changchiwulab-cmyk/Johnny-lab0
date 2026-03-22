const path = require('path');
const fs = require('fs');
const ContractTermsExtractor = require('../../agents/contract-terms-extractor');

describe('ContractTermsExtractor', () => {
  let extractor;
  let sampleContract;

  beforeAll(() => {
    extractor = new ContractTermsExtractor();
    sampleContract = fs.readFileSync(
      path.join(__dirname, '../fixtures/sample-contract.txt'),
      'utf-8'
    );
  });

  describe('constructor', () => {
    it('should initialize with correct name and version', () => {
      expect(extractor.name).toBe('ContractTermsExtractor');
      expect(extractor.version).toBe('1.0.0');
    });
  });

  describe('extractParties()', () => {
    it('should extract parties from BETWEEN...AND pattern', () => {
      const text = 'BETWEEN Acme Corporation AND Beta Technologies Inc.';
      const parties = extractor.extractParties(text);
      expect(parties).toContain('Acme Corporation');
    });

    it('should extract parties from Party A/B pattern', () => {
      const text = 'Party A: Acme Corp\nParty B: Beta Inc\n';
      const parties = extractor.extractParties(text);
      expect(parties.length).toBeGreaterThanOrEqual(1);
    });

    it('should return default when no parties found', () => {
      const parties = extractor.extractParties('No party info here');
      expect(parties).toEqual(['Party to be identified']);
    });
  });

  describe('extractDate()', () => {
    it('should extract effective date', () => {
      const text = 'Effective Date: January 15, 2026';
      const date = extractor.extractDate(text, 'effective|Effective');
      expect(date).toBe('January 15, 2026');
    });

    it('should extract ISO format date', () => {
      const text = 'Effective Date: 2026-01-15';
      const date = extractor.extractDate(text, 'effective|Effective');
      expect(date).toBe('2026-01-15');
    });

    it('should return null when no date found', () => {
      const date = extractor.extractDate('No date here', 'effective');
      expect(date).toBeNull();
    });
  });

  describe('extractJurisdiction()', () => {
    it('should detect California', () => {
      expect(extractor.extractJurisdiction('laws of California')).toBe('California');
    });

    it('should detect New York', () => {
      expect(extractor.extractJurisdiction('courts of New York')).toBe('New York');
    });

    it('should detect Delaware', () => {
      expect(extractor.extractJurisdiction('incorporated in Delaware')).toBe('Delaware');
    });

    it('should return Unknown when no jurisdiction found', () => {
      expect(extractor.extractJurisdiction('some random text')).toBe('Unknown');
    });
  });

  describe('extractGoverningLaw()', () => {
    it('should extract governing law', () => {
      const text = 'governed by the laws of the State of California';
      const law = extractor.extractGoverningLaw(text);
      expect(law).toContain('State of California');
    });

    it('should return Not specified when not found', () => {
      const law = extractor.extractGoverningLaw('no governing law mentioned');
      expect(law).toBe('Not specified');
    });
  });

  describe('extractConfidentialityPeriod()', () => {
    it('should extract period in years', () => {
      const text = 'confidential 3 years from disclosure';
      const result = extractor.extractConfidentialityPeriod(text);
      expect(result.numeric_value).toBe(3);
      expect(result.unit).toBe('years');
      expect(result.description).toContain('3');
    });

    it('should return null numeric_value when not specified', () => {
      const result = extractor.extractConfidentialityPeriod('no period mentioned');
      expect(result.numeric_value).toBeNull();
      expect(result.description).toBe('Not specified');
    });
  });

  describe('extractLiabilityCap()', () => {
    it('should extract liability cap amount', () => {
      const text = 'liability cap shall not exceed $1,000,000';
      const result = extractor.extractLiabilityCap(text);
      expect(result.numeric_value).toBe(1000000);
      expect(result.currency).toBe('USD');
    });

    it('should handle limitation of liability pattern', () => {
      const text = 'limitation of liability is $5,000,000';
      const result = extractor.extractLiabilityCap(text);
      expect(result.numeric_value).toBe(5000000);
    });

    it('should return null when not specified', () => {
      const result = extractor.extractLiabilityCap('no cap mentioned');
      expect(result.numeric_value).toBeNull();
      expect(result.description).toBe('Not specified');
    });
  });

  describe('extractTerminationClause()', () => {
    it('should extract termination notice period', () => {
      const text = 'terminate this Agreement with 30 days written notice';
      const result = extractor.extractTerminationClause(text);
      expect(result.notice_period).toBe(30);
      expect(result.notice_unit).toBe('days');
    });

    it('should return null when not specified', () => {
      const result = extractor.extractTerminationClause('no termination info');
      expect(result.notice_period).toBeNull();
      expect(result.description).toBe('Not explicitly stated');
    });
  });

  describe('extractPaymentTerms()', () => {
    it('should extract payment days', () => {
      const text = 'payment shall be made within 30 days';
      const result = extractor.extractPaymentTerms(text);
      expect(result.payment_days).toBe(30);
    });

    it('should return Not specified when not found', () => {
      const result = extractor.extractPaymentTerms('no payment info');
      expect(result.description).toBe('Not specified');
    });
  });

  describe('extractObligations()', () => {
    it('should detect confidentiality obligation', () => {
      const obligations = extractor.extractObligations('maintain confidentiality');
      expect(obligations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ description: 'Maintain confidentiality' }),
        ])
      );
    });

    it('should detect multiple obligations', () => {
      const text = 'confidentiality protect indemnification insurance compliance';
      const obligations = extractor.extractObligations(text);
      expect(obligations.length).toBe(5);
    });

    it('should return empty array when no obligations found', () => {
      const obligations = extractor.extractObligations('nothing relevant here xyz');
      expect(obligations).toEqual([]);
    });
  });

  describe('extractDefinitions()', () => {
    it('should extract quoted definitions', () => {
      const text = '"Confidential Information" means any non-public information.';
      const defs = extractor.extractDefinitions(text);
      expect(defs['Confidential Information']).toBeDefined();
    });

    it('should return empty object when no definitions found', () => {
      const defs = extractor.extractDefinitions('no definitions here');
      expect(Object.keys(defs).length).toBe(0);
    });
  });

  describe('extractKeyTerms() - NDA specific', () => {
    it('should extract NDA-specific terms for NDA type', () => {
      const terms = extractor.extractKeyTerms(sampleContract, 'NDA');
      expect(terms).toHaveProperty('permitted_use');
      expect(terms).toHaveProperty('return_of_information');
      expect(terms).toHaveProperty('confidentiality_duration');
      expect(terms).toHaveProperty('liability_cap');
    });
  });

  describe('extractKeyTerms() - SLA specific', () => {
    it('should extract SLA-specific terms for SLA type', () => {
      const text = 'uptime guarantee 99.9% response time: 4 hours SLO defined';
      const terms = extractor.extractKeyTerms(text, 'SLA');
      expect(terms).toHaveProperty('service_level_objectives');
      expect(terms).toHaveProperty('uptime_guarantee');
    });
  });

  describe('extractKeyTerms() - Purchase specific', () => {
    it('should extract Purchase-specific terms', () => {
      const text = 'warranty provided delivery within 14 days';
      const terms = extractor.extractKeyTerms(text, 'Purchase');
      expect(terms).toHaveProperty('warranty');
      expect(terms).toHaveProperty('delivery_terms');
    });
  });

  describe('extract() - main method', () => {
    it('should return complete extraction result', async () => {
      const result = await extractor.extract(sampleContract, 'NDA');

      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('basic_info');
      expect(result).toHaveProperty('key_terms');
      expect(result).toHaveProperty('obligations');
      expect(result).toHaveProperty('definitions');
      expect(result.extraction_status).toBe('completed');

      expect(result.metadata.contract_type).toBe('NDA');
      expect(result.metadata.extracted_by).toBe('ContractTermsExtractor');
    });

    it('should extract basic info from sample contract', async () => {
      const result = await extractor.extract(sampleContract, 'NDA');
      expect(result.basic_info.jurisdiction).toBe('California');
      expect(result.basic_info.parties.length).toBeGreaterThan(0);
    });

    it('should extract key terms from sample contract', async () => {
      const result = await extractor.extract(sampleContract, 'NDA');
      expect(result.key_terms.confidentiality_duration.numeric_value).toBe(3);
      expect(result.key_terms.liability_cap.numeric_value).toBe(1000000);
      expect(result.key_terms.termination_clause.notice_period).toBe(30);
    });
  });
});
