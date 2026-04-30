jest.mock('../../db', () => ({
  getConnection: jest.fn()
}));

jest.mock('express-validator', () => ({
  validationResult: jest.fn()
}));

const pool = require('../../db');
const { validationResult } = require('express-validator');
const petController = require('../petController');

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

// --- getMyPets ---------------------------------------------------------------------

describe('petController.getMyPets', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { session: { usuario: { id: 1 } } };
    const res = buildResponse();

    petController.getMyPets(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 500 cuando falla la consulta', () => {
    const connection = buildConnection((sql, params, cb) => cb(new Error('Query error')));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { session: { usuario: { id: 1 } } };
    const res = buildResponse();

    petController.getMyPets(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al obtener las mascotas');
  });

  test('renderiza myPets con la lista de mascotas del usuario', () => {
    const mockMascotas = [
      { id_mascota: 1, nombre_mascota: 'Max', especie: 'Perro', activo: 1, id_usuario: 1 },
      { id_mascota: 2, nombre_mascota: 'Luna', especie: 'Gato', activo: 1, id_usuario: 1 }
    ];
    const connection = buildConnection((sql, params, cb) => cb(null, mockMascotas));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { session: { usuario: { id: 1 } } };
    const res = buildResponse();

    petController.getMyPets(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('myPets', { pets: mockMascotas });
  });

  test('renderiza myPets con lista vacía cuando el usuario no tiene mascotas', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, []));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { session: { usuario: { id: 99 } } };
    const res = buildResponse();

    petController.getMyPets(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('myPets', { pets: [] });
  });
});

// --- getRegisterPet ---------------------------------------------------------------------

describe('petController.getRegisterPet', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('renderiza petRegister con valores iniciales vacíos', () => {
    const req = {};
    const res = buildResponse();

    petController.getRegisterPet(req, res);

    expect(res.render).toHaveBeenCalledWith('petRegister', {
      error: null,
      errores: [],
      formData: null
    });
  });
});

// --- postRegisterPet ---------------------------------------------------------------------

