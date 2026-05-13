"use strict";

// ******************************************************************************
// Tests de integración completos: HTTP → router → middleware → controlador → BD real.
// Cubre userController: perfil usuario/empresa, edición, eliminación y reportes.
// Requiere XAMPP corriendo con la BD petcare_test creada.
// Ejecutar con: npm run test:db
// ******************************************************************************

const request    = require('supertest');
const express    = require('express');
const session    = require('express-session');
const path       = require('path');
const bcrypt     = require('bcrypt');
const pool       = require('../../db');
const userRouter = require('../../routes/userRouter');

const db = pool.promise();

let testUserId;
let testUser2Id;
let testInactiveUserId;
let testEliminableUserId;
let testEmpresaId;
let testEmpresa2Id;
let testInactiveEmpresaId;
let testEliminableEmpresaId;
let testValoracionId;
let hashInicial;

// IDs de entidades insertadas y borradas de BD antes de los tests.
// Permiten simular sesiones cuyo propietario ya no existe en BD (→ 404 en el controlador)
// sin que el middleware de autorización bloquee la petición (id de sesión === id del parámetro).
let ghostUserId;
let ghostEmpresaId;

// ─────────────────────────────────────────────
// App builders
// ─────────────────────────────────────────────

/** App sin sesión activa (para rutas sin autenticación o tests de denegación). */
function buildApp() {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => { res.locals.usuario = req.session.usuario || null; next(); });
    app.use('/user', userRouter);
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message, codigo: err.codigo || null });
    });
    return app;
}

/** App con sesión del testUserId (usuario activo, propietario de su perfil). */
function buildAppConSesionUsuario() {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
        req.session.usuario = { id: testUserId, tipo: 'usuario', rol: 'user', nombre_usuario: 'testuser1' };
        res.locals.usuario = req.session.usuario;
        next();
    });
    app.use('/user', userRouter);
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message, codigo: err.codigo || null });
    });
    return app;
}

/** App con sesión del testEmpresaId (empresa activa, propietaria de su perfil). */
function buildAppConSesionEmpresa() {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
        req.session.usuario = { id: testEmpresaId, tipo: 'empresa', rol: 'empresa', nombre: 'EmpresaUserTest' };
        res.locals.usuario = req.session.usuario;
        next();
    });
    app.use('/user', userRouter);
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message, codigo: err.codigo || null });
    });
    return app;
}

/** App con sesión del usuario eliminable (id independiente, para tests de soft-delete). */
function buildAppConSesionUsuarioEliminable() {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
        req.session.usuario = { id: testEliminableUserId, tipo: 'usuario', rol: 'user', nombre_usuario: 'testuser_elim' };
        res.locals.usuario = req.session.usuario;
        next();
    });
    app.use('/user', userRouter);
    // Stub mínimo del router de auth para absorber el redirect a /auth/logout
    app.use('/auth', (req, res) => res.status(200).send('logout-ok'));
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message, codigo: err.codigo || null });
    });
    return app;
}

/** App con sesión de empresa eliminable (id independiente, para tests de soft-delete). */
function buildAppConSesionEmpresaEliminable() {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
        req.session.usuario = { id: testEliminableEmpresaId, tipo: 'empresa', rol: 'empresa', nombre: 'EmpresaElim' };
        res.locals.usuario = req.session.usuario;
        next();
    });
    app.use('/user', userRouter);
    app.use('/auth', (req, res) => res.status(200).send('logout-ok'));
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message, codigo: err.codigo || null });
    });
    return app;
}

/**
 * App con sesión de un usuario fantasma (ghostUserId).
 * El usuario ya no existe en BD, pero el id de sesión coincide con el parámetro de ruta,
 * por lo que canViewUserProfile deja pasar la petición y el controlador devuelve 404.
 */
function buildAppConSesionUsuarioFantasma() {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
        req.session.usuario = { id: ghostUserId, tipo: 'usuario', rol: 'user', nombre_usuario: 'ghostuser' };
        res.locals.usuario = req.session.usuario;
        next();
    });
    app.use('/user', userRouter);
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message, codigo: err.codigo || null });
    });
    return app;
}

/**
 * App con sesión de una empresa fantasma (ghostEmpresaId).
 * La empresa ya no existe en BD, pero el id de sesión coincide con el parámetro de ruta,
 * por lo que canViewCompanyProfile deja pasar la petición y el controlador devuelve 404.
 */
