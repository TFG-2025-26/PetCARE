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

    pool.query(
        `SELECT f.*, u.nombre_usuario 
         FROM foros f 
         JOIN usuarios u ON f.id_usuario = u.id_usuario 
         WHERE f.id_foro = ?`,
        [foroId],
        (err, results) => {
            if (err) {
                console.error('Error al obtener el foro:', err);
                return res.status(500).send('Error al obtener el foro');
            }
            if (results.length === 0) {
                return res.status(404).send('Foro no encontrado');
            }
            res.render('plantillas/foroDetalle', { 
                foro: results[0],
                comentarios: [], // Aquí se pueden cargar los comentarios del foro si es necesario
                usuarioSesion: req.session.usuario || null
            });
        }
    );
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
        });
    }); 
};

const filtrarForos = (req, res) => {
    const pagina = parseInt(req.query.pagina) || 1;
    const limite = 30;
    const offset = (pagina - 1) * limite;
    const categoria = req.query.categoria || '';
    const keyword = req.query.keyword || '';

    let condiciones = [];
    let params = [];

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
                `SELECT f.*, u.nombre_usuario 
                 FROM foros f 
                 JOIN usuarios u ON f.id_usuario = u.id_usuario 
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
    pool.connection((err, connection) => {
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

    // TODO: Hay que ver si lo eliminamos o lo ponemos a inactivo.
    pool.query('DELETE FROM foros WHERE id_foro = ?', [foroId], (err, result) => {
        if (err) {
            console.error('Error al eliminar el foro:', err);
            return res.status(500).send('Error al eliminar el foro');
        }
        res.redirect('/content/foros');
    });
};

const comentarForo = (req, res) => {};

const eliminarComentario = (req, res) => {};

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