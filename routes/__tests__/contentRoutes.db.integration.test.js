"use strict";

// ******************************************************************************
// Tests de integración completos: HTTP → router → middleware → controlador → BD real.
// Requiere XAMPP corriendo con la BD petcare_test creada.
// Ejecutar con: npm run test:db
// ******************************************************************************

const request       = require('supertest');
const express       = require('express');
const session       = require('express-session');
const path          = require('path');
const pool          = require('../../db');
const contentRouter = require('../../routes/contentRouter');

const db = pool.promise();

let testUserId;
let testUserId2;
let testArticuloId;
let testForoId;
let testComentarioId;

/** App con sesión del propietario de los recursos de prueba. */
function buildApp() {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => { res.locals.usuario = req.session.usuario || null; next(); });
    app.use((req, res, next) => {
        req.session.usuario = { id: testUserId, tipo: 'usuario', rol: 'user', nombre: 'ContentTest' };
        next();
    });
    app.use('/content', contentRouter);
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
    app.use('/content', contentRouter);
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ error: err.message });
    });
    return app;
}

/** App con sesión de un usuario distinto al propietario (para tests de autorización). */
function buildAppOtroUsuario() {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => { res.locals.usuario = req.session.usuario || null; next(); });
    app.use((req, res, next) => {
        req.session.usuario = { id: testUserId2, tipo: 'usuario', rol: 'user', nombre: 'ContentTest2' };
        next();
    });
    app.use('/content', contentRouter);
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
    return jest.spyOn(pool, 'getConnection')
        .mockImplementation((cb) => cb(null, fakeConn));
};

// CICLO DE VIDA GLOBAL

beforeAll(async () => {
    const [u1] = await db.query(
        `INSERT INTO usuarios (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña, rol)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['content_test_usr', 'Content Test User', '1990-06-15', 600200001, 'content_test@test.com', 'hashedpwd', 'user']
    );
    testUserId = u1.insertId;

    const [u2] = await db.query(
        `INSERT INTO usuarios (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña, rol)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['content_test_usr2', 'Content Test User2', '1992-03-10', 600200002, 'content_test2@test.com', 'hashedpwd', 'user']
    );
    testUserId2 = u2.insertId;

    const [ar] = await db.query(
        'INSERT INTO articulos (titulo, cuerpo, `fecha_publicación`, visualizaciones, activo, id_usuario) VALUES (?, ?, NOW(), ?, ?, ?)',
        ['Articulo Test Content', 'Cuerpo del articulo para pruebas de integracion', 0, 1, testUserId]
    );
    testArticuloId = ar.insertId;
});

beforeEach(async () => {
    const [fr] = await db.query(
        `INSERT INTO foros (titulo, categoria, descripcion, fecha_publicacion, id_usuario)
         VALUES (?, ?, ?, NOW(), ?)`,
        ['Foro Test Content', 'general', 'Descripcion del foro de prueba', testUserId]
    );
    testForoId = fr.insertId;

    const [cr] = await db.query(
        `INSERT INTO comentarios (contenido, fecha_publicacion, id_foro, id_usuario)
         VALUES (?, NOW(), ?, ?)`,
        ['Comentario test content', testForoId, testUserId]
    );
    testComentarioId = cr.insertId;
});

afterEach(async () => {
    jest.restoreAllMocks();
    await db.query('DELETE FROM foros WHERE id_foro = ?', [testForoId]).catch(() => {});
    await db.query("DELETE FROM foros WHERE titulo = 'Foro creado en test'").catch(() => {});
});

afterAll(async () => {
    await db.query('DELETE FROM articulos WHERE id_articulo = ?', [testArticuloId]).catch(() => {});
    await db.query('DELETE FROM foros WHERE id_usuario IN (?, ?)', [testUserId, testUserId2]).catch(() => {});
    await db.query('DELETE FROM usuarios WHERE id_usuario IN (?, ?)', [testUserId, testUserId2]).catch(() => {});
    await pool.end();
});

// MIDDLEWARE

