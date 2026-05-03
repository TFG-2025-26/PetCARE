jest.mock('../../db', () => ({
  getConnection: jest.fn()
}));

jest.mock('express-validator', () => ({
  validationResult: jest.fn()
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn((password, rounds, callback) => {
    callback(null, 'hashedPassword');
  }),
  compare: jest.fn((password, hashed) => {
    return Promise.resolve(password === 'Password1');
  })
}));

const pool = require('../../db');
const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const adminController = require('../adminController');

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

// ─────────────────────────────────────────────
// filtrarReportes
// ─────────────────────────────────────────────
describe('adminController.filtrarReportes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = { query: {} };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 500 cuando la query falla', () => {
    const connection = buildConnection((sql, params, cb) => cb(new Error('Query error')));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { query: {} };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al obtener los reportes');
  });

  test('renderiza gestionReportes con filtros por defecto (todos)', () => {
    const mockReportes = [{ id_reporte: 1, estado: 'pendiente' }];
    const connection = buildConnection((sql, params, cb) => cb(null, mockReportes));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { query: {} };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('gestionReportes', expect.objectContaining({
      reportes: mockReportes,
      filtros: { tipo: 'todos', estado: 'todos', usuario: '' }
    }));
  });

  test('aplica filtro por estado pendiente', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, []));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { query: { estado: 'pendiente' } };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('gestionReportes', expect.objectContaining({
      filtros: expect.objectContaining({ estado: 'pendiente' })
    }));
  });

  test('ignora tipo inválido y usa "todos"', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, []));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { query: { tipo: 'invalido' } };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    expect(res.render).toHaveBeenCalledWith('gestionReportes', expect.objectContaining({
      filtros: expect.objectContaining({ tipo: 'todos' })
    }));
  });
});

// ─────────────────────────────────────────────
// postAdminRegistroUsuario
// ─────────────────────────────────────────────
describe('adminController.postAdminRegistroUsuario', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'correo' }]
    });

    const req = { body: { correo: '', nombre_usuario: '', rol: 'user' } };
    const res = buildResponse();

    adminController.postAdminRegistroUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith('adminRegistroUsuario', expect.objectContaining({
      error: 'Por favor, corrige los errores en el formulario.',
      formType: 'usuario',
      modo: 'crear'
    }));
  });

  test('devuelve 500 cuando getConnection falla', (done) => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = {
      body: {
        nombre_completo: 'Ana García',
        correo: 'ana@example.com',
        nombre_usuario: 'ana123',
        telefono: '600123456',
        password: 'Password1',
        fecha_nacimiento: '2000-01-01',
        rol: 'user'
      }
    };
    const res = buildResponse();

    adminController.postAdminRegistroUsuario(req, res);

    setTimeout(() => {
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
      done();
    }, 50);
  });

  test('renderiza error cuando el correo ya existe', (done) => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('WHERE correo')) return cb(null, [{ id_usuario: 1 }]);
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
        fecha_nacimiento: '2000-01-01',
        rol: 'user'
      }
    };
    const res = buildResponse();

    adminController.postAdminRegistroUsuario(req, res);

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('adminRegistroUsuario', expect.objectContaining({
        error: 'El correo electrónico ya está registrado.',
        formType: 'usuario'
      }));
      done();
    }, 50);
  });

  test('renderiza error cuando el nombre de usuario ya existe', (done) => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('WHERE correo')) return cb(null, []);
      if (sql.includes('WHERE nombre_usuario')) return cb(null, [{ id_usuario: 2 }]);
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
        fecha_nacimiento: '2000-01-01',
        rol: 'user'
      }
    };
    const res = buildResponse();

    adminController.postAdminRegistroUsuario(req, res);

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('adminRegistroUsuario', expect.objectContaining({
        error: 'El nombre de usuario ya está en uso.',
        formType: 'usuario'
      }));
      done();
    }, 50);
  });

  test('renderiza error cuando el teléfono ya existe', (done) => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('WHERE correo')) return cb(null, []);
      if (sql.includes('WHERE nombre_usuario')) return cb(null, []);
      if (sql.includes('WHERE telefono')) return cb(null, [{ id_usuario: 3 }]);
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
        fecha_nacimiento: '2000-01-01',
        rol: 'user'
      }
    };
    const res = buildResponse();

    adminController.postAdminRegistroUsuario(req, res);

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('adminRegistroUsuario', expect.objectContaining({
        error: 'El teléfono ya está registrado.',
        formType: 'usuario'
      }));
      done();
    }, 50);
  });

  test('registra usuario correctamente y redirige a gestionUsuarios', (done) => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('WHERE correo')) return cb(null, []);
      if (sql.includes('WHERE nombre_usuario')) return cb(null, []);
      if (sql.includes('WHERE telefono')) return cb(null, []);
      if (sql.includes('INSERT INTO usuarios')) return cb(null, { insertId: 99 });
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
        fecha_nacimiento: '2000-01-01',
        rol: 'user'
      }
    };
    const res = buildResponse();

    adminController.postAdminRegistroUsuario(req, res);

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/admin/adminPanel/gestionUsuarios/filtrar?tab=usuarios');
      done();
    }, 50);
  });
});

