/**
 * 合同條款提取代理
 * 從合同文本中提取關鍵條款和結構化信息
 */

const fs = require('fs');
const path = require('path');

class ContractTermsExtractor {
  constructor() {
    this.name = 'ContractTermsExtractor';
    this.version = '1.0.0';
  }

  /**
   * 主執行方法
   * @param {string} contractText - 合同原文（pure text）
   * @param {string} contractType - 合同類型 (NDA, SLA, MSA 等)
   * @returns {Object} 提取的條款結構化數據
   */
  async extract(contractText, contractType = 'Other') {
    console.log(`🔍 [${this.name}] 開始提取合同條款...`);

    const startTime = Date.now();

    try {
      const result = {
        metadata: {
          contract_type: contractType,
          extraction_timestamp: new Date().toISOString(),
          confidence: 0.85,
          extracted_by: this.name,
          version: this.version
        },
        basic_info: this.extractBasicInfo(contractText),
        key_terms: this.extractKeyTerms(contractText, contractType),
        obligations: this.extractObligations(contractText),
        definitions: this.extractDefinitions(contractText),
        extraction_status: 'completed'
      };

      const duration = Date.now() - startTime;
      console.log(`✅ [${this.name}] 條款提取完成 (${duration}ms)`);

      return result;
    } catch (error) {
      console.error(`❌ [${this.name}] 提取失敗:`, error.message);
      throw error;
    }
  }

  /**
   * 提取基本信息（當事人、日期、管轄權等）
   */
  extractBasicInfo(text) {
    const info = {
      parties: this.extractParties(text),
      effective_date: this.extractDate(text, 'effective|Effective'),
      expiration_date: this.extractDate(text, 'expiration|expir|term|期限'),
      jurisdiction: this.extractJurisdiction(text),
      governing_law: this.extractGoverningLaw(text)
    };

    return info;
  }