function buildAppConSesionEmpresaFantasma() {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
        req.session.usuario = { id: ghostEmpresaId, tipo: 'empresa', rol: 'empresa', nombre: 'GhostEmpresa' };
        res.locals.usuario = req.session.usuario;
        next();
    });
    app.use('/user', userRouter);
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message, codigo: err.codigo || null });
    });
    return app;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const simularErrorConexion = () =>
    jest.spyOn(pool, 'getConnection')
        .mockImplementation((cb) => cb(new Error('DB connection error')));

// ─────────────────────────────────────────────
// Ciclo de vida
// ─────────────────────────────────────────────

beforeAll(async () => {
    hashInicial = await bcrypt.hash('Password1', 10);

    // Limpiar posibles restos de ejecuciones anteriores
    await db.query(
        `DELETE FROM usuarios WHERE correo IN (
            'testuser1@jest.com','testuser2@jest.com',
            'testuser_inactive@jest.com','testuser_elim@jest.com',
            'ghostuser@jest.com'
        )`
    );
    await db.query(
        `DELETE FROM empresas WHERE correo IN (
            'testempresa1@jest.com','testempresa2@jest.com',
            'testempresa_inactive@jest.com','testempresa_elim@jest.com',
            'ghostempresa@jest.com'
        )`
    );

    // Usuario activo principal (propietario de su perfil en los tests de edición)
    const [r1] = await db.query(
        `INSERT INTO usuarios
            (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña, activo, ban, suspendido)
         VALUES (?,?,?,?,?,?,1,0,null)`,
        ['testuser1', 'Test User Uno', '1990-05-15', 630000001, 'testuser1@jest.com', hashInicial]
    );
    testUserId = r1.insertId;

    // Segundo usuario activo (para tests de conflictos de correo/username/teléfono)
    const [r2] = await db.query(
        `INSERT INTO usuarios
            (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña, activo, ban, suspendido)
         VALUES (?,?,?,?,?,?,1,0,null)`,
        ['testuser2', 'Test User Dos', '1992-03-10', 630000002, 'testuser2@jest.com', hashInicial]
    );
    testUser2Id = r2.insertId;

    // Usuario inactivo (para tests de 403 en GET perfil)
    const [r3] = await db.query(
        `INSERT INTO usuarios
            (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña, activo, ban, suspendido)
         VALUES (?,?,?,?,?,?,0,0,null)`,
        ['testuser_inactive', 'Test User Inactive', '1990-01-01', 630000003, 'testuser_inactive@jest.com', hashInicial]
    );
    testInactiveUserId = r3.insertId;

    // Usuario exclusivo para tests de eliminación (se restaura en afterEach)
    const [r4] = await db.query(
        `INSERT INTO usuarios
            (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña, activo, ban, suspendido)
         VALUES (?,?,?,?,?,?,1,0,null)`,
        ['testuser_elim', 'Test User Elim', '1990-01-01', 630000004, 'testuser_elim@jest.com', hashInicial]
    );
    testEliminableUserId = r4.insertId;

    // Empresa activa principal
    const [e1] = await db.query(
        `INSERT INTO empresas (nombre, correo, contraseña, CIF, telefono_contacto, tipo, activo)
         VALUES (?,?,?,?,?,?,1)`,
        ['EmpresaUserTest', 'testempresa1@jest.com', hashInicial, 'C11111111', 640000001, 'clinica_veterinaria']
    );
    testEmpresaId = e1.insertId;

    // Segunda empresa activa (para tests de conflictos de correo/CIF)
    const [e2] = await db.query(
        `INSERT INTO empresas (nombre, correo, contraseña, CIF, telefono_contacto, tipo, activo)
         VALUES (?,?,?,?,?,?,1)`,
        ['EmpresaUserTest2', 'testempresa2@jest.com', hashInicial, 'C22222222', 640000002, 'clinica_veterinaria']
    );
    testEmpresa2Id = e2.insertId;

    // Empresa inactiva (para tests de 403 en GET perfil)
    const [e3] = await db.query(
        `INSERT INTO empresas (nombre, correo, contraseña, CIF, telefono_contacto, tipo, activo)
         VALUES (?,?,?,?,?,?,0)`,
        ['EmpresaInactiva', 'testempresa_inactive@jest.com', hashInicial, 'C33333333', 640000003, 'clinica_veterinaria']
    );
    testInactiveEmpresaId = e3.insertId;

    // Empresa exclusiva para tests de eliminación (se restaura en afterEach)
    const [e4] = await db.query(
        `INSERT INTO empresas (nombre, correo, contraseña, CIF, telefono_contacto, tipo, activo)
         VALUES (?,?,?,?,?,?,1)`,
        ['EmpresaElim', 'testempresa_elim@jest.com', hashInicial, 'C44444444', 640000004, 'clinica_veterinaria']
    );
    testEliminableEmpresaId = e4.insertId;

    // Usuario fantasma: se inserta para obtener un ID real autoincremental y se borra
    // inmediatamente. La sesión buildAppConSesionUsuarioFantasma usa ese ID, lo que permite
    // superar canViewUserProfile (propietario) y que el controlador devuelva 404.
    const [rGhost] = await db.query(
        `INSERT INTO usuarios
            (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña, activo, ban, suspendido)
         VALUES (?,?,?,?,?,?,1,0,null)`,
        ['ghostuser', 'Ghost User', '1990-01-01', 639999999, 'ghostuser@jest.com', hashInicial]
    );
    ghostUserId = rGhost.insertId;
    await db.query('DELETE FROM usuarios WHERE id_usuario = ?', [ghostUserId]);

    // Empresa fantasma: misma estrategia para canViewCompanyProfile.
    const [eGhost] = await db.query(
        `INSERT INTO empresas (nombre, correo, contraseña, CIF, telefono_contacto, tipo, activo)
         VALUES (?,?,?,?,?,?,1)`,
        ['GhostEmpresa', 'ghostempresa@jest.com', hashInicial, 'C99999999', 649999999, 'clinica_veterinaria']
    );
    ghostEmpresaId = eGhost.insertId;
    await db.query('DELETE FROM empresas WHERE id_empresa = ?', [ghostEmpresaId]);

    // Valoración de testUser2 hacia testUser1 (para los tests de reportar)
    const [v1] = await db.query(
        `INSERT INTO valoraciones (puntuacion, comentario, id_autor, id_destinatario)
         VALUES (?,?,?,?)`,
        [5, 'Muy buen usuario', testUser2Id, testUserId]
    );
    testValoracionId = v1.insertId;
});

