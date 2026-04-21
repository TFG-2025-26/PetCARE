jest.mock('../../db', () => ({
  getConnection: jest.fn()
}));

jest.mock('express-validator', () => ({
  validationResult: jest.fn()
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn((password, rounds) => {
    return Promise.resolve('hashedPassword');
  }),
  compare: jest.fn((password, hashed) => {
    return Promise.resolve(password === 'Password1');
  })
}));

const pool = require('../../db');
const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
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

    const req = { body: { correo: '', nombre_usuario: '' } };
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

  test('devuelve 500 cuando getConnection falla', (done) => {
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

    setTimeout(() => {
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
      expect(next).not.toHaveBeenCalled();
      done();
    }, 50);
  });

  test('renderiza error cuando el correo ya existe', (done) => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => cb(null, [{ id_usuario: 1 }]));
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

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('register', expect.objectContaining({
        error: 'El correo electrónico ya está registrado.',
        errores: [],
        formData: req.body,
        formType: 'usuario'
      }));
      expect(next).not.toHaveBeenCalled();
      done();
    }, 50);
  });

  test('renderiza error cuando el teléfono ya existe', (done) => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('WHERE correo')) return cb(null, []);
      if (sql.includes('WHERE nombre_usuario')) return cb(null, []);
      if (sql.includes('WHERE telefono')) return cb(null, [{ id_usuario: 2 }]);
      cb(new Error('Consulta inesperada'));
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

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('register', expect.objectContaining({
        error: 'El teléfono ya está registrado.',
        errores: [],
        formData: req.body,
        formType: 'usuario'
      }));
      expect(next).not.toHaveBeenCalled();
      done();
    }, 50);
  });

  test('registra usuario correctamente y redirige a /', (done) => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('WHERE correo')) return cb(null, []);
      if (sql.includes('WHERE nombre_usuario')) return cb(null, []);
      if (sql.includes('WHERE telefono')) return cb(null, []);
      if (sql.includes('INSERT INTO usuarios')) return cb(null, { insertId: 42 });
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

    setTimeout(() => {
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
      done();
    }, 50);
  });
});

