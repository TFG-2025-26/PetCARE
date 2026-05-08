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

const request    = require('supertest');
const express    = require('express');
const session    = require('express-session');
const path       = require('path');
const pool       = require('../../db');
const adminRouter = require('../../routes/adminRouter');

const db = pool.promise();

let testAdminId;
let testTargetUserId;
let testEmpresaId;
let testReporteId;

function buildApp() {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => { res.locals.usuario = req.session.usuario || null; next(); });
    app.use((req, res, next) => {
        req.session.usuario = { id: testAdminId, tipo: 'usuario', rol: 'admin', nombre: 'AdminTest' };
        next();
    });
    app.use('/admin', adminRouter);
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message });
    });
    return app;
}

function buildAppSinSesion() {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => { res.locals.usuario = null; next(); });
    app.use('/admin', adminRouter);
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message });
    });
    return app;
}

function buildAppUsuarioNormal() {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => { res.locals.usuario = req.session.usuario || null; next(); });
    app.use((req, res, next) => {
        req.session.usuario = { id: testAdminId, tipo: 'usuario', rol: 'user', nombre: 'UserTest' };
        next();
    });
    app.use('/admin', adminRouter);
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
    return jest.spyOn(pool, 'getConnection')
        .mockImplementation((cb) => cb(null, fakeConn));
};

// ─── CICLO DE VIDA GLOBAL ────────────────────────────────────────────────────

