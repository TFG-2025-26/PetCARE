"use strict";

// ******************************************************************************
// Tests de integración completos: HTTP → router → middleware → controlador → BD real.
// Cubre servicesController, chatController y citasController.
// Requiere XAMPP corriendo con la BD petcare_test creada.
// Ejecutar con: npm run test:db
// ******************************************************************************

const request        = require('supertest');
const express        = require('express');
const session        = require('express-session');
const path           = require('path');
const pool           = require('../../db');
const servicesRouter = require('../../routes/servicesRouter');

const db = pool.promise();

let testUserId;
let testUser2Id;
let testEmpresaId;
let testAnuncioId;
let testChatId;

// App builders

/* App con sesión de usuario normal (testUser1). */
function buildApp() {
    const usuario = { id: testUserId, tipo: 'usuario', rol: 'user', nombre_usuario: 'testserv1' };
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => { res.locals.usuario = req.session.usuario || null; next(); });
    app.use((req, res, next) => { req.session.usuario = usuario; next(); });
    app.use('/services', servicesRouter);
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message });
    });
    return app;
}

/* App sin sesión (para tests de autenticación). */
function buildAppSinSesion() {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => { res.locals.usuario = null; next(); });
    app.use('/services', servicesRouter);
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message });
    });
    return app;
}

/* App con sesión de empresa (para tests de autorización). */
function buildAppEmpresa() {
    const empresa = { id: testUserId, tipo: 'empresa', rol: 'user', nombre_usuario: 'testserv1' };
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => { res.locals.usuario = req.session.usuario || null; next(); });
    app.use((req, res, next) => { req.session.usuario = empresa; next(); });
    app.use('/services', servicesRouter);
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message });
    });
    return app;
}

/* App con sesión de testUser2 (propietario del anuncio de prueba). */
function buildAppUser2() {
    const usuario = { id: testUser2Id, tipo: 'usuario', rol: 'user', nombre_usuario: 'testserv2' };
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => { res.locals.usuario = req.session.usuario || null; next(); });
    app.use((req, res, next) => { req.session.usuario = usuario; next(); });
    app.use('/services', servicesRouter);
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message });
    });
    return app;
}


const simularErrorConexion = () =>
    jest.spyOn(pool, 'getConnection')
        .mockImplementation((cb) => cb(new Error('DB connection error')));

const simularErrorQuery = () => {
    const fakeConn = {
        query: jest.fn((sql, params, cb) => cb(new Error('Query error'))),
        release: jest.fn()
    };
    jest.spyOn(pool, 'getConnection').mockImplementation((cb) => cb(null, fakeConn));
};

// Ciclo de vida

beforeAll(async () => {
    await db.query("DELETE FROM usuarios WHERE correo IN ('testservices1@jest.com','testservices2@jest.com')");

    const [r1] = await db.query(
        `INSERT INTO usuarios (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña)
         VALUES (?,?,?,?,?,?)`,
        ['testserv1', 'Test Services 1', '1990-01-01', 111111111, 'testservices1@jest.com', 'hash1']
    );
    testUserId = r1.insertId;

    const [r2] = await db.query(
        `INSERT INTO usuarios (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña)
         VALUES (?,?,?,?,?,?)`,
        ['testserv2', 'Test Services 2', '1991-02-02', 222222222, 'testservices2@jest.com', 'hash2']
    );
    testUser2Id = r2.insertId;

    await db.query("DELETE FROM empresas WHERE nombre = 'EmpresaTestJest'");
    const [eResult] = await db.query(
        `INSERT INTO empresas (nombre, tipo, descripcion, ubicacion, activo) VALUES (?,?,?,?,1)`,
        ['EmpresaTestJest', 'veterinaria', 'Descripción test', 'Madrid']
    );
    testEmpresaId = eResult.insertId;
});

beforeEach(async () => {
    // Anuncio de testUser2 (testUser1 puede contactarle como cliente)
    const [ar] = await db.query(
        `INSERT INTO anuncios (tipo_anuncio, descripcion, tipo_mascota, precio_hora, tipo_servicio, id_usuario, activo, eliminado)
         VALUES (?,?,?,?,?,?,1,0)`,
        ['puntual', 'Descripción de prueba para tests', 'perro', 15.0, 'cuidador', testUser2Id]
    );
    testAnuncioId = ar.insertId;

    await db.query(
        `INSERT INTO disponibilidad (tipo, fecha_inicio, hora_inicio, hora_fin, id_anuncio)
         VALUES (?,?,?,?,?)`,
        ['puntual', '2099-12-01', '09:00:00', '17:00:00', testAnuncioId]
    );

    // Chat entre testUser1 (cliente) y testUser2 (proveedor del anuncio)
    const [cr] = await db.query(
        `INSERT INTO chats (activo, id_anuncio) VALUES (1, ?)`,
        [testAnuncioId]
    );
    testChatId = cr.insertId;

    await db.query(
        `INSERT INTO chat_usuario (id_chat, id_usuario) VALUES (?,?),(?,?)`,
        [testChatId, testUserId, testChatId, testUser2Id]
    );
});

afterEach(async () => {
    jest.restoreAllMocks();
    await db.query(
        'DELETE FROM valoraciones WHERE id_autor IN (?,?) OR id_empresa = ?',
        [testUserId, testUser2Id, testEmpresaId]
    );
    await db.query(
        'DELETE FROM reportes WHERE id_autor IN (?,?) OR id_usuario_reportado IN (?,?)',
        [testUserId, testUser2Id, testUserId, testUser2Id]
    );
    await db.query('DELETE FROM mensajes WHERE id_chat = ?', [testChatId]);
    await db.query('DELETE FROM chat_usuario WHERE id_chat = ?', [testChatId]);
    await db.query('DELETE FROM chats WHERE id_chat = ?', [testChatId]);
    await db.query('DELETE FROM disponibilidad WHERE id_anuncio = ?', [testAnuncioId]);
    await db.query('DELETE FROM anuncios WHERE id_anuncio = ?', [testAnuncioId]);
});