describe('authController.postRegisterEmpresa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 y renderiza register cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'correo' }]
    });

    const req = { body: { correo: '', nombre: '' } };
    const res = buildResponse();
    const next = jest.fn();

    authController.postRegisterEmpresa(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith('register', expect.objectContaining({
      error: 'Por favor, corrige los errores en el formulario.',
      errores: [{ msg: 'Campo obligatorio', param: 'correo' }],
      formData: req.body,
      formType: 'empresa'
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('devuelve 500 cuando getConnection falla', (done) => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = {
      body: {
        nombre: 'Empresa ABC',
        correo: 'empresa@example.com',
        telefono_contacto: '600123456',
        password: 'Password1',
        cif: 'B12345678',
        tipo: 'veterinaria'
      }
    };
    const res = buildResponse();
    const next = jest.fn();

    authController.postRegisterEmpresa(req, res, next);

    setTimeout(() => {
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
      expect(next).not.toHaveBeenCalled();
      done();
    }, 50);
  });

  test('renderiza error cuando el correo ya existe', (done) => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('WHERE correo')) return cb(null, [{ id_empresa: 1 }]);
      if (sql.includes('WHERE CIF')) return cb(null, []);
      if (sql.includes('WHERE telefono_contacto')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      body: {
        nombre: 'Empresa ABC',
        correo: 'empresa@example.com',
        telefono_contacto: '600123456',
        password: 'Password1',
        cif: 'B12345678',
        tipo: 'veterinaria'
      }
    };
    const res = buildResponse();
    const next = jest.fn();

    authController.postRegisterEmpresa(req, res, next);

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('register', expect.objectContaining({
        error: 'El correo electrónico ya está registrado.',
        errores: [],
        formData: req.body,
        formType: 'empresa'
      }));
      expect(next).not.toHaveBeenCalled();
      done();
    }, 50);
  });

  test('renderiza error cuando el CIF ya existe', (done) => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('WHERE correo')) return cb(null, []);
      if (sql.includes('WHERE CIF')) return cb(null, [{ id_empresa: 2 }]);
      if (sql.includes('WHERE telefono_contacto')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      body: {
        nombre: 'Empresa ABC',
        correo: 'empresa@example.com',
        telefono_contacto: '600123456',
        password: 'Password1',
        cif: 'B12345678',
        tipo: 'veterinaria'
      }
    };
    const res = buildResponse();
    const next = jest.fn();

    authController.postRegisterEmpresa(req, res, next);

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('register', expect.objectContaining({
        error: 'El CIF ya está registrado.',
        errores: [],
        formData: req.body,
        formType: 'empresa'
      }));
      expect(next).not.toHaveBeenCalled();
      done();
    }, 50);
  });

  test('renderiza error cuando el teléfono ya existe', (done) => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('WHERE correo')) return cb(null, []);
      if (sql.includes('WHERE CIF')) return cb(null, []);
      if (sql.includes('WHERE telefono = ?')) return cb(null, []);
      if (sql.includes('WHERE telefono_contacto')) return cb(null, [{ id_empresa: 3 }]);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      body: {
        nombre: 'Empresa ABC',
        correo: 'empresa@example.com',
        telefono_contacto: '600123456',
        password: 'Password1',
        cif: 'B12345678',
        tipo: 'veterinaria'
      }
    };
    const res = buildResponse();
    const next = jest.fn();

    authController.postRegisterEmpresa(req, res, next);

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('register', expect.objectContaining({
        error: 'El teléfono ya está registrado.',
        errores: [],
        formData: req.body,
        formType: 'empresa'
      }));
      expect(next).not.toHaveBeenCalled();
      done();
    }, 50);
  });

  test('registra empresa correctamente y redirige a /', (done) => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('WHERE correo')) return cb(null, []);
      if (sql.includes('WHERE CIF')) return cb(null, []);
      if (sql.includes('WHERE telefono = ?')) return cb(null, []);
      if (sql.includes('WHERE telefono_contacto')) return cb(null, []);
      if (sql.includes('INSERT INTO empresas')) return cb(null, { insertId: 43 });
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      body: {
        nombre: 'Empresa ABC',
        correo: 'empresa@example.com',
        telefono_contacto: '600123456',
        password: 'Password1',
        cif: 'B12345678',
        tipo: 'veterinaria',
        tipo_otro: ''
      },
      session: {}
    };
    const res = buildResponse();
    const next = jest.fn();

    authController.postRegisterEmpresa(req, res, next);

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(req.session.usuario).toEqual({
        id: 43,
        nombre: 'Empresa ABC',
        tipo: 'empresa'
      });
      expect(res.redirect).toHaveBeenCalledWith('/');
      expect(next).not.toHaveBeenCalled();
      done();
    }, 50);
  });
});