describe('Middleware isAuthenticated en contentRouter', () => {
    it('redirige a login cuando no hay sesión', async () => {
        const res = await request(buildAppSinSesion())
            .get('/content/articulos');
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/auth/login');
    });

    it('permite el acceso con sesión activa', async () => {
        const res = await request(buildApp())
            .get('/content/articulos');
        expect(res.status).toBe(200);
    });
});

// ARTÍCULOS

describe('GET /content/articulos', () => {
    it('devuelve 200 con la lista de artículos', async () => {
        const res = await request(buildApp())
            .get('/content/articulos');
        expect(res.status).toBe(200);
    });

    it('filtra artículos por keyword', async () => {
        const res = await request(buildApp())
            .get('/content/articulos?keyword=test');
        expect(res.status).toBe(200);
    });

    it('pagina los resultados', async () => {
        const res = await request(buildApp())
            .get('/content/articulos?pagina=2');
        expect(res.status).toBe(200);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .get('/content/articulos');
        expect(res.status).toBe(500);
    });

    it('devuelve 500 cuando falla la query', async () => {
        simularErrorQuery();
        const res = await request(buildApp())
            .get('/content/articulos');
        expect(res.status).toBe(500);
    });
});

describe('GET /content/articulos/:id', () => {
    it('devuelve 200 con el detalle del artículo', async () => {
        const res = await request(buildApp())
            .get(`/content/articulos/${testArticuloId}`);
        expect(res.status).toBe(200);
    });

    it('devuelve 400 si el ID no es un número', async () => {
        const res = await request(buildApp())
            .get('/content/articulos/abc');
        expect(res.status).toBe(400);
    });

    it('devuelve 404 si el artículo no existe', async () => {
        const res = await request(buildApp())
            .get('/content/articulos/99999999');
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .get(`/content/articulos/${testArticuloId}`);
        expect(res.status).toBe(500);
    });
});

// FOROS (NAVEGACIÓN)

describe('GET /content/foros', () => {
    it('redirige a /content/foros/filtrar con parámetros de paginación', async () => {
        const res = await request(buildApp())
            .get('/content/foros');
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/content/foros/filtrar');
    });
});

describe('GET /content/foros/filtrar', () => {
    it('devuelve 200 con la lista de foros', async () => {
        const res = await request(buildApp())
            .get('/content/foros/filtrar');
        expect(res.status).toBe(200);
    });

    it('filtra foros por categoría', async () => {
        const res = await request(buildApp())
            .get('/content/foros/filtrar?categoria=general');
        expect(res.status).toBe(200);
    });

    it('filtra foros por keyword', async () => {
        const res = await request(buildApp())
            .get('/content/foros/filtrar?keyword=test');
        expect(res.status).toBe(200);
    });

    it('acepta petición POST con parámetros de query', async () => {
        const res = await request(buildApp())
            .post('/content/foros/filtrar?categoria=salud');
        expect(res.status).toBe(200);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .get('/content/foros/filtrar');
        expect(res.status).toBe(500);
    });
});

// CREAR FORO

describe('GET /content/foros/crearForo', () => {
    it('redirige a /content/foros si no es petición AJAX', async () => {
        const res = await request(buildApp())
            .get('/content/foros/crearForo');
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/content/foros');
    });

    it('devuelve 200 con el formulario en petición AJAX', async () => {
        const res = await request(buildApp())
            .get('/content/foros/crearForo')
            .set('X-Requested-With', 'XMLHttpRequest');
        expect(res.status).toBe(200);
    });
});

describe('POST /content/foros/crearForo', () => {
    it('devuelve 200 con errores cuando faltan campos obligatorios', async () => {
        const res = await request(buildApp())
            .post('/content/foros/crearForo')
            .send({ titulo: '', descripcion: '', categoria: '' });
        expect(res.status).toBe(200);
    });

    it('crea el foro y devuelve JSON con success', async () => {
        const res = await request(buildApp())
            .post('/content/foros/crearForo')
            .send({ titulo: 'Foro creado en test', descripcion: 'Descripcion valida del foro', categoria: 'general' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.redirectUrl).toBe('/content/foros');
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post('/content/foros/crearForo')
            .send({ titulo: 'Foro test', descripcion: 'Descripcion valida', categoria: 'general' });
        expect(res.status).toBe(500);
    });
});

// VER FORO

describe('GET /content/foros/:id', () => {
    it('devuelve 200 con el detalle del foro y sus comentarios', async () => {
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}`);
        expect(res.status).toBe(200);
    });

    it('devuelve 400 si el ID no es un número', async () => {
        const res = await request(buildApp())
            .get('/content/foros/abc');
        expect(res.status).toBe(400);
    });

    it('devuelve 404 si el foro no existe', async () => {
        const res = await request(buildApp())
            .get('/content/foros/99999999');
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}`);
        expect(res.status).toBe(500);
    });
});

