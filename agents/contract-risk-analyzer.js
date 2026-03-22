/**
 * 合同風險分析代理
 * 識別合同中的風險項，並與標準模板對比
 */

const fs = require('fs');
const path = require('path');

class ContractRiskAnalyzer {
  constructor() {
    this.name = 'ContractRiskAnalyzer';
    this.version = '1.0.0';
    this.loadRulesEngine();
  }

  /**
   * 加載法律規則引擎
   */
  loadRulesEngine() {
    const rulesPath = path.join(__dirname, '../tools/legal-rules-engine.json');
    if (fs.existsSync(rulesPath)) {
      this.rulesEngine = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
    } else {
      this.rulesEngine = this.getDefaultRules();
    }
  }

  /**
   * 主執行方法
   * @param {Object} terms - 條款提取結果 (terms.json)
   * @param {string} contractType - 合同類型
   * @returns {Object} 風險分析結果
   */
  async analyze(terms, contractType = 'Other') {
    console.log(`🔍 [${this.name}] 開始風險分析...`);

    const startTime = Date.now();

    try {
      const risks = [];

      // 分析責任上限風險
      risks.push(...this.analyzeLiabilityCap(terms, contractType));

      // 分析保密期限風險
      risks.push(...this.analyzeConfidentialityPeriod(terms, contractType));

      // 分析支付條款風險
      risks.push(...this.analyzePaymentTerms(terms, contractType));

      // 分析終止條款風險
      risks.push(...this.analyzeTerminationClause(terms, contractType));

      // 分析合同特定風險
      risks.push(...this.analyzeTypeSpecificRisks(terms, contractType));

      // 排序風險：HIGH > MEDIUM > LOW
      risks.sort((a, b) => {
        const severityMap = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return severityMap[b.severity] - severityMap[a.severity];
      });

      const result = {
        metadata: {
          analysis_timestamp: new Date().toISOString(),
          total_risks: risks.length,
          high_severity: risks.filter((r) => r.severity === 'HIGH').length,
          medium_severity: risks.filter((r) => r.severity === 'MEDIUM').length,
          low_severity: risks.filter((r) => r.severity === 'LOW').length,
          analyzed_by: this.name,
          version: this.version
        },
        risks: risks,
        analysis_status: 'completed'
      };

      const duration = Date.now() - startTime;
      console.log(
        `✅ [${this.name}] 風險分析完成 (${duration}ms, ${risks.length} 項風險)`
      );

      return result;
    } catch (error) {
      console.error(`❌ [${this.name}] 分析失敗:`, error.message);
      throw error;
    }
  }

  /**
   * 分析責任上限風險
   */
  analyzeLiabilityCap(terms, contractType) {
    const risks = [];

    if (!terms.key_terms || !terms.key_terms.liability_cap) {
      return risks;
    }

    const cap = terms.key_terms.liability_cap;
    const industry_standard = this.getIndustryStandard(contractType, 'liability_cap');

    if (!cap.numeric_value) {
      risks.push({
        risk_id: 'RISK-001',
        type: 'liability_cap_missing',
        severity: 'HIGH',
        description: '責任上限未明確指定',
        impact: '如發生爭議，公司責任可能無限',
        recommendation: '應明確限定責任金額'
      });
    } else if (cap.numeric_value < industry_standard * 0.5) {
      risks.push({
        risk_id: 'RISK-002',
        type: 'liability_cap_low',
        severity: 'HIGH',
        description: '責任上限低於行業標準',
        current_value: cap.description,
        recommended_value: `$${industry_standard.toLocaleString()}`,
        impact: '公司在爭議中的風險敞口較大',
        recommendation: `請求提高責任上限至 $${industry_standard.toLocaleString()}`
      });
    } else if (cap.numeric_value < industry_standard) {
      risks.push({
        risk_id: 'RISK-003',
        type: 'liability_cap_below_standard',
        severity: 'MEDIUM',
        description: '責任上限略低於行業標準',
        current_value: cap.description,
        recommended_value: `$${industry_standard.toLocaleString()}`,
        impact: '在較大爭議中可能無法完全保護公司',
        recommendation: '建議協商至行業標準水平'
      });
    }

    return risks;
  }

