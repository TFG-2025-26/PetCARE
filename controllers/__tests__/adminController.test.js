jest.mock('../../db', () => ({
  getConnection: jest.fn()
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

describe('adminController.filtrarReportes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renderiza gestionReportes con todos los reportes cuando no hay filtros', (done) => {
    const mockReportes = [
      {
        id_reporte: 1,
        tipo: 'usuarios',
        estado: 'pendiente',
        nombre_usuario_reportado: 'usuario1'
      },
      {
        id_reporte: 2,
        tipo: 'foros',
        estado: 'aceptado',
        nombre_usuario_reportado: 'usuario2'
      }
    ];

    const connection = buildConnection((sql, params, cb) => {
      cb(null, mockReportes);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: {}
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(pool.getConnection).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('gestionReportes', {
        reportes: mockReportes,
        filtros: { tipo: 'todos', estado: 'todos', usuario: '' }
      });
      done();
    }, 50);
  });

  test('filtra reportes por tipo "usuarios"', (done) => {
    const mockReportes = [
      {
        id_reporte: 1,
        tipo: 'usuarios',
        estado: 'pendiente'
      }
    ];

    const connection = buildConnection((sql, params, cb) => {
      expect(sql).toContain('r.id_foro IS NULL AND r.id_comentario IS NULL AND r.id_valoracion IS NULL');
      cb(null, mockReportes);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: { tipo: 'usuarios' }
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(res.render).toHaveBeenCalledWith('gestionReportes', {
        reportes: mockReportes,
        filtros: { tipo: 'usuarios', estado: 'todos', usuario: '' }
      });
      done();
    }, 50);
  });

  test('filtra reportes por tipo "foros"', (done) => {
    const mockReportes = [
      {
        id_reporte: 2,
        tipo: 'foros',
        estado: 'pendiente'
      }
    ];

    const connection = buildConnection((sql, params, cb) => {
      expect(sql).toContain('r.id_foro IS NOT NULL');
      cb(null, mockReportes);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: { tipo: 'foros' }
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(res.render).toHaveBeenCalledWith('gestionReportes', {
        reportes: mockReportes,
        filtros: { tipo: 'foros', estado: 'todos', usuario: '' }
      });
      done();
    }, 50);
  });

  test('filtra reportes por tipo "comentarios"', (done) => {
    const mockReportes = [
      {
        id_reporte: 3,
        tipo: 'comentarios',
        estado: 'pendiente'
      }
    ];

    const connection = buildConnection((sql, params, cb) => {
      expect(sql).toContain('r.id_comentario IS NOT NULL');
      cb(null, mockReportes);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: { tipo: 'comentarios' }
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(res.render).toHaveBeenCalledWith('gestionReportes', {
        reportes: mockReportes,
        filtros: { tipo: 'comentarios', estado: 'todos', usuario: '' }
      });
      done();
    }, 50);
  });

  test('filtra reportes por tipo "valoraciones"', (done) => {
    const mockReportes = [
      {
        id_reporte: 4,
        tipo: 'valoraciones',
        estado: 'pendiente'
      }
    ];

    const connection = buildConnection((sql, params, cb) => {
      expect(sql).toContain('r.id_valoracion IS NOT NULL');
      cb(null, mockReportes);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: { tipo: 'valoraciones' }
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(res.render).toHaveBeenCalledWith('gestionReportes', {
        reportes: mockReportes,
        filtros: { tipo: 'valoraciones', estado: 'todos', usuario: '' }
      });
      done();
    }, 50);
  });

  test('rechaza tipos inválidos y usa "todos" como predeterminado', (done) => {
    const mockReportes = [];

    const connection = buildConnection((sql, params, cb) => {
      expect(sql).not.toContain('id_foro IS NOT NULL');
      expect(sql).not.toContain('id_comentario IS NOT NULL');
      cb(null, mockReportes);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: { tipo: 'invalido' }
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(res.render).toHaveBeenCalledWith('gestionReportes', {
        reportes: mockReportes,
        filtros: { tipo: 'todos', estado: 'todos', usuario: '' }
      });
      done();
    }, 50);
  });

  test('filtra reportes por estado "pendiente"', (done) => {
    const mockReportes = [
      { id_reporte: 1, estado: 'pendiente' }
    ];

    const connection = buildConnection((sql, params, cb) => {
      expect(sql).toContain('r.estado = ?');
      expect(params).toContain('pendiente');
      cb(null, mockReportes);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: { estado: 'pendiente' }
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(res.render).toHaveBeenCalledWith('gestionReportes', {
        reportes: mockReportes,
        filtros: { tipo: 'todos', estado: 'pendiente', usuario: '' }
      });
      done();
    }, 50);
  });

  test('filtra reportes por estado "aceptado"', (done) => {
    const mockReportes = [
      { id_reporte: 2, estado: 'aceptado' }
    ];

    const connection = buildConnection((sql, params, cb) => {
      expect(params).toContain('aceptado');
      cb(null, mockReportes);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: { estado: 'aceptado' }
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(res.render).toHaveBeenCalledWith('gestionReportes', {
        reportes: mockReportes,
        filtros: { tipo: 'todos', estado: 'aceptado', usuario: '' }
      });
      done();
    }, 50);
  });

  test('filtra reportes por estado "rechazado"', (done) => {
    const mockReportes = [
      { id_reporte: 3, estado: 'rechazado' }
    ];

    const connection = buildConnection((sql, params, cb) => {
      expect(params).toContain('rechazado');
      cb(null, mockReportes);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: { estado: 'rechazado' }
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(res.render).toHaveBeenCalledWith('gestionReportes', {
        reportes: mockReportes,
        filtros: { tipo: 'todos', estado: 'rechazado', usuario: '' }
      });
      done();
    }, 50);
  });

  test('rechaza estados inválidos y usa "todos" como predeterminado', (done) => {
    const mockReportes = [];

    const connection = buildConnection((sql, params, cb) => {
      expect(sql).not.toContain('r.estado = ?');
      cb(null, mockReportes);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: { estado: 'invalido' }
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(res.render).toHaveBeenCalledWith('gestionReportes', {
        reportes: mockReportes,
        filtros: { tipo: 'todos', estado: 'todos', usuario: '' }
      });
      done();
    }, 50);
  });

  test('filtra reportes por ID de usuario (número)', (done) => {
    const mockReportes = [
      { id_reporte: 1, id_usuario_reportado: 5 }
    ];

    const connection = buildConnection((sql, params, cb) => {
      expect(sql).toContain('r.id_usuario_reportado = ?');
      expect(params).toContain(5);
      cb(null, mockReportes);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: { usuario: '5' }
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(res.render).toHaveBeenCalledWith('gestionReportes', {
        reportes: mockReportes,
        filtros: { tipo: 'todos', estado: 'todos', usuario: '5' }
      });
      done();
    }, 50);
  });

  test('filtra reportes por nombre de usuario (string)', (done) => {
    const mockReportes = [
      { id_reporte: 1, nombre_usuario_reportado: 'juan_perez' }
    ];

    const connection = buildConnection((sql, params, cb) => {
      expect(sql).toContain('u_reportado.nombre_usuario LIKE ?');
      expect(params).toContain('%juan%');
      cb(null, mockReportes);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: { usuario: 'juan' }
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(res.render).toHaveBeenCalledWith('gestionReportes', {
        reportes: mockReportes,
        filtros: { tipo: 'todos', estado: 'todos', usuario: 'juan' }
      });
      done();
    }, 50);
  });

  test('ignora usuario vacío', (done) => {
    const mockReportes = [];

    const connection = buildConnection((sql, params, cb) => {
      // Verificar que params está vacío cuando usuario es vacío
      expect(params.length).toBe(0);
      // Verificar que la cláusula WHERE no tiene condiciones de usuario
      expect(sql).not.toContain('WHERE');
      cb(null, mockReportes);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: { usuario: '   ' }
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(res.render).toHaveBeenCalledWith('gestionReportes', {
        reportes: mockReportes,
        filtros: { tipo: 'todos', estado: 'todos', usuario: '   ' }
      });
      done();
    }, 50);
  });

  test('combina múltiples filtros correctamente', (done) => {
    const mockReportes = [];

    const connection = buildConnection((sql, params, cb) => {
      expect(sql).toContain('r.id_foro IS NOT NULL');
      expect(sql).toContain('r.estado = ?');
      expect(sql).toContain('u_reportado.nombre_usuario LIKE ?');
      expect(params).toEqual(['aceptado', '%admin%']);
      cb(null, mockReportes);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: { tipo: 'foros', estado: 'aceptado', usuario: 'admin' }
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(res.render).toHaveBeenCalledWith('gestionReportes', {
        reportes: mockReportes,
        filtros: { tipo: 'foros', estado: 'aceptado', usuario: 'admin' }
      });
      done();
    }, 50);
  });

  test('devuelve 500 cuando getConnection falla', (done) => {
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = {
      query: {}
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
      done();
    }, 50);
  });

  test('devuelve 500 cuando la query falla', (done) => {
    const connection = buildConnection((sql, params, cb) => {
      cb(new Error('Query failed'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: {}
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(connection.release).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Error al obtener los reportes');
      done();
    }, 50);
  });

  test('ordena reportes por fecha descendente', (done) => {
    const mockReportes = [];

    const connection = buildConnection((sql, params, cb) => {
      expect(sql).toContain('ORDER BY r.fecha DESC');
      cb(null, mockReportes);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: {}
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(connection.query).toHaveBeenCalled();
      done();
    }, 50);
  });

  test('hace LEFT JOIN con todas las tablas necesarias', (done) => {
    const mockReportes = [];

    const connection = buildConnection((sql, params, cb) => {
      expect(sql).toContain('LEFT JOIN usuarios u ON r.id_autor = u.id_usuario');
      expect(sql).toContain('LEFT JOIN usuarios u_reportado ON r.id_usuario_reportado = u_reportado.id_usuario');
      expect(sql).toContain('LEFT JOIN foros f ON r.id_foro = f.id_foro');
      expect(sql).toContain('LEFT JOIN comentarios c ON r.id_comentario = c.id_comentario');
      expect(sql).toContain('LEFT JOIN valoraciones v ON r.id_valoracion = v.id_valoracion');
      cb(null, mockReportes);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      query: {}
    };
    const res = buildResponse();

    adminController.filtrarReportes(req, res);

    setTimeout(() => {
      expect(connection.query).toHaveBeenCalled();
      done();
    }, 50);
  });
});
