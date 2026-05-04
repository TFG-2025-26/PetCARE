"use strict";

// ******************************************************************************
// Tests de integración completos: HTTP → router → middleware → controlador → BD real.
// Requiere XAMPP corriendo con la BD petcare_test creada.
// Ejecutar con: npm run test:db
// ******************************************************************************

jest.mock('multer', () => {
    const m = () => ({
        single: () => (req, res, next) => { req.file = null; next(); }
    });
    m.diskStorage = jest.fn(() => ({}));
    m.MulterError = class MulterError extends Error {
        constructor(code) { super(code); this.code = code; }
    };
    return m;
});


const request   = require('supertest');
const express   = require('express');
const session   = require('express-session');
const path      = require('path');
const pool      = require('../../db');
const { isAuthenticated, esEmpresa } = require('../../middlewares/authMiddleware');
const petRouter = require('../../routes/petRouter');

const db = pool.promise();


let testUserId;
let testMascotaId;
let testCartillaId;



/** Mini app con la sesión del usuario de prueba inyectada. */
function buildApp() {
    const usuario = { id: testUserId, tipo: 'usuario', rol: 'user', nombre: 'TestUser' };
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => { res.locals.usuario = req.session.usuario || null; next(); });
    app.use((req, res, next) => { req.session.usuario = usuario; next(); });
    app.use('/pets', isAuthenticated, esEmpresa, petRouter);
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message });
    });
    return app;
}

/** App SIN sesión inyectada (para tests de autenticación). */
function buildAppSinSesion() {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => { res.locals.usuario = null; next(); });
    app.use('/pets', isAuthenticated, esEmpresa, petRouter);
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message });
    });
    return app;
}

/** App con sesión de empresa (para tests de autorización). */
function buildAppEmpresa() {
    const empresa = { id: testUserId, tipo: 'empresa', rol: 'user' };
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => { res.locals.usuario = req.session.usuario || null; next(); });
    app.use((req, res, next) => { req.session.usuario = empresa; next(); });
    app.use('/pets', isAuthenticated, esEmpresa, petRouter);
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message });
    });
    return app;
}

/** Simula fallo de conexión a BD para el siguiente test. */
const simularErrorConexion = () =>
    jest.spyOn(pool, 'getConnection')
        .mockImplementation((cb) => cb(new Error('DB connection error')));

/** Simula fallo de query (la conexión se abre pero la query falla). */
const simularErrorQuery = () => {
    const fakeConn = {
        query: jest.fn((sql, params, cb) => cb(new Error('Query error'))),
        release: jest.fn()
    };
    jest.spyOn(pool, 'getConnection').mockImplementation((cb) => cb(null, fakeConn));
};

const limpiarMascotas = () =>
    db.query('DELETE FROM mascotas WHERE id_usuario = ?', [testUserId]);

// Ciclo de vida

beforeAll(async () => {
    await db.query("DELETE FROM usuarios WHERE correo = 'testpetcare@jest.com'");
    const [result] = await db.query(
        `INSERT INTO usuarios
            (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['testpetcare', 'Test PetCare', '1990-01-01', 123456789,
         'testpetcare@jest.com', 'hashedpassword_test']
    );
    testUserId = result.insertId;
});

beforeEach(async () => {
    const [mascotaResult] = await db.query(
        `INSERT INTO mascotas
            (nombre_mascota, fecha_nacimiento, especie, raza, peso, id_usuario)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['Buddy', '2020-03-10', 'Perro', 'Labrador', 10.5, testUserId]
    );
    testMascotaId = mascotaResult.insertId;

    const [cartillaResult] = await db.query(
        'INSERT INTO cartilla_medica (id_mascota) VALUES (?)',
        [testMascotaId]
    );
    testCartillaId = cartillaResult.insertId;
});

afterEach(async () => {
    jest.restoreAllMocks();
    await limpiarMascotas();
});

afterAll(async () => {
    await db.query('DELETE FROM usuarios WHERE id_usuario = ?', [testUserId]);
    await new Promise((resolve, reject) =>
        pool.end(err => (err ? reject(err) : resolve()))
    );
});


// MIDDLEWARE DE AUTENTICACIÓN Y AUTORIZACIÓN


describe('Middleware de autenticación – rutas /pets', () => {
    test('sin sesión redirige a /auth/login', async () => {
        const res = await request(buildAppSinSesion()).get('/pets/mypets');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
    });

    test('usuario de tipo empresa recibe 403', async () => {
        const res = await request(buildAppEmpresa()).get('/pets/mypets');
        expect(res.status).toBe(403);
    });
});


// GET /pets/mypets