// ─────────────────────────────────────────────
// postAdminRegistroEmpresa
// ─────────────────────────────────────────────
describe('adminController.postAdminRegistroEmpresa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'nombre' }]
    });

    const req = { body: { nombre: '', correo: '', cif: '', tipo_otro: '' } };
    const res = buildResponse();

    adminController.postAdminRegistroEmpresa(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith('adminRegistroUsuario', expect.objectContaining({
      error: 'Por favor, corrige los errores en el formulario.',
      formType: 'empresa',
      modo: 'crear'
    }));
  });

  test('renderiza error cuando el correo ya existe', (done) => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('WHERE correo')) return cb(null, [{ id_empresa: 1 }]);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      body: {
        nombre: 'Empresa XYZ',
        correo: 'empresa@example.com',
        telefono_contacto: '600000001',
        password: 'Password1',
        cif: 'B12345678',
        tipo: 'veterinaria',
        tipo_otro: ''
      }
    };
    const res = buildResponse();

    adminController.postAdminRegistroEmpresa(req, res);

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('adminRegistroUsuario', expect.objectContaining({
        error: 'El correo electrónico ya está registrado.',
        formType: 'empresa'
      }));
      done();
    }, 50);
  });

  test('renderiza error cuando el CIF ya existe', (done) => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('WHERE correo')) return cb(null, []);
      if (sql.includes('WHERE CIF')) return cb(null, [{ id_empresa: 2 }]);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      body: {
        nombre: 'Empresa XYZ',
        correo: 'empresa@example.com',
        telefono_contacto: '600000001',
        password: 'Password1',
        cif: 'B12345678',
        tipo: 'veterinaria',
        tipo_otro: ''
      }
    };
    const res = buildResponse();

    adminController.postAdminRegistroEmpresa(req, res);

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('adminRegistroUsuario', expect.objectContaining({
        error: 'El CIF ya está registrado.',
        formType: 'empresa'
      }));
      done();
    }, 50);
  });

  test('registra empresa correctamente y redirige a gestionUsuarios', (done) => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('WHERE correo')) return cb(null, []);
      if (sql.includes('WHERE CIF')) return cb(null, []);
      if (sql.includes('WHERE telefono_contacto')) return cb(null, []);
      if (sql.includes('INSERT INTO empresas')) return cb(null, { insertId: 55 });
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      body: {
        nombre: 'Empresa XYZ',
        correo: 'empresa@example.com',
        telefono_contacto: '600000001',
        password: 'Password1',
        cif: 'B12345678',
        tipo: 'veterinaria',
        tipo_otro: ''
      }
    };
    const res = buildResponse();

    adminController.postAdminRegistroEmpresa(req, res);

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/admin/adminPanel/gestionUsuarios/filtrar?tab=empresas');
      done();
    }, 50);
  });
});

// ─────────────────────────────────────────────
// aplicarAccionReporte
// ─────────────────────────────────────────────
describe('adminController.aplicarAccionReporte', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 cuando la acción no es válida', () => {
    const req = { params: { id_reporte: '1', accion: 'inexistente' } };
    const res = buildResponse();

    adminController.aplicarAccionReporte(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Acción no válida');
  });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = { params: { id_reporte: '1', accion: 'aceptar' } };
    const res = buildResponse();

    adminController.aplicarAccionReporte(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 404 cuando el reporte no existe', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, { affectedRows: 0 }));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { id_reporte: '999', accion: 'aceptar' } };
    const res = buildResponse();

    adminController.aplicarAccionReporte(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Reporte no encontrado');
  });

  test('acepta el reporte y redirige a gestionReportes', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, { affectedRows: 1 }));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { id_reporte: '1', accion: 'aceptar' } };
    const res = buildResponse();

    adminController.aplicarAccionReporte(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/admin/adminPanel/gestionReportes');
  });

  test('deniega el reporte y redirige a gestionReportes', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, { affectedRows: 1 }));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { id_reporte: '2', accion: 'denegar' } };
    const res = buildResponse();

    adminController.aplicarAccionReporte(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/admin/adminPanel/gestionReportes');
  });
});