afterEach(async () => {
    jest.restoreAllMocks();

    // Restaurar activo de usuarios y empresas que los tests de eliminación desactivan
    await db.query('UPDATE usuarios SET activo = 1 WHERE id_usuario = ?', [testEliminableUserId]);
    await db.query('UPDATE empresas SET activo = 1 WHERE id_empresa = ?', [testEliminableEmpresaId]);

    // Restaurar datos editables de testUser1 y testEmpresa1 para evitar contaminación entre tests
    await db.query(
        `UPDATE usuarios SET
            nombre_usuario = ?, nombre_completo = ?, correo = ?,
            telefono = ?, contraseña = ?, bio = NULL, ciudad = NULL,
            pais = NULL, genero = NULL, trabajo = NULL
         WHERE id_usuario = ?`,
        ['testuser1', 'Test User Uno', 'testuser1@jest.com', 630000001, hashInicial, testUserId]
    );
    await db.query(
        `UPDATE empresas SET
            nombre = ?, correo = ?, telefono_contacto = ?, CIF = ?,
            tipo = ?, tipo_otro = NULL, ubicacion = NULL, descripcion = NULL,
            contraseña = ?
         WHERE id_empresa = ?`,
        ['EmpresaUserTest', 'testempresa1@jest.com', 640000001, 'C11111111', 'clinica_veterinaria', hashInicial, testEmpresaId]
    );

    // Limpiar reportes generados durante los tests
    await db.query('DELETE FROM reportes WHERE id_valoracion = ?', [testValoracionId]);
});

afterAll(async () => {
    await db.query('DELETE FROM valoraciones WHERE id_valoracion = ?', [testValoracionId]);
    await db.query('DELETE FROM usuarios WHERE id_usuario IN (?,?,?,?)', [
        testUserId, testUser2Id, testInactiveUserId, testEliminableUserId
    ]);
    await db.query('DELETE FROM empresas WHERE id_empresa IN (?,?,?,?)', [
        testEmpresaId, testEmpresa2Id, testInactiveEmpresaId, testEliminableEmpresaId
    ]);
    await new Promise((resolve, reject) =>
        pool.end(err => (err ? reject(err) : resolve()))
    );
});


// ─────────────────────────────────────────────
// GET /user/perfilUsuario/:id
// ─────────────────────────────────────────────

