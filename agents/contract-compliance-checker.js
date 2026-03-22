/**
 * 合同合規性檢查代理
 * 驗證合同是否符合法律和公司政策要求
 */

const fs = require('fs');
const path = require('path');

class ContractComplianceChecker {
  constructor() {
    this.name = 'ContractComplianceChecker';
    this.version = '1.0.0';
    this.loadComplianceRules();
  }

  /**
   * 加載合規性規則
   */
  loadComplianceRules() {
    const rulesPath = path.join(__dirname, '../tools/compliance-rules.json');
    if (fs.existsSync(rulesPath)) {
      this.complianceRules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
    } else {
      this.complianceRules = this.getDefaultComplianceRules();
    }
  }

  /**
   * 主執行方法
   * @param {Object} terms - 條款提取結果 (terms.json)
   * @param {string} jurisdiction - 司法管轄區
   * @returns {Object} 合規性檢查結果
   */
  async check(terms, jurisdiction = 'California') {
    console.log(`🔍 [${this.name}] 開始合規性檢查...`);

    const startTime = Date.now();

    try {
      const issues = [];

      // 檢查數據保護合規
      issues.push(...this.checkDataProtectionCompliance(terms, jurisdiction));

      // 檢查責任和免責合規
      issues.push(...this.checkLiabilityCompliance(terms));

      // 檢查隱私政策合規
      issues.push(...this.checkPrivacyCompliance(terms, jurisdiction));

      // 檢查知識產權合規
      issues.push(...this.checkIPCompliance(terms));

      // 檢查終止和仲裁合規
      issues.push(...this.checkDisputeResolutionCompliance(terms));

      // 檢查行業特定合規
      issues.push(...this.checkIndustrySpecificCompliance(terms, jurisdiction));

      // 排序問題：CRITICAL > HIGH > MEDIUM > LOW
      issues.sort((a, b) => {
        const severityMap = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return severityMap[b.severity] - severityMap[a.severity];
      });

      const result = {
        metadata: {
          check_timestamp: new Date().toISOString(),
          jurisdiction: jurisdiction,
          total_issues: issues.length,
          critical: issues.filter((i) => i.severity === 'CRITICAL').length,
          high: issues.filter((i) => i.severity === 'HIGH').length,
          medium: issues.filter((i) => i.severity === 'MEDIUM').length,
          low: issues.filter((i) => i.severity === 'LOW').length,
          checked_by: this.name,
          version: this.version
        },
        compliance_checks: issues,
        check_status: 'completed'
      };

      const duration = Date.now() - startTime;
      console.log(
        `✅ [${this.name}] 合規性檢查完成 (${duration}ms, ${issues.length} 項問題)`
      );

      return result;
    } catch (error) {
      console.error(`❌ [${this.name}] 檢查失敗:`, error.message);
      throw error;
    }
  }

  /**
   * 檢查數據保護合規
   */
  checkDataProtectionCompliance(terms, jurisdiction) {
    const issues = [];
    const text = JSON.stringify(terms);

    // CCPA (California Consumer Privacy Act)
    if (jurisdiction === 'California' || jurisdiction === 'USA') {
      if (!text.match(/CCPA|california consumer privacy|數據隱私|privacy notice/i)) {
        issues.push({
          check_id: 'COMP-001',
          category: 'data_protection',
          jurisdiction_requirement: 'CCPA',
          severity: 'HIGH',
          requirement: 'CCPA compliance clause required',
          status: 'MISSING',
          description: 'California Consumer Privacy Act (CCPA) 要求在合同中明確說明數據處理',
          impact: 'Violation of CCPA requirements',
          recommendation: '添加 CCPA 合規條款，說明如何處理加州居民的個人數據'
        });
      }
    }

    // GDPR (European Union)
    if (jurisdiction.includes('EU') || jurisdiction.includes('Europe')) {
      if (!text.match(/GDPR|general data protection|data processing|data controller|data processor/i)) {
        issues.push({
          check_id: 'COMP-002',
          category: 'data_protection',
          jurisdiction_requirement: 'GDPR',
          severity: 'HIGH',
          requirement: 'GDPR compliance clause required',
          status: 'MISSING',
          description: 'GDPR 要求在涉及歐盟個人數據的合同中明確數據控制和處理的角色',
          impact: 'Violation of GDPR requirements',
          recommendation: '添加 GDPR 合規條款，明確數據控制者和處理者的責任'
        });
      }
    }

    // 通用數據保護檢查
    if (!text.match(/data protection|data security|encryption|secur/i)) {
      issues.push({
        check_id: 'COMP-003',
        category: 'data_protection',
        severity: 'MEDIUM',
        requirement: 'Data protection measures must be specified',
        status: 'MISSING',
        description: '合同應包含數據保護和安全措施的說明',
        impact: 'Lack of clarity on data protection responsibilities',
        recommendation: '添加數據保護措施章節，說明雙方如何保護敏感信息'
      });
    }

    return issues;
  }