beforeAll(async () => {
    const [adminResult] = await db.query(
        `INSERT INTO usuarios (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña, rol)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['admin_test_adm', 'Admin Test Adm', '1985-03-15', 600100001, 'admin_test_adm@test.com', 'hashedpwd', 'admin']
    );
    testAdminId = adminResult.insertId;

    const [userResult] = await db.query(
        `INSERT INTO usuarios (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña, rol)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['target_test_adm', 'Target Test Adm', '1995-05-20', 600100002, 'target_test_adm@test.com', 'hashedpwd', 'user']
    );
    testTargetUserId = userResult.insertId;

    const [empresaResult] = await db.query(
        `INSERT INTO empresas (nombre, correo, contraseña, CIF, telefono_contacto, tipo)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['Empresa Test Adm', 'empresa_test_adm@test.com', 'hashedpwd', 'A12345678', 600100003, 'clinica_veterinaria']
    );
    testEmpresaId = empresaResult.insertId;
});

beforeEach(async () => {
    const [rr] = await db.query(
        `INSERT INTO reportes (motivo, descripcion, estado, fecha, id_autor, id_usuario_reportado)
         VALUES (?, ?, ?, NOW(), ?, ?)`,
        ['spam', 'Reporte test admin', 'pendiente', testAdminId, testTargetUserId]
    );
    testReporteId = rr.insertId;
});

afterEach(async () => {
    jest.restoreAllMocks();
    await db.query('DELETE FROM reportes WHERE id_reporte = ?', [testReporteId]).catch(() => {});
    await db.query("DELETE FROM usuarios WHERE correo = 'newuser_test_adm@test.com'").catch(() => {});
    await db.query("DELETE FROM empresas WHERE correo = 'newempresa_test_adm@test.com'").catch(() => {});
    await db.query('UPDATE usuarios SET ban = 0, suspendido = NULL WHERE id_usuario = ?', [testTargetUserId]).catch(() => {});
    await db.query('UPDATE usuarios SET activo = 1 WHERE id_usuario = ?', [testTargetUserId]).catch(() => {});
    await db.query('UPDATE empresas SET activo = 1 WHERE id_empresa = ?', [testEmpresaId]).catch(() => {});
});

afterAll(async () => {
    await db.query('DELETE FROM reportes WHERE id_autor = ? OR id_usuario_reportado = ?', [testAdminId, testTargetUserId]).catch(() => {});
    await db.query('DELETE FROM foros WHERE id_usuario = ?', [testAdminId]).catch(() => {});
    await db.query('DELETE FROM usuarios WHERE id_usuario IN (?, ?)', [testAdminId, testTargetUserId]).catch(() => {});
    await db.query('DELETE FROM empresas WHERE id_empresa = ?', [testEmpresaId]).catch(() => {});
    await db.query("DELETE FROM usuarios WHERE correo = 'newuser_test_adm@test.com'").catch(() => {});
    await db.query("DELETE FROM empresas WHERE correo = 'newempresa_test_adm@test.com'").catch(() => {});
    await pool.end();
});

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

describe('Middleware isAdminAuthenticated', () => {
    it('redirige a login cuando no hay sesión', async () => {
        const res = await request(buildAppSinSesion())
            .get('/admin/adminPanel');
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/auth/login');
    });

    it('permite acceso con sesión de admin', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel');
        expect(res.status).toBe(200);
    });

    it('devuelve 403 con sesión de usuario con rol user', async () => {
        const res = await request(buildAppUsuarioNormal())
            .get('/admin/adminPanel');
        expect(res.status).toBe(403);
    });
});

// ─── PANEL ADMIN ─────────────────────────────────────────────────────────────

describe('GET /admin/adminPanel', () => {
    it('renderiza el panel de administración', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel');
        expect(res.status).toBe(200);
    });
});

// ─── GESTIÓN ARTÍCULOS Y FOROS (redirecciones simples) ───────────────────────

describe('GET /admin/adminPanel/gestionArticulos', () => {
    it('redirige a /content/articulos', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionArticulos');
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/content/articulos');
    });
});

describe('GET /admin/adminPanel/gestionForos', () => {
    it('redirige a /content/foros', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionForos');
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/content/foros');
    });
});

// ─── GESTIÓN REPORTES ────────────────────────────────────────────────────────

describe('GET /admin/adminPanel/gestionReportes', () => {
    it('redirige a filtrar', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionReportes');
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/admin/adminPanel/gestionReportes/filtrar');
    });
});

describe('GET /admin/adminPanel/gestionReportes/filtrar', () => {
    it('devuelve 200 con lista de reportes (sin filtros)', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionReportes/filtrar');
        expect(res.status).toBe(200);
    });

    it('filtra por tipo=usuarios y estado=pendiente', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionReportes/filtrar?tipo=usuarios&estado=pendiente');
        expect(res.status).toBe(200);
    });

    it('filtra por nombre de usuario reportado', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionReportes/filtrar?usuario=target');
        expect(res.status).toBe(200);
    });

    it('filtra por id de usuario reportado', async () => {
        const res = await request(buildApp())
            .get(`/admin/adminPanel/gestionReportes/filtrar?usuario=${testTargetUserId}`);
        expect(res.status).toBe(200);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionReportes/filtrar');
        expect(res.status).toBe(500);
    });

    it('devuelve 500 cuando falla la query', async () => {
        simularErrorQuery();
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionReportes/filtrar');
        expect(res.status).toBe(500);
    });
});

// ─── DETALLE REPORTE ─────────────────────────────────────────────────────────

describe('GET /admin/adminPanel/gestionReportes/:id_reporte', () => {
    it('redirige a filtrar si no es petición AJAX', async () => {
        const res = await request(buildApp())
            .get(`/admin/adminPanel/gestionReportes/${testReporteId}`);
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/admin/adminPanel/gestionReportes/filtrar');
    });

    it('devuelve 200 con detalle del reporte en petición AJAX', async () => {
        const res = await request(buildApp())
            .get(`/admin/adminPanel/gestionReportes/${testReporteId}`)
            .set('X-Requested-With', 'XMLHttpRequest');
        expect(res.status).toBe(200);
    });

    it('devuelve 400 si el ID no es válido', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionReportes/abc')
            .set('X-Requested-With', 'XMLHttpRequest');
        expect(res.status).toBe(400);
    });

    it('devuelve 404 si el reporte no existe', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionReportes/99999999')
            .set('X-Requested-With', 'XMLHttpRequest');
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .get(`/admin/adminPanel/gestionReportes/${testReporteId}`)
            .set('X-Requested-With', 'XMLHttpRequest');
        expect(res.status).toBe(500);
    });
});

// ─── ACCION GENERICA REPORTE ─────────────────────────────────────────────────

describe('POST /admin/adminPanel/gestionReportes/:id_reporte/acciones/:accion', () => {
    it('acepta el reporte y redirige', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testReporteId}/acciones/aceptar`);
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/admin/adminPanel/gestionReportes');
    });

    it('deniega el reporte y redirige', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testReporteId}/acciones/denegar`);
        expect(res.status).toBe(302);
    });

    it('devuelve 400 si la acción no es válida', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testReporteId}/acciones/invalida`);
        expect(res.status).toBe(400);
    });

    it('devuelve 404 si el reporte no existe', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionReportes/99999999/acciones/aceptar');
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testReporteId}/acciones/aceptar`);
        expect(res.status).toBe(500);
    });
});

// ─── ACEPTAR REPORTE VALORACION ──────────────────────────────────────────────

describe('POST /admin/adminPanel/gestionReportes/:id_reporte/acciones/aceptar-valoracion', () => {
    let testValoracionId;
    let testValoracionReporteId;

    beforeEach(async () => {
        const [vr] = await db.query(
            `INSERT INTO valoraciones (puntuacion, id_autor, id_destinatario) VALUES (?, ?, ?)`,
            [5, testAdminId, testTargetUserId]
        );
        testValoracionId = vr.insertId;

        const [rr] = await db.query(
            `INSERT INTO reportes (motivo, estado, fecha, id_autor, id_usuario_reportado, id_valoracion)
             VALUES (?, ?, NOW(), ?, ?, ?)`,
            ['spam', 'pendiente', testAdminId, testTargetUserId, testValoracionId]
        );
        testValoracionReporteId = rr.insertId;
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        await db.query('DELETE FROM valoraciones WHERE id_valoracion = ?', [testValoracionId]).catch(() => {});
        await db.query('DELETE FROM reportes WHERE id_reporte = ?', [testValoracionReporteId]).catch(() => {});
    });

    it('elimina la valoración, actualiza el reporte y redirige', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testValoracionReporteId}/acciones/aceptar-valoracion`);
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/admin/adminPanel/gestionReportes');
    });

    it('devuelve 404 si el reporte no existe', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionReportes/99999999/acciones/aceptar-valoracion');
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testValoracionReporteId}/acciones/aceptar-valoracion`);
        expect(res.status).toBe(500);
    });
});

// ─── ACEPTAR REPORTE VALORACION SIN ACCION ───────────────────────────────────

describe('POST /admin/.../acciones/aceptar-valoracion-sin-accion', () => {
    it('actualiza el reporte a aceptado y redirige', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testReporteId}/acciones/aceptar-valoracion-sin-accion`);
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/admin/adminPanel/gestionReportes');
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testReporteId}/acciones/aceptar-valoracion-sin-accion`);
        expect(res.status).toBe(500);
    });
});

// ─── ACEPTAR REPORTE COMENTARIO SIN ACCION ───────────────────────────────────

describe('POST /admin/.../acciones/aceptar-comentario-sin-accion', () => {
    it('actualiza el reporte a aceptado y redirige', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testReporteId}/acciones/aceptar-comentario-sin-accion`);
        expect(res.status).toBe(302);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testReporteId}/acciones/aceptar-comentario-sin-accion`);
        expect(res.status).toBe(500);
    });
});

// ─── ACEPTAR REPORTE COMENTARIO ELIMINAR ─────────────────────────────────────

describe('POST /admin/.../acciones/aceptar-comentario-eliminar', () => {
    let testForoComentId;
    let testComentarioId;
    let testComentReporteId;

    beforeEach(async () => {
        const [fr] = await db.query(
            `INSERT INTO foros (titulo, categoria, descripcion, fecha_publicacion, id_usuario)
             VALUES (?, ?, ?, NOW(), ?)`,
            ['Foro test comentario', 'general', 'Descripcion test', testAdminId]
        );
        testForoComentId = fr.insertId;

        const [cr] = await db.query(
            `INSERT INTO comentarios (contenido, fecha_publicacion, id_foro, id_usuario)
             VALUES (?, NOW(), ?, ?)`,
            ['Comentario test', testForoComentId, testAdminId]
        );
        testComentarioId = cr.insertId;

        const [rr] = await db.query(
            `INSERT INTO reportes (motivo, estado, fecha, id_autor, id_usuario_reportado, id_comentario)
             VALUES (?, ?, NOW(), ?, ?, ?)`,
            ['spam', 'pendiente', testAdminId, testTargetUserId, testComentarioId]
        );
        testComentReporteId = rr.insertId;
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        await db.query('DELETE FROM comentarios WHERE id_comentario = ?', [testComentarioId]).catch(() => {});
        await db.query('DELETE FROM foros WHERE id_foro = ?', [testForoComentId]).catch(() => {});
        await db.query('DELETE FROM reportes WHERE id_reporte = ?', [testComentReporteId]).catch(() => {});
    });

    it('elimina el comentario, actualiza el reporte y redirige', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testComentReporteId}/acciones/aceptar-comentario-eliminar`);
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/admin/adminPanel/gestionReportes');
    });

    it('devuelve 404 si el reporte no existe', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionReportes/99999999/acciones/aceptar-comentario-eliminar');
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testComentReporteId}/acciones/aceptar-comentario-eliminar`);
        expect(res.status).toBe(500);
    });
});

// ─── ACEPTAR REPORTE COMENTARIO MODIFICAR ────────────────────────────────────

describe('POST /admin/.../acciones/aceptar-comentario-modificar', () => {
    let testForoModId;
    let testComentModId;
    let testComentModReporteId;

    beforeEach(async () => {
        const [fr] = await db.query(
            `INSERT INTO foros (titulo, categoria, descripcion, fecha_publicacion, id_usuario)
             VALUES (?, ?, ?, NOW(), ?)`,
            ['Foro test modificar', 'salud', 'Descripcion test modificar', testAdminId]
        );
        testForoModId = fr.insertId;

        const [cr] = await db.query(
            `INSERT INTO comentarios (contenido, fecha_publicacion, id_foro, id_usuario)
             VALUES (?, NOW(), ?, ?)`,
            ['Comentario a modificar', testForoModId, testAdminId]
        );
        testComentModId = cr.insertId;

        const [rr] = await db.query(
            `INSERT INTO reportes (motivo, estado, fecha, id_autor, id_usuario_reportado, id_comentario)
             VALUES (?, ?, NOW(), ?, ?, ?)`,
            ['spam', 'pendiente', testAdminId, testTargetUserId, testComentModId]
        );
        testComentModReporteId = rr.insertId;
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        await db.query('DELETE FROM comentarios WHERE id_comentario = ?', [testComentModId]).catch(() => {});
        await db.query('DELETE FROM foros WHERE id_foro = ?', [testForoModId]).catch(() => {});
        await db.query('DELETE FROM reportes WHERE id_reporte = ?', [testComentModReporteId]).catch(() => {});
    });

    it('actualiza el reporte y redirige al foro con edición', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testComentModReporteId}/acciones/aceptar-comentario-modificar`)
            .send({ idComentario: testComentModId });
        expect(res.status).toBe(302);
        expect(res.header.location).toContain(`/content/foros/${testForoModId}`);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testComentModReporteId}/acciones/aceptar-comentario-modificar`)
            .send({ idComentario: testComentModId });
        expect(res.status).toBe(500);
    });
});

// ─── ACEPTAR REPORTE FORO ────────────────────────────────────────────────────

describe('POST /admin/.../acciones/aceptar-foro', () => {
    let testForoId;
    let testForoReporteId;

    beforeEach(async () => {
        const [fr] = await db.query(
            `INSERT INTO foros (titulo, categoria, descripcion, fecha_publicacion, id_usuario)
             VALUES (?, ?, ?, NOW(), ?)`,
            ['Foro a eliminar', 'adopcion', 'Descripcion foro a eliminar', testAdminId]
        );
        testForoId = fr.insertId;

        const [rr] = await db.query(
            `INSERT INTO reportes (motivo, estado, fecha, id_autor, id_usuario_reportado, id_foro)
             VALUES (?, ?, NOW(), ?, ?, ?)`,
            ['spam', 'pendiente', testAdminId, testTargetUserId, testForoId]
        );
        testForoReporteId = rr.insertId;
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        await db.query('DELETE FROM foros WHERE id_foro = ?', [testForoId]).catch(() => {});
        await db.query('DELETE FROM reportes WHERE id_reporte = ?', [testForoReporteId]).catch(() => {});
    });

    it('elimina el foro, actualiza el reporte y redirige', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testForoReporteId}/acciones/aceptar-foro`);
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/admin/adminPanel/gestionReportes');
    });

    it('devuelve 404 si el reporte no existe', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionReportes/99999999/acciones/aceptar-foro');
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testForoReporteId}/acciones/aceptar-foro`);
        expect(res.status).toBe(500);
    });
});

// ─── ACCIONES SOBRE USUARIO REPORTADO ────────────────────────────────────────

describe('POST /admin/.../acciones/aceptar-usuario-sin-accion', () => {
    it('actualiza el reporte a aceptado y redirige', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testReporteId}/acciones/aceptar-usuario-sin-accion`);
        expect(res.status).toBe(302);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testReporteId}/acciones/aceptar-usuario-sin-accion`);
        expect(res.status).toBe(500);
    });
});

describe('POST /admin/.../acciones/aceptar-usuario-suspender', () => {
    it('suspende al usuario reportado y redirige', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testReporteId}/acciones/aceptar-usuario-suspender`);
        expect(res.status).toBe(302);
    });

    it('devuelve 404 si el reporte no existe', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionReportes/99999999/acciones/aceptar-usuario-suspender');
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testReporteId}/acciones/aceptar-usuario-suspender`);
        expect(res.status).toBe(500);
    });
});

describe('POST /admin/.../acciones/aceptar-usuario-banear', () => {
    it('banea al usuario reportado y redirige', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testReporteId}/acciones/aceptar-usuario-banear`);
        expect(res.status).toBe(302);
    });

    it('devuelve 404 si el reporte no existe', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionReportes/99999999/acciones/aceptar-usuario-banear');
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionReportes/${testReporteId}/acciones/aceptar-usuario-banear`);
        expect(res.status).toBe(500);
    });
});

// ─── GESTIÓN USUARIOS ────────────────────────────────────────────────────────

describe('GET /admin/adminPanel/gestionUsuarios', () => {
    it('redirige a filtrar con tab=usuarios', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionUsuarios');
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/admin/adminPanel/gestionUsuarios/filtrar');
    });
});

describe('GET /admin/adminPanel/gestionUsuarios/filtrar', () => {
    it('devuelve 200 con lista de usuarios y empresas', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionUsuarios/filtrar');
        expect(res.status).toBe(200);
    });

    it('filtra usuarios por nombre', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionUsuarios/filtrar?busqueda=target&tab=usuarios');
        expect(res.status).toBe(200);
    });

    it('muestra empresas con búsqueda por ID numérico', async () => {
        const res = await request(buildApp())
            .get(`/admin/adminPanel/gestionUsuarios/filtrar?busqueda=${testEmpresaId}&tab=empresas`);
        expect(res.status).toBe(200);
    });

    it('muestra inactivos cuando se solicita', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionUsuarios/filtrar?inactivos=1');
        expect(res.status).toBe(200);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionUsuarios/filtrar');
        expect(res.status).toBe(500);
    });
});

// ─── REGISTRO USUARIO (GET) ───────────────────────────────────────────────────

describe('GET /admin/adminPanel/gestionUsuarios/registro', () => {
    it('renderiza formulario de creación de usuario', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionUsuarios/registro?tipo=usuario');
        expect(res.status).toBe(200);
    });

    it('renderiza formulario de creación de empresa', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionUsuarios/registro?tipo=empresa');
        expect(res.status).toBe(200);
    });

    it('carga datos del usuario existente en modo editar', async () => {
        const res = await request(buildApp())
            .get(`/admin/adminPanel/gestionUsuarios/registro?tipo=usuario&modo=editar&id=${testTargetUserId}`);
        expect(res.status).toBe(200);
    });

    it('carga datos de la empresa existente en modo editar', async () => {
        const res = await request(buildApp())
            .get(`/admin/adminPanel/gestionUsuarios/registro?tipo=empresa&modo=editar&id=${testEmpresaId}`);
        expect(res.status).toBe(200);
    });

    it('devuelve 400 si el id no es válido en modo editar', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionUsuarios/registro?tipo=usuario&modo=editar&id=abc');
        expect(res.status).toBe(400);
    });

    it('devuelve 404 si el usuario no existe en modo editar', async () => {
        const res = await request(buildApp())
            .get('/admin/adminPanel/gestionUsuarios/registro?tipo=usuario&modo=editar&id=99999999');
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD en modo editar', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .get(`/admin/adminPanel/gestionUsuarios/registro?tipo=usuario&modo=editar&id=${testTargetUserId}`);
        expect(res.status).toBe(500);
    });
});

// ─── REGISTRO USUARIO (POST) ──────────────────────────────────────────────────

describe('POST /admin/adminPanel/gestionUsuarios/registro/usuario', () => {
    const datosValidos = {
        nombre_completo: 'New User Test Adm',
        nombre_usuario: 'newuser_test_adm',
        correo: 'newuser_test_adm@test.com',
        telefono: '600100004',
        password: 'Password1',
        fecha_nacimiento: '1995-06-15',
        rol: 'user'
    };

    it('devuelve 400 si faltan campos obligatorios', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionUsuarios/registro/usuario')
            .send({ nombre_completo: '', correo: '', password: '', rol: 'user', fecha_nacimiento: '1995-01-01' });
        expect(res.status).toBe(400);
    });

    it('re-renderiza con error si el correo ya existe', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionUsuarios/registro/usuario')
            .send({ ...datosValidos, correo: 'target_test_adm@test.com' });
        expect(res.status).toBe(200);
        expect(res.text).toContain('correo');
    });

    it('re-renderiza con error si el nombre de usuario ya existe', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionUsuarios/registro/usuario')
            .send({ ...datosValidos, nombre_usuario: 'target_test_adm' });
        expect(res.status).toBe(200);
        expect(res.text).toContain('usuario');
    });

    it('re-renderiza con error si el teléfono ya existe', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionUsuarios/registro/usuario')
            .send({ ...datosValidos, telefono: '600100002' });
        expect(res.status).toBe(200);
        expect(res.text).toContain('tel');
    });

    it('crea el usuario y redirige al listado', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionUsuarios/registro/usuario')
            .send(datosValidos);
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/admin/adminPanel/gestionUsuarios/filtrar');
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionUsuarios/registro/usuario')
            .send(datosValidos);
        expect(res.status).toBe(500);
    });
});

// ─── REGISTRO EMPRESA (POST) ──────────────────────────────────────────────────

describe('POST /admin/adminPanel/gestionUsuarios/registro/empresa', () => {
    const datosValidos = {
        nombre: 'New Empresa Test Adm',
        correo: 'newempresa_test_adm@test.com',
        password: 'Password1',
        telefono_contacto: '600100005',
        cif: 'B12345678',
        tipo: 'clinica_veterinaria',
        tipo_otro: ''
    };

    it('devuelve 400 si faltan campos obligatorios', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionUsuarios/registro/empresa')
            .send({ nombre: '', correo: '', password: '', cif: '', tipo: '' });
        expect(res.status).toBe(400);
    });

    it('re-renderiza con error si el correo ya existe', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionUsuarios/registro/empresa')
            .send({ ...datosValidos, correo: 'empresa_test_adm@test.com' });
        expect(res.status).toBe(200);
        expect(res.text).toContain('correo');
    });

    it('re-renderiza con error si el CIF ya existe', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionUsuarios/registro/empresa')
            .send({ ...datosValidos, cif: 'A12345678' });
        expect(res.status).toBe(200);
        expect(res.text).toContain('CIF');
    });

    it('crea la empresa y redirige al listado', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionUsuarios/registro/empresa')
            .send(datosValidos);
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/admin/adminPanel/gestionUsuarios/filtrar');
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionUsuarios/registro/empresa')
            .send(datosValidos);
        expect(res.status).toBe(500);
    });
});

// ─── EDITAR USUARIO (POST) ────────────────────────────────────────────────────

describe('POST /admin/adminPanel/gestionUsuarios/usuario/:id/editar', () => {
    const datosValidos = () => ({
        nombre_completo: 'Target Test Editado',
        nombre_usuario: 'target_test_adm',
        correo: 'target_test_adm@test.com',
        telefono: '600100002',
        password: '',
        fecha_nacimiento: '1995-05-20',
        rol: 'user',
        activo: '1',
        ban: '0',
        suspendido: '0'
    });

    it('devuelve 400 si los datos son inválidos', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionUsuarios/usuario/${testTargetUserId}/editar`)
            .send({ nombre_completo: '', nombre_usuario: '', correo: 'no-email', telefono: '123', fecha_nacimiento: '2099-01-01', rol: 'user' });
        expect(res.status).toBe(400);
    });

    it('devuelve 404 si el usuario no existe', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionUsuarios/usuario/99999999/editar')
            .send(datosValidos());
        expect(res.status).toBe(404);
    });

    it('actualiza el usuario y redirige', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionUsuarios/usuario/${testTargetUserId}/editar`)
            .send(datosValidos());
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/admin/adminPanel/gestionUsuarios/filtrar');
    });

    it('actualiza el usuario con nueva contraseña y redirige', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionUsuarios/usuario/${testTargetUserId}/editar`)
            .send({ ...datosValidos(), password: 'Password2' });
        expect(res.status).toBe(302);
    });

    it('re-renderiza con error si el correo ya está en uso', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionUsuarios/usuario/${testTargetUserId}/editar`)
            .send({ ...datosValidos(), correo: 'admin_test_adm@test.com' });
        expect(res.status).toBe(200);
        expect(res.text).toContain('correo');
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionUsuarios/usuario/${testTargetUserId}/editar`)
            .send(datosValidos());
        expect(res.status).toBe(500);
    });
});

