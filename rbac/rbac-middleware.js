'use strict';

const RBACManager = require('./rbac-manager');

/**
 * RBAC 中間層 — Claude Code PreToolUse Hook 整合
 * 在工具執行前檢查權限，產生稽核日誌
 */
class RBACMiddleware {
  /**
   * @param {RBACManager} rbacManager
   */
  constructor(rbacManager) {
    if (!(rbacManager instanceof RBACManager)) {
      throw new Error('RBACMiddleware requires an RBACManager instance');
    }
    this._manager = rbacManager;
    this._auditLog = [];
  }

  /**
   * 執行權限檢查
   * @param {string} roleName
   * @param {{ tool: string, args: string }} toolRequest
   * @returns {{ continue: boolean, reason: string, systemMessage?: string }}
   */
  enforce(roleName, toolRequest) {
    const result = this._manager.checkPermission(roleName, toolRequest);
    const timestamp = new Date().toISOString();

    // 記錄稽核日誌
    this._auditLog.push({
      timestamp,
      role: roleName,
      tool: toolRequest.tool,
      args: toolRequest.args || '',
      decision: result.decision,
      matchedRule: result.matchedRule,
      reason: result.reason,
    });

    if (result.decision === 'allow') {
      return {
        continue: true,
        reason: result.reason,
      };
    }

    if (result.decision === 'ask') {
      return {
        continue: false,
        reason: result.reason,
        systemMessage: `⚠️ 需要人類確認：角色 "${roleName}" 執行 ${toolRequest.tool}(${toolRequest.args || ''}) — ${result.matchedRule}`,
      };
    }

    // deny
    return {
      continue: false,
      reason: result.reason,
    };
  }

  /**
   * 為指定角色產生 Claude Code PreToolUse hook 配置
   * @param {string} roleName
   * @returns {object} Claude Code hook 配置物件
   */
  generateHookConfig(roleName) {
    const role = this._manager.getRole(roleName);
    if (!role) {
      throw new Error(`Unknown role: "${roleName}"`);
    }

    const { deny = [], ask = [] } = role.permissions;

    const hooks = [];

    // 為 deny 規則生成攔截 hook
    if (deny.length > 0) {
      const denyPatterns = deny
        .map((d) => {
          const match = d.match(/^(\w+)(?:\((.+)\))?$/);
          return match ? match[0] : null;
        })
        .filter(Boolean);

      hooks.push({
        matcher: '.*',
        hooks: [
          {
            type: 'command',
            command: `echo "RBAC: Checking ${roleName} permissions..." && exit 0`,
            statusMessage: `🔒 RBAC 權限檢查 (${roleName})`,
          },
        ],
        _rbac_deny_patterns: denyPatterns,
        _rbac_role: roleName,
      });
    }

    // 為 ask 規則生成確認 hook
    if (ask.length > 0) {
      hooks.push({
        matcher: '.*',
        hooks: [
          {
            type: 'command',
            command: `echo "RBAC: Operation requires confirmation for role ${roleName}" && exit 0`,
            statusMessage: `⚠️ RBAC 確認需求 (${roleName})`,
          },
        ],
        _rbac_ask_patterns: ask,
        _rbac_role: roleName,
      });
    }

    return {
      PreToolUse: hooks,
    };
  }

  /**
   * 取得稽核日誌
   * @returns {Array<{timestamp: string, role: string, tool: string, args: string, decision: string, matchedRule: string|null, reason: string}>}
   */
  getAuditLog() {
    return [...this._auditLog];
  }

  /**
   * 清除稽核日誌
   */
  clearAuditLog() {
    this._auditLog = [];
  }
}

module.exports = RBACMiddleware;