describe('GET /user/perfilUsuario/:id', () => {
    test('devuelve 200 y renderiza el perfil cuando el usuario existe y está activo', async () => {
        const res = await request(buildAppConSesionUsuario())
            .get(`/user/perfilUsuario/${testUserId}`);
        expect(res.status).toBe(200);
        expect(res.text).toContain('testuser1');
    });

    test('devuelve 404 cuando el usuario no existe', async () => {
        const res = await request(buildAppConSesionUsuarioFantasma())
            .get(`/user/perfilUsuario/${ghostUserId}`);
        expect(res.status).toBe(404);
    });

    test('devuelve 403 cuando la cuenta del usuario está inactiva', async () => {
        const res = await request(buildAppConSesionUsuario())
            .get(`/user/perfilUsuario/${testInactiveUserId}`);
        expect(res.status).toBe(403);
    });

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildAppConSesionUsuario())
            .get(`/user/perfilUsuario/${testUserId}`);
        expect(res.status).toBe(500);
    });
});


// ─────────────────────────────────────────────
// GET /user/perfilEmpresa/:id
// ─────────────────────────────────────────────

describe('GET /user/perfilEmpresa/:id', () => {
    test('devuelve 200 y renderiza el perfil cuando la empresa existe y está activa', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .get(`/user/perfilEmpresa/${testEmpresaId}`);
        expect(res.status).toBe(200);
        expect(res.text).toContain('EmpresaUserTest');
    });

    test('devuelve 404 cuando la empresa no existe', async () => {
        const res = await request(buildAppConSesionEmpresaFantasma())
            .get(`/user/perfilEmpresa/${ghostEmpresaId}`);
        expect(res.status).toBe(404);
    });

    test('devuelve 403 cuando la cuenta de empresa está inactiva', async () => {
        const res = await request(buildAppConSesionUsuario())
            .get(`/user/perfilEmpresa/${testInactiveEmpresaId}`);
        expect(res.status).toBe(403);
    });

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildAppConSesionEmpresa())
            .get(`/user/perfilEmpresa/${testEmpresaId}`);
        expect(res.status).toBe(500);
    });
});


// ─────────────────────────────────────────────
// GET /user/perfilUsuario/:id/editar
// ─────────────────────────────────────────────

describe('GET /user/perfilUsuario/:id/editar', () => {
    test('devuelve 200 y renderiza el formulario cuando el usuario accede a su propio perfil', async () => {
        const res = await request(buildAppConSesionUsuario())
            .get(`/user/perfilUsuario/${testUserId}/editar`);
        expect(res.status).toBe(200);
    });

    test('devuelve 403 cuando un usuario intenta acceder al formulario de edición de otro', async () => {
        const res = await request(buildAppConSesionUsuario())
            .get(`/user/perfilUsuario/${testUser2Id}/editar`);
        expect(res.status).toBe(403);
    });

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildAppConSesionUsuario())
            .get(`/user/perfilUsuario/${testUserId}/editar`);
        expect(res.status).toBe(500);
    });
});


// ─────────────────────────────────────────────
// GET /user/perfilEmpresa/:id/editar
// ─────────────────────────────────────────────

describe('GET /user/perfilEmpresa/:id/editar', () => {
    test('devuelve 200 y renderiza el formulario cuando la empresa accede a su propio perfil', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .get(`/user/perfilEmpresa/${testEmpresaId}/editar`);
        expect(res.status).toBe(200);
    });

    test('devuelve 403 cuando una empresa intenta acceder al formulario de edición de otra', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .get(`/user/perfilEmpresa/${testEmpresa2Id}/editar`);
        expect(res.status).toBe(403);
    });

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildAppConSesionEmpresa())
            .get(`/user/perfilEmpresa/${testEmpresaId}/editar`);
        expect(res.status).toBe(500);
    });
});


// ─────────────────────────────────────────────
// POST /user/perfilUsuario/:id/editar – Validaciones
// ─────────────────────────────────────────────