describe('GET /pets/mypets', () => {
    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp()).get('/pets/mypets');
        expect(res.status).toBe(500);
    });

    test('devuelve 500 cuando falla la consulta SQL', async () => {
        simularErrorQuery();
        const res = await request(buildApp()).get('/pets/mypets');
        expect(res.status).toBe(500);
    });

    test('devuelve 200 y renderiza las mascotas activas del usuario', async () => {
        const res = await request(buildApp()).get('/pets/mypets');
        expect(res.status).toBe(200);
        expect(res.text).toContain('Buddy');
    });

    test('no incluye mascotas con activo=0 en la respuesta', async () => {
        await db.query(
            `INSERT INTO mascotas
                (nombre_mascota, fecha_nacimiento, especie, raza, peso, activo, id_usuario)
             VALUES (?, ?, ?, ?, ?, 0, ?)`,
            ['Desactivada', '2018-01-01', 'Gato', 'Común', 4.0, testUserId]
        );
        const res = await request(buildApp()).get('/pets/mypets');
        expect(res.status).toBe(200);
        expect(res.text).not.toContain('Desactivada');
    });

    test('devuelve 200 cuando el usuario no tiene mascotas activas', async () => {
        await limpiarMascotas();
        const res = await request(buildApp()).get('/pets/mypets');
        expect(res.status).toBe(200);
    });
});

// GET /pets/register

describe('GET /pets/register', () => {
    test('devuelve 200 y renderiza el formulario con sesión válida', async () => {
        const res = await request(buildApp()).get('/pets/register');
        expect(res.status).toBe(200);
    });

    test('sin sesión redirige a /auth/login', async () => {
        const res = await request(buildAppSinSesion()).get('/pets/register');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
    });
});

// POST /pets/register – Validaciones

describe('POST /pets/register – validaciones de formulario', () => {
    const datosValidos = {
        nombre_mascota: 'Rex',
        especie: 'Perro',
        raza: 'Pastor Alemán',
        peso: '30',
        fecha_nacimiento: '2019-06-01'
    };

    test('rechaza con 400 cuando nombre_mascota está vacío', async () => {
        const res = await request(buildApp())
            .post('/pets/register')
            .send({ ...datosValidos, nombre_mascota: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando nombre_mascota supera 50 caracteres', async () => {
        const res = await request(buildApp())
            .post('/pets/register')
            .send({ ...datosValidos, nombre_mascota: 'a'.repeat(51) });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando especie está vacía', async () => {
        const res = await request(buildApp())
            .post('/pets/register')
            .send({ ...datosValidos, especie: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el peso es negativo', async () => {
        const res = await request(buildApp())
            .post('/pets/register')
            .send({ ...datosValidos, peso: '-1' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando la fecha de nacimiento es futura', async () => {
        const res = await request(buildApp())
            .post('/pets/register')
            .send({ ...datosValidos, fecha_nacimiento: '2099-12-31' });
        expect(res.status).toBe(400);
    });
});

// POST /pets/register – Integración con BD

describe('POST /pets/register – BD real', () => {
    const datosValidos = {
        nombre_mascota: 'Rex',
        especie: 'Perro',
        raza: 'Pastor Alemán',
        peso: '30',
        fecha_nacimiento: '2019-06-01'
    };

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post('/pets/register')
            .send(datosValidos);
        expect(res.status).toBe(500);
    });

    test('devuelve 500 cuando falla el INSERT en BD', async () => {
        simularErrorQuery();
        const res = await request(buildApp())
            .post('/pets/register')
            .send(datosValidos);
        expect(res.status).toBe(500);
    });

    test('redirige a /pets/mypets tras registrar correctamente', async () => {
        const res = await request(buildApp())
            .post('/pets/register')
            .send(datosValidos);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/pets/mypets');
    });

    test('guarda la mascota con los datos correctos en BD', async () => {
        await request(buildApp()).post('/pets/register').send(datosValidos);

        const [rows] = await db.query(
            'SELECT * FROM mascotas WHERE id_usuario = ? AND nombre_mascota = ?',
            [testUserId, 'Rex']
        );
        expect(rows.length).toBe(1);
        expect(rows[0].especie).toBe('Perro');
        expect(rows[0].raza).toBe('Pastor Alemán');
        expect(parseFloat(rows[0].peso)).toBeCloseTo(30);
        expect(rows[0].activo).toBe(1);
    });

    test('crea automáticamente la cartilla médica junto con la mascota', async () => {
        await request(buildApp()).post('/pets/register').send(datosValidos);

        const [mascotas] = await db.query(
            'SELECT * FROM mascotas WHERE id_usuario = ? AND nombre_mascota = ?',
            [testUserId, 'Rex']
        );
        const [cartillas] = await db.query(
            'SELECT * FROM cartilla_medica WHERE id_mascota = ?',
            [mascotas[0].id_mascota]
        );
        expect(cartillas.length).toBe(1);
    });
});

// GET /pets/profile/:id

describe('GET /pets/profile/:id', () => {
    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp()).get('/pets/profile/1');
        expect(res.status).toBe(500);
    });

    test('devuelve 404 cuando la mascota no existe en BD', async () => {
        const res = await request(buildApp()).get('/pets/profile/999999');
        expect(res.status).toBe(404);
    });

    test('devuelve 200 para mascota sin cartilla médica', async () => {
        const [result] = await db.query(
            `INSERT INTO mascotas
                (nombre_mascota, fecha_nacimiento, especie, raza, peso, id_usuario)
             VALUES (?, ?, ?, ?, ?, ?)`,
            ['SinCartilla', '2020-01-01', 'Gato', 'Común', 3, testUserId]
        );
        const res = await request(buildApp()).get(`/pets/profile/${result.insertId}`);
        expect(res.status).toBe(200);
    });

    test('devuelve 200 con el perfil completo de una mascota con cartilla', async () => {
        const res = await request(buildApp()).get(`/pets/profile/${testMascotaId}`);
        expect(res.status).toBe(200);
        expect(res.text).toContain('Buddy');
    });

    test('incluye los registros médicos previamente insertados', async () => {
        await db.query(
            'INSERT INTO cita_veterinaria (clinica, fecha, id_cartilla) VALUES (?, ?, ?)',
            ['Clínica Test', '2025-05-01 10:00:00', testCartillaId]
        );
        const res = await request(buildApp()).get(`/pets/profile/${testMascotaId}`);
        expect(res.status).toBe(200);
        expect(res.text).toContain('Clínica Test');
    });
});

// POST /pets/eliminar – soft delete

describe('POST /pets/eliminar', () => {
    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post('/pets/eliminar')
            .send({ id: String(testMascotaId) });
        expect(res.status).toBe(500);
    });

    test('redirige a /pets/mypets tras el soft delete', async () => {
        const res = await request(buildApp())
            .post('/pets/eliminar')
            .send({ id: String(testMascotaId) });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/pets/mypets');
    });

    test('pone activo=0 pero la mascota sigue existiendo en BD', async () => {
        await request(buildApp())
            .post('/pets/eliminar')
            .send({ id: String(testMascotaId) });

        const [rows] = await db.query(
            'SELECT activo FROM mascotas WHERE id_mascota = ?',
            [testMascotaId]
        );
        expect(rows.length).toBe(1);
        expect(rows[0].activo).toBe(0);
    });
});