afterAll(async () => {
    await db.query('DELETE FROM valoraciones WHERE id_empresa = ?', [testEmpresaId]);
    await db.query('DELETE FROM empresas WHERE id_empresa = ?', [testEmpresaId]);
    await db.query('DELETE FROM usuarios WHERE id_usuario IN (?,?)', [testUserId, testUser2Id]);
    await new Promise((resolve, reject) =>
        pool.end(err => (err ? reject(err) : resolve()))
    );
});



// MIDDLEWARE DE AUTENTICACIÓN Y AUTORIZACIÓN

describe('Middleware de autenticación – rutas que requieren sesión', () => {
    test('GET /mis-anuncios sin sesión redirige a /auth/login', async () => {
        const res = await request(buildAppSinSesion()).get('/services/mis-anuncios');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
    });

    test('GET /get-mis-anuncios sin sesión redirige a /auth/login', async () => {
        const res = await request(buildAppSinSesion()).get('/services/get-mis-anuncios');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
    });

    test('GET /publicar-anuncio sin sesión redirige a /auth/login', async () => {
        const res = await request(buildAppSinSesion()).get('/services/publicar-anuncio');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
    });

    test('POST /publicar-anuncio sin sesión redirige a /auth/login', async () => {
        const res = await request(buildAppSinSesion()).post('/services/publicar-anuncio').send({});
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
    });

    test('GET /citas sin sesión redirige a /auth/login', async () => {
        const res = await request(buildAppSinSesion()).get('/services/citas');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
    });

    test('GET /mis-chats sin sesión redirige a /auth/login', async () => {
        const res = await request(buildAppSinSesion()).get('/services/mis-chats');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
    });

    test('POST /usuario/reportar sin sesión redirige a /auth/login', async () => {
        const res = await request(buildAppSinSesion()).post('/services/usuario/reportar').send({});
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
    });
});

describe('Middleware de autorización – usuarios tipo empresa reciben 403', () => {
    test('GET /mis-anuncios con empresa recibe 403', async () => {
        const res = await request(buildAppEmpresa()).get('/services/mis-anuncios');
        expect(res.status).toBe(403);
    });

    test('GET /anuncios con empresa recibe 403', async () => {
        const res = await request(buildAppEmpresa()).get('/services/anuncios');
        expect(res.status).toBe(403);
    });

    test('POST /publicar-anuncio con empresa recibe 403', async () => {
        const res = await request(buildAppEmpresa()).post('/services/publicar-anuncio').send({});
        expect(res.status).toBe(403);
    });

    test('GET /citas con empresa recibe 403', async () => {
        const res = await request(buildAppEmpresa()).get('/services/citas');
        expect(res.status).toBe(403);
    });

    test('POST /usuario/reportar con empresa recibe 403', async () => {
        const res = await request(buildAppEmpresa()).post('/services/usuario/reportar').send({});
        expect(res.status).toBe(403);
    });
});



// GET /services/ y páginas de renderizado simple

describe('GET /services/', () => {
    test('devuelve 200 con sesión de usuario', async () => {
        const res = await request(buildApp()).get('/services/');
        expect(res.status).toBe(200);
    });

    test('devuelve 200 sin sesión (ruta pública)', async () => {
        const res = await request(buildAppSinSesion()).get('/services/');
        expect(res.status).toBe(200);
    });
});

describe('GET /services/empresas', () => {
    test('devuelve 200 con sesión de usuario', async () => {
        const res = await request(buildApp()).get('/services/empresas');
        expect(res.status).toBe(200);
    });

    test('devuelve 200 sin sesión (ruta pública)', async () => {
        const res = await request(buildAppSinSesion()).get('/services/empresas');
        expect(res.status).toBe(200);
    });
});



// GET /services/get-anuncios

describe('GET /services/get-anuncios', () => {
    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp()).get('/services/get-anuncios');
        expect(res.status).toBe(500);
    });

    test('devuelve JSON con anuncios y hayMasPaginas', async () => {
        const res = await request(buildApp()).get('/services/get-anuncios');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('anuncios');
        expect(res.body).toHaveProperty('hayMasPaginas');
        expect(Array.isArray(res.body.anuncios)).toBe(true);
    });

    test('no incluye el anuncio propio del usuario autenticado', async () => {
        // Crear un anuncio del propio testUser1
        const [myAd] = await db.query(
            `INSERT INTO anuncios (tipo_anuncio, tipo_mascota, precio_hora, tipo_servicio, id_usuario, activo, eliminado)
             VALUES (?,?,?,?,?,1,0)`,
            ['puntual', 'gato', 10.0, 'cuidador', testUserId]
        );
        const res = await request(buildApp()).get('/services/get-anuncios');
        expect(res.status).toBe(200);
        const ids = res.body.anuncios.map(a => a.id_anuncio);
        expect(ids).not.toContain(myAd.insertId);
        await db.query('DELETE FROM anuncios WHERE id_anuncio = ?', [myAd.insertId]);
    });

    test('incluye el anuncio de testUser2 (activo y no eliminado)', async () => {
        const res = await request(buildApp()).get('/services/get-anuncios');
        expect(res.status).toBe(200);
        const ids = res.body.anuncios.map(a => a.id_anuncio);
        expect(ids).toContain(testAnuncioId);
    });

    test('filtra correctamente por tipoServicio', async () => {
        const res = await request(buildApp()).get('/services/get-anuncios?tipoServicio=transporte');
        expect(res.status).toBe(200);
        res.body.anuncios.forEach(a => expect(a.tipo_servicio).toBe('transporte'));
    });

    test('filtra correctamente por tipoAnimal', async () => {
        const res = await request(buildApp()).get('/services/get-anuncios?tipoAnimal=gato');
        expect(res.status).toBe(200);
        res.body.anuncios.forEach(a => expect(a.tipo_mascota).toBe('gato'));
    });

    test('filtra correctamente por precioMax', async () => {
        const res = await request(buildApp()).get('/services/get-anuncios?precioMax=10');
        expect(res.status).toBe(200);
        res.body.anuncios.forEach(a => expect(parseFloat(a.precio_hora)).toBeLessThanOrEqual(10));
    });

    test('la paginación devuelve hayMasPaginas=false en última página', async () => {
        const res = await request(buildApp()).get('/services/get-anuncios?pagina=999&limite=10');
        expect(res.status).toBe(200);
        expect(res.body.hayMasPaginas).toBe(false);
    });

    test('sin sesión devuelve anuncios sin excluir ningún usuario', async () => {
        const res = await request(buildAppSinSesion()).get('/services/get-anuncios');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('anuncios');
    });
});