describe('petController.postRegisterPet', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 400 cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'nombre_mascota' }]
    });
    const req = { body: { nombre_mascota: '' }, file: null };
    const res = buildResponse();

    petController.postRegisterPet(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith('petRegister', expect.objectContaining({
      error: 'Por favor, corrige los errores en el formulario.',
      errores: [{ msg: 'Campo obligatorio', param: 'nombre_mascota' }],
      formData: req.body
    }));
  });

  test('devuelve 500 cuando getConnection falla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = {
      body: { nombre_mascota: 'Max', especie: 'Perro', raza: 'Labrador', fecha_nacimiento: '2020-01-01', peso: 10 },
      file: null,
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    petController.postRegisterPet(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 500 cuando falla el INSERT de la mascota', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO mascotas')) return cb(new Error('Insert error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = {
      body: { nombre_mascota: 'Max', especie: 'Perro', raza: 'Labrador', fecha_nacimiento: '2020-01-01', peso: 10 },
      file: null,
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    petController.postRegisterPet(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al registrar la mascota');
  });

  test('devuelve 500 cuando falla el INSERT de la cartilla médica', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO mascotas')) return cb(null, { insertId: 5 });
      if (sql.includes('INSERT INTO cartilla_medica')) return cb(new Error('Cartilla error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = {
      body: { nombre_mascota: 'Max', especie: 'Perro', raza: 'Labrador', fecha_nacimiento: '2020-01-01', peso: 10 },
      file: null,
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    petController.postRegisterPet(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al crear la cartilla médica');
  });

  test('registra mascota sin imagen correctamente y redirige a /pets/mypets', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO mascotas')) return cb(null, { insertId: 5 });
      if (sql.includes('INSERT INTO cartilla_medica')) return cb(null, {});
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = {
      body: { nombre_mascota: 'Max', especie: 'Perro', raza: 'Labrador', fecha_nacimiento: '2020-01-01', peso: 10 },
      file: null,
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    petController.postRegisterPet(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/mypets');
  });

  test('registra mascota con imagen correctamente y redirige a /pets/mypets', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO mascotas')) return cb(null, { insertId: 6 });
      if (sql.includes('INSERT INTO cartilla_medica')) return cb(null, {});
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = {
      body: { nombre_mascota: 'Luna', especie: 'Gato', raza: 'Siamés', fecha_nacimiento: '2021-03-15', peso: 4 },
      file: { filename: 'mascota-123.jpg' },
      session: { usuario: { id: 1 } }
    };
    const res = buildResponse();

    petController.postRegisterPet(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/mypets');
  });
});

// --- getPetProfile ---------------------------------------------------------------------

describe('petController.getPetProfile', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 500 cuando getConnection falla', async () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    await petController.getPetProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 404 cuando la mascota no existe', async () => {
    const connection = buildConnection((sql, params, cb) => cb(null, []));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '999' } };
    const res = buildResponse();

    await petController.getPetProfile(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Recurso no encontrado');
  });

  test('renderiza perfilMascota con arrays vacíos cuando la mascota no tiene cartilla', async () => {
    const mockPet = { id_mascota: 1, nombre_mascota: 'Max', id_cartilla: null, fecha_nacimiento: '2020-01-01' };
    const connection = buildConnection((sql, params, cb) => cb(null, [mockPet]));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    await petController.getPetProfile(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('perfilMascota', expect.objectContaining({
      condiciones: [],
      vacunas: [],
      tratamientos: [],
      citas: []
    }));
  });

  test('devuelve 500 cuando falla una consulta de la cartilla', async () => {
    const mockPet = { id_mascota: 1, nombre_mascota: 'Max', id_cartilla: 10, fecha_nacimiento: '2020-01-01' };
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT m.*')) return cb(null, [mockPet]);
      cb(new Error('Query error'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    await petController.getPetProfile(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al obtener los datos de la mascota');
  });

  test('renderiza perfilMascota con todos los datos cuando existe cartilla', async () => {
    const mockPet = { id_mascota: 1, nombre_mascota: 'Max', id_cartilla: 10, fecha_nacimiento: '2020-01-01' };
    const mockCondiciones = [{ id_condicion: 1, nombre: 'Alergia' }];
    const mockVacunas = [{ id_vacuna: 1, nombre: 'Rabia' }];
    const mockTratamientos = [{ id_tratamiento: 1, medicamento: 'Antibiótico' }];
    const mockCitas = [{ id_cita: 1, clinica: 'Vet Clinic' }];

    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT m.*')) return cb(null, [mockPet]);
      if (sql.includes('condicion_medica')) return cb(null, mockCondiciones);
      if (sql.includes('vacunas')) return cb(null, mockVacunas);
      if (sql.includes('tratamientos')) return cb(null, mockTratamientos);
      if (sql.includes('cita_veterinaria')) return cb(null, mockCitas);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    await petController.getPetProfile(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('perfilMascota', expect.objectContaining({
      condiciones: mockCondiciones,
      vacunas: mockVacunas,
      tratamientos: mockTratamientos,
      citas: mockCitas
    }));
  });
});

// --- postEliminarMascota ---------------------------------------------------------------------

describe('petController.postEliminarMascota', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { body: { id: '1' } };
    const res = buildResponse();

    petController.postEliminarMascota(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 500 cuando falla la consulta', () => {
    const connection = buildConnection((sql, params, cb) => cb(new Error('Query error')));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id: '1' } };
    const res = buildResponse();

    petController.postEliminarMascota(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al eliminar la mascota');
  });

  test('elimina la mascota correctamente y redirige a /pets/mypets', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, { affectedRows: 1 }));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id: '1' } };
    const res = buildResponse();

    petController.postEliminarMascota(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/mypets');
  });
});

// --- getAddRegistroCartilla ---------------------------------------------------------------------

describe('petController.getAddRegistroCartilla', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('renderiza addRegistro con el id_cartilla recibido', () => {
    const req = { params: { id_cartilla: '5' } };
    const res = buildResponse();

    petController.getAddRegistroCartilla(req, res);

    expect(res.render).toHaveBeenCalledWith('addRegistro', { id_cartilla: '5' });
  });

  test('renderiza addRegistro con null cuando no hay id_cartilla en params', () => {
    const req = { params: {} };
    const res = buildResponse();

    petController.getAddRegistroCartilla(req, res);

    expect(res.render).toHaveBeenCalledWith('addRegistro', { id_cartilla: null });
  });
});

// --- getEditarMascota ---------------------------------------------------------------------

describe('petController.getEditarMascota', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    petController.getEditarMascota(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 500 cuando falla la consulta', () => {
    const connection = buildConnection((sql, params, cb) => cb(new Error('Query error')));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    petController.getEditarMascota(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al obtener los datos de la mascota');
  });

  test('devuelve 404 cuando la mascota no existe', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, []));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '999' } };
    const res = buildResponse();

    petController.getEditarMascota(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Recurso no encontrado');
  });

  test('renderiza editarMascota con los datos de la mascota', () => {
    const mockMascota = {
      id_mascota: 1, nombre_mascota: 'Max', especie: 'Perro',
      raza: 'Labrador', fecha_nacimiento: new Date('2020-06-15'), peso: 10
    };
    const connection = buildConnection((sql, params, cb) => cb(null, [mockMascota]));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    petController.getEditarMascota(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('editarMascota', expect.objectContaining({
      formData: expect.objectContaining({ id_mascota: 1, nombre_mascota: 'Max' })
    }));
  });
});

