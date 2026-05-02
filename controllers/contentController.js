"use strict"; 

const { validationResult } = require('express-validator');
const pool = require('../db');
const { parse } = require('path');

const renderFormularioArticulo = (req, res, {
    articulo = {},
    error = null,
    errores = [],
    modoEdicion = false
} = {}) => {
    const articuloNormalizado = {
        ...articulo,
        titulo: articulo.titulo || '',
        cuerpo: articulo.cuerpo || '',
        imagenSrc: articulo.imagenSrc || articulo.imagen || null
    };

    return res.render('plantillas/crearArticulo', {
        usuario: req.session.usuario || null,
        error,
        errores,
        articulo: articuloNormalizado,
        modoEdicion,
        tituloModal: modoEdicion ? 'Editar artículo' : 'Crear artículo',
        submitLabel: modoEdicion ? 'Guardar cambios' : 'Publicar artículo',
        formAction: modoEdicion && articuloNormalizado.id_articulo
            ? `/admin/adminPanel/gestionArticulos/${articuloNormalizado.id_articulo}/editar`
            : '/admin/adminPanel/gestionArticulos/crearArticulo'
    });
};

const esAdminSesion = (usuario) => !!(usuario && usuario.rol === 'admin');

const puedeGestionarContenido = (usuario, propietarioId) => {
    if (!usuario) {
        return false;
    }

    return esAdminSesion(usuario) || Number(usuario.id) === Number(propietarioId);
};

const renderFormularioEditarComentario = (req, res, {
    comentario = {},
    error = null,
    errores = []
} = {}) => {
    return res.render('plantillas/modificarComentario', {
        usuario: req.session.usuario || null,
        error,
        errores,
        comentario
    });
};

const getArticulos = (req, res) => {
    const pagina = parseInt(req.query.pagina, 10) || 1;
    const limite = 20;
    const offset = (pagina - 1) * limite;
    const keyword = (req.query.keyword || '').trim();
    const usuario = req.session.usuario || null;
    const esAdmin = !!(usuario && usuario.rol === 'admin');

    const condiciones = ['a.activo = ?'];
    const params = [1];

    if (keyword) {
        condiciones.push('(a.titulo LIKE ? OR a.cuerpo LIKE ? OR u.nombre_usuario LIKE ?)');
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const where = `WHERE ${condiciones.join(' AND ')}`;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        const countQuery = `
            SELECT COUNT(*) AS total
            FROM articulos a
            JOIN usuarios u ON a.id_usuario = u.id_usuario
            ${where}
        `;

        connection.query(countQuery, params, (countErr, countResults) => {
            if (countErr) {
                connection.release();
                console.error('Error al contar los artículos:', countErr);
                return res.status(500).send('Error al obtener los artículos');
            }

            const total = countResults[0].total;
            const query = `
                SELECT
                    a.id_articulo,
                    a.titulo,
                    a.cuerpo,
                    a.visualizaciones,
                    a.id_usuario,
                    a.activo,
                    a.\`fecha_publicación\` AS fecha_publicacion,
                    u.nombre_usuario
                FROM articulos a
                JOIN usuarios u ON a.id_usuario = u.id_usuario
                ${where}
                ORDER BY a.\`fecha_publicación\` DESC
                LIMIT ? OFFSET ?
            `;

            connection.query(query, [...params, limite, offset], (queryErr, articulos) => {
                connection.release();

                if (queryErr) {
                    console.error('Error al obtener los artículos:', queryErr);
                    return res.status(500).send('Error al obtener los artículos');
                }

                return res.render('articulos', {
                    articulos,
                    total,
                    totalPaginas: Math.ceil(total / limite),
                    paginaActual: pagina,
                    filtros: { keyword },
                    usuario,
                    esAdmin,
                    error: null,
                    errores: []
                });
            });
        });
    });
};

const getCrearArticulo = (req, res) => {
    const esAjax = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest';
    if (!esAjax) {
        return res.redirect('/content/articulos');
    }

    return renderFormularioArticulo(req, res, {
        articulo: { titulo: '', cuerpo: '' }
    });
};