// GET /services/anuncios (página HTML)

describe('GET /services/anuncios', () => {
    test('devuelve 200 con sesión de usuario normal', async () => {
        const res = await request(buildApp()).get('/services/anuncios');
        expect(res.status).toBe(200);
    });

    test('usuario tipo empresa recibe 403', async () => {
        const res = await request(buildAppEmpresa()).get('/services/anuncios');
        expect(res.status).toBe(403);
    });
});



// GET /services/mis-anuncios y GET /services/get-mis-anuncios

describe('GET /services/mis-anuncios', () => {
    test('devuelve 200 con sesión válida', async () => {
        const res = await request(buildApp()).get('/services/mis-anuncios');
        expect(res.status).toBe(200);
    });

    test('sin sesión redirige a /auth/login', async () => {
        const res = await request(buildAppSinSesion()).get('/services/mis-anuncios');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
    });
});

describe('GET /services/get-mis-anuncios', () => {
    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp()).get('/services/get-mis-anuncios');
        expect(res.status).toBe(500);
    });

    test('devuelve JSON con anuncios propios del usuario', async () => {
        // testUser2 tiene un anuncio creado en beforeEach
        const res = await request(buildAppUser2()).get('/services/get-mis-anuncios');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('anuncios');
        expect(Array.isArray(res.body.anuncios)).toBe(true);
        const ids = res.body.anuncios.map(a => a.id_anuncio);
        expect(ids).toContain(testAnuncioId);
    });

    test('no incluye anuncios de otros usuarios', async () => {
        // testUser1 no tiene anuncios propios en este test
        const res = await request(buildApp()).get('/services/get-mis-anuncios');
        expect(res.status).toBe(200);
        const ids = res.body.anuncios.map(a => a.id_anuncio);
        expect(ids).not.toContain(testAnuncioId);
    });

    test('devuelve array vacío si el usuario no tiene anuncios', async () => {
        const res = await request(buildApp()).get('/services/get-mis-anuncios');
        expect(res.status).toBe(200);
        expect(res.body.anuncios).toEqual([]);
    });
});



// GET /services/publicar-anuncio

describe('GET /services/publicar-anuncio', () => {
    test('devuelve 200 con sesión válida', async () => {
        const res = await request(buildApp()).get('/services/publicar-anuncio');
        expect(res.status).toBe(200);
    });

    test('sin sesión redirige a /auth/login', async () => {
        const res = await request(buildAppSinSesion()).get('/services/publicar-anuncio');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
    });
});


// POST /services/publicar-anuncio – Validaciones

