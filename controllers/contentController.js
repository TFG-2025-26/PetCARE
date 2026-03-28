"use strict"; 

const { validationResult } = require('express-validator');
const pool = require('../db');

const verForos = (req, res) => {
    res.redirect('/content/foros/filtrar/?pagina=1&categoria=&keyword=');
};

const verForo = (req, res) => {
    const foroId = parseInt(req.params.id, 10);

    if (Number.isNaN(foroId)) {
        return res.status(400).send('ID de foro inválido');
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        const sql_foro = `SELECT f.*, u.nombre_usuario 
                                  FROM foros f 
                                  JOIN usuarios u ON f.id_usuario = u.id_usuario 
                                  WHERE f.id_foro = ?`;

        connection.query(sql_foro, [foroId], (err, results) => {
            connection.release();
            if (err) {
                console.error('Error al obtener el foro:', err);
                return res.status(500).send('Error al obtener el foro');
            } else if (results.length === 0) {
                return res.status(404).send('Foro no encontrado');
            } else {
                const sql_comentarios = `SELECT c.*, u.nombre_usuario 
                                        FROM comentarios c 
                                        JOIN usuarios u ON c.id_usuario = u.id_usuario
                                        WHERE c.id_foro = ? 
                                        ORDER BY c.fecha_publicacion ASC`;
                
                connection.query(sql_comentarios, [foroId], (err, commentResults) => {
                    if (err) {
                        console.error('Error al obtener los comentarios:', err);
                        return res.status(500).send('Error al obtener los comentarios');
                    }

                    res.render('foroDetalle', { 
                        foro: results[0],
                        comentarios: commentResults, 
                        usuarioSesion: req.session.usuario || null
                    }); 
                }); 
            }   
        }); 
    }); 
};

const getCrearForo = (req, res) => {
    res.render('plantillas/crearForo', {
        usuario: req.session.usuario || null,
        error: null,
        errores: [], 
        foro: {}
    });
}; 

const postCrearForo = (req, res) => {
    const errors = validationResult(req);

    // Comprobar si hay errores de validación
    if (!errors.isEmpty()) {
        // TODO: Este render hay que cambiarlo porque me manda a un sitio que no debería. 
        return res.render('plantillas/crearForo', {
            usuario: req.session.usuario || null,
            error: 'Por favor corrige los errores',
            errores: errors.array(),
            foro: req.body
        });
    }

    const { titulo, descripcion, categoría } = req.body;
    const id_usuario = req.session.usuario.id;
    const sql_insert_foro = 'INSERT INTO foros (titulo, descripcion, categoría, id_usuario) VALUES (?, ?, ?, ?)';

    pool.getConnection((err, connection) => {
        // Comprobar si hubo un error al conectar a la base de datos
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        connection.query(sql_insert_foro, [titulo, descripcion, categoría, id_usuario], (err, result) => {
            // Comprobar si hubo un error al insertar el foro
            if (err) {
                console.error('Error al crear el foro:', err);
                return res.status(500).send('Error al crear el foro');
            }
            
            res.redirect('/content/foros');
            connection.release();
        });
    }); 
};

