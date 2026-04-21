jest.mock('../../db', () => ({
  getConnection: jest.fn()
}));

jest.mock('express-validator', () => ({
  validationResult: jest.fn()
}));

const pool = require('../../db');
const { validationResult } = require('express-validator');
const contentController = require('../contentController');

const buildResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.render = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.session = {};
  res.get = jest.fn().mockReturnValue(null);
  res.xhr = false;
  return res;
};

const buildConnection = (queryImpl) => ({
  query: jest.fn(queryImpl),
  release: jest.fn()
});

describe('contentController.getArticulos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = { query: { pagina: '1' }, session: {} };
    const res = buildResponse();

    contentController.getArticulos(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 500 cuando falla el conteo de artículos', () => {
    const connection = buildConnection((sql, params, cb) => {
      cb(new Error('Count error'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { query: { pagina: '1' }, session: {} };
    const res = buildResponse();

    contentController.getArticulos(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al obtener los artículos');
  });

  test('renderiza artículos correctamente con paginación', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('COUNT(*)')) {
        return cb(null, [{ total: 25 }]);
      }
      if (sql.includes('SELECT')) {
        return cb(null, [
          {
            id_articulo: 1,
            titulo: 'Artículo 1',
            cuerpo: 'Contenido 1',
            nombre_usuario: 'usuario1',
            visualizaciones: 10,
            fecha_publicacion: '2026-01-01'
          }
        ]);
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { query: { pagina: '1' }, session: {} };
    const res = buildResponse();

    contentController.getArticulos(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('articulos', expect.objectContaining({
      total: 25,
      totalPaginas: 2,
      paginaActual: 1
    }));
  });

  test('filtra artículos por keyword', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('COUNT(*)')) {
        return cb(null, [{ total: 1 }]);
      }
      if (sql.includes('SELECT')) {
        return cb(null, [
          {
            id_articulo: 2,
            titulo: 'Busqueda encontrada',
            cuerpo: 'Contenido',
            nombre_usuario: 'usuario2',
            visualizaciones: 5,
            fecha_publicacion: '2026-01-02'
          }
        ]);
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { query: { pagina: '1', keyword: 'busqueda' }, session: {} };
    const res = buildResponse();

    contentController.getArticulos(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('articulos', expect.objectContaining({
      filtros: { keyword: 'busqueda' }
    }));
  });
});

describe('contentController.getArticuloDetalle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 cuando el ID del artículo es inválido', () => {
    const req = { params: { id: 'invalido' }, session: {} };
    const res = buildResponse();

    contentController.getArticuloDetalle(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('ID de artículo inválido');
  });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = { params: { id: '1' }, session: { articulosVistos: {} } };
    const res = buildResponse();

    contentController.getArticuloDetalle(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 404 cuando el artículo no existe', () => {
    const connection = buildConnection((sql, params, cb) => {
      cb(null, []);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { id: '999' }, session: { articulosVistos: {} } };
    const res = buildResponse();

    contentController.getArticuloDetalle(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Artículo no encontrado');
  });

  test('incrementa visualizaciones cuando es primera visita en sesión', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('UPDATE')) {
        return cb(null, { affectedRows: 1 });
      }
      if (sql.includes('SELECT')) {
        return cb(null, [
          {
            id_articulo: 1,
            titulo: 'Artículo Test',
            cuerpo: 'Contenido test',
            imagen: null,
            visualizaciones: 5,
            id_usuario: 1,
            nombre_usuario: 'testuser',
            fecha_publicacion: '2026-01-01'
          }
        ]);
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { id: '1' }, session: { articulosVistos: {} } };
    const res = buildResponse();

    contentController.getArticuloDetalle(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(req.session.articulosVistos['1']).toBe(true);
    expect(res.render).toHaveBeenCalledWith('articuloDetalle', expect.objectContaining({
      articulo: expect.objectContaining({
        titulo: 'Artículo Test'
      })
    }));
  });

  test('no incrementa visualizaciones si ya fue visitado en sesión', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT')) {
        return cb(null, [
          {
            id_articulo: 1,
            titulo: 'Artículo Test',
            cuerpo: 'Contenido test',
            imagen: null,
            visualizaciones: 5,
            id_usuario: 1,
            nombre_usuario: 'testuser',
            fecha_publicacion: '2026-01-01'
          }
        ]);
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { id: '1' }, session: { articulosVistos: { '1': true } } };
    const res = buildResponse();

    contentController.getArticuloDetalle(req, res);

    expect(res.render).toHaveBeenCalledWith('articuloDetalle', expect.anything());
  });
});