describe('POST /services/publicar-anuncio – validaciones de formulario', () => {
    const datosValidos = {
        tipo: 'puntual',
        tipo_servicio: 'cuidador',
        tipo_mascota: 'perro',
        precio_hora: '20',
        descripcion: 'Una descripción válida para test',
        disponibilidad: [{ fecha: '2099-01-01', hora_inicio: '09:00', hora_fin: '17:00' }]
    };

    test('rechaza con 400 cuando tipo_servicio no es válido', async () => {
        const res = await request(buildApp())
            .post('/services/publicar-anuncio')
            .send({ ...datosValidos, tipo_servicio: 'invalido' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando tipo_mascota no es válido', async () => {
        const res = await request(buildApp())
            .post('/services/publicar-anuncio')
            .send({ ...datosValidos, tipo_mascota: 'dinosaurio' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando precio_hora es negativo', async () => {
        const res = await request(buildApp())
            .post('/services/publicar-anuncio')
            .send({ ...datosValidos, precio_hora: '-5' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando precio_hora supera 999', async () => {
        const res = await request(buildApp())
            .post('/services/publicar-anuncio')
            .send({ ...datosValidos, precio_hora: '1000' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando tipo es puntual y no hay disponibilidad', async () => {
        const res = await request(buildApp())
            .post('/services/publicar-anuncio')
            .send({ ...datosValidos, disponibilidad: [] });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando tipo puntual tiene fecha pasada', async () => {
        const res = await request(buildApp())
            .post('/services/publicar-anuncio')
            .send({ ...datosValidos, disponibilidad: [{ fecha: '2000-01-01', hora_inicio: '09:00', hora_fin: '17:00' }] });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando tipo puntual tiene hora_fin <= hora_inicio', async () => {
        const res = await request(buildApp())
            .post('/services/publicar-anuncio')
            .send({ ...datosValidos, disponibilidad: [{ fecha: '2099-01-01', hora_inicio: '17:00', hora_fin: '09:00' }] });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando tipo es recurrente y no hay días seleccionados', async () => {
        const res = await request(buildApp())
            .post('/services/publicar-anuncio')
            .send({ ...datosValidos, tipo: 'recurrente', recurrente: {} });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando descripcion supera 500 caracteres', async () => {
        const res = await request(buildApp())
            .post('/services/publicar-anuncio')
            .send({ ...datosValidos, descripcion: 'a'.repeat(501) });
        expect(res.status).toBe(400);
    });
});



// POST /services/publicar-anuncio – BD real

describe('POST /services/publicar-anuncio – BD real', () => {
    const datosValidos = {
        tipo: 'puntual',
        tipo_servicio: 'cuidador',
        tipo_mascota: 'perro',
        precio_hora: '20',
        descripcion: 'Anuncio creado por test de integración',
        disponibilidad: [{ fecha: '2099-06-15', hora_inicio: '08:00', hora_fin: '16:00' }]
    };

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post('/services/publicar-anuncio')
            .send(datosValidos);
        expect(res.status).toBe(500);
    });

    test('redirige a /services/mis-anuncios tras publicar anuncio puntual', async () => {
        const res = await request(buildApp())
            .post('/services/publicar-anuncio')
            .send(datosValidos);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/services/mis-anuncios');
    });

    test('guarda el anuncio puntual con los datos correctos en BD', async () => {
        await request(buildApp())
            .post('/services/publicar-anuncio')
            .send(datosValidos);

        const [rows] = await db.query(
            'SELECT * FROM anuncios WHERE id_usuario = ? AND tipo_servicio = ? AND tipo_mascota = ? AND eliminado = 0',
            [testUserId, 'cuidador', 'perro']
        );
        expect(rows.length).toBeGreaterThanOrEqual(1);
        const anuncio = rows.find(a => a.descripcion === 'Anuncio creado por test de integración');
        expect(anuncio).toBeDefined();
        expect(parseFloat(anuncio.precio_hora)).toBeCloseTo(20);

        // Limpieza del anuncio creado en este test
        await db.query('DELETE FROM disponibilidad WHERE id_anuncio = ?', [anuncio.id_anuncio]);
        await db.query('DELETE FROM anuncios WHERE id_anuncio = ?', [anuncio.id_anuncio]);
    });

    test('guarda la disponibilidad puntual junto con el anuncio', async () => {
        await request(buildApp())
            .post('/services/publicar-anuncio')
            .send(datosValidos);

        const [anuncios] = await db.query(
            "SELECT id_anuncio FROM anuncios WHERE id_usuario = ? AND descripcion = 'Anuncio creado por test de integración'",
            [testUserId]
        );
        expect(anuncios.length).toBeGreaterThanOrEqual(1);

        const [disps] = await db.query(
            'SELECT * FROM disponibilidad WHERE id_anuncio = ?',
            [anuncios[0].id_anuncio]
        );
        expect(disps.length).toBe(1);
        expect(disps[0].tipo).toBe('puntual');

        // Limpieza
        await db.query('DELETE FROM disponibilidad WHERE id_anuncio = ?', [anuncios[0].id_anuncio]);
        await db.query('DELETE FROM anuncios WHERE id_anuncio = ?', [anuncios[0].id_anuncio]);
    });

    test('redirige a /services/anuncios tras publicar anuncio recurrente', async () => {
        const res = await request(buildApp())
            .post('/services/publicar-anuncio')
            .send({
                tipo: 'recurrente',
                tipo_servicio: 'cuidador',
                tipo_mascota: 'perro',
                precio_hora: '25',
                recurrente: {
                    lunes: { 0: { hora_inicio: '09:00', hora_fin: '17:00' } }
                }
            });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/services/mis-anuncios');

        // Limpieza
        const [anuncios] = await db.query(
            "SELECT id_anuncio FROM anuncios WHERE id_usuario = ? AND tipo_anuncio = 'recurrente'",
            [testUserId]
        );
        for (const a of anuncios) {
            await db.query('DELETE FROM disponibilidad WHERE id_anuncio = ?', [a.id_anuncio]);
            await db.query('DELETE FROM anuncios WHERE id_anuncio = ?', [a.id_anuncio]);
        }
    });
});


// PUT /services/anuncios/:id/eliminar

describe('PUT /services/anuncios/:id/eliminar', () => {
    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildAppUser2())
            .put(`/services/anuncios/${testAnuncioId}/eliminar`)
            .send({ tipo: 'simple' });
        expect(res.status).toBe(500);
    });

    test('devuelve 400 cuando tipo de eliminación no es válido', async () => {
        const res = await request(buildAppUser2())
            .put(`/services/anuncios/${testAnuncioId}/eliminar`)
            .send({ tipo: 'invalido' });
        expect(res.status).toBe(400);
    });

    test('devuelve 403 si el usuario no es propietario del anuncio', async () => {
        const res = await request(buildApp())
            .put(`/services/anuncios/${testAnuncioId}/eliminar`)
            .send({ tipo: 'simple' });
        expect(res.status).toBe(403);
    });

    test('tipo=simple desactiva el anuncio (activo=0) sin marcarlo como eliminado', async () => {
        const res = await request(buildAppUser2())
            .put(`/services/anuncios/${testAnuncioId}/eliminar`)
            .send({ tipo: 'simple' });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        const [rows] = await db.query(
            'SELECT activo, eliminado FROM anuncios WHERE id_anuncio = ?',
            [testAnuncioId]
        );
        expect(rows[0].activo).toBe(0);
        expect(rows[0].eliminado).toBe(0);
    });

    test('tipo=total marca el anuncio como eliminado y desactiva sus chats', async () => {
        const res = await request(buildAppUser2())
            .put(`/services/anuncios/${testAnuncioId}/eliminar`)
            .send({ tipo: 'total' });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        const [rows] = await db.query(
            'SELECT activo, eliminado FROM anuncios WHERE id_anuncio = ?',
            [testAnuncioId]
        );
        expect(rows[0].eliminado).toBe(1);
        expect(rows[0].activo).toBe(0);

        const [chats] = await db.query(
            'SELECT activo FROM chats WHERE id_chat = ?',
            [testChatId]
        );
        expect(chats[0].activo).toBe(0);
    });
});



// PUT /services/anuncios/:id/reactivar

describe('PUT /services/anuncios/:id/reactivar', () => {
    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildAppUser2())
            .put(`/services/anuncios/${testAnuncioId}/reactivar`);
        expect(res.status).toBe(500);
    });

    test('devuelve 403 si el usuario no es propietario del anuncio', async () => {
        await db.query('UPDATE anuncios SET activo = 0 WHERE id_anuncio = ?', [testAnuncioId]);
        const res = await request(buildApp())
            .put(`/services/anuncios/${testAnuncioId}/reactivar`);
        expect(res.status).toBe(403);
    });

    test('reactiva el anuncio correctamente (activo=1)', async () => {
        await db.query('UPDATE anuncios SET activo = 0 WHERE id_anuncio = ?', [testAnuncioId]);

        const res = await request(buildAppUser2())
            .put(`/services/anuncios/${testAnuncioId}/reactivar`);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        const [rows] = await db.query(
            'SELECT activo FROM anuncios WHERE id_anuncio = ?',
            [testAnuncioId]
        );
        expect(rows[0].activo).toBe(1);
    });

    test('no puede reactivar un anuncio marcado como eliminado', async () => {
        await db.query('UPDATE anuncios SET eliminado = 1, activo = 0 WHERE id_anuncio = ?', [testAnuncioId]);

        const res = await request(buildAppUser2())
            .put(`/services/anuncios/${testAnuncioId}/reactivar`);
        expect(res.status).toBe(403);
    });
});



