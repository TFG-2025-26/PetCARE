"use strict"; 

const { validationResult } = require('express-validator');
const pool = require('../db');

const verForos = (req, res) => {
    const pagina = parseInt(req.query.pagina) || 1;
    const limite = 30;
    const offset = (pagina - 1) * limite;
    const categoria = req.query.categoria || '';
    const keyword = req.query.keyword || '';

    // Construir condiciones de filtro
    let condiciones = [];
    let params = [];

    if (categoria) {
        condiciones.push('f.categoria = ?');
        params.push(categoria);
    }
    if (keyword) {
        condiciones.push('(f.titulo LIKE ? OR f.descripcion LIKE ?)');
        params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const where = condiciones.length > 0 ? 'WHERE ' + condiciones.join(' AND ') : '';

    // 1. Contar total
    pool.query(`SELECT COUNT(*) as total FROM foros f ${where}`, params, (err, countResults) => {
        if (err) {
            console.error('Error al contar los foros:', err);
            return res.status(500).send('Error al obtener los foros');
        }

        const total = countResults[0].total;

        // 2. Obtener foros de la página actual con JOIN
        pool.query(
            `SELECT f.*, u.nombre_usuario 
             FROM foros f 
             JOIN usuarios u ON f.id_usuario = u.id_usuario 
             ${where} 
             LIMIT ? OFFSET ?`,
            [...params, limite, offset],
            (err, results) => {
                if (err) {
                    console.error('Error al obtener los foros:', err);
                    return res.status(500).send('Error al obtener los foros');
                }

                // TODO: Las categorias estaría bien pasarlas para evitar repetición absurda

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
};

const verForo = (req, res) => {
    const foroId = parseInt(req.params.id, 10);

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

const getCrearForo = (req, res) => {}; 

const postCrearForo = (req, res) => {};

const filtrarForos = (req, res) => {};

const getEditarForo = (req, res) => {};

const postEditarForo = (req, res) => {};

const eliminarForo = (req, res) => {};

const comentarForo = (req, res) => {};

const eliminarComentario = (req, res) => {};

const getEditarComentario = (req, res) => {};

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