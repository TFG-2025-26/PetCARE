"use strict";

// ******************************************************************************
// Tests de integración completos: HTTP → router → middleware → controlador → BD real.
// Cubre authController: registro de usuarios y empresas, login y logout.
// Requiere XAMPP corriendo con la BD petcare_test creada.
// Ejecutar con: npm run test:db
// ******************************************************************************

const request    = require('supertest');
const express    = require('express');
const session    = require('express-session');
const path       = require('path');
const bcrypt     = require('bcrypt');
const pool       = require('../../db');
const authRouter = require('../../routes/authRouter');

const db = pool.promise();

let testUserId;
let testEmpresaId;
let testBannedUserId;
let testSuspendedUserId;
let testInactiveUserId;
let testInactiveEmpresaId;

// ─────────────────────────────────────────────
// App builders
// ─────────────────────────────────────────────

/* App base sin sesión previa (la mayoría de rutas auth son públicas). */
function buildApp() {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => { res.locals.usuario = req.session.usuario || null; next(); });
    app.use('/auth', authRouter);
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message, codigo: err.codigo || null });
    });
    return app;
}

/* App con sesión de usuario activa (para el test de logout). */
function buildAppConSesion() {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => { res.locals.usuario = req.session.usuario || null; next(); });
    app.use((req, res, next) => {
        req.session.usuario = { id: testUserId, tipo: 'usuario', rol: 'user', nombre_usuario: 'testauth1' };
        next();
    });
    app.use('/auth', authRouter);
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
    const hash = await bcrypt.hash('Password1', 10);

    // Limpiar posibles restos de ejecuciones anteriores
    await db.query(
        `DELETE FROM usuarios WHERE correo IN (
            'testauth1@jest.com','testauth_banned@jest.com',
            'testauth_suspended@jest.com','testauth_inactive@jest.com'
        )`
    );
    await db.query(
        `DELETE FROM empresas WHERE correo IN (
            'testauth_empresa@jest.com','testauth_empresa_inactive@jest.com'
        )`
    );

    // Usuario activo normal (para login)
    const [r1] = await db.query(
        `INSERT INTO usuarios (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña, activo, ban, suspendido)
         VALUES (?,?,?,?,?,?,1,0,0)`,
        ['testauth1', 'Test Auth 1', '1990-01-01', 610000001, 'testauth1@jest.com', hash]
    );
    testUserId = r1.insertId;

    // Usuario baneado
    const [r2] = await db.query(
        `INSERT INTO usuarios (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña, activo, ban, suspendido)
         VALUES (?,?,?,?,?,?,1,1,0)`,
        ['testauth_banned', 'Test Auth Banned', '1990-01-01', 610000002, 'testauth_banned@jest.com', hash]
    );
    testBannedUserId = r2.insertId;

    // Usuario suspendido
    const [r3] = await db.query(
        `INSERT INTO usuarios (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña, activo, ban, suspendido)
        VALUES (?,?,?,?,?,?,1,0,'2099-12-31')`,
        ['testauth_suspended', 'Test Auth Suspended', '1990-01-01', 610000003, 'testauth_suspended@jest.com', hash]
    );
    testSuspendedUserId = r3.insertId;

    // Usuario inactivo
    const [r4] = await db.query(
        `INSERT INTO usuarios (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña, activo, ban, suspendido)
         VALUES (?,?,?,?,?,?,0,0,0)`,
        ['testauth_inactive', 'Test Auth Inactive', '1990-01-01', 610000004, 'testauth_inactive@jest.com', hash]
    );
    testInactiveUserId = r4.insertId;

    // Empresa activa (para login)
    const [e1] = await db.query(
        `INSERT INTO empresas (nombre, correo, contraseña, CIF, telefono_contacto, tipo, activo)
         VALUES (?,?,?,?,?,?,1)`,
        ['EmpresaAuthTest', 'testauth_empresa@jest.com', hash, 'B99999991', 620000001, 'clinica_veterinaria']
    );
    testEmpresaId = e1.insertId;

    // Empresa inactiva
    const [e2] = await db.query(
        `INSERT INTO empresas (nombre, correo, contraseña, CIF, telefono_contacto, tipo, activo)
         VALUES (?,?,?,?,?,?,0)`,
        ['EmpresaAuthInactiva', 'testauth_empresa_inactive@jest.com', hash, 'B99999992', 620000002, 'clinica_veterinaria']
    );
    testInactiveEmpresaId = e2.insertId;
});