// GET /services/get-empresas

describe('GET /services/get-empresas', () => {
    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp()).get('/services/get-empresas');
        expect(res.status).toBe(500);
    });

    test('devuelve JSON con empresas y hayMasPaginas', async () => {
        const res = await request(buildApp()).get('/services/get-empresas');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('empresas');
        expect(res.body).toHaveProperty('hayMasPaginas');
        expect(Array.isArray(res.body.empresas)).toBe(true);
    });

    test('incluye la empresa de prueba creada en beforeAll', async () => {
        const res = await request(buildApp()).get('/services/get-empresas');
        expect(res.status).toBe(200);
        const nombres = res.body.empresas.map(e => e.nombre);
        expect(nombres).toContain('EmpresaTestJest');
    });

    test('filtra correctamente por nombre', async () => {
        const res = await request(buildApp()).get('/services/get-empresas?nombre=EmpresaTestJest');
        expect(res.status).toBe(200);
        expect(res.body.empresas.length).toBeGreaterThanOrEqual(1);
        res.body.empresas.forEach(e => expect(e.nombre).toContain('EmpresaTestJest'));
    });

    test('filtra correctamente por tipoEmpresa', async () => {
        const res = await request(buildApp()).get('/services/get-empresas?tipoEmpresa=veterinaria');
        expect(res.status).toBe(200);
        res.body.empresas.forEach(e => expect(e.tipo).toBe('veterinaria'));
    });

    test('devuelve empresas sin sesión (ruta pública)', async () => {
        const res = await request(buildAppSinSesion()).get('/services/get-empresas');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('empresas');
    });
});



// POST /services/empresa/valorar

describe('POST /services/empresa/valorar – validaciones', () => {
    test('rechaza con 400 cuando empresa_id falta', async () => {
        const res = await request(buildApp())
            .post('/services/empresa/valorar')
            .send({ puntuacion: 4 });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando puntuacion es 0', async () => {
        const res = await request(buildApp())
            .post('/services/empresa/valorar')
            .send({ empresa_id: String(testEmpresaId), puntuacion: 0 });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando puntuacion es 6', async () => {
        const res = await request(buildApp())
            .post('/services/empresa/valorar')
            .send({ empresa_id: String(testEmpresaId), puntuacion: 6 });
        expect(res.status).toBe(400);
    });
});

describe('POST /services/empresa/valorar – BD real', () => {
    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post('/services/empresa/valorar')
            .send({ empresa_id: String(testEmpresaId), puntuacion: 4 });
        expect(res.status).toBe(500);
    });

    test('guarda la valoración de empresa correctamente', async () => {
        const res = await request(buildApp())
            .post('/services/empresa/valorar')
            .send({ empresa_id: String(testEmpresaId), puntuacion: 5, comentario: 'Excelente servicio' });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        const [rows] = await db.query(
            'SELECT * FROM valoraciones WHERE id_autor = ? AND id_empresa = ?',
            [testUserId, testEmpresaId]
        );
        expect(rows.length).toBe(1);
        expect(rows[0].puntuacion).toBe(5);
    });

    test('devuelve 409 cuando el usuario ya ha valorado esa empresa', async () => {
        await db.query(
            'INSERT INTO valoraciones (puntuacion, id_autor, id_empresa) VALUES (?,?,?)',
            [3, testUserId, testEmpresaId]
        );

        const res = await request(buildApp())
            .post('/services/empresa/valorar')
            .send({ empresa_id: String(testEmpresaId), puntuacion: 4 });
        expect(res.status).toBe(409);
    });
});



// POST /services/usuario/reportar