const postCrearArticulo = (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).render('plantillas/crearArticulo', {
            usuario: req.session.usuario || null,
            error: 'Por favor corrige los errores',
            errores: errors.array(),
            articulo: {
                titulo: req.body.titulo || '',
                cuerpo: req.body.cuerpo || ''
            },
            modoEdicion: false,
            tituloModal: 'Crear artículo',
            submitLabel: 'Publicar artículo',
            formAction: '/admin/adminPanel/gestionArticulos/crearArticulo'
        });
    }

    const { titulo, cuerpo } = req.body;
    const imagen = req.file ? '/uploads/' + req.file.filename : null;
    const id_usuario = req.session.usuario.id;
    const sqlInsertArticulo = 'INSERT INTO articulos (titulo, cuerpo, `fecha_publicación`, imagen, visualizaciones, activo, id_usuario) VALUES (?, ?, NOW(), ?, ?, ?, ?)';

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        connection.query(sqlInsertArticulo, [titulo, cuerpo, imagen, 0, 1, id_usuario], (insertErr) => {
            connection.release();

            if (insertErr) {
                console.error('Error al crear el artículo:', insertErr);
                return res.status(500).send('Error al crear el artículo');
            }

            return res.json({ success: true, redirectUrl: '/content/articulos' });
        });
    });
};

const getEditarArticulo = (req, res) => {
    const articuloId = parseInt(req.params.id_articulo, 10);
    const esAjax = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest';

    if (Number.isNaN(articuloId)) {
        return res.status(400).send('ID de artículo inválido');
    }

    if (!esAjax) {
        return res.redirect(`/content/articulos/${articuloId}`);
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        connection.query(
            'SELECT id_articulo, titulo, cuerpo, imagen, id_usuario FROM articulos WHERE id_articulo = ? AND activo = 1',
            [articuloId],
            (queryErr, results) => {
                connection.release();

                if (queryErr) {
                    console.error('Error al obtener el artículo para editar:', queryErr);
                    return res.status(500).send('Error al obtener el artículo');
                }

                if (!results || results.length === 0) {
                    return res.status(404).send('Artículo no encontrado');
                }

                return renderFormularioArticulo(req, res, {
                    articulo: results[0],
                    modoEdicion: true
                });
            }
        );
    });
};

const postEditarArticulo = (req, res) => {
    const articuloId = parseInt(req.params.id_articulo, 10);
    const errors = validationResult(req);

    if (Number.isNaN(articuloId)) {
        return res.status(400).send('ID de artículo inválido');
    }

    if (!errors.isEmpty()) {
        return res.status(400).render('plantillas/crearArticulo', {
            usuario: req.session.usuario || null,
            error: 'Por favor corrige los errores',
            errores: errors.array(),
            articulo: {
                id_articulo: articuloId,
                titulo: req.body.titulo || '',
                cuerpo: req.body.cuerpo || ''
            },
            modoEdicion: true,
            tituloModal: 'Editar artículo',
            submitLabel: 'Guardar cambios',
            formAction: `/admin/adminPanel/gestionArticulos/${articuloId}/editar`
        });
    }

    const { titulo, cuerpo } = req.body;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        connection.query(
            'SELECT imagen FROM articulos WHERE id_articulo = ? AND activo = 1',
            [articuloId],
            (queryErr, results) => {
                if (queryErr) {
                    connection.release();
                    console.error('Error al obtener el artículo para editar:', queryErr);
                    return res.status(500).send('Error al obtener el artículo');
                }

                if (!results || results.length === 0) {
                    connection.release();
                    return res.status(404).send('Artículo no encontrado');
                }

                const imagen = req.file ? '/uploads/' + req.file.filename : (results[0].imagen || null);
                const sqlUpdateArticulo = 'UPDATE articulos SET titulo = ?, cuerpo = ?, imagen = ? WHERE id_articulo = ? AND activo = 1';

                connection.query(sqlUpdateArticulo, [titulo, cuerpo, imagen, articuloId], (updateErr, updateResult) => {
                    connection.release();

                    if (updateErr) {
                        console.error('Error al editar el artículo:', updateErr);
                        return res.status(500).send('Error al editar el artículo');
                    }

                    if (updateResult.affectedRows === 0) {
                        return res.status(404).send('Artículo no encontrado');
                    }

                    return res.json({ success: true, redirectUrl: `/content/articulos/${articuloId}` });
                });
            }
        );
    });
};