afterEach(async () => {
    jest.restoreAllMocks();
    // Limpiar usuarios/empresas creados en cada test de registro
    await db.query(
        `DELETE FROM usuarios WHERE correo IN (
            'nuevo_usuario@jest.com','nuevo_usuario2@jest.com','nuevo_usuario3@jest.com'
        )`
    );
    await db.query(
        `DELETE FROM empresas WHERE correo IN (
            'nueva_empresa@jest.com','nueva_empresa2@jest.com','nueva_empresa3@jest.com'
        )`
    );
});

afterAll(async () => {
    await db.query('DELETE FROM usuarios WHERE id_usuario IN (?,?,?,?)', [
        testUserId, testBannedUserId, testSuspendedUserId, testInactiveUserId
    ]);
    await db.query('DELETE FROM empresas WHERE id_empresa IN (?,?)', [
        testEmpresaId, testInactiveEmpresaId
    ]);
    await new Promise((resolve, reject) =>
        pool.end(err => (err ? reject(err) : resolve()))
    );
});


// ─────────────────────────────────────────────
// GET /auth/register, /auth/login, /auth/recuperarContrasena
// ─────────────────────────────────────────────

describe('GET /auth/register', () => {
    test('devuelve 200 y renderiza la página de registro', async () => {
        const res = await request(buildApp()).get('/auth/register');
        expect(res.status).toBe(200);
    });
});

describe('GET /auth/login', () => {
    test('devuelve 200 y renderiza la página de login', async () => {
        const res = await request(buildApp()).get('/auth/login');
        expect(res.status).toBe(200);
    });
});

describe('GET /auth/recuperarContrasena', () => {
    test('devuelve 200 y renderiza la página de recuperación de contraseña', async () => {
        const res = await request(buildApp()).get('/auth/recuperarContrasena');
        expect(res.status).toBe(200);
    });
});


// ─────────────────────────────────────────────
// POST /auth/register/usuario – Validaciones
// ─────────────────────────────────────────────

describe('POST /auth/register/usuario – validaciones de formulario', () => {
    const datosValidos = {
        nombre_completo:  'Test Nuevo Usuario',
        nombre_usuario:   'testnuevo1',
        correo:           'nuevo_usuario@jest.com',
        telefono:         '610000099',
        password:         'Password1',
        fecha_nacimiento: '1995-06-15'
    };

    test('rechaza con 400 cuando nombre_completo está vacío', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, nombre_completo: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando nombre_usuario tiene menos de 3 caracteres', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, nombre_usuario: 'ab' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando nombre_usuario contiene espacios', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, nombre_usuario: 'test nuevo' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el correo no es válido', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, correo: 'no-es-un-correo' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el teléfono tiene menos de 9 dígitos', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, telefono: '12345' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el teléfono contiene letras', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, telefono: '61000abc9' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando la contraseña tiene menos de 8 caracteres', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, password: 'Pass1' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando la contraseña no tiene mayúsculas', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, password: 'password1' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando la contraseña no tiene números', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, password: 'PasswordSinNumero' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando la contraseña contiene espacios', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, password: 'Pass word1' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando la fecha de nacimiento indica menos de 14 años', async () => {
        const hoy = new Date();
        const fecha = `${hoy.getFullYear() - 10}-01-01`;
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, fecha_nacimiento: fecha });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando la fecha de nacimiento no es válida', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, fecha_nacimiento: 'no-es-fecha' });
        expect(res.status).toBe(400);
    });
});


// ─────────────────────────────────────────────
// POST /auth/register/usuario – BD real
// ─────────────────────────────────────────────

