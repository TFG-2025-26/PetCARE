jest.mock('../../db', () => ({
  getConnection: jest.fn()
}));

jest.mock('express-validator', () => ({
  validationResult: jest.fn()
}));

const pool = require('../../db');
const { validationResult } = require('express-validator');
const authController = require('../authController');

const buildResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.render = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.session = {};
  return res;
};

const buildConnection = (queryImpl) => ({
  query: jest.fn(queryImpl),
  release: jest.fn()
});

describe('authController.postRegisterUsuario', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 y renderiza register cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'correo' }]
    });

    const req = {
      body: { correo: '', nombre_usuario: '' }
    };
    const res = buildResponse();
    const next = jest.fn();

    authController.postRegisterUsuario(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith('register', expect.objectContaining({
      error: 'Por favor, corrige los errores en el formulario.',
      errores: [{ msg: 'Campo obligatorio', param: 'correo' }],
      formData: req.body,
      formType: 'usuario'
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('devuelve error 500 cuando getConnection falla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = {
      body: {
        nombre_completo: 'Ana',
        correo: 'ana@example.com',
        nombre_usuario: 'ana123',
        telefono: '600123456',
        password: 'Password1',
        fecha_nacimiento: '2000-01-01'
      }
    };
    const res = buildResponse();
    const next = jest.fn();

    authController.postRegisterUsuario(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
    expect(next).not.toHaveBeenCalled();
  });

  test('renderiza error cuando el correo ya existe', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      cb(null, [{ id_usuario: 1 }]);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      body: {
        nombre_completo: 'Ana',
        correo: 'ana@example.com',
        nombre_usuario: 'ana123',
        telefono: '600123456',
        password: 'Password1',
        fecha_nacimiento: '2000-01-01'
      }
    };
    const res = buildResponse();
    const next = jest.fn();

    authController.postRegisterUsuario(req, res, next);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('register', expect.objectContaining({
      error: 'El correo electrónico ya está registrado.',
      errores: [],
      formData: req.body,
      formType: 'usuario'
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('registra usuario cuando no hay conflictos y redirige a /', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT id_usuario, ban FROM usuarios WHERE correo')) {
        return cb(null, []);
      }
      if (sql.includes('SELECT id_usuario FROM usuarios WHERE nombre_usuario')) {
        return cb(null, []);
      }
      if (sql.includes('SELECT id_usuario, ban FROM usuarios WHERE telefono')) {
        return cb(null, []);
      }
      if (sql.includes('INSERT INTO usuarios')) {
        return cb(null, { insertId: 42 });
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      body: {
        nombre_completo: 'Ana García',
        correo: 'ana@example.com',
        nombre_usuario: 'ana123',
        telefono: '600123456',
        password: 'Password1',
        fecha_nacimiento: '2000-01-01'
      },
      session: {}
    };
    const res = buildResponse();
    const next = jest.fn();

    authController.postRegisterUsuario(req, res, next);

    expect(connection.release).toHaveBeenCalled();
    expect(req.session.usuario).toEqual({
      id: 42,
      nombre_completo: 'Ana García',
      nombre_usuario: 'ana123',
      tipo: 'usuario',
      rol: 'user'
    });
    expect(res.redirect).toHaveBeenCalledWith('/');
    expect(next).not.toHaveBeenCalled();
  });
});