// --- postEditarMascota ---------------------------------------------------------------------

describe('petController.postEditarMascota', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 400 cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'nombre_mascota' }]
    });
    const req = { body: { id_mascota: '1', nombre_mascota: '' }, file: null };
    const res = buildResponse();

    petController.postEditarMascota(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith('editarMascota', expect.objectContaining({
      error: 'Por favor, corrige los errores en el formulario.'
    }));
  });

  test('devuelve 500 cuando getConnection falla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = {
      body: { id_mascota: '1', nombre_mascota: 'Max', especie: 'Perro', raza: 'Labrador', fecha_nacimiento: '2020-01-01', peso: 10 },
      file: null
    };
    const res = buildResponse();

    petController.postEditarMascota(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('edita mascota sin imagen y redirige al perfil', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => cb(null, { affectedRows: 1 }));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = {
      body: { id_mascota: '1', nombre_mascota: 'Max', especie: 'Perro', raza: 'Labrador', fecha_nacimiento: '2020-01-01', peso: 10 },
      file: null
    };
    const res = buildResponse();

    petController.postEditarMascota(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/profile/1');
  });

  test('edita mascota con imagen y redirige al perfil', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => cb(null, { affectedRows: 1 }));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = {
      body: { id_mascota: '2', nombre_mascota: 'Luna', especie: 'Gato', raza: 'Siamés', fecha_nacimiento: '2021-03-15', peso: 4 },
      file: { filename: 'mascota-nueva.jpg' }
    };
    const res = buildResponse();

    petController.postEditarMascota(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/profile/2');
  });

  test('devuelve 500 cuando falla el UPDATE', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => cb(new Error('Update error')));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = {
      body: { id_mascota: '1', nombre_mascota: 'Max', especie: 'Perro', raza: 'Labrador', fecha_nacimiento: '2020-01-01', peso: 10 },
      file: null
    };
    const res = buildResponse();

    petController.postEditarMascota(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al actualizar los datos de la mascota');
  });
});

// --- getEditarCita ---------------------------------------------------------------------

describe('petController.getEditarCita', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    petController.getEditarCita(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 500 cuando falla la consulta', () => {
    const connection = buildConnection((sql, params, cb) => cb(new Error('Query error')));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    petController.getEditarCita(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al obtener los datos de la cita');
  });

  test('devuelve 404 cuando la cita no existe', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, []));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '999' } };
    const res = buildResponse();

    petController.getEditarCita(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Recurso no encontrado');
  });

  test('renderiza editarCita con los datos de la cita', () => {
    const mockCita = {
      id_cita: 1, clinica: 'Vet Clinic',
      fecha: new Date('2025-06-01T10:00:00'),
      observaciones: 'Revisión rutinaria', diagnostico: 'Sano'
    };
    const connection = buildConnection((sql, params, cb) => cb(null, [mockCita]));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    petController.getEditarCita(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('editarCita', expect.objectContaining({
      cita: expect.objectContaining({ id_cita: 1, clinica: 'Vet Clinic' })
    }));
  });
});

// --- getEditarVacuna ---------------------------------------------------------------------

describe('petController.getEditarVacuna', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    petController.getEditarVacuna(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 500 cuando falla la consulta', () => {
    const connection = buildConnection((sql, params, cb) => cb(new Error('Query error')));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    petController.getEditarVacuna(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al obtener los datos de la vacuna');
  });

  test('devuelve 404 cuando la vacuna no existe', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, []));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '999' } };
    const res = buildResponse();

    petController.getEditarVacuna(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Recurso no encontrado');
  });

  test('renderiza editarVacuna con los datos de la vacuna', () => {
    const mockVacuna = {
      id_vacuna: 1, nombre: 'Rabia',
      fecha_administracion: new Date('2024-03-01'), observaciones: null
    };
    const connection = buildConnection((sql, params, cb) => cb(null, [mockVacuna]));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    petController.getEditarVacuna(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('editarVacuna', expect.objectContaining({
      vacuna: expect.objectContaining({ id_vacuna: 1, nombre: 'Rabia' })
    }));
  });
});

// --- getEditarTratamiento ---------------------------------------------------------------------