describe('contentController.getCrearArticulo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 302 redirect cuando no es una solicitud AJAX', () => {
    const req = { xhr: false, get: () => null };
    const res = buildResponse();

    contentController.getCrearArticulo(req, res);

    expect(res.redirect).toHaveBeenCalledWith('/content/articulos');
  });

  test('renderiza formulario cuando es solicitud AJAX', () => {
    const req = { xhr: true, session: { usuario: { id: 1 } } };
    const res = buildResponse();

    contentController.getCrearArticulo(req, res);

    expect(res.render).toHaveBeenCalledWith('plantillas/crearArticulo', expect.objectContaining({
      modoEdicion: false,
      tituloModal: 'Crear artículo'
    }));
  });
});

describe('contentController.postCrearArticulo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'titulo' }]
    });

    const req = { body: { titulo: '', cuerpo: '' }, session: { usuario: { id: 1 } } };
    const res = buildResponse();

    contentController.postCrearArticulo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith('plantillas/crearArticulo', expect.objectContaining({
      error: 'Por favor corrige los errores',
      errores: [{ msg: 'Campo obligatorio', param: 'titulo' }]
    }));
  });

  test('devuelve 500 cuando getConnection falla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = {
      body: { titulo: 'Nuevo artículo', cuerpo: 'Contenido' },
      session: { usuario: { id: 1 } },
      file: null
    };
    const res = buildResponse();

    contentController.postCrearArticulo(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('crea un artículo correctamente sin imagen', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT')) {
        return cb(null, { insertId: 5 });
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      body: { titulo: 'Nuevo artículo', cuerpo: 'Contenido del artículo' },
      session: { usuario: { id: 1 } },
      file: null
    };
    const res = buildResponse();

    contentController.postCrearArticulo(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      redirectUrl: '/content/articulos'
    });
  });

  test('crea un artículo correctamente con imagen', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT')) {
        return cb(null, { insertId: 6 });
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      body: { titulo: 'Artículo con imagen', cuerpo: 'Contenido' },
      session: { usuario: { id: 1 } },
      file: { filename: 'imagen.jpg' }
    };
    const res = buildResponse();

    contentController.postCrearArticulo(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      redirectUrl: '/content/articulos'
    });
  });
});

describe('contentController.getEditarArticulo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 cuando el ID del artículo es inválido', () => {
    const req = { params: { id_articulo: 'invalido' }, xhr: true };
    const res = buildResponse();

    contentController.getEditarArticulo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('ID de artículo inválido');
  });

  test('redirige cuando no es solicitud AJAX', () => {
    const req = { params: { id_articulo: '1' }, xhr: false, get: () => null };
    const res = buildResponse();

    contentController.getEditarArticulo(req, res);

    expect(res.redirect).toHaveBeenCalledWith('/content/articulos/1');
  });

  test('devuelve 404 cuando el artículo no existe', () => {
    const connection = buildConnection((sql, params, cb) => {
      cb(null, []);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { id_articulo: '999' }, xhr: true, session: { usuario: { id: 1 } } };
    const res = buildResponse();

    contentController.getEditarArticulo(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Artículo no encontrado');
  });

  test('renderiza formulario cuando el artículo existe', () => {
    const connection = buildConnection((sql, params, cb) => {
      cb(null, [
        {
          id_articulo: 1,
          titulo: 'Artículo a editar',
          cuerpo: 'Contenido',
          imagen: null,
          id_usuario: 1
        }
      ]);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { id_articulo: '1' }, xhr: true, session: { usuario: { id: 1 } } };
    const res = buildResponse();

    contentController.getEditarArticulo(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('plantillas/crearArticulo', expect.objectContaining({
      modoEdicion: true
    }));
  });
});

describe('contentController.postEditarArticulo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 cuando el ID es inválido', () => {
    const req = { params: { id_articulo: 'invalido' }, body: {} };
    const res = buildResponse();

    contentController.postEditarArticulo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('ID de artículo inválido');
  });

  test('devuelve 400 cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'titulo' }]
    });

    const req = {
      params: { id_articulo: '1' },
      body: { titulo: '', cuerpo: 'Contenido' },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    contentController.postEditarArticulo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('edita un artículo correctamente', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT imagen')) {
        return cb(null, [{ imagen: null }]);
      }
      if (sql.includes('UPDATE')) {
        return cb(null, { affectedRows: 1 });
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      params: { id_articulo: '1' },
      body: { titulo: 'Artículo editado', cuerpo: 'Contenido actualizado' },
      session: { usuario: { id: 1 } },
      file: null
    };
    const res = buildResponse();

    contentController.postEditarArticulo(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      redirectUrl: '/content/articulos/1'
    });
  });

  test('devuelve 404 cuando el artículo no existe', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT imagen')) {
        return cb(null, []);
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      params: { id_articulo: '999' },
      body: { titulo: 'Título', cuerpo: 'Contenido' },
      session: { usuario: { id: 1 } },
      file: null
    };
    const res = buildResponse();

    contentController.postEditarArticulo(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('contentController.eliminarArticulo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 cuando el ID del artículo es inválido', () => {
    const req = { params: { id_articulo: 'invalido' } };
    const res = buildResponse();

    contentController.eliminarArticulo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('ID de artículo inválido');
  });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = { params: { id_articulo: '1' } };
    const res = buildResponse();

    contentController.eliminarArticulo(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('elimina un artículo correctamente (soft delete)', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('UPDATE')) {
        return cb(null, { affectedRows: 1 });
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { id_articulo: '1' } };
    const res = buildResponse();

    contentController.eliminarArticulo(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/content/articulos');
  });

  test('devuelve 404 cuando el artículo no existe', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('UPDATE')) {
        return cb(null, { affectedRows: 0 });
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { id_articulo: '999' } };
    const res = buildResponse();

    contentController.eliminarArticulo(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('contentController.verForos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('redirige a la ruta de filtrado con parámetros por defecto', () => {
    const req = { query: {} };
    const res = buildResponse();

    contentController.verForos(req, res);

    expect(res.redirect).toHaveBeenCalledWith(
      '/content/foros/filtrar/?pagina=1&categoria=&keyword='
    );
  });

  test('redirige con parámetros de búsqueda', () => {
    const req = { query: { pagina: '2', categoria: 'salud', keyword: 'perros' } };
    const res = buildResponse();

    contentController.verForos(req, res);

    expect(res.redirect).toHaveBeenCalledWith(
      '/content/foros/filtrar/?pagina=2&categoria=salud&keyword=perros'
    );
  });
});