// POST /pets/editar – BD real

describe('POST /pets/editar – BD real', () => {
    test('actualiza los campos de la mascota en BD', async () => {
        await request(buildApp())
            .post('/pets/editar')
            .send({
                id_mascota: String(testMascotaId),
                nombre_mascota: 'BuddyEditado',
                especie: 'Perro',
                raza: 'Labrador',
                peso: '12',
                fecha_nacimiento: '2020-03-10'
            });

        const [rows] = await db.query(
            'SELECT nombre_mascota, peso FROM mascotas WHERE id_mascota = ?',
            [testMascotaId]
        );
        expect(rows[0].nombre_mascota).toBe('BuddyEditado');
        expect(parseFloat(rows[0].peso)).toBeCloseTo(12);
    });
});

// POST /pets/cartilla/add-cita – Validaciones

describe('POST /pets/cartilla/add-cita – validaciones', () => {
    const datosValidos = {
        id_cartilla: '',   // se rellena en cada test con testCartillaId
        clinica: 'Clínica Veterinaria Central',
        fecha: '2025-08-20T11:00'
    };

    test('rechaza con 400 cuando la clínica está vacía', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-cita')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId), clinica: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando la clínica tiene menos de 3 caracteres', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-cita')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId), clinica: 'AB' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando la fecha no es válida', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-cita')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId), fecha: 'no-es-fecha' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando observaciones tiene menos de 5 caracteres', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-cita')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId), observaciones: 'abc' });
        expect(res.status).toBe(400);
    });
});


// POST /pets/cartilla/add-cita – BD real