describe('POST /services/usuario/reportar – validaciones', () => {
    test('rechaza con 400 cuando id_usuario_reportado no es válido', async () => {
        const res = await request(buildApp())
            .post('/services/usuario/reportar')
            .send({ id_usuario_reportado: 'abc', motivo: 'spam' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el usuario intenta reportarse a sí mismo', async () => {
        const res = await request(buildApp())
            .post('/services/usuario/reportar')
            .send({ id_usuario_reportado: String(testUserId), motivo: 'spam' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el motivo no es válido', async () => {
        const res = await request(buildApp())
            .post('/services/usuario/reportar')
            .send({ id_usuario_reportado: String(testUser2Id), motivo: 'motivo_invalido' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el motivo falta', async () => {
        const res = await request(buildApp())
            .post('/services/usuario/reportar')
            .send({ id_usuario_reportado: String(testUser2Id) });
        expect(res.status).toBe(400);
    });
});

describe('POST /services/usuario/reportar – BD real', () => {
    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post('/services/usuario/reportar')
            .send({ id_usuario_reportado: String(testUser2Id), motivo: 'spam' });
        expect(res.status).toBe(500);
    });

    test('guarda el reporte correctamente en BD', async () => {
        const res = await request(buildApp())
            .post('/services/usuario/reportar')
            .send({ id_usuario_reportado: String(testUser2Id), motivo: 'spam', descripcion: 'Descripción del reporte' });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        const [rows] = await db.query(
            'SELECT * FROM reportes WHERE id_autor = ? AND id_usuario_reportado = ?',
            [testUserId, testUser2Id]
        );
        expect(rows.length).toBe(1);
        expect(rows[0].motivo).toBe('spam');
        expect(rows[0].estado).toBe('pendiente');
    });

    test('devuelve 409 cuando ya existe un reporte previo del mismo autor al mismo usuario', async () => {
        await db.query(
            `INSERT INTO reportes (motivo, estado, fecha, id_autor, id_usuario_reportado)
             VALUES (?,?,NOW(),?,?)`,
            ['spam', 'pendiente', testUserId, testUser2Id]
        );

        const res = await request(buildApp())
            .post('/services/usuario/reportar')
            .send({ id_usuario_reportado: String(testUser2Id), motivo: 'spam' });
        expect(res.status).toBe(409);
    });

    test('permite reportar con cada uno de los motivos válidos', async () => {
        const motivos = ['spam', 'lenguaje_ofensivo', 'contenido_inapropiado', 'informacion_falsa'];
        for (const motivo of motivos) {
            // Borrar reporte previo para este par (autor, reportado)
            await db.query(
                'DELETE FROM reportes WHERE id_autor = ? AND id_usuario_reportado = ?',
                [testUserId, testUser2Id]
            );
            const res = await request(buildApp())
                .post('/services/usuario/reportar')
                .send({ id_usuario_reportado: String(testUser2Id), motivo });
            expect(res.status).toBe(200);
        }
    });
});


// GET /services/citas (citasController)

describe('GET /services/citas', () => {
    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp()).get('/services/citas');
        expect(res.status).toBe(500);
    });

    test('devuelve 200 y renderiza la página de citas', async () => {
        const res = await request(buildApp()).get('/services/citas');
        expect(res.status).toBe(200);
    });

    test('sin sesión redirige a /auth/login', async () => {
        const res = await request(buildAppSinSesion()).get('/services/citas');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
    });

    test('usuario tipo empresa recibe 403', async () => {
        const res = await request(buildAppEmpresa()).get('/services/citas');
        expect(res.status).toBe(403);
    });
});


// PUT /services/citas/:id/cancelar (citasController)

describe('PUT /services/citas/:id/cancelar', () => {
    let testReservaId;

    beforeEach(async () => {
        const [rr] = await db.query(
            `INSERT INTO reservas (id_cliente, id_proveedor, id_chat, fecha, hora_inicio, hora_fin, precio_hora, activo)
             VALUES (?,?,?,?,?,?,?,1)`,
            [testUserId, testUser2Id, testChatId, '2025-12-01', '09:00:00', '17:00:00', 15]
        );
        testReservaId = rr.insertId;
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        await db.query('DELETE FROM reservas WHERE id_reserva = ?', [testReservaId]);
    });

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .put(`/services/citas/${testReservaId}/cancelar`);
        expect(res.status).toBe(500);
    });

    test('cancela la cita correctamente (activo=0)', async () => {
        const res = await request(buildApp())
            .put(`/services/citas/${testReservaId}/cancelar`);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        const [rows] = await db.query(
            'SELECT activo FROM reservas WHERE id_reserva = ?',
            [testReservaId]
        );
        expect(rows[0].activo).toBe(0);
    });

    test('devuelve 403 si el usuario no es cliente ni proveedor de la cita', async () => {
        const [otroUsuario] = await db.query(
            `INSERT INTO usuarios (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña)
             VALUES (?,?,?,?,?,?)`,
            ['testserv3', 'Test Serv 3', '1992-03-03', 333333333, 'testservices3@jest.com', 'hash3']
        );

        const otroId = otroUsuario.insertId;
        const otroUsuarioObj = { id: otroId, tipo: 'usuario', rol: 'user', nombre_usuario: 'testserv3' };

        const appOtro = express();
        appOtro.set('view engine', 'ejs');
        appOtro.set('views', path.join(__dirname, '../../views'));
        appOtro.use(express.urlencoded({ extended: true }));
        appOtro.use(express.json());
        appOtro.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
        appOtro.use((req, res, next) => { res.locals.usuario = req.session.usuario || null; next(); });
        appOtro.use((req, res, next) => { req.session.usuario = otroUsuarioObj; next(); });
        appOtro.use('/services', servicesRouter);
        appOtro.use((err, req, res, next) => {
            res.status(err.status || err.statusCode || 500).json({ error: err.message });
        });

        const res = await request(appOtro).put(`/services/citas/${testReservaId}/cancelar`);
        expect(res.status).toBe(403);

        await db.query('DELETE FROM usuarios WHERE id_usuario = ?', [otroId]);
    });

    test('también puede cancelar el proveedor de la cita', async () => {
        const res = await request(buildAppUser2())
            .put(`/services/citas/${testReservaId}/cancelar`);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});


// GET /services/mis-chats y GET /services/mis-chats/data (chatController)

describe('GET /services/mis-chats', () => {
    test('devuelve 200 con sesión válida', async () => {
        const res = await request(buildApp()).get('/services/mis-chats');
        expect(res.status).toBe(200);
    });

    test('sin sesión redirige a /auth/login', async () => {
        const res = await request(buildAppSinSesion()).get('/services/mis-chats');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
    });
});

describe('GET /services/mis-chats/data', () => {
    test('devuelve 400 cuando tipo no es válido', async () => {
        const res = await request(buildApp()).get('/services/mis-chats/data?tipo=invalido');
        expect(res.status).toBe(400);
    });

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp()).get('/services/mis-chats/data?tipo=iniciados');
        expect(res.status).toBe(500);
    });

    test('devuelve JSON con chats y hayMas para tipo=iniciados', async () => {
        const res = await request(buildApp()).get('/services/mis-chats/data?tipo=iniciados');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('chats');
        expect(res.body).toHaveProperty('hayMas');
        expect(Array.isArray(res.body.chats)).toBe(true);
    });

    test('devuelve JSON con chats para tipo=recibidos', async () => {
        const res = await request(buildApp()).get('/services/mis-chats/data?tipo=recibidos');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('chats');
    });

    test('testUser1 aparece como iniciador del chat con el anuncio de testUser2', async () => {
        const res = await request(buildApp()).get('/services/mis-chats/data?tipo=iniciados');
        expect(res.status).toBe(200);
        const ids = res.body.chats.map(c => c.id_chat);
        expect(ids).toContain(testChatId);
    });

    test('testUser2 aparece como receptor del chat (tipo=recibidos)', async () => {
        const res = await request(buildAppUser2()).get('/services/mis-chats/data?tipo=recibidos');
        expect(res.status).toBe(200);
        const ids = res.body.chats.map(c => c.id_chat);
        expect(ids).toContain(testChatId);
    });

    test('devuelve chats archivados cuando archivados=1', async () => {
        await db.query('UPDATE chats SET activo = 0 WHERE id_chat = ?', [testChatId]);
        const res = await request(buildApp()).get('/services/mis-chats/data?tipo=iniciados&archivados=1');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('chats');
    });
});