describe('authController.postLoginUsuario', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = { body: { usuario_input: 'ana@example.com', password: 'Password1' } };
    const res = buildResponse();
    const next = jest.fn();

    authController.postLoginUsuario(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
    expect(next).not.toHaveBeenCalled();
  });

  test('renderiza login con error cuando el usuario no existe', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, []));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { body: { usuario_input: 'ana@example.com', password: 'Password1' } };
    const res = buildResponse();
    const next = jest.fn();

    authController.postLoginUsuario(req, res, next);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('login', expect.objectContaining({
      error: 'Datos del formulario incorrectos',
      errores: [],
      formData: req.body,
      formType: 'usuario'
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('llama a next con error de cuenta baneada', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, [{ id_usuario: 1, ban: 1, suspendido: 0, activo: 1, contraseña: 'Password1' }]));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { body: { usuario_input: 'ana@example.com', password: 'Password1' } };
    const res = buildResponse();
    const next = jest.fn();

    authController.postLoginUsuario(req, res, next);

    expect(connection.release).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 403,
      codigo: 'AUTH_ACCOUNT_BANNED'
    }));
    expect(res.render).not.toHaveBeenCalled();
  });

  test('llama a next con error de cuenta suspendida', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, [{ id_usuario: 1, ban: 0, suspendido: 1, activo: 1, contraseña: 'Password1' }]));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { body: { usuario_input: 'ana@example.com', password: 'Password1' } };
    const res = buildResponse();
    const next = jest.fn();

    authController.postLoginUsuario(req, res, next);

    expect(connection.release).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 423,
      codigo: 'AUTH_ACCOUNT_SUSPENDED'
    }));
    expect(res.render).not.toHaveBeenCalled();
  });

  test('renderiza login con error de cuenta inactiva', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, [{ id_usuario: 1, ban: 0, suspendido: 0, activo: 0, contraseña: 'Password1' }]));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { body: { usuario_input: 'ana@example.com', password: 'Password1' } };
    const res = buildResponse();
    const next = jest.fn();

    authController.postLoginUsuario(req, res, next);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('login', expect.objectContaining({
      error: 'Cuenta inactiva. Por favor, contacta con soporte.',
      errores: [],
      formData: req.body,
      formType: 'usuario'
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('renderiza login con error cuando la contraseña es incorrecta', (done) => {
    bcrypt.compare.mockResolvedValueOnce(false);
    const connection = buildConnection((sql, params, cb) => cb(null, [{ id_usuario: 1, ban: 0, suspendido: 0, activo: 1, contraseña: 'hashedPassword1', nombre_usuario: 'ana123', nombre_completo: 'Ana García', rol: 'user' }]));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { body: { usuario_input: 'ana@example.com', password: 'WrongPassword' }, session: {} };
    const res = buildResponse();
    const next = jest.fn();

    authController.postLoginUsuario(req, res, next);

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('login', expect.objectContaining({
        error: 'Datos del formulario incorrectos',
        errores: [],
        formData: req.body,
        formType: 'usuario'
      }));
      expect(next).not.toHaveBeenCalled();
      done();
    }, 50);
  });

  test('loguea usuario correctamente y redirige a /', (done) => {
    bcrypt.compare.mockResolvedValueOnce(true);
    const connection = buildConnection((sql, params, cb) => cb(null, [{ id_usuario: 1, ban: 0, suspendido: 0, activo: 1, contraseña: 'hashedPassword1', nombre_usuario: 'ana123', nombre_completo: 'Ana García', rol: 'user' }]));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { body: { usuario_input: 'ana@example.com', password: 'Password1' }, session: {} };
    const res = buildResponse();
    const next = jest.fn();

    authController.postLoginUsuario(req, res, next);

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(req.session.usuario).toEqual({
        id: 1,
        nombre_usuario: 'ana123',
        nombre_completo: 'Ana García',
        tipo: 'usuario',
        rol: 'user'
      });
      expect(res.redirect).toHaveBeenCalledWith('/');
      expect(next).not.toHaveBeenCalled();
      done();
    }, 50);
  });
});

describe('authController.postLoginEmpresa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = { body: { correo: 'empresa@example.com', password: 'Password1' } };
    const res = buildResponse();

    authController.postLoginEmpresa(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('renderiza login con error cuando la empresa no existe', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, []));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { body: { correo: 'empresa@example.com', password: 'Password1' } };
    const res = buildResponse();

    authController.postLoginEmpresa(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('login', expect.objectContaining({
      error: 'Datos del formulario incorrectos',
      errores: [],
      formData: req.body,
      formType: 'empresa'
    }));
  });

  test('renderiza login con error cuando la cuenta está inactiva', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, [{ id_empresa: 1, activo: 0, contraseña: 'Password1' }]));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { body: { correo: 'empresa@example.com', password: 'Password1' } };
    const res = buildResponse();

    authController.postLoginEmpresa(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('login', expect.objectContaining({
      error: 'Cuenta inactiva. Por favor, contacta con soporte.',
      errores: [],
      formData: req.body,
      formType: 'empresa'
    }));
  });

  test('renderiza login con error cuando la contraseña es incorrecta', (done) => {
    bcrypt.compare.mockResolvedValueOnce(false);
    const connection = buildConnection((sql, params, cb) => cb(null, [{ id_empresa: 1, activo: 1, contraseña: 'hashedPassword1' }]));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { body: { correo: 'empresa@example.com', password: 'WrongPassword' }, session: {} };
    const res = buildResponse();

    authController.postLoginEmpresa(req, res);

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('login', expect.objectContaining({
        error: 'Datos del formulario incorrectos',
        errores: [],
        formData: req.body,
        formType: 'empresa'
      }));
      done();
    }, 50);
  });

  test('loguea empresa correctamente y redirige a /', (done) => {
    bcrypt.compare.mockResolvedValueOnce(true);
    const connection = buildConnection((sql, params, cb) => cb(null, [{ id_empresa: 1, activo: 1, contraseña: 'hashedPassword1', nombre: 'Empresa ABC' }]));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { body: { correo: 'empresa@example.com', password: 'Password1' }, session: {} };
    const res = buildResponse();

    authController.postLoginEmpresa(req, res);

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(req.session.usuario).toEqual({
        id: 1,
        nombre: 'Empresa ABC',
        tipo: 'empresa'
      });
      expect(res.redirect).toHaveBeenCalledWith('/');
      done();
    }, 50);
  });
});