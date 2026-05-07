jest.mock('../../db', () => ({
  getConnection: jest.fn()
}));

jest.mock('express-validator', () => ({
  validationResult: jest.fn()
}));

const pool = require('../../db');
const { validationResult } = require('express-validator');
const servicesController = require('../servicesController');

const buildResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.render = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildConnection = (queryImpl) => ({
  query: jest.fn(queryImpl),
  release: jest.fn()
});

// --- getServicios ---------------------------------------------------------------------

describe('servicesController.getServicios', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('renderiza servicios', () => {
    const req = {};
    const res = buildResponse();

    servicesController.getServicios(req, res);

    expect(res.render).toHaveBeenCalledWith('servicios');
  });
});

// --- anuncios ---------------------------------------------------------------------

describe('servicesController.anuncios', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('renderiza anuncios', () => {
    const req = {};
    const res = buildResponse();

    servicesController.anuncios(req, res);

    expect(res.render).toHaveBeenCalledWith('anuncios');
  });
});

// --- misAnuncios ---------------------------------------------------------------------

describe('servicesController.misAnuncios', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('renderiza misAnuncios', () => {
    const req = {};
    const res = buildResponse();

    servicesController.misAnuncios(req, res);

    expect(res.render).toHaveBeenCalledWith('misAnuncios');
  });
});

// --- empresas ---------------------------------------------------------------------

describe('servicesController.empresas', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('renderiza empresas', () => {
    const req = {};
    const res = buildResponse();

    servicesController.empresas(req, res);

    expect(res.render).toHaveBeenCalledWith('empresas');
  });
});

// --- getPublicarAnuncio ---------------------------------------------------------------------

describe('servicesController.getPublicarAnuncio', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('renderiza publicarAnuncio con error null y errores vacíos', () => {
    const req = {};
    const res = buildResponse();

    servicesController.getPublicarAnuncio(req, res);

    expect(res.render).toHaveBeenCalledWith('publicarAnuncio', { error: null, errores: [] });
  });
});

// --- getAnuncios ---------------------------------------------------------------------

describe('servicesController.getAnuncios', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  const baseReq = (overrides = {}) => ({
    query: { pagina: '1', limite: '10', ...overrides },
    session: { usuario: null }
  });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getAnuncios(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al conectar a la base de datos' });
  });

  test('devuelve 500 cuando falla la consulta de anuncios', () => {
    const connection = buildConnection((sql, params, cb) => cb(new Error('Query error')));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getAnuncios(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener los anuncios' });
  });

  test('devuelve array vacío cuando no hay anuncios', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, []));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getAnuncios(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ anuncios: [], hayMasPaginas: false });
  });

  test('devuelve 500 cuando falla la consulta de disponibilidades', () => {
    const anunciosMock = [{ id_anuncio: 1, descripcion: 'Desc' }];
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('FROM disponibilidad WHERE id_anuncio IN')) return cb(new Error('Disp error'));
      cb(null, anunciosMock);
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getAnuncios(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener las disponibilidades' });
  });

  test('devuelve anuncios con disponibilidades correctamente', () => {
    const anunciosMock = [{ id_anuncio: 1, descripcion: 'Paseo de perros' }];
    const dispMock = [{ id_disp: 1, tipo: 'puntual', id_anuncio: 1, fecha_inicio: '2025-06-01', dia_semana: null, hora_inicio: '10:00', hora_fin: '11:00' }];
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('FROM disponibilidad WHERE id_anuncio IN')) return cb(null, dispMock);
      cb(null, anunciosMock);
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getAnuncios(req, res);

    expect(connection.release).toHaveBeenCalled();
    const { anuncios, hayMasPaginas } = res.json.mock.calls[0][0];
    expect(hayMasPaginas).toBe(false);
    expect(anuncios[0].disponibilidades).toEqual(dispMock);
  });

  test('devuelve hayMasPaginas=true cuando hay más resultados que el límite', () => {
    const anunciosMock = Array.from({ length: 11 }, (_, i) => ({ id_anuncio: i + 1, descripcion: 'Desc' }));
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('FROM disponibilidad WHERE id_anuncio IN')) return cb(null, []);
      cb(null, anunciosMock);
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getAnuncios(req, res);

    const { anuncios, hayMasPaginas } = res.json.mock.calls[0][0];
    expect(hayMasPaginas).toBe(true);
    expect(anuncios).toHaveLength(10);
  });

  test('reemplaza descripcion nula con texto por defecto', () => {
    const anunciosMock = [{ id_anuncio: 1, descripcion: null }];
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('FROM disponibilidad WHERE id_anuncio IN')) return cb(null, []);
      cb(null, anunciosMock);
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getAnuncios(req, res);

    const { anuncios } = res.json.mock.calls[0][0];
    expect(anuncios[0].descripcion).toBe('El usuario no ha añadido una descripción para este anuncio.');
  });

  test('aplica el filtro de usuario autenticado para excluir sus propios anuncios', () => {
    const anunciosMock = [{ id_anuncio: 2, descripcion: 'Cuidado' }];
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('FROM disponibilidad WHERE id_anuncio IN')) return cb(null, []);
      cb(null, anunciosMock);
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { query: { pagina: '1', limite: '10' }, session: { usuario: { id: 5 } } };
    const res = buildResponse();

    servicesController.getAnuncios(req, res);

    const firstQueryParams = connection.query.mock.calls[0][1];
    expect(firstQueryParams).toContain(5);
  });
});