// ─── EDITAR EMPRESA (POST) ────────────────────────────────────────────────────

describe('POST /admin/adminPanel/gestionUsuarios/empresa/:id/editar', () => {
    const datosValidos = () => ({
        nombre: 'Empresa Test Adm Editada',
        correo: 'empresa_test_adm@test.com',
        password: '',
        telefono_contacto: '600100003',
        cif: 'A12345678',
        tipo: 'clinica_veterinaria',
        tipo_otro: '',
        activo: '1'
    });

    it('devuelve 400 si los datos son inválidos', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionUsuarios/empresa/${testEmpresaId}/editar`)
            .send({ nombre: '', correo: 'no-email', cif: 'X', tipo: '' });
        expect(res.status).toBe(400);
    });

    it('devuelve 404 si la empresa no existe', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionUsuarios/empresa/99999999/editar')
            .send(datosValidos());
        expect(res.status).toBe(404);
    });

    it('actualiza la empresa y redirige', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionUsuarios/empresa/${testEmpresaId}/editar`)
            .send(datosValidos());
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/admin/adminPanel/gestionUsuarios/filtrar');
    });

    it('re-renderiza con error si el CIF ya está en uso', async () => {
        // Crear otra empresa para generar conflicto de CIF
        const [otra] = await db.query(
            `INSERT INTO empresas (nombre, correo, contraseña, CIF, telefono_contacto, tipo)
             VALUES (?, ?, ?, ?, ?, ?)`,
            ['Otra Empresa', 'otra_empresa_adm@test.com', 'hashedpwd', 'C99999999', 600100099, 'hotel']
        );
        const otraEmpresaId = otra.insertId;

        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionUsuarios/empresa/${testEmpresaId}/editar`)
            .send({ ...datosValidos(), cif: 'C99999999' });
        expect(res.status).toBe(200);
        expect(res.text).toContain('CIF');

        await db.query('DELETE FROM empresas WHERE id_empresa = ?', [otraEmpresaId]).catch(() => {});
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionUsuarios/empresa/${testEmpresaId}/editar`)
            .send(datosValidos());
        expect(res.status).toBe(500);
    });
});