const eliminarArticulo = (req, res) => {
    const articuloId = parseInt(req.params.id_articulo, 10);

    if (Number.isNaN(articuloId)) {
        return res.status(400).send('ID de artículo inválido');
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        const sqlEliminarArticulo = 'UPDATE articulos SET activo = 0 WHERE id_articulo = ? AND activo = 1';
        connection.query(sqlEliminarArticulo, [articuloId], (deleteErr, deleteResult) => {
            connection.release();

            if (deleteErr) {
                console.error('Error al eliminar el artículo:', deleteErr);
                return res.status(500).send('Error al eliminar el artículo');
            }

            if (deleteResult.affectedRows === 0) {
                return res.status(404).send('Artículo no encontrado');
            }

            return res.redirect('/content/articulos');
        });
    });
};

const getArticuloDetalle = (req, res) => {
    const articuloId = parseInt(req.params.id, 10);
    const usuario = req.session.usuario || null;
    const esAdmin = !!(usuario && usuario.rol === 'admin');

    if (Number.isNaN(articuloId)) {
        return res.status(400).send('ID de artículo inválido');
    }

    if (!req.session.articulosVistos) {
        req.session.articulosVistos = {};
    }

    const articuloKey = String(articuloId);
    const yaVistoEnSesion = req.session.articulosVistos[articuloKey] === true;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        const cargarArticuloDetalle = () => {
            const sqlArticulo = `
                SELECT
                    a.id_articulo,
                    a.titulo,
                    a.cuerpo,
                    a.imagen,
                    a.visualizaciones,
                    a.id_usuario,
                    a.\`fecha_publicación\` AS fecha_publicacion,
                    u.nombre_usuario
                FROM articulos a
                JOIN usuarios u ON a.id_usuario = u.id_usuario
                WHERE a.id_articulo = ? AND a.activo = 1
            `;

            connection.query(sqlArticulo, [articuloId], (queryErr, results) => {
                connection.release();

                if (queryErr) {
                    console.error('Error al obtener el detalle del artículo:', queryErr);
                    return res.status(500).send('Error al obtener el detalle del artículo');
                }

                if (!results || results.length === 0) {
                    return res.status(404).send('Artículo no encontrado');
                }

                const articulo = results[0];
                articulo.imagenSrc = articulo.imagen || null;

                return res.render('articuloDetalle', {
                    articulo,
                    usuario,
                    esAdmin,
                    error: null,
                    errores: []
                });
            });
        };

        if (yaVistoEnSesion) {
            return cargarArticuloDetalle();
        }

        const sqlIncrementar = 'UPDATE articulos SET visualizaciones = COALESCE(visualizaciones, 0) + 1 WHERE id_articulo = ? AND activo = 1';
        connection.query(sqlIncrementar, [articuloId], (incrementErr, incrementResult) => {
            if (incrementErr) {
                connection.release();
                console.error('Error al actualizar las visualizaciones del artículo:', incrementErr);
                return res.status(500).send('Error al actualizar las visualizaciones del artículo');
            }

            if (!incrementResult || incrementResult.affectedRows === 0) {
                connection.release();
                return res.status(404).send('Artículo no encontrado');
            }

            req.session.articulosVistos[articuloKey] = true;
            return cargarArticuloDetalle();
        });
    });
};

const verForos = (req, res) => {
    const pagina = req.query.pagina || 1;
    const categoria = req.query.categoria || '';
    const keyword = req.query.keyword || '';
    res.redirect(`/content/foros/filtrar/?pagina=${pagina}&categoria=${categoria}&keyword=${keyword}`);
};

const verForo = (req, res) => {
    const foroId = parseInt(req.params.id, 10);
    const usuario = req.session.usuario || null;
    const esAdmin = esAdminSesion(usuario);

    if (Number.isNaN(foroId)) {
        return res.status(400).send('ID de foro inválido');
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        const sqlForo = `
            SELECT f.*, u.nombre_usuario
            FROM foros f
            JOIN usuarios u ON f.id_usuario = u.id_usuario
            WHERE f.id_foro = ? AND f.activo = 1
        `;

        connection.query(sqlForo, [foroId], (foroErr, results) => {
            if (foroErr) {
                connection.release();
                console.error('Error al obtener el foro:', foroErr);
                return res.status(500).send('Error al obtener el foro');
            }

            if (!results || results.length === 0) {
                connection.release();
                return res.status(404).send('Foro no encontrado');
            }

            const sqlComentarios = `
                SELECT c.*, COALESCE(u.nombre_usuario, 'Usuario eliminado') AS nombre_usuario
                FROM comentarios c
                LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
                WHERE c.id_foro = ?
                ORDER BY c.fecha_publicacion ASC
            `;

            connection.query(sqlComentarios, [foroId], (comentariosErr, commentResults) => {
                connection.release();

                if (comentariosErr) {
                    console.error('Error al obtener los comentarios:', comentariosErr);
                    return res.status(500).send('Error al obtener los comentarios');
                }

                const reporteExito = req.query.reporte === 'ok';
                const tipoReporte = req.query.tipo === 'comentario' ? 'comentario' : 'foro';

                return res.render('foroDetalle', {
                    foro: results[0],
                    comentarios: commentResults,
                    usuario,
                    esAdmin,
                    reporteExito,
                    tipoReporte,
                    error: null,
                    errores: []
                });
            });
        });
    });
};

