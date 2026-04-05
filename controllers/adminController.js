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

const getGestionUsuarios = (req, res) => {
    res.redirect('/admin/adminPanel/gestionUsuarios/filtrar?tab=usuarios');
};

const filtrarUsuarios = (req, res) => {
    const busqueda = (req.query.busqueda || '').trim();
    const mostrarInactivos = ['1', 'true', 'on'].includes(String(req.query.inactivos || '').toLowerCase());
    const compactaRaw = req.query.compacta;
    const vistaCompacta = Array.isArray(compactaRaw)
        ? compactaRaw.some(valor => ['1', 'true', 'on'].includes(String(valor).toLowerCase()))
        : compactaRaw === undefined
            ? true
            : ['1', 'true', 'on'].includes(String(compactaRaw).toLowerCase());

    const tabsValidas = ['usuarios', 'empresas'];
    const tabActiva = tabsValidas.includes(req.query.tab) ? req.query.tab : 'usuarios';

    const condicionesUsuarios = ["u.rol <> 'admin'"];
    const paramsUsuarios = [];

    if (!mostrarInactivos) {
        condicionesUsuarios.push('u.activo = 1');
    }

    if (busqueda) {
        const idNum = parseInt(busqueda, 10);
        if (!isNaN(idNum)) {
            condicionesUsuarios.push('(u.id_usuario = ? OR u.nombre_usuario LIKE ? OR u.nombre_completo LIKE ?)');
            paramsUsuarios.push(idNum, `%${busqueda}%`, `%${busqueda}%`);
        } else {
            condicionesUsuarios.push('(u.nombre_usuario LIKE ? OR u.nombre_completo LIKE ?)');
            paramsUsuarios.push(`%${busqueda}%`, `%${busqueda}%`);
        }
    }

    const queryUsuarios = `
        SELECT
            u.id_usuario,
            u.nombre_usuario,
            u.nombre_completo,
            DATE_FORMAT(u.fecha_nacimiento, '%d/%m/%Y') AS fecha_nacimiento_formateada,
            u.ciudad,
            u.pais,
            u.telefono,
            u.correo,
            u.bio,
            u.rol,
            u.codigo_postal,
            u.genero,
            u.trabajo,
            u.ban,
            u.suspendido,
            u.activo,
            CASE WHEN u.foto IS NOT NULL THEN 1 ELSE 0 END AS tiene_foto,
            CONCAT('/user/perfilUsuario/', u.id_usuario) AS perfil_url,
            CONCAT('/user/perfilUsuario/', u.id_usuario, '/editar') AS editar_url
        FROM usuarios u
        WHERE ${condicionesUsuarios.join(' AND ')}
        ORDER BY u.activo DESC, u.nombre_usuario ASC
    `;

    const condicionesEmpresas = ['1 = 1'];
    const paramsEmpresas = [];

    if (!mostrarInactivos) {
        condicionesEmpresas.push('e.activo = 1');
    }

    if (busqueda) {
        const idNum = parseInt(busqueda, 10);
        if (!isNaN(idNum)) {
            condicionesEmpresas.push('(e.id_empresa = ? OR e.nombre LIKE ?)');
            paramsEmpresas.push(idNum, `%${busqueda}%`);
        } else {
            condicionesEmpresas.push('e.nombre LIKE ?');
            paramsEmpresas.push(`%${busqueda}%`);
        }
    }

    const queryEmpresas = `
        SELECT
            e.id_empresa,
            e.nombre,
            e.correo,
            e.telefono_contacto,
            e.CIF,
            e.tipo,
            e.tipo_otro,
            e.descripcion,
            e.ubicacion,
            e.activo,
            CASE WHEN e.foto IS NOT NULL THEN 1 ELSE 0 END AS tiene_foto,
            COALESCE(NULLIF(e.tipo_otro, ''), e.tipo) AS tipo_mostrado,
            CONCAT('/user/perfilEmpresa/', e.id_empresa) AS perfil_url,
            CONCAT('/user/perfilEmpresa/', e.id_empresa, '/editar') AS editar_url
        FROM empresas e
        WHERE ${condicionesEmpresas.join(' AND ')}
        ORDER BY e.activo DESC, e.nombre ASC
    `;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos: ', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        connection.query(queryUsuarios, paramsUsuarios, (errorUsuarios, usuarios) => {
            if (errorUsuarios) {
                connection.release();
                console.error('Error al obtener la tabla de usuarios: ', errorUsuarios);
                return res.status(500).send('Error al obtener la tabla de usuarios');
            }

            connection.query(queryEmpresas, paramsEmpresas, (errorEmpresas, empresas) => {
                connection.release();
                if (errorEmpresas) {
                    console.error('Error al obtener la tabla de empresas: ', errorEmpresas);
                    return res.status(500).send('Error al obtener la tabla de empresas');
                }

                res.render('gestionUsuarios', {
                    usuarios,
                    empresas,
                    filtros: {
                        busqueda,
                        mostrarInactivos,
                        vistaCompacta,
                        tab: tabActiva
                    }
                });
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

const eliminarUsuarioGestion = (req, res) => {
    const tipo = req.params.tipo;
    const id = parseInt(req.params.id, 10);

    const configuracion = {
        usuario: { tabla: 'usuarios', idCampo: 'id_usuario' },
        empresa: { tabla: 'empresas', idCampo: 'id_empresa' }
    };

    if (!configuracion[tipo] || isNaN(id)) {
        return res.status(400).send('Solicitud de eliminación inválida');
    }

    const { tabla, idCampo } = configuracion[tipo];

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos: ', err);
            return res.status(500).send('Error al conectar a la base de datos');
        }

        const query = `UPDATE ${tabla} SET activo = 0 WHERE ${idCampo} = ?`;
        connection.query(query, [id], (error, result) => {
            connection.release();
            if (error) {
                console.error('Error al desactivar la cuenta desde administración: ', error);
                return res.status(500).send('Error al desactivar la cuenta');
            }

            if (result.affectedRows === 0) {
                return res.status(404).send('Cuenta no encontrada');
            }

            const destino = req.get('Referrer') || '/admin/adminPanel/gestionUsuarios/filtrar';
            res.redirect(destino);
        });
    });
};

const editarAccionReporte = (req, res) => {}

module.exports = {
    getAdminPanel,
    getGestionReportes,
    filtrarReportes,
    getGestionUsuarios,
    filtrarUsuarios,
    getDetalleReporte,
    aplicarAccionReporte,
    eliminarUsuarioGestion,
    editarAccionReporte
}; 