const filtrarForos = (req, res) => {
    const pagina = parseInt(req.query.pagina) || 1;
    const limite = 30;
    const offset = (pagina - 1) * limite;
    const categoria = req.query.categoria || '';
    const keyword = req.query.keyword || '';

    let condiciones = ['f.activo = ?'];
    let params = [1];

    if (categoria) {
        condiciones.push('f.categoría = ?');
        params.push(categoria);
    }
    if (keyword) {
        condiciones.push('(f.titulo LIKE ? OR f.descripcion LIKE ?)');
        params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const where = condiciones.length > 0 ? 'WHERE ' + condiciones.join(' AND ') : '';

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al obtener la conexión:', err);
            return res.status(500).send('Error al obtener la conexión a la base de datos');
        }

        // 1. Contar total
        connection.query(`SELECT COUNT(*) as total FROM foros f ${where}`, params, (err, countResults) => {
            if (err) {
                connection.release();
                console.error('Error al contar los foros:', err);
                return res.status(500).send('Error al obtener los foros');
            }

            const total = countResults[0].total;

            // 2. Obtener foros de la página actual
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
                 LIMIT ? OFFSET ?`,
                [...params, limite, offset],
                (err, results) => {
                    connection.release();
                    if (err) {
                        console.error('Error al obtener los foros:', err);
                        return res.status(500).send('Error al obtener los foros');
                    }

                    res.render('foros', {
                        foros: results,
                        total: total,
                        totalPaginas: Math.ceil(total / limite),
                        paginaActual: pagina,
                        filtros: { categoria, keyword },
                        usuario: req.session.usuario || null,
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
    const usuarioSesion = req.session.usuario;
    pool.getConnection((err, connection) => {
        // Comprobar si hubo un error al conectar a la base de datos
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        // Obtener el foro para editar
        connection.query('SELECT * FROM foros WHERE id_foro = ? AND id_usuario = ?', [foroId, usuarioSesion.id_usuario], (err, results) => {
            if (err) {
                console.error('Error al obtener el foro:', err);
                return res.status(500).send('Error al obtener el foro');
            }
            if (results.length === 0) {
                return res.status(404).send('Foro no encontrado o no tienes permiso para editarlo');
            }

            // TODO: Aquí va a haber 2 posibilidades
            // 1. El usuario obtiene el foro que no es suyo y le muestra un error
            // 2. Se hace el query tal y como está ahora y le da un error 404 tal y como está

            res.render('plantillas/crearForo', {
                usuario: req.session.usuario || null,
                error: null,
                errores: [], 
                foro: results[0]
            }); 
        }); 
    }); 
};

const postEditarForo = (req, res) => {};

const eliminarForo = (req, res) => {
    const foroId = parseInt(req.params.id, 10);
    const usuarioId = parseInt(req.params.id_usuario, 10);
    const usuarioSesion = req.session.usuario;

    if (Number.isNaN(foroId) || Number.isNaN(usuarioId)) {
        return res.status(400).send('Parámetros inválidos');
    }

    if (!usuarioSesion) {
        return res.status(401).send('Debes iniciar sesión para realizar esta acción');
    }

    // Comprobación adicional: el id de usuario del enlace debe coincidir con la sesión activa.
    if (usuarioSesion.id !== usuarioId) {
        return res.status(403).send('No tienes permiso para eliminar este foro');
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }
        connection.query('UPDATE foros SET activo = 0 WHERE id_foro = ? AND id_usuario = ? AND activo = 1', [foroId, usuarioId], (err, result) => {
            connection.release();
            if (err) {
                console.error('Error al eliminar el foro:', err);
                return res.status(500).send('Error al eliminar el foro');
            }

            if (result.affectedRows === 0) {
                return res.status(404).send('Foro no encontrado o sin permisos para eliminarlo');
            }

            res.redirect('/content/foros');
        });
    });
};

const comentarForo = (req, res) => {
    const foroId = parseInt(req.params.id, 10);
    const usuarioId = parseInt(req.params.id_usuario, 10);
    const { contenido } = req.body;
    const usuarioSesion = req.session.usuario;

    if (Number.isNaN(foroId) || Number.isNaN(usuarioId)) {
        return res.status(400).send('Parámetros inválidos');
    }

    if (contenido.trim() === '') {
        return res.status(400).send('El contenido del comentario no puede estar vacío');
    }

    // Comprobación adicional: el id de usuario del enlace debe coincidir con la sesión activa.
    if (usuarioSesion.id !== usuarioId) {
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
    const usuarioSesion = req.session.usuario;

    if (Number.isNaN(foroId) || Number.isNaN(usuarioId) || Number.isNaN(comentarioId)) {
        return res.status(400).send('Parámetros inválidos');
    }

    // Comprobación adicional: el id de usuario del enlace debe coincidir con la sesión activa.
    if (usuarioSesion.id !== usuarioId) {
        return res.status(403).send('No tienes permiso para eliminar este comentario');
    }

    // Aquí iría la lógica para eliminar el comentario de la base de datos
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }
        const sql_eliminar_comentario = 'DELETE FROM comentarios WHERE id_comentario = ? AND id_usuario = ?';
        connection.query(sql_eliminar_comentario, [comentarioId, usuarioId], (err, result) => {
            connection.release();
            if (err) {
                console.error('Error al eliminar el comentario:', err);
                return res.status(500).send('Error al eliminar el comentario');
            }
            if (result.affectedRows === 0) {
                return res.status(404).send('Comentario no encontrado o sin permisos para eliminarlo');
            }
            res.redirect(`/content/foros/${foroId}`);
        });
    });
};

const getEditarComentario = (req, res) => {

};

const postEditarComentario = (req, res) => {};

module.exports = {
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
    postEditarComentario
};