// EDITAR FORO

describe('GET /content/foros/:id/usuario/:id_usuario/editar', () => {
    it('redirige al foro si no es petición AJAX', async () => {
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}/usuario/${testUserId}/editar`);
        expect(res.status).toBe(302);
        expect(res.header.location).toContain(`/content/foros/${testForoId}`);
    });

    it('devuelve 200 con el formulario en petición AJAX (propietario)', async () => {
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}/usuario/${testUserId}/editar`)
            .set('X-Requested-With', 'XMLHttpRequest');
        expect(res.status).toBe(200);
    });

    it('devuelve 403 si el usuario no es propietario', async () => {
        const res = await request(buildAppOtroUsuario())
            .get(`/content/foros/${testForoId}/usuario/${testUserId2}/editar`)
            .set('X-Requested-With', 'XMLHttpRequest');
        expect(res.status).toBe(403);
    });

    it('devuelve 404 si el foro no existe', async () => {
        const res = await request(buildApp())
            .get('/content/foros/99999999/usuario/1/editar')
            .set('X-Requested-With', 'XMLHttpRequest');
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}/usuario/${testUserId}/editar`)
            .set('X-Requested-With', 'XMLHttpRequest');
        expect(res.status).toBe(500);
    });
});

describe('POST /content/foros/:id/usuario/:id_usuario/editar', () => {
    const datosValidos = {
        titulo: 'Foro Editado',
        descripcion: 'Descripcion editada del foro de prueba',
        categoria: 'salud'
    };

    it('devuelve 400 si los datos son inválidos', async () => {
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId}/editar`)
            .send({ titulo: '', descripcion: '', categoria: '' });
        expect(res.status).toBe(400);
    });

    it('actualiza el foro y devuelve JSON con success (propietario)', async () => {
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId}/editar`)
            .send(datosValidos);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('devuelve 403 si el usuario no es propietario', async () => {
        const res = await request(buildAppOtroUsuario())
            .post(`/content/foros/${testForoId}/usuario/${testUserId2}/editar`)
            .send(datosValidos);
        expect(res.status).toBe(403);
    });

    it('devuelve 404 si el foro no existe', async () => {
        const res = await request(buildApp())
            .post('/content/foros/99999999/usuario/1/editar')
            .send(datosValidos);
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId}/editar`)
            .send(datosValidos);
        expect(res.status).toBe(500);
    });
});

// ELIMINAR FORO

describe('GET /content/foros/:id/usuario/:id_usuario/eliminar', () => {
    it('desactiva el foro y redirige (propietario)', async () => {
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}/usuario/${testUserId}/eliminar`);
        expect(res.status).toBe(302);
        expect(res.header.location).toContain('/content/foros');

        const [[foro]] = await db.query('SELECT activo FROM foros WHERE id_foro = ?', [testForoId]);
        expect(Number(foro.activo)).toBe(0);
    });

    it('devuelve 403 si el usuario no es propietario', async () => {
        const res = await request(buildAppOtroUsuario())
            .get(`/content/foros/${testForoId}/usuario/${testUserId2}/eliminar`);
        expect(res.status).toBe(403);
    });

    it('devuelve 404 si el foro no existe', async () => {
        const res = await request(buildApp())
            .get('/content/foros/99999999/usuario/1/eliminar');
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}/usuario/${testUserId}/eliminar`);
        expect(res.status).toBe(500);
    });
});

// COMENTAR FORO