const getCrearForo = (req, res) => {
    const esAjax = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest';
    if (!esAjax) {
        return res.redirect('/content/foros');
    }

    res.render('plantillas/crearForo', {
        usuario: req.session.usuario || null,
        error: null,
        errores: [],
        foro: { titulo: '', categoria: '', descripcion: '', id_foro: '', id_usuario: '' }
    });
};

const postCrearForo = (req, res) => {
    console.log('Recibiendo solicitud para crear foro con datos:', req.body);

    const errors = validationResult(req);

    // Comprobar si hay errores de validación
    if (!errors.isEmpty()) {
        return res.render('plantillas/crearForo', {
            usuario: req.session.usuario || null,
            error: 'Por favor corrige los errores',
            errores: errors.array(),
            foro: req.body
        });
    }

    const { titulo, descripcion, categoria } = req.body;
    const id_usuario = req.session.usuario.id;
    const sql_insert_foro = 'INSERT INTO foros (titulo, descripcion, categoria, id_usuario, fecha_publicacion) VALUES (?, ?, ?, ?, NOW())';

    pool.getConnection((err, connection) => {
        console.log('Conexión a la base de datos establecida para crear foro');

        // Comprobar si hubo un error al conectar a la base de datos
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        connection.query(sql_insert_foro, [titulo, descripcion, categoria, id_usuario], (err, result) => {
            console.log('Intentando insertar foro con datos:', { titulo, descripcion, categoria, id_usuario });

            // Comprobar si hubo un error al insertar el foro
            if (err) {
                console.error('Error al crear el foro:', err);
                return res.status(500).send('Error al crear el foro');
            }
            
            res.json({ success: true, redirectUrl: '/content/foros' });
            connection.release();
        });
    }); 
};

const filtrarForos = (req, res) => {
    const pagina = parseInt(req.query.pagina, 10) || 1;
    const limite = 20;
    const offset = (pagina - 1) * limite;
    const categoria = req.query.categoria || '';
    const keyword = req.query.keyword || '';
    const usuario = req.session.usuario || null;
    const esAdmin = esAdminSesion(usuario);

    const condiciones = ['f.activo = ?'];
    const params = [1];

    if (categoria) {
        condiciones.push('f.categoria = ?');
        params.push(categoria);
    }
    if (keyword) {
        condiciones.push('(f.titulo LIKE ? OR f.descripcion LIKE ?)');
        params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const where = 'WHERE ' + condiciones.join(' AND ');

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al obtener la conexión:', err);
            return res.status(500).send('Error al obtener la conexión a la base de datos');
        }

        connection.query(`SELECT COUNT(*) as total FROM foros f ${where}`, params, (countErr, countResults) => {
            if (countErr) {
                connection.release();
                console.error('Error al contar los foros:', countErr);
                return res.status(500).send('Error al obtener los foros');
            }

            const total = countResults[0].total;

            connection.query(
                `SELECT f.*, u.nombre_usuario, COALESCE(c.num_respuestas, 0) AS num_respuestas
                 FROM foros f
                 JOIN usuarios u ON f.id_usuario = u.id_usuario
                 LEFT JOIN (
                     SELECT id_foro, COUNT(*) AS num_respuestas
                     FROM comentarios
                     GROUP BY id_foro
                 ) c ON c.id_foro = f.id_foro
                 ${where}
                 ORDER BY f.fecha_publicacion DESC
                 LIMIT ? OFFSET ?`,
                [...params, limite, offset],
                (queryErr, results) => {
                    connection.release();
                    if (queryErr) {
                        console.error('Error al obtener los foros:', queryErr);
                        return res.status(500).send('Error al obtener los foros');
                    }

                    return res.render('foros', {
                        foros: results,
                        total,
                        totalPaginas: Math.ceil(total / limite),
                        paginaActual: pagina,
                        filtros: { categoria, keyword },
                        usuario,
                        esAdmin,
                        error: null,
                        errores: []
                    });
                }
            );
        });
    });
};