// PUT /services/mis-chats/:id/eliminar (chatController)

describe('PUT /services/mis-chats/:id/eliminar', () => {
    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .put(`/services/mis-chats/${testChatId}/eliminar`);
        expect(res.status).toBe(500);
    });

    test('devuelve 403 cuando el usuario no es participante del chat', async () => {
        const [otroUsuario] = await db.query(
            `INSERT INTO usuarios (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña)
             VALUES (?,?,?,?,?,?)`,
            ['testserv4', 'Test Serv 4', '1993-04-04', 444444444, 'testservices4@jest.com', 'hash4']
        );
        const otroId = otroUsuario.insertId;
        const otroObj = { id: otroId, tipo: 'usuario', rol: 'user', nombre_usuario: 'testserv4' };

        const appOtro = express();
        appOtro.set('view engine', 'ejs');
        appOtro.set('views', path.join(__dirname, '../../views'));
        appOtro.use(express.urlencoded({ extended: true }));
        appOtro.use(express.json());
        appOtro.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
        appOtro.use((req, res, next) => { res.locals.usuario = req.session.usuario || null; next(); });
        appOtro.use((req, res, next) => { req.session.usuario = otroObj; next(); });
        appOtro.use('/services', servicesRouter);
        appOtro.use((err, req, res, next) => {
            res.status(err.status || err.statusCode || 500).json({ error: err.message });
        });

        const res = await request(appOtro).put(`/services/mis-chats/${testChatId}/eliminar`);
        expect(res.status).toBe(403);

        await db.query('DELETE FROM usuarios WHERE id_usuario = ?', [otroId]);
    });

    test('archiva el chat correctamente (activo=0)', async () => {
        const res = await request(buildApp())
            .put(`/services/mis-chats/${testChatId}/eliminar`);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        const [rows] = await db.query(
            'SELECT activo FROM chats WHERE id_chat = ?',
            [testChatId]
        );
        expect(rows[0].activo).toBe(0);
    });
});



// GET /services/chat (chatController)

describe('GET /services/chat', () => {
    test('devuelve 400 cuando falta usuario_id', async () => {
        const res = await request(buildApp())
            .get(`/services/chat?anuncio_id=${testAnuncioId}`);
        expect(res.status).toBe(400);
    });

    test('devuelve 400 cuando falta anuncio_id', async () => {
        const res = await request(buildApp())
            .get(`/services/chat?usuario_id=${testUser2Id}`);
        expect(res.status).toBe(400);
    });

    test('devuelve 400 cuando el usuario intenta chatear consigo mismo', async () => {
        const res = await request(buildApp())
            .get(`/services/chat?usuario_id=${testUserId}&anuncio_id=${testAnuncioId}`);
        expect(res.status).toBe(400);
    });

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .get(`/services/chat?usuario_id=${testUser2Id}&anuncio_id=${testAnuncioId}`);
        expect(res.status).toBe(500);
    });

    test('devuelve 404 cuando el usuario destino no existe', async () => {
        const res = await request(buildApp())
            .get(`/services/chat?usuario_id=999999&anuncio_id=${testAnuncioId}`);
        expect(res.status).toBe(404);
    });

    test('devuelve 404 cuando el anuncio no existe', async () => {
        const res = await request(buildApp())
            .get(`/services/chat?usuario_id=${testUser2Id}&anuncio_id=999999`);
        expect(res.status).toBe(404);
    });

    test('devuelve 200 y renderiza el chat correctamente', async () => {
        const res = await request(buildApp())
            .get(`/services/chat?usuario_id=${testUser2Id}&anuncio_id=${testAnuncioId}`);
        expect(res.status).toBe(200);
    });

    test('sin sesión redirige a /auth/login', async () => {
        const res = await request(buildAppSinSesion())
            .get(`/services/chat?usuario_id=${testUser2Id}&anuncio_id=${testAnuncioId}`);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
    });
});



// GET /services/chat/historial (chatController)

