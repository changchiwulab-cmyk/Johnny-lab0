// Security check test - checking for vulnerabilities

// Simulate checking for hardcoded secrets
function checkSecurityIssues(code) {
  const patterns = [
    /password\s*=\s*['"][\w\-]+['"]/, // Hardcoded passwords
    /api[_-]?key\s*=\s*['"][\w\-]+['"]/, // API keys
    /secret\s*=\s*['"][\w\-]+['"]/, // Secrets
  ]

  let issues = []
  patterns.forEach(pattern => {
    if (pattern.test(code)) {
      issues.push('⚠️ Potential hardcoded secret detected')
    }
  })

  return issues
}

module.exports = { checkSecurityIssues }