describe('POST /auth/register/usuario – BD real', () => {
    const datosValidos = {
        nombre_completo:  'Test Nuevo Usuario',
        nombre_usuario:   'testnuevo_bd1',
        correo:           'nuevo_usuario@jest.com',
        telefono:         '610000099',
        password:         'Password1',
        fecha_nacimiento: '1995-06-15'
    };

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send(datosValidos);
        expect(res.status).toBe(500);
    });

    test('renderiza error cuando el correo ya está registrado', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, correo: 'testauth1@jest.com', telefono: '610000099' });
        expect(res.status).toBe(200);
        expect(res.text).toContain('El correo electrónico ya está registrado.');
    });

    test('renderiza error cuando el nombre de usuario ya está en uso', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, nombre_usuario: 'testauth1', correo: 'nuevo_usuario@jest.com' });
        expect(res.status).toBe(200);
        expect(res.text).toContain('El nombre de usuario ya está en uso.');
    });

    test('renderiza error cuando el teléfono ya está registrado', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, telefono: '610000001' }); // teléfono de testauth1
        expect(res.status).toBe(200);
        expect(res.text).toContain('El teléfono ya está registrado.');
    });

    test('devuelve 403 cuando el correo pertenece a una cuenta baneada', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, correo: 'testauth_banned@jest.com' });
        expect(res.status).toBe(403);
    });

    test('devuelve 403 cuando el teléfono pertenece a una cuenta baneada', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send({ ...datosValidos, telefono: '610000002' }); // teléfono del usuario baneado
        expect(res.status).toBe(403);
    });

    test('registra el usuario correctamente y redirige a /services', async () => {
        const res = await request(buildApp())
            .post('/auth/register/usuario')
            .send(datosValidos);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/services');
    });

    test('guarda el usuario en BD con los datos correctos', async () => {
        await request(buildApp())
            .post('/auth/register/usuario')
            .send(datosValidos);

        const [rows] = await db.query(
            'SELECT * FROM usuarios WHERE correo = ?',
            ['nuevo_usuario@jest.com']
        );
        expect(rows.length).toBe(1);
        expect(rows[0].nombre_usuario).toBe('testnuevo_bd1');
        expect(rows[0].nombre_completo).toBe('Test Nuevo Usuario');
        expect(rows[0].activo).toBe(1);
        expect(rows[0].ban).toBe(0);
    });

    test('almacena la contraseña hasheada, no en texto plano', async () => {
        await request(buildApp())
            .post('/auth/register/usuario')
            .send(datosValidos);

        const [rows] = await db.query(
            'SELECT contraseña FROM usuarios WHERE correo = ?',
            ['nuevo_usuario@jest.com']
        );
        expect(rows.length).toBe(1);
        expect(rows[0].contraseña).not.toBe('Password1');
        const match = await bcrypt.compare('Password1', rows[0].contraseña);
        expect(match).toBe(true);
    });
});


// ─────────────────────────────────────────────
// POST /auth/register/empresa – Validaciones
// ─────────────────────────────────────────────

