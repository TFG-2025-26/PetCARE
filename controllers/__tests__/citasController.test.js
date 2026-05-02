jest.mock('../../db', () => ({
  getConnection: jest.fn()
}));

const pool = require('../../db');
const citasController = require('../citasController');

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

// --- getCitas ---------------------------------------------------------------------

describe('citasController.getCitas', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { session: { usuario: { id: 1 } } };
    const res = buildResponse();

    citasController.getCitas(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al conectar a la base de datos' });
  });

  test('devuelve 500 cuando falla la consulta de citas del cliente', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('r.id_cliente')) return cb(new Error('Query error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { session: { usuario: { id: 1 } } };
    const res = buildResponse();

    citasController.getCitas(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener las citas del cliente' });
  });

  test('devuelve 500 cuando falla la consulta de citas del proveedor', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('proveedor_nombre_completo')) return cb(null, []);
      if (sql.includes('cliente_nombre_completo')) return cb(new Error('Query error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { session: { usuario: { id: 1 } } };
    const res = buildResponse();

    citasController.getCitas(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener las citas del proveedor' });
  });

  test('renderiza citas con arrays vacíos cuando el usuario no tiene reservas', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('proveedor_nombre_completo')) return cb(null, []);
      if (sql.includes('cliente_nombre_completo')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { session: { usuario: { id: 1 } } };
    const res = buildResponse();

    citasController.getCitas(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('citas', {
      citas_cliente: [],
      citas_proveedor: []
    });
  });

  test('renderiza citas con fecha_formateada añadida a cada reserva', () => {
    const citasMock = [{ id_reserva: 1, fecha: '2025-06-15', tipo_servicio: 'paseo' }];
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('proveedor_nombre_completo')) return cb(null, citasMock);
      if (sql.includes('cliente_nombre_completo')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { session: { usuario: { id: 1 } } };
    const res = buildResponse();

    citasController.getCitas(req, res);

    expect(connection.release).toHaveBeenCalled();
    const { citas_cliente } = res.render.mock.calls[0][1];
    expect(citas_cliente).toHaveLength(1);
    expect(citas_cliente[0]).toHaveProperty('fecha_formateada');
    expect(citas_cliente[0].id_reserva).toBe(1);
  });

  test('asigna fecha_formateada null cuando la fecha de la reserva es null', () => {
    const citasMock = [{ id_reserva: 2, fecha: null, tipo_servicio: 'cuidado' }];
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('proveedor_nombre_completo')) return cb(null, []);
      if (sql.includes('cliente_nombre_completo')) return cb(null, citasMock);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { session: { usuario: { id: 1 } } };
    const res = buildResponse();

    citasController.getCitas(req, res);

    const { citas_proveedor } = res.render.mock.calls[0][1];
    expect(citas_proveedor[0].fecha_formateada).toBeNull();
  });

  test('renderiza citas tanto del cliente como del proveedor correctamente', () => {
    const citasCliente = [{ id_reserva: 10, fecha: '2025-07-01', tipo_servicio: 'paseo' }];
    const citasProveedor = [{ id_reserva: 20, fecha: '2025-07-02', tipo_servicio: 'cuidado' }];
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('proveedor_nombre_completo')) return cb(null, citasCliente);
      if (sql.includes('cliente_nombre_completo')) return cb(null, citasProveedor);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { session: { usuario: { id: 1 } } };
    const res = buildResponse();

    citasController.getCitas(req, res);

    expect(connection.release).toHaveBeenCalled();
    const { citas_cliente, citas_proveedor } = res.render.mock.calls[0][1];
    expect(citas_cliente).toHaveLength(1);
    expect(citas_proveedor).toHaveLength(1);
    expect(citas_cliente[0].id_reserva).toBe(10);
    expect(citas_proveedor[0].id_reserva).toBe(20);
  });
});

// --- cancelarCita ---------------------------------------------------------------------

describe('citasController.cancelarCita', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { params: { id: '5' }, session: { usuario: { id: 1 } } };
    const res = buildResponse();

    citasController.cancelarCita(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error de conexión' });
  });

  test('devuelve 500 cuando falla el UPDATE', () => {
    const connection = buildConnection((sql, params, cb) => cb(new Error('Update error')));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '5' }, session: { usuario: { id: 1 } } };
    const res = buildResponse();

    citasController.cancelarCita(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al cancelar la cita' });
  });

  test('devuelve 403 cuando el usuario no es cliente ni proveedor de la reserva', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, { affectedRows: 0 }));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '5' }, session: { usuario: { id: 1 } } };
    const res = buildResponse();

    citasController.cancelarCita(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'No autorizado' });
  });

  test('cancela la cita correctamente', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, { affectedRows: 1 }));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '5' }, session: { usuario: { id: 1 } } };
    const res = buildResponse();

    citasController.cancelarCita(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