describe('GET /services/chat/historial', () => {
    test('devuelve 400 cuando faltan parámetros', async () => {
        const res = await request(buildApp()).get('/services/chat/historial');
        expect(res.status).toBe(400);
    });

    test('devuelve 400 cuando falta antes_de', async () => {
        const res = await request(buildApp())
            .get(`/services/chat/historial?chat_id=${testChatId}`);
        expect(res.status).toBe(400);
    });

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .get(`/services/chat/historial?chat_id=${testChatId}&antes_de=999999`);
        expect(res.status).toBe(500);
    });

    test('devuelve 403 si el usuario no es participante del chat', async () => {
        const [otroUsuario] = await db.query(
            `INSERT INTO usuarios (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña)
             VALUES (?,?,?,?,?,?)`,
            ['testserv5', 'Test Serv 5', '1994-05-05', 555555555, 'testservices5@jest.com', 'hash5']
        );
        const otroId = otroUsuario.insertId;
        const otroObj = { id: otroId, tipo: 'usuario', rol: 'user', nombre_usuario: 'testserv5' };

        const appOtro = express();
        appOtro.set('view engine', 'ejs');
        appOtro.set('views', path.join(__dirname, '../../views'));
        appOtro.use(express.urlencoded({ extended: true }));
        appOtro.use(express.json());
        appOtro.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
        appOtro.use((req, res, next) => { res.locals.usuario = req.session.usuario || null; next(); });
        appOtro.use((req, res, next) => { req.session.usuario = otroObj; next(); });
        appOtro.use('/services', servicesRouter);
        appOtro.use((err, req, res, next) => {
            res.status(err.status || err.statusCode || 500).json({ error: err.message });
        });

        const res = await request(appOtro)
            .get(`/services/chat/historial?chat_id=${testChatId}&antes_de=999999`);
        expect(res.status).toBe(403);

        await db.query('DELETE FROM usuarios WHERE id_usuario = ?', [otroId]);
    });

    test('devuelve JSON con mensajes y hayMas para un participante válido', async () => {
        const res = await request(buildApp())
            .get(`/services/chat/historial?chat_id=${testChatId}&antes_de=999999`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('mensajes');
        expect(res.body).toHaveProperty('hayMas');
        expect(Array.isArray(res.body.mensajes)).toBe(true);
    });

    test('devuelve solo mensajes anteriores al id indicado', async () => {
        const [m1] = await db.query(
            'INSERT INTO mensajes (tipo_mensaje, contenido, id_chat, id_usuario) VALUES (?,?,?,?)',
            ['texto', 'Mensaje antiguo', testChatId, testUserId]
        );
        const [m2] = await db.query(
            'INSERT INTO mensajes (tipo_mensaje, contenido, id_chat, id_usuario) VALUES (?,?,?,?)',
            ['texto', 'Mensaje nuevo', testChatId, testUserId]
        );

        const res = await request(buildApp())
            .get(`/services/chat/historial?chat_id=${testChatId}&antes_de=${m2.insertId}`);
        expect(res.status).toBe(200);
        const ids = res.body.mensajes.map(m => m.id_mensaje);
        expect(ids).toContain(m1.insertId);
        expect(ids).not.toContain(m2.insertId);

        await db.query('DELETE FROM mensajes WHERE id_mensaje IN (?,?)', [m1.insertId, m2.insertId]);
    });
});



// GET /services/chat/archivado (chatController)

describe('GET /services/chat/archivado', () => {
    test('devuelve 400 cuando falta chat_id', async () => {
        const res = await request(buildApp()).get('/services/chat/archivado');
        expect(res.status).toBe(400);
    });

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .get(`/services/chat/archivado?chat_id=${testChatId}`);
        expect(res.status).toBe(500);
    });

    test('devuelve 404 cuando el chat no existe o el usuario no es participante', async () => {
        const res = await request(buildApp())
            .get('/services/chat/archivado?chat_id=999999');
        expect(res.status).toBe(404);
    });

    test('devuelve 200 y renderiza el chat archivado correctamente', async () => {
        // Archivar el chat para este test
        await db.query('UPDATE chats SET activo = 0 WHERE id_chat = ?', [testChatId]);

        const res = await request(buildApp())
            .get(`/services/chat/archivado?chat_id=${testChatId}`);
        expect(res.status).toBe(200);
    });

    test('sin sesión redirige a /auth/login', async () => {
        const res = await request(buildAppSinSesion())
            .get(`/services/chat/archivado?chat_id=${testChatId}`);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
    });
});



// POST /services/chat/valorar (chatController)

describe('POST /services/chat/valorar', () => {
    test('devuelve 400 cuando puntuacion está fuera de rango', async () => {
        const res = await request(buildApp())
            .post('/services/chat/valorar')
            .send({ chat_id: String(testChatId), puntuacion: 6 });
        expect(res.status).toBe(400);
    });

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post('/services/chat/valorar')
            .send({ chat_id: String(testChatId), puntuacion: 4 });
        expect(res.status).toBe(500);
    });

    test('devuelve 403 cuando ambos usuarios no han finalizado el servicio', async () => {
        const res = await request(buildApp())
            .post('/services/chat/valorar')
            .send({ chat_id: String(testChatId), puntuacion: 4 });
        expect(res.status).toBe(403);
    });

    test('guarda la valoración cuando ambos usuarios han finalizado', async () => {
        await db.query(
            'UPDATE chats SET finalizar_usuario1 = 1, finalizar_usuario2 = 1 WHERE id_chat = ?',
            [testChatId]
        );

        const res = await request(buildApp())
            .post('/services/chat/valorar')
            .send({ chat_id: String(testChatId), puntuacion: 5, comentario: 'Muy bien' });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        const [rows] = await db.query(
            'SELECT * FROM valoraciones WHERE id_autor = ? AND id_chat = ?',
            [testUserId, testChatId]
        );
        expect(rows.length).toBe(1);
        expect(rows[0].puntuacion).toBe(5);
    });

    test('devuelve 409 cuando el usuario ya ha valorado este chat', async () => {
        await db.query(
            'UPDATE chats SET finalizar_usuario1 = 1, finalizar_usuario2 = 1 WHERE id_chat = ?',
            [testChatId]
        );
        await db.query(
            'INSERT INTO valoraciones (puntuacion, id_autor, id_destinatario, id_chat) VALUES (?,?,?,?)',
            [4, testUserId, testUser2Id, testChatId]
        );

        const res = await request(buildApp())
            .post('/services/chat/valorar')
            .send({ chat_id: String(testChatId), puntuacion: 5 });
        expect(res.status).toBe(409);
    });
});