describe('POST /content/foros/:id/usuario/:id_usuario/comentario', () => {
    it('añade un comentario y redirige al foro', async () => {
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId}/comentario`)
            .send({ contenido: 'Nuevo comentario de prueba' });
        expect(res.status).toBe(302);
        expect(res.header.location).toContain(`/content/foros/${testForoId}`);
    });

    it('devuelve 400 si el contenido está vacío', async () => {
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId}/comentario`)
            .send({ contenido: '   ' });
        expect(res.status).toBe(400);
    });

    it('devuelve 403 si el id de usuario en la URL no coincide con la sesión', async () => {
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId2}/comentario`)
            .send({ contenido: 'Intento de comentario no autorizado' });
        expect(res.status).toBe(403);
    });

    it('devuelve 400 si los parámetros de ruta no son números', async () => {
        const res = await request(buildApp())
            .post('/content/foros/abc/usuario/abc/comentario')
            .send({ contenido: 'Contenido valido' });
        expect(res.status).toBe(400);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId}/comentario`)
            .send({ contenido: 'Comentario con error BD' });
        expect(res.status).toBe(500);
    });
});

// ELIMINAR COMENTARIO

describe('GET /content/foros/:id/usuario/:id_usuario/comentario/:id_comentario/eliminar', () => {
    it('elimina el comentario y redirige al foro (propietario)', async () => {
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}/usuario/${testUserId}/comentario/${testComentarioId}/eliminar`);
        expect(res.status).toBe(302);
        expect(res.header.location).toContain(`/content/foros/${testForoId}`);
    });

    it('devuelve 403 si el usuario no es propietario del comentario', async () => {
        const res = await request(buildAppOtroUsuario())
            .get(`/content/foros/${testForoId}/usuario/${testUserId2}/comentario/${testComentarioId}/eliminar`);
        expect(res.status).toBe(403);
    });

    it('devuelve 404 si el comentario no existe', async () => {
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}/usuario/${testUserId}/comentario/99999999/eliminar`);
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}/usuario/${testUserId}/comentario/${testComentarioId}/eliminar`);
        expect(res.status).toBe(500);
    });
});

// EDITAR COMENTARIO

describe('GET /content/foros/:id/usuario/:id_usuario/comentario/:id_comentario/editar', () => {
    it('redirige al foro si no es petición AJAX', async () => {
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}/usuario/${testUserId}/comentario/${testComentarioId}/editar`);
        expect(res.status).toBe(302);
        expect(res.header.location).toContain(`/content/foros/${testForoId}`);
    });

    it('devuelve 200 con el formulario en petición AJAX (propietario)', async () => {
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}/usuario/${testUserId}/comentario/${testComentarioId}/editar`)
            .set('X-Requested-With', 'XMLHttpRequest');
        expect(res.status).toBe(200);
    });

    it('devuelve 403 si el usuario no es propietario del comentario', async () => {
        const res = await request(buildAppOtroUsuario())
            .get(`/content/foros/${testForoId}/usuario/${testUserId2}/comentario/${testComentarioId}/editar`)
            .set('X-Requested-With', 'XMLHttpRequest');
        expect(res.status).toBe(403);
    });

    it('devuelve 404 si el comentario no existe', async () => {
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}/usuario/${testUserId}/comentario/99999999/editar`)
            .set('X-Requested-With', 'XMLHttpRequest');
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}/usuario/${testUserId}/comentario/${testComentarioId}/editar`)
            .set('X-Requested-With', 'XMLHttpRequest');
        expect(res.status).toBe(500);
    });
});

describe('POST /content/foros/:id/usuario/:id_usuario/comentario/:id_comentario/editar', () => {
    it('actualiza el comentario y devuelve JSON con success (propietario)', async () => {
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId}/comentario/${testComentarioId}/editar`)
            .send({ contenido: 'Comentario editado correctamente' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('devuelve 400 si el contenido está vacío', async () => {
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId}/comentario/${testComentarioId}/editar`)
            .send({ contenido: '' });
        expect(res.status).toBe(400);
    });

    it('devuelve 403 si el usuario no es propietario del comentario', async () => {
        const res = await request(buildAppOtroUsuario())
            .post(`/content/foros/${testForoId}/usuario/${testUserId2}/comentario/${testComentarioId}/editar`)
            .send({ contenido: 'Intento no autorizado' });
        expect(res.status).toBe(403);
    });

    it('devuelve 404 si el comentario no existe', async () => {
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId}/comentario/99999999/editar`)
            .send({ contenido: 'Contenido valido' });
        expect(res.status).toBe(404);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId}/comentario/${testComentarioId}/editar`)
            .send({ contenido: 'Comentario con error BD' });
        expect(res.status).toBe(500);
    });
});

// REPORTAR FORO

describe('GET /content/foros/:id/usuario/:id_usuario/reportar', () => {
    it('redirige al foro si no es petición AJAX', async () => {
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}/usuario/${testUserId}/reportar`);
        expect(res.status).toBe(302);
        expect(res.header.location).toContain(`/content/foros/${testForoId}`);
    });

    it('devuelve 200 con el formulario en petición AJAX', async () => {
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}/usuario/${testUserId}/reportar`)
            .set('X-Requested-With', 'XMLHttpRequest');
        expect(res.status).toBe(200);
    });
});

describe('POST /content/foros/:id/usuario/:id_usuario/reportar', () => {
    it('crea el reporte y redirige al foro', async () => {
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId2}/reportar`)
            .send({ motivo: 'spam', descripcion: 'Descripcion del reporte de prueba' });
        expect(res.status).toBe(302);
        expect(res.header.location).toContain(`/content/foros/${testForoId}`);
    });

    it('devuelve 400 si el motivo no es válido', async () => {
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId2}/reportar`)
            .send({ motivo: 'motivo_invalido', descripcion: 'Descripcion valida' });
        expect(res.status).toBe(400);
    });

    it('devuelve 400 si la descripción está vacía', async () => {
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId2}/reportar`)
            .send({ motivo: 'spam', descripcion: '' });
        expect(res.status).toBe(400);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId2}/reportar`)
            .send({ motivo: 'spam', descripcion: 'Descripcion valida' });
        expect(res.status).toBe(500);
    });
});

// REPORTAR COMENTARIO

describe('GET /content/foros/:id/usuario/:id_usuario/comentario/:id_comentario/reportar', () => {
    it('redirige al foro si no es petición AJAX', async () => {
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}/usuario/${testUserId}/comentario/${testComentarioId}/reportar`);
        expect(res.status).toBe(302);
        expect(res.header.location).toContain(`/content/foros/${testForoId}`);
    });

    it('devuelve 200 con el formulario en petición AJAX', async () => {
        const res = await request(buildApp())
            .get(`/content/foros/${testForoId}/usuario/${testUserId}/comentario/${testComentarioId}/reportar`)
            .set('X-Requested-With', 'XMLHttpRequest');
        expect(res.status).toBe(200);
    });
});

