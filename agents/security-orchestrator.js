/**
 * 安全編排層
 * 協調 3 個安全代理（事件收集、事件分析、事件響應）
 * 進行完整的 SIEM 與自動響應工作流
 */

const fs = require("fs");
const path = require("path");

const SIEMEventCollector = require("./siem-event-collector");
const SIEMEventAnalyzer = require("./siem-event-analyzer");
const IncidentResponseHandler = require("./incident-response-handler");

class SecurityOrchestrator {
  constructor() {
    this.name = "SecurityOrchestrator";
    this.version = "1.0.0";
    this.agents = {
      collector: new SIEMEventCollector(),
      analyzer: new SIEMEventAnalyzer(),
      responder: new IncidentResponseHandler(),
    };
  }

  /**
   * 主工作流程
   * @param {Array} eventSources - 原始安全事件陣列
   * @param {object} options - 選項
   * @returns {object} 完整結果
   */
  async orchestrate(eventSources, options = {}) {
    console.log("\n" + "=".repeat(60));
    console.log("🛡️  [SecurityOrchestrator] 開始 SIEM 與自動響應工作流");
    console.log("=".repeat(60));

    const workflowStartTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    try {
      // Step 1: 驗證輸入
      console.log("\n📥 Step 1: 驗證輸入事件...");
      this.validateInput(eventSources);

      // Step 2: 事件收集與正規化
      console.log("\n📡 Step 2: 收集與正規化事件...");
      const collectionResult = this.agents.collector.collect(eventSources);
      console.log(
        `   ✅ 收集 ${collectionResult.metadata.total_ingested}/${collectionResult.metadata.total_received} 事件`,
      );

      // Step 3: 事件分析
      console.log("\n🔍 Step 3: 分析事件模式與異常...");
      const analysisResult = this.agents.analyzer.analyze(
        collectionResult.events,
      );
      console.log(
        `   ✅ 偵測 ${analysisResult.metadata.patterns_detected} 模式, ${analysisResult.metadata.anomalies_detected} 異常, ${analysisResult.metadata.alerts_generated} 告警`,
      );

      // Step 4: 自動響應
      console.log("\n⚡ Step 4: 執行自動響應...");
      const responseResult = this.agents.responder.respond(
        analysisResult.alerts,
      );
      console.log(
        `   ✅ 處理 ${responseResult.metadata.responded} 告警, 級聯 ${responseResult.metadata.escalated}`,
      );

      // Step 5: 合成報告
      console.log("\n📄 Step 5: 合成安全報告...");
      const report = this.synthesizeReport(
        collectionResult,
        analysisResult,
        responseResult,
        timestamp,
      );

      // Step 6: 輸出結果
      const outputDir = options.outputDir || process.cwd();
      if (options.writeReport !== false) {
        const reportPath = path.join(
          outputDir,
          `security-report-${timestamp}.md`,
        );
        fs.writeFileSync(reportPath, report, "utf-8");
        console.log(`   ✅ 報告已儲存: ${reportPath}`);
      }

      const totalTime = Date.now() - workflowStartTime;
      console.log("\n" + "=".repeat(60));
      console.log(`✅ 工作流完成 (${totalTime}ms)`);
      console.log("=".repeat(60));

      return {
        metadata: {
          workflow: "security-siem-response",
          version: this.version,
          total_time_ms: totalTime,
          timestamp: new Date().toISOString(),
        },
        collection: collectionResult,
        analysis: analysisResult,
        response: responseResult,
        report,
        metrics: this.getMetricsDashboard(
          collectionResult,
          analysisResult,
          responseResult,
          totalTime,
        ),
      };
    } catch (err) {
      console.error(`\n❌ 工作流失敗: ${err.message}`);
      throw err;
    }
  }

  /**
   * 驗證輸入
   * @param {Array} eventSources
   */
  validateInput(eventSources) {
    if (!Array.isArray(eventSources)) {
      throw new Error("eventSources must be an array");
    }
    if (eventSources.length === 0) {
      throw new Error("eventSources cannot be empty");
    }
    for (const event of eventSources) {
      if (!event || typeof event !== "object") {
        throw new Error("Each event source must be a non-null object");
      }
    }
  }