describe('contentController.verForo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 cuando el ID del foro es inválido', () => {
    const req = { params: { id: 'invalido' }, session: {} };
    const res = buildResponse();

    contentController.verForo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('ID de foro inválido');
  });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = { params: { id: '1' }, session: {} };
    const res = buildResponse();

    contentController.verForo(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 404 cuando el foro no existe', () => {
    const connection = buildConnection((sql, params, cb) => {
      cb(null, []);
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { id: '999' }, session: {} };
    const res = buildResponse();

    contentController.verForo(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('renderiza un foro con sus comentarios correctamente', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('FROM foros f')) {
        return cb(null, [
          {
            id_foro: 1,
            titulo: 'Foro Test',
            descripcion: 'Descripción test',
            nombre_usuario: 'usuario1',
            activo: 1
          }
        ]);
      }
      if (sql.includes('FROM comentarios')) {
        return cb(null, [
          {
            id_comentario: 1,
            contenido: 'Comentario 1',
            nombre_usuario: 'usuario2',
            fecha_publicacion: '2026-01-01'
          }
        ]);
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { params: { id: '1' }, session: {}, query: {} };
    const res = buildResponse();

    contentController.verForo(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('foroDetalle', expect.objectContaining({
      foro: expect.objectContaining({ titulo: 'Foro Test' }),
      comentarios: expect.any(Array)
    }));
  });
});

describe('contentController.getCrearForo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('redirige cuando no es solicitud AJAX', () => {
    const req = { xhr: false, get: () => null };
    const res = buildResponse();

    contentController.getCrearForo(req, res);

    expect(res.redirect).toHaveBeenCalledWith('/content/foros');
  });

  test('renderiza formulario cuando es solicitud AJAX', () => {
    const req = { xhr: true, session: { usuario: { id: 1 } } };
    const res = buildResponse();

    contentController.getCrearForo(req, res);

    expect(res.render).toHaveBeenCalledWith('plantillas/crearForo', expect.objectContaining({
      foro: expect.objectContaining({
        titulo: '',
        categoria: ''
      })
    }));
  });
});

describe('contentController.postCrearForo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve error cuando hay problemas de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'titulo' }]
    });

    const req = {
      body: { titulo: '', descripcion: '', categoria: '' },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    contentController.postCrearForo(req, res);

    expect(res.render).toHaveBeenCalledWith('plantillas/crearForo', expect.objectContaining({
      error: 'Por favor corrige los errores'
    }));
  });

  test('devuelve 500 cuando getConnection falla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = {
      body: { titulo: 'Nuevo foro', descripcion: 'Contenido', categoria: 'salud' },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    contentController.postCrearForo(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('crea un foro correctamente', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT')) {
        return cb(null, { insertId: 3 });
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      body: { titulo: 'Nuevo foro', descripcion: 'Descripción', categoria: 'general' },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    contentController.postCrearForo(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      redirectUrl: '/content/foros'
    });
  });
});