describe('petController.getEditarTratamiento', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    petController.getEditarTratamiento(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 500 cuando falla la consulta', () => {
    const connection = buildConnection((sql, params, cb) => cb(new Error('Query error')));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    petController.getEditarTratamiento(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al obtener los datos del tratamiento');
  });

  test('devuelve 404 cuando el tratamiento no existe', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, []));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '999' } };
    const res = buildResponse();

    petController.getEditarTratamiento(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Recurso no encontrado');
  });

  test('renderiza editarTratamiento con los datos del tratamiento', () => {
    const mockTratamiento = {
      id_tratamiento: 1, medicamento: 'Antibiótico', dosis: '5mg', frecuencia: 'Diaria',
      fecha_inicio: new Date('2025-01-01T00:00:00'),
      fecha_fin: new Date('2025-01-10T00:00:00'),
      observaciones: null
    };
    const connection = buildConnection((sql, params, cb) => cb(null, [mockTratamiento]));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    petController.getEditarTratamiento(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('editarTratamiento', expect.objectContaining({
      tratamiento: expect.objectContaining({ id_tratamiento: 1, medicamento: 'Antibiótico' })
    }));
  });
});

// --- getEditarPatologia ---------------------------------------------------------------------

describe('petController.getEditarPatologia', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    petController.getEditarPatologia(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 500 cuando falla la consulta', () => {
    const connection = buildConnection((sql, params, cb) => cb(new Error('Query error')));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    petController.getEditarPatologia(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al obtener los datos de la patología');
  });

  test('devuelve 404 cuando la patología no existe', () => {
    const connection = buildConnection((sql, params, cb) => cb(null, []));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '999' } };
    const res = buildResponse();

    petController.getEditarPatologia(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Recurso no encontrado');
  });

  test('renderiza editarPatologia con los datos de la patología', () => {
    const mockPatologia = {
      id_condicion: 1, nombre: 'Dermatitis', tipo: 'Alergia',
      estado: 'activo', fecha_diagnostico: new Date('2024-01-01'), descripcion: 'Alergia al polen'
    };
    const connection = buildConnection((sql, params, cb) => cb(null, [mockPatologia]));
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { params: { id: '1' } };
    const res = buildResponse();

    petController.getEditarPatologia(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('editarPatologia', expect.objectContaining({
      patologia: expect.objectContaining({ id_condicion: 1, nombre: 'Dermatitis' })
    }));
  });
});

// --- postAddCita ---------------------------------------------------------------------

describe('petController.postAddCita', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 400 cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'clinica' }]
    });
    const req = { body: { id_cartilla: '10', clinica: '' } };
    const res = buildResponse();

    petController.postAddCita(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith('addRegistro', expect.objectContaining({
      error: 'Por favor, corrige los errores en el formulario.'
    }));
  });

  test('devuelve 400 cuando falta id_cartilla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const req = { body: { id_cartilla: '', clinica: 'Vet Clinic', fecha: '2025-06-01' } };
    const res = buildResponse();

    petController.postAddCita(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith('addRegistro', expect.objectContaining({
      id_cartilla: null,
      errores: [{ msg: 'No se ha recibido la cartilla médica.' }]
    }));
  });

  test('devuelve 500 cuando getConnection falla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { body: { id_cartilla: '10', clinica: 'Vet Clinic', fecha: '2025-06-01', observaciones: '', diagnostico: '' } };
    const res = buildResponse();

    petController.postAddCita(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 500 cuando falla el INSERT de la cita', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO cita_veterinaria')) return cb(new Error('Insert error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cartilla: '10', clinica: 'Vet Clinic', fecha: '2025-06-01', observaciones: '', diagnostico: '' } };
    const res = buildResponse();

    petController.postAddCita(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al crear la cita');
  });

  test('devuelve 404 cuando la cartilla no tiene mascota asociada', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO cita_veterinaria')) return cb(null, {});
      if (sql.includes('SELECT id_mascota FROM cartilla_medica')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cartilla: '10', clinica: 'Vet Clinic', fecha: '2025-06-01', observaciones: '', diagnostico: '' } };
    const res = buildResponse();

    petController.postAddCita(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Recurso no encontrado');
  });

  test('crea la cita correctamente y redirige al perfil de la mascota', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO cita_veterinaria')) return cb(null, {});
      if (sql.includes('SELECT id_mascota FROM cartilla_medica')) return cb(null, [{ id_mascota: 1 }]);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cartilla: '10', clinica: 'Vet Clinic', fecha: '2025-06-01', observaciones: '', diagnostico: '' } };
    const res = buildResponse();

    petController.postAddCita(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/profile/1');
  });
});

// --- postAddVacuna ---------------------------------------------------------------------