const getEditarForo = (req, res) => {
    const foroId = parseInt(req.params.id, 10);
    const esAjax = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest';
    const usuario = req.session.usuario || null;

    if (Number.isNaN(foroId)) {
        return res.status(400).send('ID de foro inválido');
    }

    if (!esAjax) {
        return res.redirect(`/content/foros/${foroId}`);
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        connection.query('SELECT * FROM foros WHERE id_foro = ? AND activo = 1', [foroId], (queryErr, results) => {
            connection.release();

            if (queryErr) {
                console.error('Error al obtener el foro:', queryErr);
                return res.status(500).send('Error al obtener el foro');
            }

            if (!results || results.length === 0) {
                return res.status(404).send('Foro no encontrado');
            }

            if (!puedeGestionarContenido(usuario, results[0].id_usuario)) {
                return res.status(403).send('No tienes permiso para editar este foro');
            }

            return res.render('plantillas/modificarForo', {
                usuario,
                error: null,
                errores: [],
                foro: results[0]
            });
        });
    });
};

const postEditarForo = (req, res) => {
    const foroId = parseInt(req.params.id, 10);
    const usuarioId = parseInt(req.params.id_usuario, 10);
    const { titulo, descripcion, categoria } = req.body;
    const usuario = req.session.usuario || null;

    if (Number.isNaN(foroId)) {
        return res.status(400).send('ID de foro inválido');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).render('plantillas/modificarForo', {
            usuario,
            error: 'Por favor corrige los errores',
            errores: errors.array(),
            foro: {
                ...req.body,
                id_foro: foroId,
                id_usuario: usuarioId
            }
        });
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        connection.query('SELECT id_usuario FROM foros WHERE id_foro = ? AND activo = 1', [foroId], (queryErr, results) => {
            if (queryErr) {
                connection.release();
                console.error('Error al obtener el foro:', queryErr);
                return res.status(500).send('Error al obtener el foro');
            }

            if (!results || results.length === 0) {
                connection.release();
                return res.status(404).send('Foro no encontrado');
            }

            if (!puedeGestionarContenido(usuario, results[0].id_usuario)) {
                connection.release();
                return res.status(403).send('No tienes permiso para editar este foro');
            }

            const sqlUpdateForo = 'UPDATE foros SET titulo = ?, descripcion = ?, categoria = ? WHERE id_foro = ? AND activo = 1';
            connection.query(sqlUpdateForo, [titulo, descripcion, categoria, foroId], (updateErr, updateResult) => {
                connection.release();

                if (updateErr) {
                    console.error('Error al editar el foro:', updateErr);
                    return res.status(500).send('Error al editar el foro');
                }

                if (updateResult.affectedRows === 0) {
                    return res.status(404).send('Foro no encontrado o sin permisos para editarlo');
                }

                return res.json({ success: true, redirectUrl: `/content/foros/${foroId}` });
            });
        });
    });
};

const eliminarForo = (req, res) => {
    const foroId = parseInt(req.params.id, 10);
    const usuarioId = parseInt(req.params.id_usuario, 10);
    const usuario = req.session.usuario || null;

    if (Number.isNaN(foroId) || Number.isNaN(usuarioId)) {
        return res.status(400).send('Parámetros inválidos');
    }

    if (!usuario) {
        return res.status(401).send('Debes iniciar sesión para realizar esta acción');
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        connection.query('SELECT id_usuario FROM foros WHERE id_foro = ? AND activo = 1', [foroId], (queryErr, results) => {
            if (queryErr) {
                connection.release();
                console.error('Error al obtener el foro para eliminarlo:', queryErr);
                return res.status(500).send('Error al eliminar el foro');
            }

            if (!results || results.length === 0) {
                connection.release();
                return res.status(404).send('Foro no encontrado o ya eliminado');
            }

            if (!puedeGestionarContenido(usuario, results[0].id_usuario)) {
                connection.release();
                return res.status(403).send('No tienes permiso para eliminar este foro');
            }

            connection.query('UPDATE foros SET activo = 0 WHERE id_foro = ? AND activo = 1', [foroId], (deleteErr, result) => {
                connection.release();
                if (deleteErr) {
                    console.error('Error al eliminar el foro:', deleteErr);
                    return res.status(500).send('Error al eliminar el foro');
                }

                if (result.affectedRows === 0) {
                    return res.status(404).send('Foro no encontrado o ya eliminado');
                }

                return res.redirect('/content/foros');
            });
        });
    });
};