describe('POST /user/perfilUsuario/:id/editar – validaciones de formulario', () => {
    const datosValidos = {
        nombre_completo:  'Test User Uno',
        nombre_usuario:   'testuser1',
        correo:           'testuser1@jest.com',
        telefono:         '630000001',
        fecha_nacimiento: '1990-05-15',
    };

    test('rechaza con 400 cuando nombre_completo está vacío', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, nombre_completo: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando nombre_completo tiene menos de 3 caracteres', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, nombre_completo: 'AB' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando nombre_usuario está vacío', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, nombre_usuario: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando nombre_usuario tiene menos de 3 caracteres', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, nombre_usuario: 'ab' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando nombre_usuario contiene espacios en blanco', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, nombre_usuario: 'test user' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el correo no es válido', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, correo: 'no-es-correo' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el teléfono tiene menos de 9 dígitos', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, telefono: '12345' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el teléfono supera los 15 dígitos', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, telefono: '1234567890123456' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el teléfono contiene letras', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, telefono: '63000abc1' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando la fecha de nacimiento no es válida', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, fecha_nacimiento: 'no-es-fecha' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando la edad es inferior a 14 años', async () => {
        const hoy = new Date();
        const fecha = `${hoy.getFullYear() - 10}-01-01`;
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, fecha_nacimiento: fecha });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando se envía password_nueva sin password_actual', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, password_nueva: 'NuevaClave1', password_confirmar: 'NuevaClave1' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando password_nueva tiene menos de 8 caracteres', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, password_actual: 'Password1', password_nueva: 'Clave1', password_confirmar: 'Clave1' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando password_nueva no tiene mayúsculas', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, password_actual: 'Password1', password_nueva: 'nuevaclave1', password_confirmar: 'nuevaclave1' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando password_nueva no tiene números', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, password_actual: 'Password1', password_nueva: 'NuevaClaveS', password_confirmar: 'NuevaClaveS' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando password_nueva contiene espacios', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, password_actual: 'Password1', password_nueva: 'Nueva Clave1', password_confirmar: 'Nueva Clave1' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando password_confirmar no coincide con password_nueva', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, password_actual: 'Password1', password_nueva: 'NuevaClave1', password_confirmar: 'OtraClave1' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando genero no es un valor permitido', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, genero: 'invalido' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando bio tiene menos de 2 caracteres', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, bio: 'X' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando bio supera 255 caracteres', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, bio: 'A'.repeat(256) });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando trabajo supera 64 caracteres', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, trabajo: 'A'.repeat(65) });
        expect(res.status).toBe(400);
    });
});


// ─────────────────────────────────────────────
// POST /user/perfilUsuario/:id/editar – BD real
// ─────────────────────────────────────────────

describe('POST /user/perfilUsuario/:id/editar – BD real', () => {
    const datosValidos = {
        nombre_completo:  'Test User Uno',
        nombre_usuario:   'testuser1',
        correo:           'testuser1@jest.com',
        telefono:         '630000001',
        fecha_nacimiento: '1990-05-15',
    };

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send(datosValidos);
        expect(res.status).toBe(500);
    });

    test('renderiza error cuando el correo ya está en uso por otro usuario', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, correo: 'testuser2@jest.com' });
        expect(res.status).toBe(400);
        expect(res.text).toContain('correo');
    });

    test('renderiza error cuando el nombre de usuario ya está en uso por otro', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, nombre_usuario: 'testuser2' });
        expect(res.status).toBe(400);
        expect(res.text).toContain('usuario');
    });

    test('renderiza error cuando el teléfono ya está en uso por otro usuario', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, telefono: '630000002' });
        expect(res.status).toBe(400);
        expect(res.text).toContain('teléfono');
    });

    test('renderiza error cuando la contraseña actual es incorrecta', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({
                ...datosValidos,
                password_actual:    'ClaveIncorrecta1',
                password_nueva:     'NuevaClave1',
                password_confirmar: 'NuevaClave1',
            });
        expect(res.status).toBe(400);
        expect(res.text).toContain('contraseña');
    });

    test('actualiza datos básicos correctamente y redirige al perfil', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, nombre_completo: 'Nombre Editado', bio: 'Mi nueva bio' });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(`/user/perfilUsuario/${testUserId}`);

        const [rows] = await db.query(
            'SELECT nombre_completo, bio FROM usuarios WHERE id_usuario = ?',
            [testUserId]
        );
        expect(rows[0].nombre_completo).toBe('Nombre Editado');
        expect(rows[0].bio).toBe('Mi nueva bio');
    });

    test('guarda campos opcionales válidos en BD', async () => {
        await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, ciudad: 'Madrid', pais: 'España', genero: 'hombre', trabajo: 'Desarrollador' });

        const [rows] = await db.query(
            'SELECT ciudad, pais, genero, trabajo FROM usuarios WHERE id_usuario = ?',
            [testUserId]
        );
        expect(rows[0].ciudad).toBe('Madrid');
        expect(rows[0].pais).toBe('España');
        expect(rows[0].genero).toBe('hombre');
        expect(rows[0].trabajo).toBe('Desarrollador');
    });

    test('actualiza la contraseña con hash correcto en BD', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({
                ...datosValidos,
                password_actual:    'Password1',
                password_nueva:     'NuevaClave1',
                password_confirmar: 'NuevaClave1',
            });
        expect(res.status).toBe(302);

        const [rows] = await db.query(
            'SELECT contraseña FROM usuarios WHERE id_usuario = ?',
            [testUserId]
        );
        expect(rows[0].contraseña).not.toBe('NuevaClave1');
        const match = await bcrypt.compare('NuevaClave1', rows[0].contraseña);
        expect(match).toBe(true);
    });

    test('mantiene la contraseña anterior cuando no se proporciona una nueva', async () => {
        await request(buildAppConSesionUsuario())
            .post(`/user/perfilUsuario/${testUserId}/editar`)
            .send({ ...datosValidos, nombre_completo: 'Sin Cambio Clave' });

        const [rows] = await db.query(
            'SELECT contraseña FROM usuarios WHERE id_usuario = ?',
            [testUserId]
        );
        const matchOriginal = await bcrypt.compare('Password1', rows[0].contraseña);
        expect(matchOriginal).toBe(true);
    });
});


