'use strict';

const path = require('path');
const RBACManager = require('../../rbac/rbac-manager');
const RBACMiddleware = require('../../rbac/rbac-middleware');

const CONFIG_PATH = path.join(__dirname, '../../rbac/rbac-config.json');

describe('RBACMiddleware', () => {
  let manager;
  let middleware;

  beforeEach(() => {
    manager = new RBACManager(CONFIG_PATH);
    middleware = new RBACMiddleware(manager);
  });

  describe('constructor', () => {
    it('should throw if not given RBACManager', () => {
      expect(() => new RBACMiddleware({})).toThrow('RBACMiddleware requires an RBACManager instance');
    });
  });

  describe('enforce()', () => {
    it('should allow permitted operations', () => {
      const result = middleware.enforce('developer', { tool: 'Read', args: '/file.js' });
      expect(result.continue).toBe(true);
      expect(result.reason).toContain('Allowed');
    });

    it('should deny forbidden operations', () => {
      const result = middleware.enforce('legal', { tool: 'Write', args: '/etc/hosts' });
      expect(result.continue).toBe(false);
      expect(result.reason).toContain('Denied');
    });

    it('should return systemMessage for ask operations', () => {
      const result = middleware.enforce('legal', {
        tool: 'Write',
        args: '/departments/legal/archive/doc.pdf',
      });
      expect(result.continue).toBe(false);
      expect(result.systemMessage).toBeDefined();
      expect(result.systemMessage).toContain('需要人類確認');
      expect(result.systemMessage).toContain('legal');
    });

    it('should deny by default for unmatched operations', () => {
      const result = middleware.enforce('security', { tool: 'Write', args: '/home/user/file.js' });
      expect(result.continue).toBe(false);
    });
  });

  describe('audit log', () => {
    it('should record audit entries', () => {
      middleware.enforce('developer', { tool: 'Read', args: '/file.js' });
      middleware.enforce('legal', { tool: 'Write', args: '/etc/hosts' });

      const log = middleware.getAuditLog();
      expect(log).toHaveLength(2);
    });

    it('should include correct fields in audit entries', () => {
      middleware.enforce('developer', { tool: 'Bash', args: 'npm test' });

      const log = middleware.getAuditLog();
      expect(log[0]).toHaveProperty('timestamp');
      expect(log[0]).toHaveProperty('role', 'developer');
      expect(log[0]).toHaveProperty('tool', 'Bash');
      expect(log[0]).toHaveProperty('args', 'npm test');
      expect(log[0]).toHaveProperty('decision', 'allow');
      expect(log[0]).toHaveProperty('matchedRule');
      expect(log[0]).toHaveProperty('reason');
    });

    it('should record denied operations', () => {
      middleware.enforce('security', { tool: 'Bash', args: 'rm -rf /tmp' });

      const log = middleware.getAuditLog();
      expect(log[0].decision).toBe('deny');
    });

    it('should record ask operations', () => {
      middleware.enforce('operations', { tool: 'Bash', args: 'rm temp.log' });

      const log = middleware.getAuditLog();
      expect(log[0].decision).toBe('ask');
    });

    it('should clear audit log', () => {
      middleware.enforce('developer', { tool: 'Read', args: '' });
      expect(middleware.getAuditLog()).toHaveLength(1);

      middleware.clearAuditLog();
      expect(middleware.getAuditLog()).toHaveLength(0);
    });
  });

  describe('generateHookConfig()', () => {
    it('should generate PreToolUse hooks for legal role', () => {
      const config = middleware.generateHookConfig('legal');
      expect(config).toHaveProperty('PreToolUse');
      expect(config.PreToolUse).toBeInstanceOf(Array);
      expect(config.PreToolUse.length).toBeGreaterThan(0);
    });

    it('should include RBAC role metadata', () => {
      const config = middleware.generateHookConfig('legal');
      const hasRoleMetadata = config.PreToolUse.some((hook) => hook._rbac_role === 'legal');
      expect(hasRoleMetadata).toBe(true);
    });

    it('should generate hooks for deny patterns', () => {
      const config = middleware.generateHookConfig('legal');
      const denyHook = config.PreToolUse.find((h) => h._rbac_deny_patterns);
      expect(denyHook).toBeDefined();
      expect(denyHook._rbac_deny_patterns.length).toBeGreaterThan(0);
    });

    it('should generate hooks for ask patterns', () => {
      const config = middleware.generateHookConfig('legal');
      const askHook = config.PreToolUse.find((h) => h._rbac_ask_patterns);
      expect(askHook).toBeDefined();
      expect(askHook._rbac_ask_patterns.length).toBeGreaterThan(0);
    });

    it('should throw for unknown role', () => {
      expect(() => middleware.generateHookConfig('nonexistent')).toThrow();
    });
  });

  describe('full enforcement flow', () => {
    it('should enforce multiple operations and track all in audit log', () => {
      // Developer flow
      const r1 = middleware.enforce('developer', { tool: 'Read', args: '/src/app.js' });
      const r2 = middleware.enforce('developer', { tool: 'Write', args: '/src/app.js' });
      const r3 = middleware.enforce('developer', { tool: 'Bash', args: 'sudo shutdown' });

      expect(r1.continue).toBe(true);
      expect(r2.continue).toBe(true);
      expect(r3.continue).toBe(false);

      // Legal flow
      const r4 = middleware.enforce('legal', { tool: 'Read', args: '/contract.pdf' });
      const r5 = middleware.enforce('legal', { tool: 'Edit', args: 'review.md' });
      const r6 = middleware.enforce('legal', { tool: 'Bash', args: 'sudo rm -rf /' });

      expect(r4.continue).toBe(true);
      expect(r5.continue).toBe(true);
      expect(r6.continue).toBe(false);

      const log = middleware.getAuditLog();
      expect(log).toHaveLength(6);
      expect(log.filter((e) => e.decision === 'allow')).toHaveLength(4);
      expect(log.filter((e) => e.decision === 'deny')).toHaveLength(2);
    });
  });
});