// ─── ELIMINAR USUARIO / EMPRESA ───────────────────────────────────────────────

describe('POST /admin/adminPanel/gestionUsuarios/:tipo/:id/eliminar', () => {
    it('desactiva un usuario (activo=0) y redirige', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionUsuarios/usuario/${testTargetUserId}/eliminar`);
        expect(res.status).toBe(302);

        const [[usuario]] = await db.query(
            'SELECT activo FROM usuarios WHERE id_usuario = ?', [testTargetUserId]
        );
        expect(Number(usuario.activo)).toBe(0);
    });

    it('desactiva una empresa (activo=0) y redirige', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionUsuarios/empresa/${testEmpresaId}/eliminar`);
        expect(res.status).toBe(302);

        const [[empresa]] = await db.query(
            'SELECT activo FROM empresas WHERE id_empresa = ?', [testEmpresaId]
        );
        expect(Number(empresa.activo)).toBe(0);
    });

    it('devuelve 400 si el tipo no es válido', async () => {
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionUsuarios/mascota/${testTargetUserId}/eliminar`);
        expect(res.status).toBe(400);
    });

    it('devuelve 400 si el ID no es válido', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionUsuarios/usuario/abc/eliminar');
        expect(res.status).toBe(400);
    });

    it('devuelve 404 si el usuario no existe', async () => {
        const res = await request(buildApp())
            .post('/admin/adminPanel/gestionUsuarios/usuario/99999999/eliminar');
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/admin/adminPanel/gestionUsuarios/usuario/${testTargetUserId}/eliminar`);
        expect(res.status).toBe(500);
    });
});