describe('contentController.filtrarForos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((callback) => callback(new Error('DB down')));

    const req = { query: { pagina: '1' }, session: {} };
    const res = buildResponse();

    contentController.filtrarForos(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al obtener la conexión a la base de datos');
  });

  test('filtra foros por categoría correctamente', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('COUNT(*)')) {
        return cb(null, [{ total: 5 }]);
      }
      if (sql.includes('SELECT')) {
        return cb(null, [
          {
            id_foro: 1,
            titulo: 'Foro de salud',
            categoria: 'salud',
            nombre_usuario: 'usuario1',
            num_respuestas: 3
          }
        ]);
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { query: { pagina: '1', categoria: 'salud' }, session: {} };
    const res = buildResponse();

    contentController.filtrarForos(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('foros', expect.objectContaining({
      total: 5,
      filtros: { categoria: 'salud', keyword: '' }
    }));
  });

  test('filtra foros por keyword correctamente', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('COUNT(*)')) {
        return cb(null, [{ total: 2 }]);
      }
      if (sql.includes('SELECT')) {
        return cb(null, []);
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = { query: { pagina: '1', keyword: 'perros' }, session: {} };
    const res = buildResponse();

    contentController.filtrarForos(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('foros', expect.objectContaining({
      filtros: { categoria: '', keyword: 'perros' }
    }));
  });
});

describe('contentController.comentarForo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 cuando los parámetros son inválidos', () => {
    const req = {
      params: { id: 'invalido', id_usuario: '1' },
      body: { contenido: 'Comentario' },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    contentController.comentarForo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Parámetros inválidos');
  });

  test('devuelve 400 cuando el contenido está vacío', () => {
    const req = {
      params: { id: '1', id_usuario: '1' },
      body: { contenido: '   ' },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    contentController.comentarForo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('El contenido del comentario no puede estar vacío');
  });

  test('devuelve 403 cuando el usuario no tiene permiso', () => {
    const req = {
      params: { id: '1', id_usuario: '2' },
      body: { contenido: 'Comentario válido' },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    contentController.comentarForo(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('crea un comentario correctamente', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT')) {
        return cb(null, { insertId: 10 });
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      params: { id: '1', id_usuario: '1' },
      body: { contenido: 'Este es un comentario válido' },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    contentController.comentarForo(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/content/foros/1');
  });
});

describe('contentController.eliminarComentario', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 cuando los parámetros son inválidos', () => {
    const req = {
      params: { id: 'invalido', id_usuario: '1', id_comentario: '1' },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    contentController.eliminarComentario(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('devuelve 401 cuando no hay sesión activa', () => {
    const req = {
      params: { id: '1', id_usuario: '1', id_comentario: '1' },
      session: { usuario: null }
    };
    const res = buildResponse();

    contentController.eliminarComentario(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('devuelve 404 cuando el comentario no existe', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT')) {
        return cb(null, []);
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      params: { id: '1', id_usuario: '1', id_comentario: '999' },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    contentController.eliminarComentario(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('elimina un comentario correctamente', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT')) {
        return cb(null, [{ id_usuario: 1 }]);
      }
      if (sql.includes('DELETE')) {
        return cb(null, { affectedRows: 1 });
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      params: { id: '1', id_usuario: '1', id_comentario: '5' },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    contentController.eliminarComentario(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/content/foros/1');
  });
});

describe('contentController.postReportarForo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 401 cuando no hay sesión activa', () => {
    const req = {
      params: { id: '1', id_usuario: '2' },
      body: { motivo: 'spam', fecha: '' },
      session: { usuario: null }
    };
    const res = buildResponse();

    contentController.postReportarForo(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('devuelve 400 cuando los parámetros son inválidos', () => {
    const req = {
      params: { id: 'invalido', id_usuario: '2' },
      body: { motivo: 'spam', fecha: '' },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    contentController.postReportarForo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('devuelve 400 cuando el motivo es inválido', () => {
    const req = {
      params: { id: '1', id_usuario: '2' },
      body: { motivo: 'motivo_invalido', fecha: '' },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    contentController.postReportarForo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('reporta un foro correctamente', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT')) {
        return cb(null, { insertId: 1 });
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      params: { id: '1', id_usuario: '2' },
      body: { motivo: 'spam', fecha: '' },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    contentController.postReportarForo(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/content/foros/1?reporte=ok&tipo=foro');
  });
});

describe('contentController.postReportarComentario', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 401 cuando no hay sesión activa', () => {
    const req = {
      params: { id: '1', id_usuario: '2', id_comentario: '5' },
      body: { motivo: 'spam', fecha: '' },
      session: { usuario: null }
    };
    const res = buildResponse();

    contentController.postReportarComentario(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('reporta un comentario correctamente', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT')) {
        return cb(null, { insertId: 2 });
      }
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((callback) => callback(null, connection));

    const req = {
      params: { id: '1', id_usuario: '2', id_comentario: '5' },
      body: { motivo: 'lenguaje_ofensivo', fecha: '' },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    contentController.postReportarComentario(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/content/foros/1?reporte=ok&tipo=comentario');
  });
});