describe('POST /auth/register/empresa – validaciones de formulario', () => {
    const datosValidos = {
        nombre:              'Empresa Test Nueva',
        correo:              'nueva_empresa@jest.com',
        password:            'Password1',
        telefono_contacto:   '620000099',
        cif:                 'B12345678',
        tipo:                'clinica_veterinaria',
        tipo_otro:           ''
    };

    test('rechaza con 400 cuando nombre está vacío', async () => {
        const res = await request(buildApp())
            .post('/auth/register/empresa')
            .send({ ...datosValidos, nombre: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el correo no es válido', async () => {
        const res = await request(buildApp())
            .post('/auth/register/empresa')
            .send({ ...datosValidos, correo: 'no-es-correo' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando la contraseña no cumple requisitos', async () => {
        const res = await request(buildApp())
            .post('/auth/register/empresa')
            .send({ ...datosValidos, password: 'sinmayus1' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el teléfono contiene letras', async () => {
        const res = await request(buildApp())
            .post('/auth/register/empresa')
            .send({ ...datosValidos, telefono_contacto: '62000abc9' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando el CIF tiene menos de 8 caracteres', async () => {
        const res = await request(buildApp())
            .post('/auth/register/empresa')
            .send({ ...datosValidos, cif: 'B1234' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando tipo es obligatorio y falta', async () => {
        const res = await request(buildApp())
            .post('/auth/register/empresa')
            .send({ ...datosValidos, tipo: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando tipo es "otro" y tipo_otro está vacío', async () => {
        const res = await request(buildApp())
            .post('/auth/register/empresa')
            .send({ ...datosValidos, tipo: 'otro', tipo_otro: '' });
        expect(res.status).toBe(400);
    });

    test('rechaza con 400 cuando tipo es "otro" y tipo_otro tiene menos de 5 caracteres', async () => {
        const res = await request(buildApp())
            .post('/auth/register/empresa')
            .send({ ...datosValidos, tipo: 'otro', tipo_otro: 'abc' });
        expect(res.status).toBe(400);
    });
});


// ─────────────────────────────────────────────
// POST /auth/register/empresa – BD real
// ─────────────────────────────────────────────

describe('POST /auth/register/empresa – BD real', () => {
    const datosValidos = {
        nombre:              'Empresa Test Nueva',
        correo:              'nueva_empresa@jest.com',
        password:            'Password1',
        telefono_contacto:   '620000099',
        cif:                 'B12345678',
        tipo:                'clinica_veterinaria',
        tipo_otro:           ''
    };

    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post('/auth/register/empresa')
            .send(datosValidos);
        expect(res.status).toBe(500);
    });

    test('renderiza error cuando el correo ya está registrado', async () => {
        const res = await request(buildApp())
            .post('/auth/register/empresa')
            .send({ ...datosValidos, correo: 'testauth_empresa@jest.com' });
        expect(res.status).toBe(200);
        expect(res.text).toContain('El correo electrónico ya está registrado.');
    });

    test('renderiza error cuando el CIF ya está registrado', async () => {
        const res = await request(buildApp())
            .post('/auth/register/empresa')
            .send({ ...datosValidos, cif: 'B99999991' }); // CIF de EmpresaAuthTest
        expect(res.status).toBe(200);
        expect(res.text).toContain('El CIF ya está registrado.');
    });

    test('renderiza error cuando el teléfono ya está registrado', async () => {
        const res = await request(buildApp())
            .post('/auth/register/empresa')
            .send({ ...datosValidos, telefono_contacto: '620000001' }); // teléfono de EmpresaAuthTest
        expect(res.status).toBe(200);
        expect(res.text).toContain('El teléfono ya está registrado.');
    });

    test('devuelve 403 cuando el correo pertenece a un usuario baneado', async () => {
        const res = await request(buildApp())
            .post('/auth/register/empresa')
            .send({ ...datosValidos, correo: 'testauth_banned@jest.com' });
        expect(res.status).toBe(403);
    });

    test('devuelve 403 cuando el teléfono pertenece a un usuario baneado', async () => {
        const res = await request(buildApp())
            .post('/auth/register/empresa')
            .send({ ...datosValidos, telefono_contacto: '610000002' }); // teléfono del usuario baneado
        expect(res.status).toBe(403);
    });

    test('registra la empresa correctamente y redirige a /', async () => {
        const res = await request(buildApp())
            .post('/auth/register/empresa')
            .send(datosValidos);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/');
    });

    test('guarda la empresa en BD con los datos correctos', async () => {
        await request(buildApp())
            .post('/auth/register/empresa')
            .send(datosValidos);

        const [rows] = await db.query(
            'SELECT * FROM empresas WHERE correo = ?',
            ['nueva_empresa@jest.com']
        );
        expect(rows.length).toBe(1);
        expect(rows[0].nombre).toBe('Empresa Test Nueva');
        expect(rows[0].CIF).toBe('B12345678');
        expect(rows[0].tipo).toBe('clinica_veterinaria');
        expect(rows[0].activo).toBe(1);
    });

    test('normaliza el CIF a mayúsculas antes de guardarlo', async () => {
        await request(buildApp())
            .post('/auth/register/empresa')
            .send({ ...datosValidos, cif: 'b12345678' });

        const [rows] = await db.query(
            'SELECT CIF FROM empresas WHERE correo = ?',
            ['nueva_empresa@jest.com']
        );
        expect(rows.length).toBe(1);
        expect(rows[0].CIF).toBe('B12345678');
    });

    test('guarda tipo_otro cuando tipo es "otro"', async () => {
        const res = await request(buildApp())
            .post('/auth/register/empresa')
            .send({ ...datosValidos, tipo: 'otro', tipo_otro: 'Guardería canina' });
        expect(res.status).toBe(302);

        const [rows] = await db.query(
            'SELECT tipo, tipo_otro FROM empresas WHERE correo = ?',
            ['nueva_empresa@jest.com']
        );
        expect(rows.length).toBe(1);
        expect(rows[0].tipo).toBe('otro');
        expect(rows[0].tipo_otro).toBe('Guardería canina');
    });

    test('almacena la contraseña hasheada, no en texto plano', async () => {
        await request(buildApp())
            .post('/auth/register/empresa')
            .send(datosValidos);

        const [rows] = await db.query(
            'SELECT contraseña FROM empresas WHERE correo = ?',
            ['nueva_empresa@jest.com']
        );
        expect(rows.length).toBe(1);
        expect(rows[0].contraseña).not.toBe('Password1');
        const match = await bcrypt.compare('Password1', rows[0].contraseña);
        expect(match).toBe(true);
    });
});


// ─────────────────────────────────────────────
// POST /auth/login/usuario
// ─────────────────────────────────────────────

describe('POST /auth/login/usuario – BD real', () => {
    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post('/auth/login/usuario')
            .send({ usuario_input: 'testauth1', password: 'Password1' });
        expect(res.status).toBe(500);
    });

    test('renderiza error cuando el usuario no existe', async () => {
        const res = await request(buildApp())
            .post('/auth/login/usuario')
            .send({ usuario_input: 'usuario_inexistente', password: 'Password1' });
        expect(res.status).toBe(200);
        expect(res.text).toContain('Datos del formulario incorrectos');
    });

    test('devuelve 403 cuando la cuenta está baneada', async () => {
        const res = await request(buildApp())
            .post('/auth/login/usuario')
            .send({ usuario_input: 'testauth_banned', password: 'Password1' });
        expect(res.status).toBe(403);
    });

    test('devuelve 423 cuando la cuenta está suspendida', async () => {
        const res = await request(buildApp())
            .post('/auth/login/usuario')
            .send({ usuario_input: 'testauth_suspended', password: 'Password1' });
        expect(res.status).toBe(423);
    });

    test('renderiza error cuando la cuenta está inactiva', async () => {
        const res = await request(buildApp())
            .post('/auth/login/usuario')
            .send({ usuario_input: 'testauth_inactive', password: 'Password1' });
        expect(res.status).toBe(200);
        expect(res.text).toContain('Cuenta inactiva');
    });

    test('renderiza error cuando la contraseña es incorrecta', async () => {
        const res = await request(buildApp())
            .post('/auth/login/usuario')
            .send({ usuario_input: 'testauth1', password: 'ContrasenaMal1' });
        expect(res.status).toBe(200);
        expect(res.text).toContain('Datos del formulario incorrectos');
    });

    test('permite login con nombre_usuario y redirige a /services', async () => {
        const res = await request(buildApp())
            .post('/auth/login/usuario')
            .send({ usuario_input: 'testauth1', password: 'Password1' });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/services');
    });

    test('permite login con correo y redirige a /services', async () => {
        const res = await request(buildApp())
            .post('/auth/login/usuario')
            .send({ usuario_input: 'testauth1@jest.com', password: 'Password1' });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/services');
    });

    test('permite login con teléfono y redirige a /services', async () => {
        const res = await request(buildApp())
            .post('/auth/login/usuario')
            .send({ usuario_input: '610000001', password: 'Password1' });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/services');
    });
});


// ─────────────────────────────────────────────
// POST /auth/login/empresa
// ─────────────────────────────────────────────

describe('POST /auth/login/empresa – BD real', () => {
    test('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post('/auth/login/empresa')
            .send({ correo: 'testauth_empresa@jest.com', password: 'Password1' });
        expect(res.status).toBe(500);
    });

    test('renderiza error cuando la empresa no existe', async () => {
        const res = await request(buildApp())
            .post('/auth/login/empresa')
            .send({ correo: 'noexiste@jest.com', password: 'Password1' });
        expect(res.status).toBe(200);
        expect(res.text).toContain('Datos del formulario incorrectos');
    });

    test('renderiza error cuando la empresa está inactiva', async () => {
        const res = await request(buildApp())
            .post('/auth/login/empresa')
            .send({ correo: 'testauth_empresa_inactive@jest.com', password: 'Password1' });
        expect(res.status).toBe(200);
        expect(res.text).toContain('Cuenta inactiva');
    });

    test('renderiza error cuando la contraseña es incorrecta', async () => {
        const res = await request(buildApp())
            .post('/auth/login/empresa')
            .send({ correo: 'testauth_empresa@jest.com', password: 'ContrasenaMal1' });
        expect(res.status).toBe(200);
        expect(res.text).toContain('Datos del formulario incorrectos');
    });

    test('login exitoso con empresa activa y redirige a /', async () => {
        const res = await request(buildApp())
            .post('/auth/login/empresa')
            .send({ correo: 'testauth_empresa@jest.com', password: 'Password1' });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/');
    });
});


// ─────────────────────────────────────────────
// GET /auth/logout
// ─────────────────────────────────────────────

describe('GET /auth/logout', () => {
    test('destruye la sesión y redirige a /', async () => {
        const res = await request(buildAppConSesion()).get('/auth/logout');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/');
    });

    test('redirige a / incluso sin sesión activa', async () => {
        const res = await request(buildApp()).get('/auth/logout');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/');
    });
});