  /**
   * 檢查責任和免責合規
   */
  checkLiabilityCompliance(terms) {
    const issues = [];
    const text = JSON.stringify(terms);

    if (!text.match(/liability|indemnif|damages|exclusion|limitation/i)) {
      issues.push({
        check_id: 'COMP-004',
        category: 'liability',
        severity: 'MEDIUM',
        requirement: 'Liability limitations must be clearly stated',
        status: 'MISSING',
        description: '合同應明確規定責任限制和排除',
        impact: 'Potential unlimited liability exposure',
        recommendation: '添加責任限制和排除條款'
      });
    }

    // 檢查免責條款
    if (!text.match(/consequential damages|indirect damages|lost profits|loss of data/i)) {
      issues.push({
        check_id: 'COMP-005',
        category: 'liability_exclusion',
        severity: 'MEDIUM',
        requirement: 'Consequential damages exclusion recommended',
        status: 'MISSING',
        description: '應排除對間接損害賠償的責任',
        impact: 'Exposure to indirect damages claims',
        recommendation: '添加排除間接損害、利潤損失和數據損失賠償的條款'
      });
    }

    return issues;
  }

  /**
   * 檢查隱私政策合規
   */
  checkPrivacyCompliance(terms, jurisdiction) {
    const issues = [];
    const text = JSON.stringify(terms);

    if (!text.match(/privacy|personal data|personally identifiable|PII/i)) {
      issues.push({
        check_id: 'COMP-006',
        category: 'privacy',
        severity: 'MEDIUM',
        requirement: 'Privacy and personal data handling must be addressed',
        status: 'MISSING',
        description: '合同應包含隱私政策和個人數據處理的說明',
        impact: 'Non-compliance with privacy regulations',
        recommendation: '添加隱私政策和個人數據處理條款'
      });
    }

    // 檢查隱私通知
    if (!text.match(/privacy notice|privacy policy|disclose|notice/i)) {
      issues.push({
        check_id: 'COMP-007',
        category: 'privacy_notice',
        severity: 'LOW',
        requirement: 'Privacy notice should be provided',
        status: 'MISSING',
        description: '應向相關方提供隱私通知',
        recommendation: '提供隱私通知文件'
      });
    }

    return issues;
  }

  /**
   * 檢查知識產權合規
   */
  checkIPCompliance(terms) {
    const issues = [];
    const text = JSON.stringify(terms);

    if (!text.match(/intellectual property|IP|patent|trademark|copyright|proprietary/i)) {
      issues.push({
        check_id: 'COMP-008',
        category: 'intellectual_property',
        severity: 'MEDIUM',
        requirement: 'IP ownership and rights must be clearly specified',
        status: 'MISSING',
        description: '合同應明確規定知識產權的所有權和使用權',
        impact: 'Potential IP disputes',
        recommendation: '添加知識產權條款，明確所有權和使用許可'
      });
    }

    // 檢查代碼和軟件知識產權
    if (text.match(/software|code|API|source code/i)) {
      if (!text.match(/open source|license|GPL|MIT|source code access/i)) {
        issues.push({
          check_id: 'COMP-009',
          category: 'software_ip',
          severity: 'HIGH',
          requirement: 'Software IP and licensing must be addressed',
          status: 'MISSING',
          description: '涉及軟件代碼的合同應明確許可和知識產權條款',
          impact: 'IP infringement risk',
          recommendation: '添加軟件許可和開源代碼披露要求'
        });
      }
    }

    return issues;
  }

  /**
   * 檢查爭議解決和仲裁合規
   */
  checkDisputeResolutionCompliance(terms) {
    const issues = [];
    const text = JSON.stringify(terms);

    if (!text.match(/dispute|arbitration|mediation|jurisdiction|governing law|court/i)) {
      issues.push({
        check_id: 'COMP-010',
        category: 'dispute_resolution',
        severity: 'MEDIUM',
        requirement: 'Dispute resolution mechanism must be specified',
        status: 'MISSING',
        description: '合同應明確爭議解決機制和準據法',
        impact: 'Unclear dispute resolution process',
        recommendation: '添加爭議解決條款，包括仲裁或訴訟程序'
      });
    }

    // 檢查管轄權
    const jurisdiction = terms.basic_info?.jurisdiction;
    if (!jurisdiction) {
      issues.push({
        check_id: 'COMP-011',
        category: 'jurisdiction',
        severity: 'MEDIUM',
        requirement: 'Jurisdiction must be clearly specified',
        status: 'MISSING',
        description: '應明確指定管轄權和準據法',
        recommendation: '明確規定合同爭議由哪個司法管轄區的法院管轄'
      });
    }

    return issues;
  }