  /**
   * 分析保密期限風險
   */
  analyzeConfidentialityPeriod(terms, contractType) {
    const risks = [];

    if (!terms.key_terms || !terms.key_terms.confidentiality_duration) {
      return risks;
    }

    const period = terms.key_terms.confidentiality_duration;
    const industry_standard = this.getIndustryStandard(contractType, 'confidentiality_period');

    if (!period.numeric_value) {
      risks.push({
        risk_id: 'RISK-004',
        type: 'confidentiality_period_missing',
        severity: 'MEDIUM',
        description: '保密期限未明確指定',
        impact: '對方可能在任何時間洩露信息',
        recommendation: '應明確規定保密期限'
      });
    } else if (period.numeric_value < industry_standard * 0.5) {
      risks.push({
        risk_id: 'RISK-005',
        type: 'confidentiality_period_short',
        severity: 'MEDIUM',
        description: '保密期限短於合理期限',
        current_value: `${period.numeric_value} ${period.unit}`,
        recommended_value: `${industry_standard} years`,
        impact: '信息保護期限不足，可能被對方在期限後洩露',
        recommendation: `協商將保密期延長至 ${industry_standard} 年`
      });
    }

    return risks;
  }

  /**
   * 分析支付條款風險
   */
  analyzePaymentTerms(terms, contractType) {
    const risks = [];

    if (contractType !== 'Purchase' && contractType !== 'SLA') {
      return risks;
    }

    if (!terms.key_terms || !terms.key_terms.payment_terms) {
      return risks;
    }

    const payment = terms.key_terms.payment_terms;

    if (!payment.payment_days) {
      risks.push({
        risk_id: 'RISK-006',
        type: 'payment_terms_unclear',
        severity: 'MEDIUM',
        description: '支付條款不清晰',
        impact: '可能導致支付糾紛',
        recommendation: '應明確指定支付期限'
      });
    } else if (payment.payment_days > 90) {
      risks.push({
        risk_id: 'RISK-007',
        type: 'payment_terms_long',
        severity: 'LOW',
        description: '支付期限較長',
        current_value: `${payment.payment_days} 天`,
        impact: '延長公司的資金周期',
        recommendation: '協商縮短支付期限至 30-60 天'
      });
    }

    return risks;
  }

  /**
   * 分析終止條款風險
   */
  analyzeTerminationClause(terms, contractType) {
    const risks = [];

    if (!terms.key_terms || !terms.key_terms.termination_clause) {
      return risks;
    }

    const termination = terms.key_terms.termination_clause;

    if (!termination.notice_period) {
      risks.push({
        risk_id: 'RISK-008',
        type: 'termination_clause_missing',
        severity: 'MEDIUM',
        description: '終止條款不明確',
        impact: '對方可能隨時終止合同',
        recommendation: '應明確指定終止通知期限'
      });
    } else if (termination.notice_period < 30) {
      risks.push({
        risk_id: 'RISK-009',
        type: 'termination_clause_short',
        severity: 'MEDIUM',
        description: '終止通知期限過短',
        current_value: `${termination.notice_period} 天`,
        impact: '給公司準備時間不足',
        recommendation: '協商延長通知期限至 30-60 天'
      });
    }

    return risks;
  }

  /**
   * 分析合同特定風險
   */
  analyzeTypeSpecificRisks(terms, contractType) {
    const risks = [];

    if (contractType === 'NDA') {
      risks.push(...this.analyzeNDASpecificRisks(terms));
    } else if (contractType === 'SLA') {
      risks.push(...this.analyzeSLASpecificRisks(terms));
    } else if (contractType === 'Purchase') {
      risks.push(...this.analyzePurchaseSpecificRisks(terms));
    }

    return risks;
  }

  /**
   * 分析 NDA 特定風險
   */
  analyzeNDASpecificRisks(terms) {
    const risks = [];

    if (!terms.key_terms?.permitted_use?.description || !terms.key_terms.permitted_use.description.includes('Limited')) {
      risks.push({
        risk_id: 'RISK-010',
        type: 'nda_permitted_use_vague',
        severity: 'MEDIUM',
        description: '允許的使用方式不夠明確',
        impact: '對方可能以超出預期的方式使用信息',
        recommendation: '明確限定對方可以如何使用披露的信息'
      });
    }

    if (
      !terms.key_terms?.return_of_information?.description ||
      !terms.key_terms.return_of_information.description.includes('returned')
    ) {
      risks.push({
        risk_id: 'RISK-011',
        type: 'nda_no_return_clause',
        severity: 'MEDIUM',
        description: '缺少信息返回或銷毀條款',
        impact: '合同終止後，對方仍可能保留信息',
        recommendation: '添加條款規定對方必須返回或銷毀所有信息'
      });
    }

    return risks;
  }