describe('petController.postAddVacuna', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 400 cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'nombre_vacuna' }]
    });
    const req = { body: { id_cartilla: '10', nombre_vacuna: '' } };
    const res = buildResponse();

    petController.postAddVacuna(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('devuelve 400 cuando falta id_cartilla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const req = { body: { id_cartilla: '', nombre_vacuna: 'Rabia', fecha_administracion: '2025-01-01' } };
    const res = buildResponse();

    petController.postAddVacuna(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('devuelve 500 cuando getConnection falla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { body: { id_cartilla: '10', nombre_vacuna: 'Rabia', fecha_administracion: '2025-01-01', observaciones_vacuna: '' } };
    const res = buildResponse();

    petController.postAddVacuna(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('devuelve 500 cuando falla el INSERT de la vacuna', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO vacunas')) return cb(new Error('Insert error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cartilla: '10', nombre_vacuna: 'Rabia', fecha_administracion: '2025-01-01', observaciones_vacuna: '' } };
    const res = buildResponse();

    petController.postAddVacuna(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al crear la vacuna');
  });

  test('devuelve 404 cuando la cartilla no tiene mascota asociada', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO vacunas')) return cb(null, {});
      if (sql.includes('SELECT id_mascota FROM cartilla_medica')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cartilla: '10', nombre_vacuna: 'Rabia', fecha_administracion: '2025-01-01', observaciones_vacuna: '' } };
    const res = buildResponse();

    petController.postAddVacuna(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Recurso no encontrado');
  });

  test('crea la vacuna correctamente y redirige al perfil de la mascota', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO vacunas')) return cb(null, {});
      if (sql.includes('SELECT id_mascota FROM cartilla_medica')) return cb(null, [{ id_mascota: 2 }]);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cartilla: '10', nombre_vacuna: 'Rabia', fecha_administracion: '2025-01-01', observaciones_vacuna: '' } };
    const res = buildResponse();

    petController.postAddVacuna(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/profile/2');
  });
});

// --- postAddTratamiento ---------------------------------------------------------------------

describe('petController.postAddTratamiento', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 400 cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'medicamento' }]
    });
    const req = { body: { id_cartilla: '10', medicamento: '' } };
    const res = buildResponse();

    petController.postAddTratamiento(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('devuelve 400 cuando falta id_cartilla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const req = { body: { id_cartilla: '', medicamento: 'Amoxicilina', dosis: '5mg', frecuencia: 'Diaria', fecha_inicio: '2025-01-01', fecha_fin: '2025-01-10' } };
    const res = buildResponse();

    petController.postAddTratamiento(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('devuelve 500 cuando getConnection falla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { body: { id_cartilla: '10', medicamento: 'Amoxicilina', dosis: '5mg', frecuencia: 'Diaria', fecha_inicio: '2025-01-01', fecha_fin: '2025-01-10', observaciones_tratamiento: '' } };
    const res = buildResponse();

    petController.postAddTratamiento(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('devuelve 500 cuando falla el INSERT del tratamiento', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO tratamientos')) return cb(new Error('Insert error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cartilla: '10', medicamento: 'Amoxicilina', dosis: '5mg', frecuencia: 'Diaria', fecha_inicio: '2025-01-01', fecha_fin: '2025-01-10', observaciones_tratamiento: '' } };
    const res = buildResponse();

    petController.postAddTratamiento(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al crear el tratamiento');
  });

  test('devuelve 404 cuando la cartilla no tiene mascota asociada', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO tratamientos')) return cb(null, {});
      if (sql.includes('SELECT id_mascota FROM cartilla_medica')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cartilla: '10', medicamento: 'Amoxicilina', dosis: '5mg', frecuencia: 'Diaria', fecha_inicio: '2025-01-01', fecha_fin: '2025-01-10', observaciones_tratamiento: '' } };
    const res = buildResponse();

    petController.postAddTratamiento(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Recurso no encontrado');
  });

  test('crea el tratamiento correctamente y redirige al perfil de la mascota', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO tratamientos')) return cb(null, {});
      if (sql.includes('SELECT id_mascota FROM cartilla_medica')) return cb(null, [{ id_mascota: 3 }]);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cartilla: '10', medicamento: 'Amoxicilina', dosis: '5mg', frecuencia: 'Diaria', fecha_inicio: '2025-01-01', fecha_fin: '2025-01-10', observaciones_tratamiento: '' } };
    const res = buildResponse();

    petController.postAddTratamiento(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/profile/3');
  });
});

// --- postAddPatologia ---------------------------------------------------------------------