// ─────────────────────────────────────────────
// aceptarReporteUsuarioSuspender
// ─────────────────────────────────────────────
describe('adminController.aceptarReporteUsuarioSuspender', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = { params: { id_reporte: '1' } };
    const res = buildResponse();

    adminController.aceptarReporteUsuarioSuspender(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 404 cuando el reporte no existe', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT id_usuario_reportado')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { id_reporte: '999' } };
    const res = buildResponse();

    adminController.aceptarReporteUsuarioSuspender(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Reporte no encontrado');
  });

  test('suspende al usuario y redirige a gestionReportes', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT id_usuario_reportado')) return cb(null, [{ id_usuario_reportado: 7 }]);
      if (sql.includes('UPDATE usuarios SET suspendido')) return cb(null, {});
      if (sql.includes('UPDATE reportes SET estado')) return cb(null, {});
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { id_reporte: '1' } };
    const res = buildResponse();

    adminController.aceptarReporteUsuarioSuspender(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/admin/adminPanel/gestionReportes');
  });
});

// ─────────────────────────────────────────────
// aceptarReporteUsuarioBanear
// ─────────────────────────────────────────────
describe('adminController.aceptarReporteUsuarioBanear', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 404 cuando el reporte no existe', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT id_usuario_reportado')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { id_reporte: '999' } };
    const res = buildResponse();

    adminController.aceptarReporteUsuarioBanear(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Reporte no encontrado');
  });

  test('banea al usuario y redirige a gestionReportes', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT id_usuario_reportado')) return cb(null, [{ id_usuario_reportado: 7 }]);
      if (sql.includes('UPDATE usuarios SET ban')) return cb(null, {});
      if (sql.includes('UPDATE reportes SET estado')) return cb(null, {});
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { id_reporte: '1' } };
    const res = buildResponse();

    adminController.aceptarReporteUsuarioBanear(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/admin/adminPanel/gestionReportes');
  });
});

// ─────────────────────────────────────────────
// eliminarUsuarioGestion
// ─────────────────────────────────────────────
describe('adminController.eliminarUsuarioGestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 cuando el tipo no es válido', () => {
    const req = { params: { tipo: 'invalido', id: '1' } };
    const res = buildResponse();

    adminController.eliminarUsuarioGestion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Solicitud de eliminación inválida');
  });

  test('devuelve 400 cuando el id no es un número', () => {
    const req = { params: { tipo: 'usuario', id: 'abc' } };
    const res = buildResponse();

    adminController.eliminarUsuarioGestion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Solicitud de eliminación inválida');
  });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = { params: { tipo: 'usuario', id: '5' } };
    const res = buildResponse();

    adminController.eliminarUsuarioGestion(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 404 cuando la cuenta no existe', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, { affectedRows: 0 }));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { tipo: 'usuario', id: '999' } };
    const res = buildResponse();

    adminController.eliminarUsuarioGestion(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Cuenta no encontrada');
  });

  test('desactiva un usuario y redirige al referrer', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, { affectedRows: 1 }));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      params: { tipo: 'usuario', id: '5' },
      get: jest.fn((header) => header === 'Referrer' ? '/admin/adminPanel/gestionUsuarios/filtrar' : undefined)
    };
    const res = buildResponse();

    adminController.eliminarUsuarioGestion(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/admin/adminPanel/gestionUsuarios/filtrar');
  });

  test('desactiva una empresa y redirige al fallback cuando no hay referrer', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, { affectedRows: 1 }));
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      params: { tipo: 'empresa', id: '3' },
      get: jest.fn(() => undefined)
    };
    const res = buildResponse();

    adminController.eliminarUsuarioGestion(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/admin/adminPanel/gestionUsuarios/filtrar');
  });
});