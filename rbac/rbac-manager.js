'use strict';

const fs = require('fs');
const path = require('path');
const PermissionMatcher = require('./permission-matcher');

/**
 * 核心 RBAC 引擎
 * 管理角色定義、權限檢查、部門配置載入
 *
 * 權限解析順序：deny → ask → allow → deny_by_default（安全優先）
 */
class RBACManager {
  /**
   * @param {string|object} config - rbac-config.json 的路徑或直接傳入配置物件
   */
  constructor(config) {
    if (typeof config === 'string') {
      const raw = fs.readFileSync(config, 'utf-8');
      this._config = JSON.parse(raw);
    } else if (typeof config === 'object' && config !== null) {
      this._config = JSON.parse(JSON.stringify(config));
    } else {
      // 預設載入同目錄下的 rbac-config.json
      const defaultPath = path.join(__dirname, 'rbac-config.json');
      const raw = fs.readFileSync(defaultPath, 'utf-8');
      this._config = JSON.parse(raw);
    }

    this._roles = this._config.roles || {};
    this._denyByDefault = this._config.deny_by_default !== false;
  }

  /**
   * 列出所有已註冊角色
   * @returns {string[]}
   */
  listRoles() {
    return Object.keys(this._roles);
  }

  /**
   * 取得角色定義
   * @param {string} roleName
   * @returns {object|null}
   */
  getRole(roleName) {
    return this._roles[roleName] || null;
  }

  /**
   * 註冊自訂角色
   * @param {string} name
   * @param {object} roleConfig - { description, permissions: { allow, ask, deny } }
   */
  registerRole(name, roleConfig) {
    if (!name || typeof name !== 'string') {
      throw new Error('Role name must be a non-empty string');
    }
    if (!roleConfig || !roleConfig.permissions) {
      throw new Error('Role config must include permissions');
    }

    const permissions = roleConfig.permissions;
    this._roles[name] = {
      description: roleConfig.description || '',
      permissions: {
        allow: permissions.allow || [],
        ask: permissions.ask || [],
        deny: permissions.deny || [],
      },
    };
  }

  /**
   * 檢查角色對工具請求的權限
   * 解析順序：deny → ask → allow → deny_by_default
   *
   * @param {string} roleName
   * @param {{ tool: string, args: string }} request
   * @returns {{ allowed: boolean, decision: 'allow'|'deny'|'ask', matchedRule: string|null, reason: string }}
   */
  checkPermission(roleName, request) {
    const role = this._roles[roleName];
    if (!role) {
      return {
        allowed: false,
        decision: 'deny',
        matchedRule: null,
        reason: `Unknown role: "${roleName}"`,
      };
    }

    const { allow = [], ask = [], deny = [] } = role.permissions;

    // 1. 檢查 deny（最高優先級）
    const denyMatch = PermissionMatcher.matchesAny(request, deny);
    if (denyMatch) {
      return {
        allowed: false,
        decision: 'deny',
        matchedRule: denyMatch,
        reason: `Denied by rule: ${denyMatch}`,
      };
    }

    // 2. 檢查 ask（需人類確認）
    const askMatch = PermissionMatcher.matchesAny(request, ask);
    if (askMatch) {
      return {
        allowed: false,
        decision: 'ask',
        matchedRule: askMatch,
        reason: `Requires confirmation: ${askMatch}`,
      };
    }

    // 3. 檢查 allow
    const allowMatch = PermissionMatcher.matchesAny(request, allow);
    if (allowMatch) {
      return {
        allowed: true,
        decision: 'allow',
        matchedRule: allowMatch,
        reason: `Allowed by rule: ${allowMatch}`,
      };
    }

    // 4. 預設行為
    if (this._denyByDefault) {
      return {
        allowed: false,
        decision: 'deny',
        matchedRule: null,
        reason: `No matching rule found, denied by default`,
      };
    }

    return {
      allowed: true,
      decision: 'allow',
      matchedRule: null,
      reason: `No matching rule found, allowed by default`,
    };
  }

  /**
   * 從部門配置檔載入角色
   * 相容 departments/xxx/config.json 格式
   *
   * @param {string} deptConfigPath - 如 "departments/legal/config.json"
   * @returns {string} 註冊的角色名稱
   */
  loadDepartmentConfig(deptConfigPath) {
    const raw = fs.readFileSync(deptConfigPath, 'utf-8');
    const deptConfig = JSON.parse(raw);

    const roleName = deptConfig.role || deptConfig.department;
    if (!roleName) {
      throw new Error(`Department config missing "role" or "department" field: ${deptConfigPath}`);
    }

    this.registerRole(roleName, {
      description: deptConfig.description || `${deptConfig.department} department`,
      permissions: deptConfig.permissions,
    });

    return roleName;
  }

  /**
   * 匯出為 Claude Code settings.json 權限格式
   * @param {string} roleName
   * @returns {{ permissions: { allow: string[], defaultMode: string } }}
   */
  toClaudeCodePermissions(roleName) {
    const role = this._roles[roleName];
    if (!role) {
      throw new Error(`Unknown role: "${roleName}"`);
    }

    const { allow = [], ask = [] } = role.permissions;

    return {
      permissions: {
        allow: [...allow],
        ask: [...ask],
        defaultMode: 'deny',
      },
    };
  }
}

module.exports = RBACManager;