  /**
   * 合成 Markdown 安全報告
   */
  synthesizeReport(
    collectionResult,
    analysisResult,
    responseResult,
    timestamp,
  ) {
    const lines = [];

    lines.push(`# 🛡️ 安全事件報告 - ${timestamp}`);
    lines.push("");
    lines.push("---");
    lines.push("");

    // 概要
    lines.push("## 📊 概要");
    lines.push("");
    lines.push("| 指標 | 值 |");
    lines.push("|------|-----|");
    lines.push(
      `| 接收事件 | ${collectionResult.metadata.total_received} |`,
    );
    lines.push(
      `| 有效事件 | ${collectionResult.metadata.total_ingested} |`,
    );
    lines.push(
      `| 過濾事件 | ${collectionResult.metadata.total_rejected} |`,
    );
    lines.push(
      `| 偵測模式 | ${analysisResult.metadata.patterns_detected} |`,
    );
    lines.push(
      `| 異常事件 | ${analysisResult.metadata.anomalies_detected} |`,
    );
    lines.push(
      `| 生成告警 | ${analysisResult.metadata.alerts_generated} |`,
    );
    lines.push(
      `| 已響應 | ${responseResult.metadata.responded} |`,
    );
    lines.push(
      `| 已級聯 | ${responseResult.metadata.escalated} |`,
    );
    lines.push(
      `| SLA 達標 | ${responseResult.metadata.sla_met} |`,
    );
    lines.push(
      `| SLA 違規 | ${responseResult.metadata.sla_breached} |`,
    );
    lines.push("");

    // 告警詳情
    if (analysisResult.alerts.length > 0) {
      lines.push("## 🚨 告警詳情");
      lines.push("");
      for (const alert of analysisResult.alerts) {
        lines.push(
          `### ${alert.alert_id} [${alert.severity}] - ${alert.category}`,
        );
        lines.push(`- **描述**: ${alert.description}`);
        lines.push(`- **類型**: ${alert.type}`);
        lines.push(`- **建議動作**: ${alert.recommended_action}`);
        lines.push(
          `- **級聯等級**: Level ${alert.escalation_level}`,
        );
        lines.push(
          `- **SLA**: ${alert.sla_response_minutes} 分鐘`,
        );
        lines.push(
          `- **觸發事件**: ${alert.triggered_by.join(", ")}`,
        );
        lines.push("");
      }
    }

    // 響應摘要
    if (responseResult.responses.length > 0) {
      lines.push("## ⚡ 響應摘要");
      lines.push("");
      lines.push("| 告警 | Playbook | 狀態 | SLA | 修復 |");
      lines.push("|------|----------|------|-----|------|");
      for (const resp of responseResult.responses) {
        lines.push(
          `| ${resp.alert_id} | ${resp.playbook_used} | ${resp.actions_taken.length} 動作 | ${resp.sla_status} | ${resp.remediation_status} |`,
        );
      }
      lines.push("");
    }

    // 關聯分析
    if (analysisResult.correlations.length > 0) {
      lines.push("## 🔗 關聯分析");
      lines.push("");
      for (const corr of analysisResult.correlations) {
        lines.push(
          `- **${corr.correlation_id}**: ${corr.event_count} 個 ${corr.category} 事件在 ${corr.time_span_minutes} 分鐘內 (${corr.combined_severity})`,
        );
      }
      lines.push("");
    }

    lines.push("---");
    lines.push(`*報告生成時間: ${new Date().toISOString()}*`);
    lines.push(`*Security Orchestrator v${this.version}*`);

    return lines.join("\n");
  }

  /**
   * 取得指標儀表板
   */
  getMetricsDashboard(
    collectionResult,
    analysisResult,
    responseResult,
    totalTimeMs,
  ) {
    const targets = {
      detection_time_seconds: 60,
      high_severity_response_hours: 4,
      coverage_percent: 95,
      zero_day_leaks: 0,
    };

    const actual = {
      detection_time_seconds:
        (collectionResult.metadata.processing_time_ms +
          analysisResult.metadata.analysis_time_ms) /
        1000,
      total_processing_time_ms: totalTimeMs,
      events_processed: collectionResult.metadata.total_ingested,
      alerts_generated: analysisResult.metadata.alerts_generated,
      alerts_responded: responseResult.metadata.responded,
      sla_compliance_rate:
        responseResult.metadata.responded > 0
          ? Math.round(
              (responseResult.metadata.sla_met /
                responseResult.metadata.responded) *
                100,
            )
          : 100,
      escalation_rate:
        responseResult.metadata.responded > 0
          ? Math.round(
              (responseResult.metadata.escalated /
                responseResult.metadata.responded) *
                100,
            )
          : 0,
    };

    return { targets, actual };
  }
}

module.exports = SecurityOrchestrator;

// CLI 入口
if (require.main === module) {
  const fixturesPath = path.join(
    __dirname,
    "..",
    "tests",
    "fixtures",
    "sample-security-events.json",
  );

  if (fs.existsSync(fixturesPath)) {
    const events = JSON.parse(fs.readFileSync(fixturesPath, "utf-8"));
    const orchestrator = new SecurityOrchestrator();
    orchestrator
      .orchestrate(events, { writeReport: process.argv.includes("--report") })
      .then((result) => {
        console.log("\n📊 指標儀表板:");
        console.log(JSON.stringify(result.metrics, null, 2));
      })
      .catch((err) => {
        console.error("失敗:", err.message);
        process.exit(1);
      });
  } else {
    console.error("找不到測試資料:", fixturesPath);
    process.exit(1);
  }
}