const comentarForo = (req, res) => {
    const foroId = parseInt(req.params.id, 10);
    const usuarioId = parseInt(req.params.id_usuario, 10);
    const { contenido } = req.body;
    const usuario = req.session.usuario;

    if (Number.isNaN(foroId) || Number.isNaN(usuarioId)) {
        return res.status(400).send('Parámetros inválidos');
    }

    if (contenido.trim() === '') {
        return res.status(400).send('El contenido del comentario no puede estar vacío');
    }

    // Comprobación adicional: el id de usuario del enlace debe coincidir con la sesión activa.
    if (usuario.id !== usuarioId) {
        return res.status(403).send('No tienes permiso para comentar en este foro');
    }

    // Aquí iría la lógica para insertar el comentario en la base de datos
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }
        const sql_insert_comentario = 'INSERT INTO comentarios (contenido, id_usuario, id_foro, fecha_publicacion) VALUES (?, ?, ?, NOW())';
        connection.query(sql_insert_comentario, [contenido, usuarioId, foroId], (err, result) => {
            connection.release();
            if (err) {
                console.error('Error al insertar el comentario:', err);
                return res.status(500).send('Error al insertar el comentario');
            }
            res.redirect(`/content/foros/${foroId}`);
        });
    });

};

const eliminarComentario = (req, res) => {
    const foroId = parseInt(req.params.id, 10);
    const usuarioId = parseInt(req.params.id_usuario, 10);
    const comentarioId = parseInt(req.params.id_comentario, 10);
    const usuario = req.session.usuario || null;

    if (Number.isNaN(foroId) || Number.isNaN(usuarioId) || Number.isNaN(comentarioId)) {
        return res.status(400).send('Parámetros inválidos');
    }

    if (!usuario) {
        return res.status(401).send('Debes iniciar sesión para realizar esta acción');
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        const sqlComentario = 'SELECT id_usuario FROM comentarios WHERE id_comentario = ? AND id_foro = ?';
        connection.query(sqlComentario, [comentarioId, foroId], (queryErr, results) => {
            if (queryErr) {
                connection.release();
                console.error('Error al obtener el comentario:', queryErr);
                return res.status(500).send('Error al eliminar el comentario');
            }

            if (!results || results.length === 0) {
                connection.release();
                return res.status(404).send('Comentario no encontrado');
            }

            if (!puedeGestionarContenido(usuario, results[0].id_usuario)) {
                connection.release();
                return res.status(403).send('No tienes permiso para eliminar este comentario');
            }

            const sqlEliminarComentario = 'DELETE FROM comentarios WHERE id_comentario = ? AND id_foro = ?';
            connection.query(sqlEliminarComentario, [comentarioId, foroId], (deleteErr, result) => {
                connection.release();
                if (deleteErr) {
                    console.error('Error al eliminar el comentario:', deleteErr);
                    return res.status(500).send('Error al eliminar el comentario');
                }
                if (result.affectedRows === 0) {
                    return res.status(404).send('Comentario no encontrado o sin permisos para eliminarlo');
                }
                return res.redirect(`/content/foros/${foroId}`);
            });
        });
    });
};

const getEditarComentario = (req, res) => {
    const foroId = parseInt(req.params.id, 10);
    const comentarioId = parseInt(req.params.id_comentario, 10);
    const esAjax = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest';
    const usuario = req.session.usuario || null;

    if (Number.isNaN(foroId) || Number.isNaN(comentarioId)) {
        return res.status(400).send('Parámetros inválidos');
    }

    if (!esAjax) {
        return res.redirect(`/content/foros/${foroId}`);
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        const sqlComentario = `
            SELECT c.*, COALESCE(u.nombre_usuario, 'Usuario eliminado') AS nombre_usuario
            FROM comentarios c
            LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
            WHERE c.id_comentario = ? AND c.id_foro = ?
        `;

        connection.query(sqlComentario, [comentarioId, foroId], (queryErr, results) => {
            connection.release();

            if (queryErr) {
                console.error('Error al obtener el comentario:', queryErr);
                return res.status(500).send('Error al obtener el comentario');
            }

            if (!results || results.length === 0) {
                return res.status(404).send('Comentario no encontrado');
            }

            if (!puedeGestionarContenido(usuario, results[0].id_usuario)) {
                return res.status(403).send('No tienes permiso para editar este comentario');
            }

            return renderFormularioEditarComentario(req, res, {
                comentario: results[0],
                error: null,
                errores: []
            });
        });
    });
};