describe('petController.postAddPatologia', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 400 cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'nombre' }]
    });
    const req = { body: { id_cartilla: '10', nombre: '' } };
    const res = buildResponse();

    petController.postAddPatologia(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('devuelve 400 cuando falta id_cartilla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const req = { body: { id_cartilla: '', nombre: 'Dermatitis', tipo: 'Alergia', estado: 'activo', fecha_diagnostico: '2025-01-01' } };
    const res = buildResponse();

    petController.postAddPatologia(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('devuelve 500 cuando getConnection falla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { body: { id_cartilla: '10', nombre: 'Dermatitis', tipo: 'Alergia', estado: 'activo', fecha_diagnostico: '2025-01-01', descripcion: '' } };
    const res = buildResponse();

    petController.postAddPatologia(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('devuelve 500 cuando falla el INSERT de la patología', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO condicion_medica')) return cb(new Error('Insert error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cartilla: '10', nombre: 'Dermatitis', tipo: 'Alergia', estado: 'activo', fecha_diagnostico: '2025-01-01', descripcion: '' } };
    const res = buildResponse();

    petController.postAddPatologia(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al crear la patología');
  });

  test('devuelve 404 cuando la cartilla no tiene mascota asociada', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO condicion_medica')) return cb(null, {});
      if (sql.includes('SELECT id_mascota FROM cartilla_medica')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cartilla: '10', nombre: 'Dermatitis', tipo: 'Alergia', estado: 'activo', fecha_diagnostico: '2025-01-01', descripcion: '' } };
    const res = buildResponse();

    petController.postAddPatologia(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Recurso no encontrado');
  });

  test('crea la patología correctamente y redirige al perfil de la mascota', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('INSERT INTO condicion_medica')) return cb(null, {});
      if (sql.includes('SELECT id_mascota FROM cartilla_medica')) return cb(null, [{ id_mascota: 4 }]);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cartilla: '10', nombre: 'Dermatitis', tipo: 'Alergia', estado: 'activo', fecha_diagnostico: '2025-01-01', descripcion: '' } };
    const res = buildResponse();

    petController.postAddPatologia(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/profile/4');
  });
});

// --- postEditarCita ---------------------------------------------------------------------

describe('petController.postEditarCita', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 400 cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'clinica' }]
    });
    const req = { body: { id_cita: '1', clinica: '' } };
    const res = buildResponse();

    petController.postEditarCita(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith('editarCita', expect.objectContaining({
      error: 'Por favor, corrige los errores en el formulario.'
    }));
  });

  test('devuelve 500 cuando getConnection falla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { body: { id_cita: '1', clinica: 'Vet Clinic', fecha: '2025-06-01', observaciones: '', diagnostico: '' } };
    const res = buildResponse();

    petController.postEditarCita(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('devuelve 404 cuando la cita no existe', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cita: '999', clinica: 'Vet Clinic', fecha: '2025-06-01', observaciones: '', diagnostico: '' } };
    const res = buildResponse();

    petController.postEditarCita(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Recurso no encontrado');
  });

  test('devuelve 500 cuando falla el UPDATE de la cita', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, [{ id_mascota: 1 }]);
      if (sql.includes('UPDATE cita_veterinaria')) return cb(new Error('Update error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cita: '1', clinica: 'Vet Clinic', fecha: '2025-06-01', observaciones: '', diagnostico: '' } };
    const res = buildResponse();

    petController.postEditarCita(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al actualizar la cita');
  });

  test('edita la cita correctamente y redirige al perfil de la mascota', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, [{ id_mascota: 1 }]);
      if (sql.includes('UPDATE cita_veterinaria')) return cb(null, { affectedRows: 1 });
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cita: '1', clinica: 'Vet Clinic', fecha: '2025-06-01', observaciones: '', diagnostico: '' } };
    const res = buildResponse();

    petController.postEditarCita(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/profile/1');
  });
});

// --- postEditarVacuna ---------------------------------------------------------------------

describe('petController.postEditarVacuna', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 400 cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'nombre_vacuna' }]
    });
    const req = { body: { id_vacuna: '1', nombre_vacuna: '', fecha_administracion: '' } };
    const res = buildResponse();

    petController.postEditarVacuna(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('devuelve 500 cuando getConnection falla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { body: { id_vacuna: '1', nombre_vacuna: 'Rabia', fecha_administracion: '2025-01-01', observaciones_vacuna: '' } };
    const res = buildResponse();

    petController.postEditarVacuna(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 404 cuando la vacuna no existe', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_vacuna: '999', nombre_vacuna: 'Rabia', fecha_administracion: '2025-01-01', observaciones_vacuna: '' } };
    const res = buildResponse();

    petController.postEditarVacuna(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('devuelve 500 cuando falla el UPDATE de la vacuna', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, [{ id_mascota: 2 }]);
      if (sql.includes('UPDATE vacunas')) return cb(new Error('Update error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_vacuna: '1', nombre_vacuna: 'Rabia', fecha_administracion: '2025-01-01', observaciones_vacuna: '' } };
    const res = buildResponse();

    petController.postEditarVacuna(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al actualizar la vacuna');
  });

  test('edita la vacuna correctamente y redirige al perfil de la mascota', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, [{ id_mascota: 2 }]);
      if (sql.includes('UPDATE vacunas')) return cb(null, { affectedRows: 1 });
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_vacuna: '1', nombre_vacuna: 'Rabia', fecha_administracion: '2025-01-01', observaciones_vacuna: '' } };
    const res = buildResponse();

    petController.postEditarVacuna(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/profile/2');
  });
});