// --- getMisAnuncios ---------------------------------------------------------------------

describe('servicesController.getMisAnuncios', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  const baseReq = () => ({
    query: { pagina: '1', limite: '10' },
    session: { usuario: { id: 1 } }
  });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getMisAnuncios(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al conectar a la base de datos' });
  });

  test('devuelve 500 cuando falla la consulta de anuncios', () => {
    const connection = buildConnection((sql, params, cb) => cb(new Error('Query error')));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getMisAnuncios(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener los anuncios' });
  });

  test('devuelve array vacío cuando el usuario no tiene anuncios', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, []));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getMisAnuncios(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ anuncios: [], hayMasPaginas: false });
  });

  test('devuelve 500 cuando falla la consulta de disponibilidades', () => {
    const anunciosMock = [{ id_anuncio: 3, descripcion: 'Desc' }];
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('FROM disponibilidad WHERE id_anuncio IN')) return cb(new Error('Disp error'));
      cb(null, anunciosMock);
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getMisAnuncios(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener las disponibilidades' });
  });

  test('devuelve anuncios con disponibilidades correctamente', () => {
    const anunciosMock = [{ id_anuncio: 3, descripcion: 'Mi anuncio' }];
    const dispMock = [{ id_disp: 5, tipo: 'recurrente', id_anuncio: 3, fecha_inicio: null, dia_semana: 'lunes', hora_inicio: '09:00', hora_fin: '10:00' }];
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('FROM disponibilidad WHERE id_anuncio IN')) return cb(null, dispMock);
      cb(null, anunciosMock);
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getMisAnuncios(req, res);

    expect(connection.release).toHaveBeenCalled();
    const { anuncios, hayMasPaginas } = res.json.mock.calls[0][0];
    expect(hayMasPaginas).toBe(false);
    expect(anuncios[0].disponibilidades).toEqual(dispMock);
  });

  test('devuelve hayMasPaginas=true cuando hay más anuncios que el límite', () => {
    const anunciosMock = Array.from({ length: 11 }, (_, i) => ({ id_anuncio: i + 1, descripcion: 'Desc' }));
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('FROM disponibilidad WHERE id_anuncio IN')) return cb(null, []);
      cb(null, anunciosMock);
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getMisAnuncios(req, res);

    const { anuncios, hayMasPaginas } = res.json.mock.calls[0][0];
    expect(hayMasPaginas).toBe(true);
    expect(anuncios).toHaveLength(10);
  });

  test('reemplaza descripcion vacía con texto por defecto', () => {
    const anunciosMock = [{ id_anuncio: 4, descripcion: '' }];
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('FROM disponibilidad WHERE id_anuncio IN')) return cb(null, []);
      cb(null, anunciosMock);
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getMisAnuncios(req, res);

    const { anuncios } = res.json.mock.calls[0][0];
    expect(anuncios[0].descripcion).toBe('No has añadido una descripción para este anuncio.');
  });
});

// --- postPublicarAnuncio ---------------------------------------------------------------------

