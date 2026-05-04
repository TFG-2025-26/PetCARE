// Este fichero se ejecuta ANTES de que se cargue cualquier módulo en los tests,
// así db.js lee DB_NAME=petcare_test en lugar de petcare.
process.env.DB_NAME = 'petcare_test';