// --- postEditarTratamiento ---------------------------------------------------------------------

describe('petController.postEditarTratamiento', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 400 cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'medicamento' }]
    });
    const req = { body: { id_tratamiento: '1', medicamento: '' } };
    const res = buildResponse();

    petController.postEditarTratamiento(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('devuelve 500 cuando getConnection falla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { body: { id_tratamiento: '1', medicamento: 'Amoxicilina', dosis: '5mg', frecuencia: 'Diaria', fecha_inicio: '2025-01-01', fecha_fin: '2025-01-10', observaciones_tratamiento: '' } };
    const res = buildResponse();

    petController.postEditarTratamiento(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 404 cuando el tratamiento no existe', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_tratamiento: '999', medicamento: 'Amoxicilina', dosis: '5mg', frecuencia: 'Diaria', fecha_inicio: '2025-01-01', fecha_fin: '2025-01-10', observaciones_tratamiento: '' } };
    const res = buildResponse();

    petController.postEditarTratamiento(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('devuelve 500 cuando falla el UPDATE del tratamiento', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, [{ id_mascota: 3 }]);
      if (sql.includes('UPDATE tratamientos')) return cb(new Error('Update error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_tratamiento: '1', medicamento: 'Amoxicilina', dosis: '5mg', frecuencia: 'Diaria', fecha_inicio: '2025-01-01', fecha_fin: '2025-01-10', observaciones_tratamiento: '' } };
    const res = buildResponse();

    petController.postEditarTratamiento(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al actualizar el tratamiento');
  });

  test('edita el tratamiento correctamente y redirige al perfil de la mascota', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, [{ id_mascota: 3 }]);
      if (sql.includes('UPDATE tratamientos')) return cb(null, { affectedRows: 1 });
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_tratamiento: '1', medicamento: 'Amoxicilina', dosis: '5mg', frecuencia: 'Diaria', fecha_inicio: '2025-01-01', fecha_fin: '2025-01-10', observaciones_tratamiento: '' } };
    const res = buildResponse();

    petController.postEditarTratamiento(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/profile/3');
  });
});

// --- postEditarPatologia ---------------------------------------------------------------------

describe('petController.postEditarPatologia', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 400 cuando hay errores de validación', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Campo obligatorio', param: 'nombre' }]
    });
    const req = { body: { id_condicion: '1', nombre: '' } };
    const res = buildResponse();

    petController.postEditarPatologia(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('devuelve 500 cuando getConnection falla', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { body: { id_condicion: '1', nombre: 'Dermatitis', tipo: 'Alergia', estado: 'activo', fecha_diagnostico: '2025-01-01', descripcion: '' } };
    const res = buildResponse();

    petController.postEditarPatologia(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 404 cuando la patología no existe', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_condicion: '999', nombre: 'Dermatitis', tipo: 'Alergia', estado: 'activo', fecha_diagnostico: '2025-01-01', descripcion: '' } };
    const res = buildResponse();

    petController.postEditarPatologia(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('devuelve 500 cuando falla el UPDATE de la patología', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, [{ id_mascota: 4 }]);
      if (sql.includes('UPDATE condicion_medica')) return cb(new Error('Update error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_condicion: '1', nombre: 'Dermatitis', tipo: 'Alergia', estado: 'activo', fecha_diagnostico: '2025-01-01', descripcion: '' } };
    const res = buildResponse();

    petController.postEditarPatologia(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al actualizar la patología');
  });

  test('edita la patología correctamente y redirige al perfil de la mascota', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, [{ id_mascota: 4 }]);
      if (sql.includes('UPDATE condicion_medica')) return cb(null, { affectedRows: 1 });
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_condicion: '1', nombre: 'Dermatitis', tipo: 'Alergia', estado: 'activo', fecha_diagnostico: '2025-01-01', descripcion: '' } };
    const res = buildResponse();

    petController.postEditarPatologia(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/profile/4');
  });
});

