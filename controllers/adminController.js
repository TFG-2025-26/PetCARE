"use strict"; 

const { validationResult } = require('express-validator');
const pool = require('../db');

const getAdminPanel= (req, res) => {
    res.render('adminPanel');
};

const getGestionReportes = (req, res) => {
    res.redirect('/admin/adminPanel/gestionReportes/filtrar');
};

const filtrarReportes = (req, res) => {
    const tipo = req.query.tipo || 'todos';
    const estado = req.query.estado || 'todos';
    const usuario = req.query.usuario || '';

    const tiposValidos = ['todos', 'usuarios', 'foros', 'comentarios', 'valoraciones'];
    const estadosValidos = ['todos', 'pendiente', 'aceptado', 'rechazado'];

    const tipoFiltrado = tiposValidos.includes(tipo) ? tipo : 'todos';
    const estadoFiltrado = estadosValidos.includes(estado) ? estado : 'todos';

    let condiciones = [];
    let params = [];

    if (tipoFiltrado === 'usuarios') {
        condiciones.push('r.id_foro IS NULL AND r.id_comentario IS NULL AND r.id_valoracion IS NULL');
    } else if (tipoFiltrado === 'foros') {
        condiciones.push('r.id_foro IS NOT NULL');
    } else if (tipoFiltrado === 'comentarios') {
        condiciones.push('r.id_comentario IS NOT NULL');
    } else if (tipoFiltrado === 'valoraciones') {
        condiciones.push('r.id_valoracion IS NOT NULL');
    }

    if (estadoFiltrado !== 'todos') {
        condiciones.push('r.estado = ?');
        params.push(estadoFiltrado);
    }

    if (usuario.trim()) {
        const idNum = parseInt(usuario, 10);
        if (!isNaN(idNum)) {
            condiciones.push('r.id_usuario_reportado = ?');
            params.push(idNum);
        } else {
            condiciones.push('u_reportado.nombre_usuario LIKE ?');
            params.push(`%${usuario.trim()}%`);
        }
    }

    const where = condiciones.length > 0 ? 'WHERE ' + condiciones.join(' AND ') : '';

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos: ', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        const query = `
            SELECT
                r.*,
                f.titulo,
                c.contenido,
                u.nombre_usuario AS nombre_usuario_autor,
                u_reportado.nombre_usuario AS nombre_usuario_reportado,
                v.comentario AS comentario_valoracion
            FROM reportes r
            LEFT JOIN usuarios u ON r.id_autor = u.id_usuario
            LEFT JOIN usuarios u_reportado ON r.id_usuario_reportado = u_reportado.id_usuario
            LEFT JOIN foros f ON r.id_foro = f.id_foro
            LEFT JOIN comentarios c ON r.id_comentario = c.id_comentario
            LEFT JOIN valoraciones v ON r.id_valoracion = v.id_valoracion
            ${where}
            ORDER BY r.fecha DESC
        `;

        connection.query(query, params, (err, results) => {
            connection.release();
            if (err) {
                console.error('Error al obtener los reportes: ', err);
                return res.status(500).send('Error al obtener los reportes');
            }
            res.render('gestionReportes', {
                reportes: results,
                filtros: { tipo: tipoFiltrado, estado: estadoFiltrado, usuario }
            });
        });
    });
};

const getDetalleReporte = (req, res) => {
    const esAjax = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest';

    if (!esAjax) {
        return res.redirect('/admin/adminPanel/gestionReportes/filtrar');
    }

    const id_reporte = parseInt(req.params.id_reporte, 10);
    if (isNaN(id_reporte)) {
        return res.status(400).send('ID de reporte inválido');
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos: ', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        const query = `
            SELECT
                r.*,
                f.titulo,
                c.contenido,
                u.nombre_usuario AS nombre_usuario_autor,
                u_reportado.nombre_usuario AS nombre_usuario_reportado,
                v.comentario AS comentario_valoracion
            FROM reportes r
            LEFT JOIN usuarios u ON r.id_autor = u.id_usuario
            LEFT JOIN usuarios u_reportado ON r.id_usuario_reportado = u_reportado.id_usuario
            LEFT JOIN foros f ON r.id_foro = f.id_foro
            LEFT JOIN comentarios c ON r.id_comentario = c.id_comentario
            LEFT JOIN valoraciones v ON r.id_valoracion = v.id_valoracion
            WHERE r.id_reporte = ?
        `;

        connection.query(query, [id_reporte], (err, results) => {
            connection.release();
            if (err) {
                console.error('Error al obtener el reporte: ', err);
                return res.status(500).send('Error al obtener el reporte');
            }
            if (results.length === 0) {
                return res.status(404).send('Reporte no encontrado');
            }
            res.render('plantillas/detalleReporte', { reporte: results[0] });
        });
    });
};

const aplicarAccionReporte = (req, res) => {
    const { id_reporte, accion } = req.params;

    const accionesValidas = { aceptar: 'aceptado', denegar: 'rechazado' };
    const nuevoEstado = accionesValidas[accion];

    if (!nuevoEstado) {
        return res.status(400).send('Acción no válida');
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos: ', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        const updateQuery = 'UPDATE reportes SET estado = ? WHERE id_reporte = ?';
        connection.query(updateQuery, [nuevoEstado, id_reporte], (err, result) => {
            connection.release();
            if (err) {
                console.error('Error al actualizar el reporte: ', err);
                return res.status(500).send('Error al actualizar el reporte');
            }
            if (result.affectedRows === 0) {
                return res.status(404).send('Reporte no encontrado');
            }
            res.redirect('/admin/adminPanel/gestionReportes');
        });
    });
}

const editarAccionReporte = (req, res) => {}

module.exports = {
    getAdminPanel,
    getGestionReportes,
    filtrarReportes,
    getDetalleReporte,
    aplicarAccionReporte,
    editarAccionReporte
}; 