const postEditarComentario = (req, res) => {
    const foroId = parseInt(req.params.id, 10);
    const comentarioId = parseInt(req.params.id_comentario, 10);
    const usuario = req.session.usuario || null;
    const contenido = (req.body.contenido || '').trim();
    const errores = [];

    if (Number.isNaN(foroId) || Number.isNaN(comentarioId)) {
        return res.status(400).send('Parámetros inválidos');
    }

    if (!contenido) {
        errores.push({ msg: 'El comentario no puede estar vacío.' });
    }

    if (contenido.length > 2000) {
        errores.push({ msg: 'El comentario no puede superar los 2000 caracteres.' });
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        const sqlComentario = `
            SELECT c.*, COALESCE(u.nombre_usuario, 'Usuario eliminado') AS nombre_usuario
            FROM comentarios c
            LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
            WHERE c.id_comentario = ? AND c.id_foro = ?
        `;

        connection.query(sqlComentario, [comentarioId, foroId], (queryErr, results) => {
            if (queryErr) {
                connection.release();
                console.error('Error al obtener el comentario:', queryErr);
                return res.status(500).send('Error al obtener el comentario');
            }

            if (!results || results.length === 0) {
                connection.release();
                return res.status(404).send('Comentario no encontrado');
            }

            if (!puedeGestionarContenido(usuario, results[0].id_usuario)) {
                connection.release();
                return res.status(403).send('No tienes permiso para editar este comentario');
            }

            if (errores.length > 0) {
                connection.release();
                return res.status(400).render('plantillas/modificarComentario', {
                    usuario,
                    error: 'Por favor corrige los errores',
                    errores,
                    comentario: {
                        ...results[0],
                        contenido
                    }
                });
            }

            const sqlUpdateComentario = 'UPDATE comentarios SET contenido = ?, editado = 1 WHERE id_comentario = ? AND id_foro = ?';
            connection.query(sqlUpdateComentario, [contenido, comentarioId, foroId], (updateErr, result) => {
                connection.release();

                if (updateErr) {
                    console.error('Error al editar el comentario:', updateErr);
                    return res.status(500).send('Error al editar el comentario');
                }

                if (result.affectedRows === 0) {
                    return res.status(404).send('Comentario no encontrado o sin permisos para editarlo');
                }

                return res.json({ success: true, redirectUrl: `/content/foros/${foroId}` });
            });
        });
    });
};

const getReportarForo = (req, res) => {
    const esAjax = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest';
    if (!esAjax) {
        return res.redirect(`/content/foros/${req.params.id}`);
    }

    res.render('plantillas/reportar', {
        usuario: req.session.usuario || null,
        tipo: 'foro',
        action: `/content/foros/${req.params.id}/usuario/${req.params.id_usuario}/reportar`,
        error: null,
        errores: [],
        reporte: {
            motivo: '',
            fecha: new Date().toISOString().slice(0, 19).replace('T', ' '),
            id_usuario_reportado: req.params.id_usuario,
            id_foro: req.params.id,
            id_comentario: null
        }
    });
};

const postReportarForo = (req, res) => {
    const usuario = req.session.usuario;
    const id_autor = usuario ? usuario.id : null;
    const id_foro = parseInt(req.params.id, 10);
    const id_usuario_reportado = parseInt(req.params.id_usuario, 10);
    const { motivo, fecha, descripcion } = req.body;
    const estado = 'pendiente';
    const motivosPermitidos = ['spam', 'lenguaje_ofensivo', 'contenido_inapropiado', 'informacion_falsa'];

    if (!id_autor) {
        return res.status(401).send('Debes iniciar sesion para reportar contenido');
    }

    if (Number.isNaN(id_foro) || Number.isNaN(id_usuario_reportado)) {
        return res.status(400).send('Parametros invalidos');
    }

    if (!motivo || !motivosPermitidos.includes(motivo)) {
        return res.status(400).send('Motivo de reporte invalido');
    }

    // Validar descripción (obligatoria)
    const descripcionLimpia = (descripcion || '').trim();
    if (descripcionLimpia === '') {
        return res.status(400).send('La descripción es obligatoria');
    }
    if (descripcionLimpia.length > 255) {
        return res.status(400).send('La descripción no puede superar 255 caracteres');
    }

    const fechaReporte = fecha && fecha.trim() ? fecha : new Date().toISOString().slice(0, 19).replace('T', ' ');

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        const sqlInsertReporte = `
            INSERT INTO reportes
                (motivo, estado, fecha, id_autor, id_usuario_reportado, id_foro, id_comentario, id_valoracion, descripcion)
            VALUES
                (?, ?, ?, ?, ?, ?, NULL, NULL, ?)
        `;

        connection.query(
            sqlInsertReporte,
            [motivo, estado, fechaReporte, id_autor, id_usuario_reportado, id_foro, descripcionLimpia],
            (insertErr) => {
                connection.release();

                if (insertErr) {
                    console.error('Error al crear el reporte del foro:', insertErr);
                    return res.status(500).send('Error al crear el reporte');
                }

                return res.redirect(`/content/foros/${id_foro}`);
            }
        );
    });
};

