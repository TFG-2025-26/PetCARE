module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'controllers/**/*.js',
    '!controllers/**/*.test.js',
    '!controllers/__tests__/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  // Excluir los tests de BD real del script npm test normal
  testPathIgnorePatterns: ['\\.db\\.integration\\.test\\.js$'],
  verbose: true
};