  /**
   * 提取當事人名稱
   */
  extractParties(text) {
    const parties = [];
    // 簡單的模式匹配，實際應用可使用 NLP
    const patterns = [
      /BETWEEN\s+(.+?)\s+(?:AND|and)/,
      /Party\s+(?:A|One)\s*:\s*(.+?)(?:\n|;)/,
      /Party\s+(?:B|Two)\s*:\s*(.+?)(?:\n|;)/
    ];

    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches && matches[1]) {
        parties.push(matches[1].trim());
      }
    });

    return parties.length > 0 ? parties : ['Party to be identified'];
  }

  /**
   * 提取日期
   */
  extractDate(text, keyword) {
    const pattern = new RegExp(
      `${keyword}[^:]*:\\s*([\\w\\s,]+\\d{1,2},?\\s*\\d{4}|\\d{4}-\\d{2}-\\d{2})`,
      'i'
    );
    const match = text.match(pattern);
    return match ? match[1].trim() : null;
  }

  /**
   * 提取管轄權
   */
  extractJurisdiction(text) {
    const jurisdictions = ['California', 'New York', 'Delaware', 'Texas', 'Florida', 'Illinois'];
    for (const jurisdiction of jurisdictions) {
      if (text.includes(jurisdiction)) {
        return jurisdiction;
      }
    }
    return 'Unknown';
  }

  /**
   * 提取準據法
   */
  extractGoverningLaw(text) {
    const pattern = /(?:governed|governed by|准据法)\s*(?:of|by)?\s*(?:the\s+)?([^,\n]+)/i;
    const match = text.match(pattern);
    return match ? match[1].trim() : 'Not specified';
  }

  /**
   * 提取關鍵條款
   */
  extractKeyTerms(text, contractType) {
    const terms = {};

    // 通用條款提取
    terms.confidentiality_duration = this.extractConfidentialityPeriod(text);
    terms.liability_cap = this.extractLiabilityCap(text);
    terms.termination_clause = this.extractTerminationClause(text);
    terms.payment_terms = this.extractPaymentTerms(text);

    // 根據合同類型提取特定條款
    if (contractType === 'NDA') {
      terms.permitted_use = this.extractPermittedUse(text);
      terms.return_of_information = this.extractReturnOfInformation(text);
    } else if (contractType === 'SLA') {
      terms.service_level_objectives = this.extractSLO(text);
      terms.uptime_guarantee = this.extractUptimeGuarantee(text);
    } else if (contractType === 'Purchase') {
      terms.warranty = this.extractWarranty(text);
      terms.delivery_terms = this.extractDeliveryTerms(text);
    }

    return terms;
  }

  /**
   * 提取保密期限
   */
  extractConfidentialityPeriod(text) {
    const patterns = [
      /confidential.*?(\d+)\s*(?:year|yr|年)/i,
      /(?:during|for)\s+(?:the\s+)?(?:period\s+)?of\s+(\d+)\s*year/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          description: `${match[1]} years from disclosure`,
          numeric_value: parseInt(match[1]),
          unit: 'years'
        };
      }
    }

    return {
      description: 'Not specified',
      numeric_value: null,
      unit: 'years'
    };
  }

  /**
   * 提取責任上限
   */
  extractLiabilityCap(text) {
    const patterns = [
      /liability.*?cap.*?\$?(\d+(?:,\d{3})*)/i,
      /(?:not\s+)?exceed.*?\$?(\d+(?:,\d{3})*)/i,
      /limitation.*?liability.*?\$?(\d+(?:,\d{3})*)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseInt(match[1].replace(/,/g, ''));
        return {
          description: `$${value.toLocaleString()}`,
          numeric_value: value,
          currency: 'USD'
        };
      }
    }

    return {
      description: 'Not specified',
      numeric_value: null,
      currency: 'USD'
    };
  }

  /**
   * 提取終止條款
   */
  extractTerminationClause(text) {
    const pattern = /(?:terminat|cancel).*?(\d+)\s*(?:day|天)/i;
    const match = text.match(pattern);

    if (match) {
      return {
        description: `Either party may terminate with ${match[1]} days notice`,
        notice_period: parseInt(match[1]),
        notice_unit: 'days'
      };
    }

    return {
      description: 'Not explicitly stated',
      notice_period: null,
      notice_unit: 'days'
    };
  }

  /**
   * 提取支付條款
   */
  extractPaymentTerms(text) {
    const pattern = /(?:payment|pay).*?(?:within|in)\s*(\d+)\s*(?:day|日)/i;
    const match = text.match(pattern);

    if (match) {
      return {
        description: `Payment due within ${match[1]} days`,
        payment_days: parseInt(match[1])
      };
    }

    return { description: 'Not specified' };
  }

  /**
   * 提取允許的使用方式 (NDA)
   */
  extractPermittedUse(text) {
    if (text.match(/permitted.*use|use.*may.*only/i)) {
      return { description: 'Permitted uses are limited' };
    }
    return { description: 'Not specified' };
  }

  /**
   * 提取信息返回條款 (NDA)
   */
  extractReturnOfInformation(text) {
    if (text.match(/return|destroy|retain/i)) {
      return { description: 'Information must be returned or destroyed' };
    }
    return { description: 'Not specified' };
  }

  /**
   * 提取服務水平目標 (SLA)
   */
  extractSLO(text) {
    const pattern = /slo|service.*level.*objective|response.*time\s*[:\s]*(\d+)\s*(?:hour|minute)/i;
    const match = text.match(pattern);

    if (match) {
      return { description: `Response time: ${match[1]} hours/minutes` };
    }

    return { description: 'Not specified' };
  }

  /**
   * 提取正常運行時間保證 (SLA)
   */
  extractUptimeGuarantee(text) {
    const pattern = /uptime.*?(99\.?\d*%)/i;
    const match = text.match(pattern);

    if (match) {
      return { description: `${match[1]} uptime guarantee` };
    }

    return { description: 'Not specified' };
  }

  /**
   * 提取保修條款 (Purchase)
   */
  extractWarranty(text) {
    if (text.match(/warrant|guarantee/i)) {
      return { description: 'Warranty provided' };
    }
    return { description: 'No warranty specified' };
  }

  /**
   * 提取交付條款 (Purchase)
   */
  extractDeliveryTerms(text) {
    const pattern = /delivery.*?(\d+)\s*(?:day|week)/i;
    const match = text.match(pattern);

    if (match) {
      return { description: `Delivery within ${match[1]} days/weeks` };
    }

    return { description: 'Not specified' };
  }

  /**
   * 提取義務
   */
  extractObligations(text) {
    const obligations = [];

    const patterns = [
      { keyword: 'confidentiality|保密', obligation: 'Maintain confidentiality' },
      { keyword: 'protect|保護', obligation: 'Protect information' },
      { keyword: 'indemnif|賠償', obligation: 'Indemnification' },
      { keyword: 'insurance|保險', obligation: 'Maintain insurance' },
      { keyword: 'compliance|合規', obligation: 'Ensure compliance' }
    ];

    patterns.forEach(({ keyword, obligation }) => {
      if (new RegExp(keyword, 'i').test(text)) {
        obligations.push({
          description: obligation,
          severity: 'MEDIUM'
        });
      }
    });

    return obligations.length > 0 ? obligations : [];
  }

  /**
   * 提取定義
   */
  extractDefinitions(text) {
    const definitions = {};

    // 簡單的定義提取（實際應用需更複雜的邏輯）
    const pattern = /"([^"]+)"\s*(?:means|shall mean|定義為)\s*(.+?)(?:\.|;|\n)/gi;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      definitions[match[1]] = match[2].trim();
    }

    return definitions;
  }
}

// 如果作為獨立腳本運行
if (require.main === module) {
  const contractText = fs.readFileSync(process.argv[2] || 'contract_text.txt', 'utf-8');
  const contractType = process.argv[3] || 'Other';

  const extractor = new ContractTermsExtractor();
  extractor.extract(contractText, contractType).then((result) => {
    console.log('\n📋 提取結果:');
    console.log(JSON.stringify(result, null, 2));

    // 保存到文件
    const outputFile = path.join(path.dirname(process.argv[2] || '.'), 'terms.json');
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\n💾 結果已保存到: ${outputFile}`);
  });
}

module.exports = ContractTermsExtractor;
