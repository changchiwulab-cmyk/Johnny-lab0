'use strict';

const path = require('path');
const RBACManager = require('../../rbac/rbac-manager');

const CONFIG_PATH = path.join(__dirname, '../../rbac/rbac-config.json');

describe('RBACManager', () => {
  let manager;

  beforeAll(() => {
    manager = new RBACManager(CONFIG_PATH);
  });

  describe('listRoles()', () => {
    it('should return all four built-in roles', () => {
      const roles = manager.listRoles();
      expect(roles).toContain('developer');
      expect(roles).toContain('operations');
      expect(roles).toContain('legal');
      expect(roles).toContain('security');
      expect(roles).toHaveLength(4);
    });
  });

  describe('getRole()', () => {
    it('should return role definition for valid role', () => {
      const role = manager.getRole('developer');
      expect(role).not.toBeNull();
      expect(role.description).toBeTruthy();
      expect(role.permissions.allow).toBeDefined();
    });

    it('should return null for unknown role', () => {
      expect(manager.getRole('nonexistent')).toBeNull();
    });
  });

  describe('registerRole()', () => {
    it('should register a custom role', () => {
      const mgr = new RBACManager(CONFIG_PATH);
      mgr.registerRole('finance', {
        description: 'Finance department',
        permissions: {
          allow: ['Read', 'Glob'],
          ask: ['Edit(.json)'],
          deny: ['Write', 'Bash(*)'],
        },
      });

      expect(mgr.listRoles()).toContain('finance');
      const role = mgr.getRole('finance');
      expect(role.permissions.allow).toContain('Read');
    });

    it('should throw on empty name', () => {
      const mgr = new RBACManager(CONFIG_PATH);
      expect(() => mgr.registerRole('', {})).toThrow();
    });

    it('should throw on missing permissions', () => {
      const mgr = new RBACManager(CONFIG_PATH);
      expect(() => mgr.registerRole('test', { description: 'test' })).toThrow();
    });
  });

  describe('checkPermission() — developer role', () => {
    it('should allow Read', () => {
      const result = manager.checkPermission('developer', { tool: 'Read', args: '/any/file' });
      expect(result.allowed).toBe(true);
      expect(result.decision).toBe('allow');
    });

    it('should allow Write for normal paths', () => {
      const result = manager.checkPermission('developer', { tool: 'Write', args: '/home/user/app.js' });
      expect(result.allowed).toBe(true);
    });

    it('should allow any Bash command', () => {
      const result = manager.checkPermission('developer', { tool: 'Bash', args: 'npm test' });
      expect(result.allowed).toBe(true);
    });

    it('should deny Bash(sudo:*)', () => {
      const result = manager.checkPermission('developer', { tool: 'Bash', args: 'sudo rm -rf /' });
      expect(result.allowed).toBe(false);
      expect(result.decision).toBe('deny');
    });

    it('should deny Write(/.env*)', () => {
      const result = manager.checkPermission('developer', { tool: 'Write', args: '/.env.local' });
      expect(result.allowed).toBe(false);
      expect(result.decision).toBe('deny');
    });
  });

  describe('checkPermission() — legal role', () => {
    it('should allow Read', () => {
      const result = manager.checkPermission('legal', { tool: 'Read', args: '/any/file' });
      expect(result.allowed).toBe(true);
    });

    it('should allow Edit for .md files', () => {
      const result = manager.checkPermission('legal', { tool: 'Edit', args: 'contract.md' });
      expect(result.allowed).toBe(true);
    });

    it('should allow Edit for .txt files', () => {
      const result = manager.checkPermission('legal', { tool: 'Edit', args: 'notes.txt' });
      expect(result.allowed).toBe(true);
    });

    it('should allow Bash(grep:*)', () => {
      const result = manager.checkPermission('legal', { tool: 'Bash', args: 'grep -r "clause" .' });
      expect(result.allowed).toBe(true);
    });

    it('should deny Write to /etc/', () => {
      const result = manager.checkPermission('legal', { tool: 'Write', args: '/etc/hosts' });
      expect(result.allowed).toBe(false);
      expect(result.decision).toBe('deny');
    });

    it('should deny Bash(sudo:*)', () => {
      const result = manager.checkPermission('legal', { tool: 'Bash', args: 'sudo apt install' });
      expect(result.allowed).toBe(false);
      expect(result.decision).toBe('deny');
    });

    it('should ask for Write to legal archive', () => {
      const result = manager.checkPermission('legal', {
        tool: 'Write',
        args: '/departments/legal/archive/contract-2026.pdf',
      });
      expect(result.decision).toBe('ask');
    });

    it('should ask for git commit', () => {
      const result = manager.checkPermission('legal', { tool: 'Bash', args: 'git commit -m "update"' });
      expect(result.decision).toBe('ask');
    });

    it('should deny by default for unlisted tools', () => {
      const result = manager.checkPermission('legal', { tool: 'Write', args: '/home/user/app.js' });
      expect(result.allowed).toBe(false);
      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('denied by default');
    });
  });

  describe('checkPermission() — operations role', () => {
    it('should allow Edit for .md files', () => {
      const result = manager.checkPermission('operations', { tool: 'Edit', args: 'README.md' });
      expect(result.allowed).toBe(true);
    });

    it('should allow Bash(npm:*)', () => {
      const result = manager.checkPermission('operations', { tool: 'Bash', args: 'npm install' });
      expect(result.allowed).toBe(true);
    });

    it('should ask for Bash(rm:*)', () => {
      const result = manager.checkPermission('operations', { tool: 'Bash', args: 'rm temp.log' });
      expect(result.decision).toBe('ask');
    });

    it('should deny Write for .js files by default', () => {
      const result = manager.checkPermission('operations', { tool: 'Write', args: '/home/user/app.js' });
      expect(result.allowed).toBe(false);
    });
  });

  describe('checkPermission() — security role', () => {
    it('should allow Read', () => {
      const result = manager.checkPermission('security', { tool: 'Read', args: '/any/file' });
      expect(result.allowed).toBe(true);
    });

    it('should allow Bash(audit:*)', () => {
      const result = manager.checkPermission('security', { tool: 'Bash', args: 'audit check dependencies' });
      expect(result.allowed).toBe(true);
    });

    it('should allow Bash(scan:*)', () => {
      const result = manager.checkPermission('security', { tool: 'Bash', args: 'scan --all ports' });
      expect(result.allowed).toBe(true);
    });

    it('should deny Write (blanket deny)', () => {
      const result = manager.checkPermission('security', { tool: 'Write', args: '/any/file.js' });
      expect(result.allowed).toBe(false);
      expect(result.decision).toBe('deny');
    });

    it('should deny Bash(rm:*)', () => {
      const result = manager.checkPermission('security', { tool: 'Bash', args: 'rm -rf /tmp/test' });
      expect(result.allowed).toBe(false);
      expect(result.decision).toBe('deny');
    });

    it('should ask for Edit(.json)', () => {
      const result = manager.checkPermission('security', { tool: 'Edit', args: 'config.json' });
      expect(result.decision).toBe('ask');
    });
  });

  describe('checkPermission() — deny-first resolution', () => {
    it('should deny even when allow also matches (deny takes priority)', () => {
      // developer has Bash(*) in allow but Bash(sudo:*) in deny
      const result = manager.checkPermission('developer', { tool: 'Bash', args: 'sudo ls' });
      expect(result.decision).toBe('deny');
    });
  });

  describe('checkPermission() — unknown role', () => {
    it('should deny with explanation for unknown role', () => {
      const result = manager.checkPermission('unknown_role', { tool: 'Read', args: '' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Unknown role');
    });
  });

  describe('loadDepartmentConfig()', () => {
    it('should load legal department config', () => {
      const mgr = new RBACManager(CONFIG_PATH);
      const legalConfigPath = path.join(__dirname, '../../departments/legal/config.json');
      const roleName = mgr.loadDepartmentConfig(legalConfigPath);

      expect(roleName).toBe('contract_reviewer');
      expect(mgr.listRoles()).toContain('contract_reviewer');

      const result = mgr.checkPermission('contract_reviewer', { tool: 'Read', args: '/any' });
      expect(result.allowed).toBe(true);
    });

    it('should load operations department config', () => {
      const mgr = new RBACManager(CONFIG_PATH);
      const opsConfigPath = path.join(__dirname, '../../departments/operations/config.json');
      const roleName = mgr.loadDepartmentConfig(opsConfigPath);

      expect(roleName).toBe('operations_staff');
      expect(mgr.listRoles()).toContain('operations_staff');
    });
  });

  describe('toClaudeCodePermissions()', () => {
    it('should export valid Claude Code permissions for legal role', () => {
      const perms = manager.toClaudeCodePermissions('legal');
      expect(perms.permissions).toBeDefined();
      expect(perms.permissions.allow).toBeInstanceOf(Array);
      expect(perms.permissions.defaultMode).toBe('deny');
    });

    it('should include ask permissions', () => {
      const perms = manager.toClaudeCodePermissions('legal');
      expect(perms.permissions.ask).toBeInstanceOf(Array);
      expect(perms.permissions.ask.length).toBeGreaterThan(0);
    });

    it('should throw for unknown role', () => {
      expect(() => manager.toClaudeCodePermissions('nonexistent')).toThrow();
    });
  });

  describe('constructor', () => {
    it('should accept config object directly', () => {
      const config = {
        deny_by_default: true,
        roles: {
          tester: {
            description: 'test role',
            permissions: { allow: ['Read'], ask: [], deny: [] },
          },
        },
      };
      const mgr = new RBACManager(config);
      expect(mgr.listRoles()).toContain('tester');
    });
  });
});