describe('servicesController.postPublicarAnuncio', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 400 cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'tipo' }]
    });
    const req = { body: {} };
    const res = buildResponse();

    servicesController.postPublicarAnuncio(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith('publicarAnuncio', expect.objectContaining({
      error: 'Por favor, corrige los errores en el formulario.'
    }));
  });

  test('devuelve 500 cuando getConnection falla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = {
      body: { tipo: 'puntual', tipo_servicio: 'paseo', precio_hora: 10, tipo_mascota: 'perro', descripcion: 'Desc', disponibilidad: [] },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    servicesController.postPublicarAnuncio(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('tipo=puntual: devuelve 500 cuando falla el INSERT del anuncio', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO anuncios')) return cb(new Error('Insert error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = {
      body: { tipo: 'puntual', tipo_servicio: 'paseo', precio_hora: 10, tipo_mascota: 'perro', descripcion: 'Desc', disponibilidad: [{ fecha: '2025-06-01', hora_inicio: '10:00', hora_fin: '11:00' }] },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    servicesController.postPublicarAnuncio(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al insertar el anuncio');
  });

  test('tipo=puntual: devuelve 500 cuando falla el INSERT de disponibilidad', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO anuncios')) return cb(null, { insertId: 10 });
      if (sql.includes('INSERT INTO disponibilidad')) return cb(new Error('Disp error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = {
      body: { tipo: 'puntual', tipo_servicio: 'paseo', precio_hora: 10, tipo_mascota: 'perro', descripcion: 'Desc', disponibilidad: [{ fecha: '2025-06-01', hora_inicio: '10:00', hora_fin: '11:00' }] },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    servicesController.postPublicarAnuncio(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al insertar la disponibilidad');
  });

  test('tipo=puntual: redirige a mis-anuncios al publicar correctamente', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO anuncios')) return cb(null, { insertId: 10 });
      if (sql.includes('INSERT INTO disponibilidad')) return cb(null, {});
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = {
      body: { tipo: 'puntual', tipo_servicio: 'paseo', precio_hora: 10, tipo_mascota: 'perro', descripcion: 'Desc', disponibilidad: [{ fecha: '2025-06-01', hora_inicio: '10:00', hora_fin: '11:00' }] },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    servicesController.postPublicarAnuncio(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/services/mis-anuncios');
  });

  test('tipo=recurrente: devuelve 500 cuando falla el INSERT del anuncio', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO anuncios')) return cb(new Error('Insert error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = {
      body: { tipo: 'recurrente', tipo_servicio: 'cuidado', precio_hora: 8, tipo_mascota: 'gato', descripcion: 'Desc', disponibilidad: [], recurrente: { lunes: { 0: { hora_inicio: '10:00', hora_fin: '12:00' } } } },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    servicesController.postPublicarAnuncio(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al insertar el anuncio');
  });

  test('tipo=recurrente: devuelve 500 cuando falla el INSERT de disponibilidad', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO anuncios')) return cb(null, { insertId: 11 });
      if (sql.includes('INSERT INTO disponibilidad')) return cb(new Error('Disp error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = {
      body: { tipo: 'recurrente', tipo_servicio: 'cuidado', precio_hora: 8, tipo_mascota: 'gato', descripcion: 'Desc', disponibilidad: [], recurrente: { lunes: { 0: { hora_inicio: '10:00', hora_fin: '12:00' } } } },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    servicesController.postPublicarAnuncio(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al insertar la disponibilidad');
  });

  test('tipo=recurrente: redirige a anuncios al publicar correctamente', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO anuncios')) return cb(null, { insertId: 11 });
      if (sql.includes('INSERT INTO disponibilidad')) return cb(null, {});
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = {
      body: { tipo: 'recurrente', tipo_servicio: 'cuidado', precio_hora: 8, tipo_mascota: 'gato', descripcion: 'Desc', disponibilidad: [], recurrente: { lunes: { 0: { hora_inicio: '10:00', hora_fin: '12:00' } } } },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    servicesController.postPublicarAnuncio(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/services/mis-anuncios');
  });
});

// --- eliminarAnuncio ---------------------------------------------------------------------

describe('servicesController.eliminarAnuncio', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  const baseReq = (tipo, id = '5') => ({
    params: { id },
    body: { tipo },
    session: { usuario: { id: 1 } }
  });

  test('devuelve 400 para tipo de eliminación no válido', () => {
    const req = baseReq('invalido');
    const res = buildResponse();

    servicesController.eliminarAnuncio(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Tipo de eliminación no válido.' });
  });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = baseReq('total');
    const res = buildResponse();

    servicesController.eliminarAnuncio(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error de conexión.' });
  });

  test('tipo=total: devuelve 500 cuando falla el UPDATE del anuncio', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('eliminado')) return cb(new Error('Update error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq('total');
    const res = buildResponse();

    servicesController.eliminarAnuncio(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al eliminar el anuncio.' });
  });

  test('tipo=total: devuelve 403 cuando el anuncio no pertenece al usuario', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('eliminado')) return cb(null, { affectedRows: 0 });
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq('total');
    const res = buildResponse();

    servicesController.eliminarAnuncio(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'No tienes permiso para eliminar este anuncio.' });
  });

  test('tipo=total: devuelve 500 cuando falla el UPDATE de chats', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('eliminado')) return cb(null, { affectedRows: 1 });
      if (sql.includes('UPDATE chats')) return cb(new Error('Chats error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq('total');
    const res = buildResponse();

    servicesController.eliminarAnuncio(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Anuncio eliminado pero error al archivar chats.' });
  });

  test('tipo=total: elimina el anuncio y sus chats correctamente', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('eliminado')) return cb(null, { affectedRows: 1 });
      if (sql.includes('UPDATE chats')) return cb(null, {});
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq('total');
    const res = buildResponse();

    servicesController.eliminarAnuncio(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('tipo=simple: devuelve 500 cuando falla el UPDATE', () => {
    const connection = buildConnection((sql, params, cb) => cb(new Error('Update error')));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq('simple');
    const res = buildResponse();

    servicesController.eliminarAnuncio(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al desactivar el anuncio.' });
  });

  test('tipo=simple: devuelve 403 cuando el anuncio no pertenece al usuario', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, { affectedRows: 0 }));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq('simple');
    const res = buildResponse();

    servicesController.eliminarAnuncio(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'No tienes permiso para modificar este anuncio.' });
  });

  test('tipo=simple: desactiva el anuncio correctamente', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, { affectedRows: 1 }));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq('simple');
    const res = buildResponse();

    servicesController.eliminarAnuncio(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

// --- reactivarAnuncio ---------------------------------------------------------------------

describe('servicesController.reactivarAnuncio', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  const baseReq = (id = '5') => ({
    params: { id },
    session: { usuario: { id: 1 } }
  });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = baseReq();
    const res = buildResponse();

    servicesController.reactivarAnuncio(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error de conexión.' });
  });

  test('devuelve 500 cuando falla el UPDATE', () => {
    const connection = buildConnection((sql, params, cb) => cb(new Error('Update error')));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.reactivarAnuncio(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al reactivar el anuncio.' });
  });

  test('devuelve 403 cuando el anuncio no pertenece al usuario o está eliminado', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, { affectedRows: 0 }));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.reactivarAnuncio(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'No tienes permiso para modificar este anuncio.' });
  });

  test('reactiva el anuncio correctamente', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, { affectedRows: 1 }));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.reactivarAnuncio(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

// --- getEmpresas ---------------------------------------------------------------------

describe('servicesController.getEmpresas', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  const baseReq = (overrides = {}) => ({
    query: { pagina: '1', limite: '10', ...overrides }
  });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getEmpresas(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al conectar a la base de datos' });
  });

  test('devuelve 500 cuando falla la consulta', () => {
    const connection = buildConnection((sql, params, cb) => cb(new Error('Query error')));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getEmpresas(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener las empresas' });
  });

  test('devuelve empresas correctamente', () => {
    const empresasMock = [{ id_empresa: 1, nombre: 'Vet Clínica', descripcion: 'Descripción' }];
    const connection = buildConnection((sql, params, cb) => cb(null, empresasMock));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getEmpresas(req, res);

    expect(connection.release).toHaveBeenCalled();
    const { empresas, hayMasPaginas } = res.json.mock.calls[0][0];
    expect(hayMasPaginas).toBe(false);
    expect(empresas).toHaveLength(1);
  });

  test('devuelve hayMasPaginas=true cuando hay más resultados que el límite', () => {
    const empresasMock = Array.from({ length: 11 }, (_, i) => ({ id_empresa: i + 1, descripcion: 'Desc' }));
    const connection = buildConnection((sql, params, cb) => cb(null, empresasMock));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getEmpresas(req, res);

    const { empresas, hayMasPaginas } = res.json.mock.calls[0][0];
    expect(hayMasPaginas).toBe(true);
    expect(empresas).toHaveLength(10);
  });

  test('reemplaza descripcion vacía con texto por defecto', () => {
    const empresasMock = [{ id_empresa: 2, nombre: 'Sin desc', descripcion: '' }];
    const connection = buildConnection((sql, params, cb) => cb(null, empresasMock));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq();
    const res = buildResponse();

    servicesController.getEmpresas(req, res);

    const { empresas } = res.json.mock.calls[0][0];
    expect(empresas[0].descripcion).toBe('Esta empresa no ha añadido una descripción.');
  });

  test('aplica filtro de nombre de empresa', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, []));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = baseReq({ nombre: 'Vet' });
    const res = buildResponse();

    servicesController.getEmpresas(req, res);

    const queryParams = connection.query.mock.calls[0][1];
    expect(queryParams).toContain('%Vet%');
  });
});
