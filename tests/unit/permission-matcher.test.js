'use strict';

const PermissionMatcher = require('../../rbac/permission-matcher');

describe('PermissionMatcher', () => {
  describe('parse()', () => {
    it('should parse simple tool name', () => {
      const result = PermissionMatcher.parse('Read');
      expect(result).toEqual({ tool: 'Read', pattern: null });
    });

    it('should parse tool with wildcard pattern', () => {
      const result = PermissionMatcher.parse('Bash(*)');
      expect(result).toEqual({ tool: 'Bash', pattern: '*' });
    });

    it('should parse tool with prefix pattern', () => {
      const result = PermissionMatcher.parse('Bash(npm:*)');
      expect(result).toEqual({ tool: 'Bash', pattern: 'npm:*' });
    });

    it('should parse tool with extension pattern', () => {
      const result = PermissionMatcher.parse('Edit(.md|.json)');
      expect(result).toEqual({ tool: 'Edit', pattern: '.md|.json' });
    });

    it('should parse tool with path pattern', () => {
      const result = PermissionMatcher.parse('Write(/etc/*)');
      expect(result).toEqual({ tool: 'Write', pattern: '/etc/*' });
    });

    it('should throw on empty string', () => {
      expect(() => PermissionMatcher.parse('')).toThrow();
    });

    it('should throw on invalid format', () => {
      expect(() => PermissionMatcher.parse('123-invalid')).toThrow();
    });
  });

  describe('matches()', () => {
    it('should match simple tool name with any args', () => {
      expect(PermissionMatcher.matches({ tool: 'Read', args: '/some/file.js' }, 'Read')).toBe(true);
    });

    it('should match simple tool name with no args', () => {
      expect(PermissionMatcher.matches({ tool: 'Read', args: '' }, 'Read')).toBe(true);
    });

    it('should not match different tool names', () => {
      expect(PermissionMatcher.matches({ tool: 'Write', args: '' }, 'Read')).toBe(false);
    });

    it('should match Bash(*) with any command', () => {
      expect(PermissionMatcher.matches({ tool: 'Bash', args: 'npm install' }, 'Bash(*)')).toBe(true);
      expect(PermissionMatcher.matches({ tool: 'Bash', args: 'git status' }, 'Bash(*)')).toBe(true);
    });

    it('should match prefix pattern Bash(npm:*)', () => {
      expect(PermissionMatcher.matches({ tool: 'Bash', args: 'npm install' }, 'Bash(npm:*)')).toBe(true);
      expect(PermissionMatcher.matches({ tool: 'Bash', args: 'npm test' }, 'Bash(npm:*)')).toBe(true);
      expect(PermissionMatcher.matches({ tool: 'Bash', args: 'git push' }, 'Bash(npm:*)')).toBe(false);
    });

    it('should match extension pattern Edit(.md|.json)', () => {
      expect(PermissionMatcher.matches({ tool: 'Edit', args: 'README.md' }, 'Edit(.md|.json)')).toBe(true);
      expect(PermissionMatcher.matches({ tool: 'Edit', args: 'config.json' }, 'Edit(.md|.json)')).toBe(true);
      expect(PermissionMatcher.matches({ tool: 'Edit', args: 'app.js' }, 'Edit(.md|.json)')).toBe(false);
    });

    it('should match path prefix pattern Write(/etc/*)', () => {
      expect(PermissionMatcher.matches({ tool: 'Write', args: '/etc/hosts' }, 'Write(/etc/*)')).toBe(true);
      expect(PermissionMatcher.matches({ tool: 'Write', args: '/etc/nginx/conf' }, 'Write(/etc/*)')).toBe(true);
      expect(PermissionMatcher.matches({ tool: 'Write', args: '/home/user/file' }, 'Write(/etc/*)')).toBe(false);
    });

    it('should match OR pattern Bash(audit|scan)', () => {
      expect(PermissionMatcher.matches({ tool: 'Bash', args: 'npm audit' }, 'Bash(audit|scan)')).toBe(true);
      expect(PermissionMatcher.matches({ tool: 'Bash', args: 'security scan' }, 'Bash(audit|scan)')).toBe(true);
      expect(PermissionMatcher.matches({ tool: 'Bash', args: 'npm install' }, 'Bash(audit|scan)')).toBe(false);
    });

    it('should match file extension pattern Bash(rm:*.js|*.ts)', () => {
      expect(PermissionMatcher.matches({ tool: 'Bash', args: 'rm app.js' }, 'Bash(rm:*.js|*.ts)')).toBe(false);
      // "rm:*" prefix patterns: "rm:*.js" means args starts with "rm:" — this tests OR of prefix patterns
    });

    it('should match Write(/.env*) pattern', () => {
      expect(PermissionMatcher.matches({ tool: 'Write', args: '/.env' }, 'Write(/.env*)')).toBe(true);
      expect(PermissionMatcher.matches({ tool: 'Write', args: '/.env.local' }, 'Write(/.env*)')).toBe(true);
    });

    it('should match git prefix patterns', () => {
      expect(PermissionMatcher.matches({ tool: 'Bash', args: 'git commit -m "test"' }, 'Bash(git:*)')).toBe(true);
      expect(PermissionMatcher.matches({ tool: 'Bash', args: 'npm test' }, 'Bash(git:*)')).toBe(false);
    });

    it('should match sudo prefix pattern', () => {
      expect(PermissionMatcher.matches({ tool: 'Bash', args: 'sudo rm -rf /' }, 'Bash(sudo:*)')).toBe(true);
      expect(PermissionMatcher.matches({ tool: 'Bash', args: 'npm install' }, 'Bash(sudo:*)')).toBe(false);
    });

    it('should return false for null request', () => {
      expect(PermissionMatcher.matches(null, 'Read')).toBe(false);
    });

    it('should return false for request without tool', () => {
      expect(PermissionMatcher.matches({ args: 'test' }, 'Read')).toBe(false);
    });
  });

  describe('matchesAny()', () => {
    it('should return the first matching pattern', () => {
      const patterns = ['Write', 'Edit(.md|.json)', 'Read'];
      const result = PermissionMatcher.matchesAny({ tool: 'Read', args: '' }, patterns);
      expect(result).toBe('Read');
    });

    it('should return null when no pattern matches', () => {
      const patterns = ['Write', 'Edit(.md|.json)'];
      const result = PermissionMatcher.matchesAny({ tool: 'Read', args: '' }, patterns);
      expect(result).toBeNull();
    });

    it('should return null for non-array input', () => {
      expect(PermissionMatcher.matchesAny({ tool: 'Read', args: '' }, null)).toBeNull();
    });

    it('should handle empty patterns array', () => {
      expect(PermissionMatcher.matchesAny({ tool: 'Read', args: '' }, [])).toBeNull();
    });
  });
});