describe('POST /content/foros/:id/usuario/:id_usuario/comentario/:id_comentario/reportar', () => {
    it('crea el reporte del comentario y redirige al foro', async () => {
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId2}/comentario/${testComentarioId}/reportar`)
            .send({ motivo: 'lenguaje_ofensivo', descripcion: 'Contenido inapropiado en el comentario' });
        expect(res.status).toBe(302);
        expect(res.header.location).toContain(`/content/foros/${testForoId}`);
    });

    it('devuelve 400 si el motivo no es válido', async () => {
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId2}/comentario/${testComentarioId}/reportar`)
            .send({ motivo: 'invalido', descripcion: 'Descripcion valida' });
        expect(res.status).toBe(400);
    });

    it('devuelve 400 si la descripción está vacía', async () => {
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId2}/comentario/${testComentarioId}/reportar`)
            .send({ motivo: 'spam', descripcion: '' });
        expect(res.status).toBe(400);
    });

    it('devuelve 500 cuando falla la conexión a BD', async () => {
        simularErrorConexion();
        const res = await request(buildApp())
            .post(`/content/foros/${testForoId}/usuario/${testUserId2}/comentario/${testComentarioId}/reportar`)
            .send({ motivo: 'spam', descripcion: 'Descripcion valida' });
        expect(res.status).toBe(500);
    });
});