describe('POST /pets/cartilla/add-cita – BD real', () => {
    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post('/pets/cartilla/add-cita')
            .send({ id_cartilla: String(testCartillaId), clinica: 'Clínica Test', fecha: '2025-08-20T11:00' });
        expect(res.status).toBe(500);
    });

    test('guarda la cita en cita_veterinaria', async () => {
        await request(buildApp())
            .post('/pets/cartilla/add-cita')
            .send({ id_cartilla: String(testCartillaId), clinica: 'Clínica Central', fecha: '2025-08-20T11:00' });

        const [rows] = await db.query(
            'SELECT * FROM cita_veterinaria WHERE id_cartilla = ?',
            [testCartillaId]
        );
        expect(rows.length).toBe(1);
        expect(rows[0].clinica).toBe('Clínica Central');
    });

    test('redirige al perfil de la mascota tras insertar', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-cita')
            .send({ id_cartilla: String(testCartillaId), clinica: 'Clínica Test', fecha: '2025-08-20T11:00' });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(`/pets/profile/${testMascotaId}`);
    });
});

// POST /pets/cartilla/add-vacuna – Validaciones

describe('POST /pets/cartilla/add-vacuna – validaciones', () => {
    const datosValidos = { nombre_vacuna: 'Rabia', fecha_administracion: '2025-04-10' };

    test('rechaza con 400 cuando el nombre de la vacuna está vacío', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-vacuna')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId), nombre_vacuna: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando la fecha de administración es inválida', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-vacuna')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId), fecha_administracion: 'no-es-fecha' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando observaciones tiene menos de 5 caracteres', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-vacuna')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId), observaciones_vacuna: 'abc' });
        expect(res.status).toBe(400);
    });
});


// POST /pets/cartilla/add-vacuna – BD real

describe('POST /pets/cartilla/add-vacuna – BD real', () => {
    test('guarda la vacuna en la tabla vacunas', async () => {
        await request(buildApp())
            .post('/pets/cartilla/add-vacuna')
            .send({ id_cartilla: String(testCartillaId), nombre_vacuna: 'Rabia', fecha_administracion: '2025-04-10' });

        const [rows] = await db.query(
            'SELECT * FROM vacunas WHERE id_cartilla = ?',
            [testCartillaId]
        );
        expect(rows.length).toBe(1);
        expect(rows[0].nombre).toBe('Rabia');
    });

    test('redirige al perfil de la mascota tras insertar', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-vacuna')
            .send({ id_cartilla: String(testCartillaId), nombre_vacuna: 'Rabia', fecha_administracion: '2025-04-10' });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(`/pets/profile/${testMascotaId}`);
    });
});

// POST /pets/cartilla/add-tratamiento – Validaciones

describe('POST /pets/cartilla/add-tratamiento – validaciones', () => {
    const datosValidos = {
        medicamento: 'Ibuprofeno', dosis: '200mg',
        frecuencia: 'Cada 8 horas', fecha_inicio: '2025-05-01', fecha_fin: '2025-05-10'
    };

    test('rechaza con 400 cuando el medicamento está vacío', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-tratamiento')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId), medicamento: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando la dosis está vacía', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-tratamiento')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId), dosis: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando fecha_fin es anterior a fecha_inicio', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-tratamiento')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId), fecha_inicio: '2025-05-10', fecha_fin: '2025-05-01' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando fecha_inicio es inválida', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-tratamiento')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId), fecha_inicio: 'no-es-fecha' });
        expect(res.status).toBe(400);
    });
});


// POST /pets/cartilla/add-tratamiento – BD real

describe('POST /pets/cartilla/add-tratamiento – BD real', () => {
    const datosValidos = {
        medicamento: 'Ibuprofeno', dosis: '200mg',
        frecuencia: 'Cada 8 horas', fecha_inicio: '2025-05-01', fecha_fin: '2025-05-10'
    };

    test('guarda el tratamiento en la tabla tratamientos', async () => {
        await request(buildApp())
            .post('/pets/cartilla/add-tratamiento')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId) });

        const [rows] = await db.query(
            'SELECT * FROM tratamientos WHERE id_cartilla = ?',
            [testCartillaId]
        );
        expect(rows.length).toBe(1);
        expect(rows[0].medicamento).toBe('Ibuprofeno');
        expect(rows[0].dosis).toBe('200mg');
    });

    test('redirige al perfil de la mascota tras insertar', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-tratamiento')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId) });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(`/pets/profile/${testMascotaId}`);
    });
});

// POST /pets/cartilla/add-patologia – Validaciones

describe('POST /pets/cartilla/add-patologia – validaciones', () => {
    const datosValidos = {
        nombre: 'Artritis', tipo: 'enfermedad', estado: 'activa', fecha_diagnostico: '2024-11-01'
    };

    test('rechaza con 400 cuando el nombre está vacío', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-patologia')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId), nombre: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el tipo no es un valor permitido', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-patologia')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId), tipo: 'invalido' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el estado no es un valor permitido', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-patologia')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId), estado: 'invalido' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando la fecha de diagnóstico está vacía', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-patologia')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId), fecha_diagnostico: '' });
        expect(res.status).toBe(400);
    });
});