  /**
   * 檢查行業特定合規
   */
  checkIndustrySpecificCompliance(terms, jurisdiction) {
    const issues = [];
    const contractType = terms.metadata?.contract_type;

    if (contractType === 'SLA') {
      issues.push(...this.checkSLACompliance(terms));
    } else if (contractType === 'NDA') {
      issues.push(...this.checkNDACompliance(terms));
    } else if (contractType === 'Purchase') {
      issues.push(...this.checkPurchaseCompliance(terms));
    }

    return issues;
  }

  /**
   * 檢查 SLA 合規
   */
  checkSLACompliance(terms) {
    const issues = [];
    const text = JSON.stringify(terms);

    if (!text.match(/service level|SLO|uptime|availability|response time/i)) {
      issues.push({
        check_id: 'COMP-012',
        category: 'sla_requirements',
        severity: 'HIGH',
        requirement: 'Service Level Objectives (SLO) must be defined',
        status: 'MISSING',
        description: 'SLA 應明確定義服務水平目標',
        impact: 'Inability to measure service performance',
        recommendation: '明確定義 SLO，如 99.9% 正常運行時間、4 小時響應時間'
      });
    }

    if (!text.match(/penalty|credit|refund|SLA breach/i)) {
      issues.push({
        check_id: 'COMP-013',
        category: 'sla_remedies',
        severity: 'MEDIUM',
        requirement: 'SLA breach remedies must be specified',
        status: 'MISSING',
        description: 'SLA 違反時的補救措施應明確指定',
        recommendation: '定義違反 SLA 時的賠償機制（如積分制或退款）'
      });
    }

    return issues;
  }

  /**
   * 檢查 NDA 合規
   */
  checkNDACompliance(terms) {
    const issues = [];
    const text = JSON.stringify(terms);

    if (!text.match(/confidential information|definition|proprietary/i)) {
      issues.push({
        check_id: 'COMP-014',
        category: 'nda_definition',
        severity: 'MEDIUM',
        requirement: 'Confidential information must be clearly defined',
        status: 'MISSING',
        description: 'NDA 應明確定義什麼構成機密信息',
        recommendation: '添加機密信息的明確定義'
      });
    }

    if (!text.match(/permitted use|limited to|purpose|authorization/i)) {
      issues.push({
        check_id: 'COMP-015',
        category: 'nda_permitted_use',
        severity: 'MEDIUM',
        requirement: 'Permitted uses must be clearly restricted',
        status: 'MISSING',
        description: 'NDA 應明確限定機密信息的使用方式',
        recommendation: '限制使用方式為特定的商業目的'
      });
    }

    return issues;
  }

  /**
   * 檢查購銷合同合規
   */
  checkPurchaseCompliance(terms) {
    const issues = [];
    const text = JSON.stringify(terms);

    if (!text.match(/warranty|warranti|guarantee|condition|defect/i)) {
      issues.push({
        check_id: 'COMP-016',
        category: 'purchase_warranty',
        severity: 'MEDIUM',
        requirement: 'Product warranty must be specified',
        status: 'MISSING',
        description: '購銷合同應明確規定產品保修',
        recommendation: '定義保修期限和保修範圍'
      });
    }

    if (!text.match(/delivery|shipment|FOB|payment|invoice/i)) {
      issues.push({
        check_id: 'COMP-017',
        category: 'purchase_terms',
        severity: 'MEDIUM',
        requirement: 'Delivery and payment terms must be clearly stated',
        status: 'MISSING',
        description: '應明確規定交付和支付條款',
        recommendation: '明確包括運費承擔方、交付地點、支付期限'
      });
    }

    return issues;
  }

  /**
   * 獲取默認合規性規則
   */
  getDefaultComplianceRules() {
    return {
      data_protection: {
        CCPA: {
          jurisdiction: 'California',
          required_clauses: ['data_handling', 'consumer_rights', 'notice']
        },
        GDPR: {
          jurisdiction: 'EU',
          required_clauses: ['data_controller', 'data_processor', 'dpa']
        }
      },
      liability: {
        required: true,
        max_unlimited: false,
        exclude_consequential: true
      },
      privacy: {
        required: true,
        must_address_personal_data: true
      }
    };
  }
}

// 如果作為獨立腳本運行
if (require.main === module) {
  const termsPath = process.argv[2] || 'terms.json';
  const jurisdiction = process.argv[3] || 'California';

  if (!fs.existsSync(termsPath)) {
    console.error(`❌ 找不到文件: ${termsPath}`);
    process.exit(1);
  }

  const terms = JSON.parse(fs.readFileSync(termsPath, 'utf-8'));

  const checker = new ContractComplianceChecker();
  checker.check(terms, jurisdiction).then((result) => {
    console.log('\n✅ 合規性檢查結果:');
    console.log(JSON.stringify(result, null, 2));

    // 保存到文件
    const outputFile = path.join(path.dirname(termsPath), 'compliance_issues.json');
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\n💾 結果已保存到: ${outputFile}`);
  });
}

module.exports = ContractComplianceChecker;
