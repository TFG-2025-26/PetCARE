// Configuración Jest exclusiva para tests de integración con BD real (petcare_test).
// Uso: npm run test:db   (requiere XAMPP corriendo)
module.exports = {
  testEnvironment: 'node',
  // Establece DB_NAME=petcare_test ANTES de que se cargue db.js
  setupFiles: ['<rootDir>/jest.env.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.db.integration.test.js'],
  // maxWorkers: 1 equivale a --runInBand: evita condiciones de carrera sobre la BD
  maxWorkers: 1,
  verbose: true
};