// ─────────────────────────────────────────────
// POST /user/perfilEmpresa/:id/editar – Validaciones
// ─────────────────────────────────────────────

describe('POST /user/perfilEmpresa/:id/editar – validaciones de formulario', () => {
    const datosValidos = {
        nombre:            'EmpresaUserTest',
        correo:            'testempresa1@jest.com',
        telefono_contacto: '640000001',
        cif:               'C11111111',
        tipo:              'clinica_veterinaria',
        tipo_otro:         '',
    };

    test('rechaza con 400 cuando nombre está vacío', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, nombre: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando nombre tiene menos de 3 caracteres', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, nombre: 'AB' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el correo no es válido', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, correo: 'no-es-correo' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el correo está vacío', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, correo: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el teléfono contiene letras', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, telefono_contacto: '64000abc1' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el teléfono tiene menos de 9 dígitos', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, telefono_contacto: '12345' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el CIF tiene menos de 8 caracteres alfanuméricos', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, cif: 'C1234' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando tipo está vacío', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, tipo: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando tipo es "otro" y tipo_otro está vacío', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, tipo: 'otro', tipo_otro: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando tipo es "otro" y tipo_otro tiene menos de 5 caracteres', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, tipo: 'otro', tipo_otro: 'abc' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando descripcion tiene menos de 10 caracteres', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, descripcion: 'corta' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando descripcion supera 255 caracteres', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, descripcion: 'A'.repeat(256) });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando se envía password_nueva sin password_actual', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, password_nueva: 'NuevaClave1', password_confirmar: 'NuevaClave1' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando password_nueva no cumple los requisitos de seguridad', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, password_actual: 'Password1', password_nueva: 'sinmayus1', password_confirmar: 'sinmayus1' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando password_confirmar no coincide con password_nueva', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, password_actual: 'Password1', password_nueva: 'NuevaClave1', password_confirmar: 'OtraClave9' });
        expect(res.status).toBe(400);
    });
});


// ─────────────────────────────────────────────
// POST /user/perfilEmpresa/:id/editar – BD real
// ─────────────────────────────────────────────