  /**
   * 分析 SLA 特定風險
   */
  analyzeSLASpecificRisks(terms) {
    const risks = [];

    if (!terms.key_terms?.service_level_objectives?.description) {
      risks.push({
        risk_id: 'RISK-012',
        type: 'sla_no_slo_defined',
        severity: 'HIGH',
        description: '未定義服務水平目標 (SLO)',
        impact: '無法衡量服務提供者的服務質量',
        recommendation: '明確定義 SLO（如響應時間、解決時間）'
      });
    }

    if (!terms.key_terms?.uptime_guarantee?.description) {
      risks.push({
        risk_id: 'RISK-013',
        type: 'sla_no_uptime_guarantee',
        severity: 'HIGH',
        description: '未定義正常運行時間保證',
        impact: '服務提供者無法保證服務可用性',
        recommendation: '定義正常運行時間保證（如 99.9%）'
      });
    }

    return risks;
  }

  /**
   * 分析購銷合同特定風險
   */
  analyzePurchaseSpecificRisks(terms) {
    const risks = [];

    if (!terms.key_terms?.warranty?.description || terms.key_terms.warranty.description.includes('No')) {
      risks.push({
        risk_id: 'RISK-014',
        type: 'purchase_no_warranty',
        severity: 'MEDIUM',
        description: '未提供產品保修',
        impact: '購買後發現問題時無保障',
        recommendation: '要求供應商提供至少 12 個月的保修'
      });
    }

    if (!terms.key_terms?.delivery_terms?.description) {
      risks.push({
        risk_id: 'RISK-015',
        type: 'purchase_no_delivery_terms',
        severity: 'MEDIUM',
        description: '交付條款不明確',
        impact: '可能導致交付延遲糾紛',
        recommendation: '明確指定交付期限和地點'
      });
    }

    return risks;
  }

  /**
   * 獲取行業標準值
   */
  getIndustryStandard(contractType, parameter) {
    const standards = {
      NDA: {
        liability_cap: 5000000,
        confidentiality_period: 5
      },
      SLA: {
        liability_cap: 10000000,
        uptime_guarantee: 0.999
      },
      Purchase: {
        liability_cap: 3000000,
        warranty_months: 12
      },
      Default: {
        liability_cap: 5000000,
        confidentiality_period: 3
      }
    };

    const contractStandards = standards[contractType] || standards.Default;
    return contractStandards[parameter] || standards.Default[parameter] || 1000000;
  }

  /**
   * 獲取默認規則引擎
   */
  getDefaultRules() {
    return {
      contract_types: {
        NDA: {
          required_clauses: ['confidentiality', 'definition_of_confidential_info', 'permitted_use'],
          risk_keywords: [
            'perpetual',
            'unlimited',
            'entire world',
            'successors and assigns'
          ]
        },
        SLA: {
          required_clauses: ['service_level_objectives', 'uptime_guarantee', 'remedies'],
          risk_keywords: ['best effort', 'no guarantee', 'except for']
        },
        Purchase: {
          required_clauses: ['delivery_terms', 'payment_terms', 'warranty'],
          risk_keywords: ['as is', 'no warranty', 'buyer assumes all risk']
        }
      }
    };
  }
}

// 如果作為獨立腳本運行
if (require.main === module) {
  const termsPath = process.argv[2] || 'terms.json';
  const contractType = process.argv[3] || 'Other';

  if (!fs.existsSync(termsPath)) {
    console.error(`❌ 找不到文件: ${termsPath}`);
    process.exit(1);
  }

  const terms = JSON.parse(fs.readFileSync(termsPath, 'utf-8'));

  const analyzer = new ContractRiskAnalyzer();
  analyzer.analyze(terms, contractType).then((result) => {
    console.log('\n⚠️ 分析結果:');
    console.log(JSON.stringify(result, null, 2));

    // 保存到文件
    const outputFile = path.join(path.dirname(termsPath), 'risk_flags.json');
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\n💾 結果已保存到: ${outputFile}`);
  });
}

module.exports = ContractRiskAnalyzer;