const getReportarComentario = (req, res) => {
    const esAjax = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest';
    if (!esAjax) {
        return res.redirect(`/content/foros/${req.params.id}`);
    }

    res.render('plantillas/reportar', {
        usuario: req.session.usuario || null,
        tipo: 'comentario',
        action: `/content/foros/${req.params.id}/usuario/${req.params.id_usuario}/comentario/${req.params.id_comentario}/reportar`,
        error: null,
        errores: [],
        reporte: {
            motivo: '',
            fecha: new Date().toISOString().slice(0, 19).replace('T', ' '),
            id_usuario_reportado: req.params.id_usuario,
            id_foro: null,
            id_comentario: req.params.id_comentario
        }
    });
};

const postReportarComentario = (req, res) => {
    const usuario = req.session.usuario;
    const id_autor = usuario ? usuario.id : null;
    const id_foro = parseInt(req.params.id, 10);
    const id_usuario_reportado = parseInt(req.params.id_usuario, 10);
    const id_comentario = parseInt(req.params.id_comentario, 10);
    const { motivo, fecha, descripcion } = req.body;
    const estado = 'pendiente';
    const motivosPermitidos = ['spam', 'lenguaje_ofensivo', 'contenido_inapropiado', 'informacion_falsa'];

    if (!id_autor) {
        return res.status(401).send('Debes iniciar sesion para reportar contenido');
    }

    if (Number.isNaN(id_foro) || Number.isNaN(id_usuario_reportado) || Number.isNaN(id_comentario)) {
        return res.status(400).send('Parametros invalidos');
    }

    if (!motivo || !motivosPermitidos.includes(motivo)) {
        return res.status(400).send('Motivo de reporte invalido');
    }

    // Validar descripción (obligatoria)
    const descripcionLimpia = (descripcion || '').trim();
    if (descripcionLimpia === '') {
        return res.status(400).send('La descripción es obligatoria');
    }
    if (descripcionLimpia.length > 255) {
        return res.status(400).send('La descripción no puede superar 255 caracteres');
    }

    const fechaReporte = fecha && fecha.trim() ? fecha : new Date().toISOString().slice(0, 19).replace('T', ' ');

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        const sqlInsertReporte = `
            INSERT INTO reportes
                (motivo, estado, fecha, id_autor, id_usuario_reportado, id_foro, id_comentario, id_valoracion, descripcion)
            VALUES
                (?, ?, ?, ?, ?, NULL, ?, NULL, ?)
        `;

        connection.query(
            sqlInsertReporte,
            [motivo, estado, fechaReporte, id_autor, id_usuario_reportado, id_comentario, descripcionLimpia],
            (insertErr) => {
                connection.release();

                if (insertErr) {
                    console.error('Error al crear el reporte del comentario:', insertErr);
                    return res.status(500).send('Error al crear el reporte');
                }

                return res.redirect(`/content/foros/${id_foro}?reporte=ok&tipo=comentario`);
            }
        );
    });
};

module.exports = {
    getArticulos,
    getArticuloDetalle,
    getCrearArticulo,
    postCrearArticulo,
    getEditarArticulo,
    postEditarArticulo,
    eliminarArticulo,
    getCrearForo, 
    postCrearForo,
    verForos,
    verForo,
    filtrarForos,
    getEditarForo,
    postEditarForo,
    eliminarForo,
    comentarForo,
    eliminarComentario,
    getEditarComentario,
    postEditarComentario,
    getReportarForo,
    postReportarForo,
    getReportarComentario,
    postReportarComentario
};