// --- eliminarCita ---------------------------------------------------------------------

describe('petController.eliminarCita', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { body: { id_cita: '1' } };
    const res = buildResponse();

    petController.eliminarCita(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al conectar a la base de datos');
  });

  test('devuelve 404 cuando la cita no existe', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cita: '999' } };
    const res = buildResponse();

    petController.eliminarCita(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Recurso no encontrado');
  });

  test('devuelve 500 cuando falla el DELETE', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, [{ id_mascota: 1 }]);
      if (sql.includes('DELETE FROM cita_veterinaria')) return cb(new Error('Delete error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cita: '1' } };
    const res = buildResponse();

    petController.eliminarCita(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al eliminar la cita');
  });

  test('elimina la cita correctamente y redirige al perfil de la mascota', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, [{ id_mascota: 1 }]);
      if (sql.includes('DELETE FROM cita_veterinaria')) return cb(null, { affectedRows: 1 });
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_cita: '1' } };
    const res = buildResponse();

    petController.eliminarCita(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/profile/1');
  });
});

// --- eliminarVacuna ---------------------------------------------------------------------

describe('petController.eliminarVacuna', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { body: { id_vacuna: '1' } };
    const res = buildResponse();

    petController.eliminarVacuna(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('devuelve 404 cuando la vacuna no existe', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_vacuna: '999' } };
    const res = buildResponse();

    petController.eliminarVacuna(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('devuelve 500 cuando falla el DELETE de la vacuna', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, [{ id_mascota: 2 }]);
      if (sql.includes('DELETE FROM vacunas')) return cb(new Error('Delete error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_vacuna: '1' } };
    const res = buildResponse();

    petController.eliminarVacuna(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al eliminar la vacuna');
  });

  test('elimina la vacuna correctamente y redirige al perfil de la mascota', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, [{ id_mascota: 2 }]);
      if (sql.includes('DELETE FROM vacunas')) return cb(null, { affectedRows: 1 });
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_vacuna: '1' } };
    const res = buildResponse();

    petController.eliminarVacuna(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/profile/2');
  });
});

// --- eliminarTratamiento ---------------------------------------------------------------------

describe('petController.eliminarTratamiento', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { body: { id_tratamiento: '1' } };
    const res = buildResponse();

    petController.eliminarTratamiento(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('devuelve 404 cuando el tratamiento no existe', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_tratamiento: '999' } };
    const res = buildResponse();

    petController.eliminarTratamiento(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('devuelve 500 cuando falla el DELETE del tratamiento', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, [{ id_mascota: 3 }]);
      if (sql.includes('DELETE FROM tratamientos')) return cb(new Error('Delete error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_tratamiento: '1' } };
    const res = buildResponse();

    petController.eliminarTratamiento(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al eliminar el tratamiento');
  });

  test('elimina el tratamiento correctamente y redirige al perfil de la mascota', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, [{ id_mascota: 3 }]);
      if (sql.includes('DELETE FROM tratamientos')) return cb(null, { affectedRows: 1 });
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_tratamiento: '1' } };
    const res = buildResponse();

    petController.eliminarTratamiento(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/profile/3');
  });
});

// --- eliminarPatologia ---------------------------------------------------------------------

describe('petController.eliminarPatologia', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('devuelve 500 cuando getConnection falla', () => {
    pool.getConnection.mockImplementation((cb) => cb(new Error('DB down')));
    const req = { body: { id_patologia: '1' } };
    const res = buildResponse();

    petController.eliminarPatologia(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('devuelve 404 cuando la patología no existe', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, []);
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_patologia: '999' } };
    const res = buildResponse();

    petController.eliminarPatologia(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('devuelve 500 cuando falla el DELETE de la patología', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, [{ id_mascota: 4 }]);
      if (sql.includes('DELETE FROM condicion_medica')) return cb(new Error('Delete error'));
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_patologia: '1' } };
    const res = buildResponse();

    petController.eliminarPatologia(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error al eliminar la patología');
  });

  test('elimina la patología correctamente y redirige al perfil de la mascota', () => {
    const connection = buildConnection((sql, params, cb) => {
      if (sql.includes('SELECT cm.id_mascota')) return cb(null, [{ id_mascota: 4 }]);
      if (sql.includes('DELETE FROM condicion_medica')) return cb(null, { affectedRows: 1 });
      cb(new Error('Consulta inesperada'));
    });
    pool.getConnection.mockImplementation((cb) => cb(null, connection));
    const req = { body: { id_patologia: '1' } };
    const res = buildResponse();

    petController.eliminarPatologia(req, res);

    expect(connection.release).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/pets/profile/4');
  });
});