// POST /pets/cartilla/add-patologia – BD real

describe('POST /pets/cartilla/add-patologia – BD real', () => {
    const datosValidos = {
        nombre: 'Artritis', tipo: 'enfermedad', estado: 'activa', fecha_diagnostico: '2024-11-01'
    };

    test('guarda la patología en condicion_medica', async () => {
        await request(buildApp())
            .post('/pets/cartilla/add-patologia')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId) });

        const [rows] = await db.query(
            'SELECT * FROM condicion_medica WHERE id_cartilla = ?',
            [testCartillaId]
        );
        expect(rows.length).toBe(1);
        expect(rows[0].nombre).toBe('Artritis');
        expect(rows[0].tipo).toBe('enfermedad');
        expect(rows[0].estado).toBe('activa');
    });

    test('redirige al perfil de la mascota tras insertar', async () => {
        const res = await request(buildApp())
            .post('/pets/cartilla/add-patologia')
            .send({ ...datosValidos, id_cartilla: String(testCartillaId) });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(`/pets/profile/${testMascotaId}`);
    });
});

// POST /pets/cartilla/eliminar-cita – BD real

describe('POST /pets/cartilla/eliminar-cita – BD real', () => {
    test('elimina físicamente la cita de la BD', async () => {
        const [inserted] = await db.query(
            'INSERT INTO cita_veterinaria (clinica, fecha, id_cartilla) VALUES (?, ?, ?)',
            ['Clínica para Borrar', '2025-06-01 09:00:00', testCartillaId]
        );
        await request(buildApp())
            .post('/pets/cartilla/eliminar-cita')
            .send({ id_cita: String(inserted.insertId) });

        const [rows] = await db.query(
            'SELECT * FROM cita_veterinaria WHERE id_cita = ?', [inserted.insertId]
        );
        expect(rows.length).toBe(0);
    });
});

// POST /pets/cartilla/eliminar-vacuna – BD real

describe('POST /pets/cartilla/eliminar-vacuna – BD real', () => {
    test('elimina físicamente la vacuna de la BD', async () => {
        const [inserted] = await db.query(
            'INSERT INTO vacunas (nombre, fecha_administracion, id_cartilla) VALUES (?, ?, ?)',
            ['Vacuna para Borrar', '2025-02-01', testCartillaId]
        );
        await request(buildApp())
            .post('/pets/cartilla/eliminar-vacuna')
            .send({ id_vacuna: String(inserted.insertId) });

        const [rows] = await db.query(
            'SELECT * FROM vacunas WHERE id_vacuna = ?', [inserted.insertId]
        );
        expect(rows.length).toBe(0);
    });
});

// POST /pets/cartilla/eliminar-tratamiento – BD real

describe('POST /pets/cartilla/eliminar-tratamiento – BD real', () => {
    test('elimina físicamente el tratamiento de la BD', async () => {
        const [inserted] = await db.query(
            `INSERT INTO tratamientos (medicamento, dosis, frecuencia, fecha_inicio, fecha_fin, id_cartilla)
             VALUES (?, ?, ?, ?, ?, ?)`,
            ['Medicamento para Borrar', '100mg', 'Diario', '2025-04-01', '2025-04-10', testCartillaId]
        );
        await request(buildApp())
            .post('/pets/cartilla/eliminar-tratamiento')
            .send({ id_tratamiento: String(inserted.insertId) });

        const [rows] = await db.query(
            'SELECT * FROM tratamientos WHERE id_tratamiento = ?', [inserted.insertId]
        );
        expect(rows.length).toBe(0);
    });
});

// POST /pets/cartilla/eliminar-patologia – BD real

describe('POST /pets/cartilla/eliminar-patologia – BD real', () => {
    test('elimina físicamente la patología de la BD', async () => {
        const [inserted] = await db.query(
            `INSERT INTO condicion_medica (nombre, tipo, estado, fecha_diagnostico, id_cartilla)
             VALUES (?, ?, ?, ?, ?)`,
            ['Patología para Borrar', 'enfermedad', 'activa', '2024-10-01', testCartillaId]
        );
        await request(buildApp())
            .post('/pets/cartilla/eliminar-patologia')
            .send({ id_patologia: String(inserted.insertId) });

        const [rows] = await db.query(
            'SELECT * FROM condicion_medica WHERE id_condicion = ?', [inserted.insertId]
        );
        expect(rows.length).toBe(0);
    });
});
