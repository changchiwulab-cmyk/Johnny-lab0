module.exports = {
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['agents/**/*.js', 'rbac/**/*.js'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
};
