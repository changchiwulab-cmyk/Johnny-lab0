'use strict';

/**
 * 權限模式匹配引擎
 * 解析並匹配 Claude Code 風格的權限字串，如 "Bash(npm:*)", "Edit(.md|.json)"
 */
class PermissionMatcher {
  /**
   * 解析權限字串為結構化物件
   * @param {string} permissionStr - 如 "Bash(npm:*)"
   * @returns {{ tool: string, pattern: string|null }}
   */
  static parse(permissionStr) {
    if (!permissionStr || typeof permissionStr !== 'string') {
      throw new Error('Permission string must be a non-empty string');
    }

    const match = permissionStr.match(/^(\w+)(?:\((.+)\))?$/);
    if (!match) {
      throw new Error(`Invalid permission format: "${permissionStr}"`);
    }

    return {
      tool: match[1],
      pattern: match[2] || null,
    };
  }

  /**
   * 檢查工具請求是否匹配權限模式
   * @param {{ tool: string, args: string }} request - 如 { tool: "Bash", args: "npm install" }
   * @param {string} permissionStr - 如 "Bash(npm:*)"
   * @returns {boolean}
   */
  static matches(request, permissionStr) {
    if (!request || !request.tool) {
      return false;
    }

    const parsed = PermissionMatcher.parse(permissionStr);

    // 工具名稱必須匹配
    if (parsed.tool !== request.tool) {
      return false;
    }

    // 無模式 → 匹配該工具的所有操作
    if (parsed.pattern === null) {
      return true;
    }

    // 萬用字元 (*) → 匹配所有
    if (parsed.pattern === '*') {
      return true;
    }

    const args = request.args || '';
    return PermissionMatcher._matchPattern(args, parsed.pattern);
  }

  /**
   * 檢查請求是否匹配任一權限模式
   * @param {{ tool: string, args: string }} request
   * @param {string[]} patterns
   * @returns {string|null} 匹配的模式，或 null
   */
  static matchesAny(request, patterns) {
    if (!Array.isArray(patterns)) {
      return null;
    }

    for (const pattern of patterns) {
      if (PermissionMatcher.matches(request, pattern)) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * 內部模式匹配邏輯
   * 支援：
   *   - "npm:*" → args 以 "npm" 開頭（冒號+萬用字元表示前綴匹配）
   *   - ".md|.json" → args 包含 .md 或 .json（管道符表示 OR）
   *   - "/etc/*" → args 以 "/etc/" 開頭（斜線+萬用字元表示路徑前綴）
   *   - "audit|scan" → args 包含 audit 或 scan
   *   - "*.js|*.ts" → args 以 .js 或 .ts 結尾
   * @param {string} args
   * @param {string} pattern
   * @returns {boolean}
   * @private
   */
  static _matchPattern(args, pattern) {
    // 處理 OR 模式（含 | 分隔符）
    const alternatives = pattern.split('|');

    return alternatives.some((alt) => {
      alt = alt.trim();

      // "prefix:*" → 前綴匹配（如 "npm:*" 匹配 "npm install"）
      if (alt.endsWith(':*')) {
        const prefix = alt.slice(0, -2);
        return args.startsWith(prefix);
      }

      // "/path/*" → 路徑前綴匹配（如 "/etc/*" 匹配 "/etc/hosts"）
      if (alt.endsWith('/*')) {
        const pathPrefix = alt.slice(0, -1); // 保留結尾斜線
        return args.startsWith(pathPrefix);
      }

      // "prefix*" → 一般前綴匹配（如 "/.env*" 匹配 "/.env.local"）
      if (alt.endsWith('*') && !alt.endsWith(':*') && !alt.endsWith('/*')) {
        const prefix = alt.slice(0, -1);
        return args.startsWith(prefix);
      }

      // "*.ext" → 副檔名匹配（如 "*.js" 匹配 "app.js"）
      if (alt.startsWith('*.')) {
        const ext = alt.slice(1); // 保留點號
        return args.endsWith(ext);
      }

      // ".ext" → 副檔名包含匹配（如 ".md" 匹配 "README.md"）
      if (alt.startsWith('.')) {
        return args.endsWith(alt) || args.includes(alt + '/') || args.includes(alt + ' ');
      }

      // "prefix:keyword" → 前綴命令匹配（如 "git:commit" 匹配 "git commit -m ..."）
      // 冒號在權限字串中表示命令分隔，對應實際命令中的空格
      if (alt.includes(':')) {
        const colonAsSpace = alt.replace(/:/g, ' ');
        return args.includes(colonAsSpace) || args.includes(alt);
      }

      // 一般字串 → 包含匹配
      return args.includes(alt);
    });
  }
}

module.exports = PermissionMatcher;