describe('POST /user/perfilEmpresa/:id/editar – BD real', () => {
    const datosValidos = {
        nombre:            'EmpresaUserTest',
        correo:            'testempresa1@jest.com',
        telefono_contacto: '640000001',
        cif:               'C11111111',
        tipo:              'clinica_veterinaria',
        tipo_otro:         '',
    };

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send(datosValidos);
        expect(res.status).toBe(500);
    });

    test('renderiza error cuando el correo ya está en uso por otra empresa', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, correo: 'testempresa2@jest.com' });
        expect(res.status).toBe(400);
        expect(res.text).toContain('correo');
    });

    test('renderiza error cuando el CIF ya está registrado por otra empresa', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, cif: 'C22222222' });
        expect(res.status).toBe(400);
        expect(res.text).toContain('CIF');
    });

    test('renderiza error cuando la contraseña actual es incorrecta', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({
                ...datosValidos,
                password_actual:    'ClaveIncorrecta1',
                password_nueva:     'NuevaClave1',
                password_confirmar: 'NuevaClave1',
            });
        expect(res.status).toBe(400);
        expect(res.text).toContain('contraseña');
    });

    test('actualiza datos básicos correctamente y redirige al perfil', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, nombre: 'Empresa Editada', descripcion: 'Descripción actualizada ok' });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(`/user/perfilEmpresa/${testEmpresaId}`);

        const [rows] = await db.query(
            'SELECT nombre, descripcion FROM empresas WHERE id_empresa = ?',
            [testEmpresaId]
        );
        expect(rows[0].nombre).toBe('Empresa Editada');
        expect(rows[0].descripcion).toBe('Descripción actualizada ok');
    });

    test('normaliza el CIF a mayúsculas antes de guardarlo', async () => {
        await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, cif: 'c11111111' });

        const [rows] = await db.query(
            'SELECT CIF FROM empresas WHERE id_empresa = ?',
            [testEmpresaId]
        );
        expect(rows[0].CIF).toBe('C11111111');
    });

    test('guarda tipo_otro cuando tipo es "otro"', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, tipo: 'otro', tipo_otro: 'Guardería canina' });
        expect(res.status).toBe(302);

        const [rows] = await db.query(
            'SELECT tipo, tipo_otro FROM empresas WHERE id_empresa = ?',
            [testEmpresaId]
        );
        expect(rows[0].tipo).toBe('otro');
        expect(rows[0].tipo_otro).toBe('Guardería canina');
    });

    test('no guarda tipo_otro cuando tipo no es "otro"', async () => {
        await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, tipo: 'clinica_veterinaria', tipo_otro: 'Texto ignorado' });

        const [rows] = await db.query(
            'SELECT tipo_otro FROM empresas WHERE id_empresa = ?',
            [testEmpresaId]
        );
        expect(rows[0].tipo_otro).toBeNull();
    });

    test('actualiza la contraseña con hash correcto en BD', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({
                ...datosValidos,
                password_actual:    'Password1',
                password_nueva:     'NuevaClave1',
                password_confirmar: 'NuevaClave1',
            });
        expect(res.status).toBe(302);

        const [rows] = await db.query(
            'SELECT contraseña FROM empresas WHERE id_empresa = ?',
            [testEmpresaId]
        );
        expect(rows[0].contraseña).not.toBe('NuevaClave1');
        const match = await bcrypt.compare('NuevaClave1', rows[0].contraseña);
        expect(match).toBe(true);
    });

    test('mantiene la contraseña anterior cuando no se proporciona una nueva', async () => {
        await request(buildAppConSesionEmpresa())
            .post(`/user/perfilEmpresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos, nombre: 'Sin Cambio Clave' });

        const [rows] = await db.query(
            'SELECT contraseña FROM empresas WHERE id_empresa = ?',
            [testEmpresaId]
        );
        const matchOriginal = await bcrypt.compare('Password1', rows[0].contraseña);
        expect(matchOriginal).toBe(true);
    });
});


// ─────────────────────────────────────────────
// GET /user/eliminarCuentaUsuario/:id
// ─────────────────────────────────────────────

describe('GET /user/eliminarCuentaUsuario/:id', () => {
    test('desactiva la cuenta del usuario (activo = 0) y redirige a /auth/logout', async () => {
        const res = await request(buildAppConSesionUsuarioEliminable())
            .get(`/user/eliminarCuentaUsuario/${testEliminableUserId}`);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/logout');

        const [rows] = await db.query(
            'SELECT activo FROM usuarios WHERE id_usuario = ?',
            [testEliminableUserId]
        );
        expect(rows[0].activo).toBe(0);
    });

    test('devuelve 403 cuando un usuario intenta eliminar la cuenta de otro', async () => {
        const res = await request(buildAppConSesionUsuario())
            .get(`/user/eliminarCuentaUsuario/${testUser2Id}`);
        expect(res.status).toBe(403);
    });

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildAppConSesionUsuarioEliminable())
            .get(`/user/eliminarCuentaUsuario/${testEliminableUserId}`);
        expect(res.status).toBe(500);
    });
});


// ─────────────────────────────────────────────
// GET /user/eliminarCuentaEmpresa/:id
// ─────────────────────────────────────────────

describe('GET /user/eliminarCuentaEmpresa/:id', () => {
    test('desactiva la cuenta de empresa (activo = 0) y redirige a /auth/logout', async () => {
        const res = await request(buildAppConSesionEmpresaEliminable())
            .get(`/user/eliminarCuentaEmpresa/${testEliminableEmpresaId}`);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/logout');

        const [rows] = await db.query(
            'SELECT activo FROM empresas WHERE id_empresa = ?',
            [testEliminableEmpresaId]
        );
        expect(rows[0].activo).toBe(0);
    });

    test('devuelve 403 cuando una empresa intenta eliminar la cuenta de otra', async () => {
        const res = await request(buildAppConSesionEmpresa())
            .get(`/user/eliminarCuentaEmpresa/${testEmpresa2Id}`);
        expect(res.status).toBe(403);
    });

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildAppConSesionEmpresaEliminable())
            .get(`/user/eliminarCuentaEmpresa/${testEliminableEmpresaId}`);
        expect(res.status).toBe(500);
    });
});


// ─────────────────────────────────────────────
// GET /user/perfilUsuario/:id_perfil/valoracion/:id_valoracion/usuario/:id_autor/reportar
// ─────────────────────────────────────────────

describe('GET .../reportar (getReportarValoracion)', () => {
    const getUrl = () =>
        `/user/perfilUsuario/${testUserId}/valoracion/${testValoracionId}/usuario/${testUser2Id}/reportar`;

    test('redirige al perfil del usuario cuando la petición NO es AJAX', async () => {
        const res = await request(buildApp()).get(getUrl());
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(`/user/perfilUsuario/${testUserId}`);
    });

    test('devuelve 200 y renderiza el formulario cuando la petición es AJAX (X-Requested-With)', async () => {
        const res = await request(buildApp())
            .get(getUrl())
            .set('X-Requested-With', 'XMLHttpRequest');
        expect(res.status).toBe(200);
    });
});


// ─────────────────────────────────────────────
// POST /user/perfilUsuario/:id_perfil/valoracion/:id_valoracion/usuario/:id_autor/reportar
// ─────────────────────────────────────────────

describe('POST .../reportar (postReportarValoracion)', () => {
    const postUrl = () =>
        `/user/perfilUsuario/${testUserId}/valoracion/${testValoracionId}/usuario/${testUser2Id}/reportar`;

    const datosValidos = {
        motivo:      'spam',
        descripcion: 'Este mensaje parece un spam automatizado',
        fecha:       '2025-06-01 10:00:00',
    };

    test('devuelve 401 cuando no hay sesión de usuario activa', async () => {
        const res = await request(buildApp()).post(postUrl()).send(datosValidos);
        expect(res.status).toBe(401);
    });

    test('devuelve 400 cuando el motivo no es un valor permitido', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(postUrl())
            .send({ ...datosValidos, motivo: 'motivo_invalido' });
        expect(res.status).toBe(400);
    });

    test('devuelve 400 cuando la descripcion está vacía', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(postUrl())
            .send({ ...datosValidos, descripcion: '' });
        expect(res.status).toBe(400);
    });

    test('devuelve 400 cuando la descripcion está compuesta solo de espacios', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(postUrl())
            .send({ ...datosValidos, descripcion: '   ' });
        expect(res.status).toBe(400);
    });

    test('devuelve 400 cuando la descripcion supera 255 caracteres', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(postUrl())
            .send({ ...datosValidos, descripcion: 'A'.repeat(256) });
        expect(res.status).toBe(400);
    });

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildAppConSesionUsuario())
            .post(postUrl())
            .send(datosValidos);
        expect(res.status).toBe(500);
    });

    test('crea el reporte en BD con estado pendiente y redirige con reporte=ok', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(postUrl())
            .send(datosValidos);
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain(`/user/perfilUsuario/${testUserId}`);
        expect(res.headers.location).toContain('reporte=ok');
        expect(res.headers.location).toContain('tipo=valoracion');

        const [rows] = await db.query(
            'SELECT * FROM reportes WHERE id_valoracion = ? AND id_autor = ?',
            [testValoracionId, testUserId]
        );
        expect(rows.length).toBe(1);
        expect(rows[0].motivo).toBe('spam');
        expect(rows[0].estado).toBe('pendiente');
        expect(rows[0].descripcion).toBe(datosValidos.descripcion);
        expect(rows[0].id_usuario_reportado).toBe(testUser2Id);
    });

    test('acepta todos los motivos permitidos', async () => {
        const motivosPermitidos = ['spam', 'lenguaje_ofensivo', 'contenido_inapropiado', 'informacion_falsa'];
        for (const motivo of motivosPermitidos) {
            await db.query(
                'DELETE FROM reportes WHERE id_valoracion = ? AND id_autor = ?',
                [testValoracionId, testUserId]
            );
            const res = await request(buildAppConSesionUsuario())
                .post(postUrl())
                .send({ ...datosValidos, motivo });
            expect(res.status).toBe(302);
        }
    });

    test('usa la fecha actual cuando no se proporciona campo fecha', async () => {
        const res = await request(buildAppConSesionUsuario())
            .post(postUrl())
            .send({ motivo: 'spam', descripcion: 'Sin campo fecha' });
        expect(res.status).toBe(302);

        const [rows] = await db.query(
            'SELECT fecha FROM reportes WHERE id_valoracion = ? AND id_autor = ?',
            [testValoracionId, testUserId]
        );
        expect(rows.length).toBe(1);
        expect(rows[0].fecha).toBeTruthy();
    });
});