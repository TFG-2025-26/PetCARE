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

const renderAdminRegistroView = (res, {
    formType = '',
    formData = null,
    error = null,
    errores = [],
    modo = 'crear',
    entidadId = null
} = {}) => {
    res.render('adminRegistroUsuario', {
        formType,
        formData,
        error,
        errores,
        modo,
        entidadId
    });
};

const formatearFechaParaInput = (fecha) => {
    if (!fecha) {
        return '';
    }

    const fechaObj = new Date(fecha);
    if (isNaN(fechaObj.getTime())) {
        return '';
    }

    const year = fechaObj.getFullYear();
    const month = String(fechaObj.getMonth() + 1).padStart(2, '0');
    const day = String(fechaObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getAdminRegistroUsuario = (req, res) => {
    const tipo = req.query.tipo === 'empresa' || req.query.tipo === 'empresas'
        ? 'empresa'
        : req.query.tipo === 'usuario' || req.query.tipo === 'usuarios'
            ? 'usuario'
            : '';
    const modo = req.query.modo === 'editar' ? 'editar' : 'crear';

    if (modo !== 'editar' || !tipo) {
        return renderAdminRegistroView(res, {
            formType: tipo,
            formData: null,
            error: null,
            errores: [],
            modo: 'crear',
            entidadId: null
        });
    }

    const entidadId = parseInt(req.query.id, 10);
    if (isNaN(entidadId)) {
        return res.status(400).send('ID inválido');
    }

    const configuracion = {
        usuario: {
            query: 'SELECT * FROM usuarios WHERE id_usuario = ?'
        },
        empresa: {
            query: 'SELECT * FROM empresas WHERE id_empresa = ?'
        }
    };

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos: ', err);
            return res.status(500).render('error500', { mensaje: 'Error al conectar a la base de datos' });
        }

        connection.query(configuracion[tipo].query, [entidadId], (error, results) => {
            connection.release();

            if (error) {
                console.error('Error al recuperar la cuenta para editar: ', error);
                return res.status(500).render('error500', { mensaje: 'Error al recuperar la cuenta para editar' });
            }

            if (!results || results.length === 0) {
                return res.status(404).send(tipo === 'usuario' ? 'Usuario no encontrado' : 'Empresa no encontrada');
            }

            const registro = results[0];
            const formData = tipo === 'usuario'
                ? {
                    nombre_completo: registro.nombre_completo,
                    nombre_usuario: registro.nombre_usuario,
                    correo: registro.correo,
                    telefono: registro.telefono,
                    password: '',
                    fecha_nacimiento: formatearFechaParaInput(registro.fecha_nacimiento),
                    rol: registro.rol === 'admin' ? 'admin' : 'user',
                    activo: Number(registro.activo) === 0 ? '0' : '1',
                    ban: Number(registro.ban) === 1 ? '1' : '0',
                    suspendido: Number(registro.suspendido) === 1 ? '1' : '0'
                }
                : {
                    nombre: registro.nombre,
                    correo: registro.correo,
                    telefono_contacto: registro.telefono_contacto,
                    cif: registro.CIF,
                    password: '',
                    tipo: registro.tipo === 'peluqueria_canina' ? 'peluquería_canina' : registro.tipo,
                    tipo_otro: registro.tipo_otro || '',
                    activo: Number(registro.activo) === 0 ? '0' : '1'
                };

            return renderAdminRegistroView(res, {
                formType: tipo,
                formData,
                error: null,
                errores: [],
                modo,
                entidadId
            });
        });
    });
};

const postAdminRegistroUsuario = (req, res) => {
    const errores = validationResult(req);
    const rolSeleccionado = req.body.rol === 'admin' ? 'admin' : 'user';
    const formData = { ...req.body, rol: rolSeleccionado };

    if (!errores.isEmpty()) {
        return res.status(400).render('adminRegistroUsuario', {
            error: 'Por favor, corrige los errores en el formulario.',
            errores: errores.array(),
            formData,
            formType: 'usuario',
            modo: 'crear',
            entidadId: null
        });
    }

    const { nombre_completo, correo, nombre_usuario, telefono, password, fecha_nacimiento } = req.body;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).render('error500', { mensaje: 'Error al conectar a la base de datos' });
        }

        connection.query('SELECT id_usuario FROM usuarios WHERE correo = ?', [correo], (errorCorreo, resultadosCorreo) => {
            if (errorCorreo) {
                connection.release();
                console.error('Error al verificar el correo:', errorCorreo);
                return res.status(500).render('error500', { mensaje: 'Error al verificar el correo' });
            }

            if (resultadosCorreo.length > 0) {
                connection.release();
                return renderAdminRegistroView(res, {
                    formType: 'usuario',
                    formData,
                    error: 'El correo electrónico ya está registrado.',
                    errores: [],
                    modo: 'crear',
                    entidadId: null
                });
            }

            connection.query('SELECT id_usuario FROM usuarios WHERE nombre_usuario = ?', [nombre_usuario], (errorUsuario, resultadosUsuario) => {
                if (errorUsuario) {
                    connection.release();
                    console.error('Error al verificar el nombre de usuario:', errorUsuario);
                    return res.status(500).render('error500', { mensaje: 'Error al verificar el nombre de usuario' });
                }

                if (resultadosUsuario.length > 0) {
                    connection.release();
                    return renderAdminRegistroView(res, {
                        formType: 'usuario',
                        formData,
                        error: 'El nombre de usuario ya está en uso.',
                        errores: [],
                        modo: 'crear',
                        entidadId: null
                    });
                }

                connection.query('SELECT id_usuario FROM usuarios WHERE telefono = ?', [telefono], (errorTelefono, resultadosTelefono) => {
                    if (errorTelefono) {
                        connection.release();
                        console.error('Error al verificar el teléfono:', errorTelefono);
                        return res.status(500).render('error500', { mensaje: 'Error al verificar el teléfono' });
                    }

                    if (resultadosTelefono.length > 0) {
                        connection.release();
                        return renderAdminRegistroView(res, {
                            formType: 'usuario',
                            formData,
                            error: 'El teléfono ya está registrado.',
                            errores: [],
                            modo: 'crear',
                            entidadId: null
                        });
                    }

                    const insertQuery = 'INSERT INTO usuarios (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña, rol) VALUES (?, ?, ?, ?, ?, ?, ?)';
                    connection.query(insertQuery, [nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, password, rolSeleccionado], (errorInsert) => {
                        connection.release();

                        if (errorInsert) {
                            console.error('Error al registrar el usuario desde administración:', errorInsert);
                            return res.status(500).render('error500', { mensaje: 'Error al registrar el usuario' });
                        }

                        return res.redirect('/admin/adminPanel/gestionUsuarios/filtrar?tab=usuarios');
                    });
                });
            });
        });
    });
};

const postAdminRegistroEmpresa = (req, res) => {
    const errores = validationResult(req);
    const cifNormalizado = (req.body.cif || '').trim().toUpperCase();
    const tipoSeleccionado = req.body.tipo;
    const tipoOtroGuardado = tipoSeleccionado === 'otro' ? (req.body.tipo_otro || '').trim() : null;
    const formData = { ...req.body, cif: cifNormalizado, tipo_otro: req.body.tipo_otro || '' };

    if (!errores.isEmpty()) {
        return res.status(400).render('adminRegistroUsuario', {
            error: 'Por favor, corrige los errores en el formulario.',
            errores: errores.array(),
            formData,
            formType: 'empresa',
            modo: 'crear',
            entidadId: null
        });
    }

    const { nombre, correo, telefono_contacto, password } = req.body;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).render('error500', { mensaje: 'Error al conectar a la base de datos' });
        }

        connection.query('SELECT id_empresa FROM empresas WHERE correo = ?', [correo], (errorCorreo, resultadosCorreo) => {
            if (errorCorreo) {
                connection.release();
                console.error('Error al verificar el correo:', errorCorreo);
                return res.status(500).render('error500', { mensaje: 'Error al verificar el correo' });
            }

            if (resultadosCorreo.length > 0) {
                connection.release();
                return renderAdminRegistroView(res, {
                    formType: 'empresa',
                    formData,
                    error: 'El correo electrónico ya está registrado.',
                    errores: [],
                    modo: 'crear',
                    entidadId: null
                });
            }

            connection.query('SELECT id_empresa FROM empresas WHERE CIF = ?', [cifNormalizado], (errorCif, resultadosCif) => {
                if (errorCif) {
                    connection.release();
                    console.error('Error al verificar el CIF:', errorCif);
                    return res.status(500).render('error500', { mensaje: 'Error al verificar el CIF' });
                }

                if (resultadosCif.length > 0) {
                    connection.release();
                    return renderAdminRegistroView(res, {
                        formType: 'empresa',
                        formData,
                        error: 'El CIF ya está registrado.',
                        errores: [],
                        modo: 'crear',
                        entidadId: null
                    });
                }

                connection.query('SELECT id_empresa FROM empresas WHERE telefono_contacto = ?', [telefono_contacto], (errorTelefono, resultadosTelefono) => {
                    if (errorTelefono) {
                        connection.release();
                        console.error('Error al verificar el teléfono:', errorTelefono);
                        return res.status(500).render('error500', { mensaje: 'Error al verificar el teléfono' });
                    }

                    if (resultadosTelefono.length > 0) {
                        connection.release();
                        return renderAdminRegistroView(res, {
                            formType: 'empresa',
                            formData,
                            error: 'El teléfono ya está registrado.',
                            errores: [],
                            modo: 'crear',
                            entidadId: null
                        });
                    }

                    const insertQuery = 'INSERT INTO empresas (nombre, correo, contraseña, CIF, telefono_contacto, tipo, tipo_otro) VALUES (?, ?, ?, ?, ?, ?, ?)';
                    connection.query(insertQuery, [nombre, correo, password, cifNormalizado, telefono_contacto, tipoSeleccionado, tipoOtroGuardado], (errorInsert) => {
                        connection.release();

                        if (errorInsert) {
                            console.error('Error al registrar la empresa desde administración:', errorInsert);
                            return res.status(500).render('error500', { mensaje: 'Error al registrar la empresa' });
                        }

                        return res.redirect('/admin/adminPanel/gestionUsuarios/filtrar?tab=empresas');
                    });
                });
            });
        });
    });
};

const postAdminEditarUsuario = (req, res) => {
    const errores = validationResult(req);
    const usuarioId = parseInt(req.params.id, 10);
    const rolSeleccionado = req.body.rol === 'admin' ? 'admin' : 'user';
    const activo = String(req.body.activo) === '0' ? 0 : 1;
    const ban = String(req.body.ban) === '1' ? 1 : 0;
    const suspendido = String(req.body.suspendido) === '1' ? 1 : 0;
    const formData = { ...req.body, rol: rolSeleccionado };

    if (isNaN(usuarioId)) {
        return res.status(400).send('ID de usuario inválido');
    }

    if (!errores.isEmpty()) {
        return res.status(400).render('adminRegistroUsuario', {
            error: 'Por favor, corrige los errores en el formulario.',
            errores: errores.array(),
            formData,
            formType: 'usuario',
            modo: 'editar',
            entidadId: usuarioId
        });
    }

    const { nombre_completo, correo, nombre_usuario, telefono, password, fecha_nacimiento } = req.body;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).render('error500', { mensaje: 'Error al conectar a la base de datos' });
        }

        connection.query('SELECT * FROM usuarios WHERE id_usuario = ?', [usuarioId], (errorActual, resultadosActuales) => {
            if (errorActual) {
                connection.release();
                console.error('Error al recuperar el usuario:', errorActual);
                return res.status(500).render('error500', { mensaje: 'Error al recuperar el usuario' });
            }

            if (resultadosActuales.length === 0) {
                connection.release();
                return res.status(404).send('Usuario no encontrado');
            }

            connection.query('SELECT id_usuario FROM usuarios WHERE correo = ? AND id_usuario != ?', [correo, usuarioId], (errorCorreo, resultadosCorreo) => {
                if (errorCorreo) {
                    connection.release();
                    return res.status(500).render('error500', { mensaje: 'Error al verificar el correo' });
                }

                if (resultadosCorreo.length > 0) {
                    connection.release();
                    return renderAdminRegistroView(res, {
                        formType: 'usuario',
                        formData,
                        error: 'El correo electrónico ya está en uso.',
                        errores: [],
                        modo: 'editar',
                        entidadId: usuarioId
                    });
                }

                connection.query('SELECT id_usuario FROM usuarios WHERE nombre_usuario = ? AND id_usuario != ?', [nombre_usuario, usuarioId], (errorUsuario, resultadosUsuario) => {
                    if (errorUsuario) {
                        connection.release();
                        return res.status(500).render('error500', { mensaje: 'Error al verificar el nombre de usuario' });
                    }

                    if (resultadosUsuario.length > 0) {
                        connection.release();
                        return renderAdminRegistroView(res, {
                            formType: 'usuario',
                            formData,
                            error: 'El nombre de usuario ya está en uso.',
                            errores: [],
                            modo: 'editar',
                            entidadId: usuarioId
                        });
                    }

                    connection.query('SELECT id_usuario FROM usuarios WHERE telefono = ? AND id_usuario != ?', [telefono, usuarioId], (errorTelefono, resultadosTelefono) => {
                        if (errorTelefono) {
                            connection.release();
                            return res.status(500).render('error500', { mensaje: 'Error al verificar el teléfono' });
                        }

                        if (resultadosTelefono.length > 0) {
                            connection.release();
                            return renderAdminRegistroView(res, {
                                formType: 'usuario',
                                formData,
                                error: 'El teléfono ya está en uso.',
                                errores: [],
                                modo: 'editar',
                                entidadId: usuarioId
                            });
                        }

                        const passwordFinal = password && password.trim()
                            ? password
                            : resultadosActuales[0].contraseña;

                        const updateQuery = 'UPDATE usuarios SET nombre_usuario = ?, nombre_completo = ?, fecha_nacimiento = ?, telefono = ?, correo = ?, contraseña = ?, rol = ?, activo = ?, ban = ?, suspendido = ? WHERE id_usuario = ?';
                        connection.query(updateQuery, [nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, passwordFinal, rolSeleccionado, activo, ban, suspendido, usuarioId], (errorUpdate) => {
                            connection.release();

                            if (errorUpdate) {
                                console.error('Error al actualizar el usuario desde administración:', errorUpdate);
                                return res.status(500).render('error500', { mensaje: 'Error al actualizar el usuario' });
                            }

                            return res.redirect('/admin/adminPanel/gestionUsuarios/filtrar?tab=usuarios');
                        });
                    });
                });
            });
        });
    });
};

const postAdminEditarEmpresa = (req, res) => {
    const errores = validationResult(req);
    const empresaId = parseInt(req.params.id, 10);
    const cifNormalizado = (req.body.cif || '').trim().toUpperCase();
    const tipoSeleccionado = req.body.tipo;
    const tipoOtroGuardado = tipoSeleccionado === 'otro' ? (req.body.tipo_otro || '').trim() : null;
    const activo = String(req.body.activo) === '0' ? 0 : 1;
    const formData = { ...req.body, cif: cifNormalizado, tipo_otro: req.body.tipo_otro || '' };

    if (isNaN(empresaId)) {
        return res.status(400).send('ID de empresa inválido');
    }

    if (!errores.isEmpty()) {
        return res.status(400).render('adminRegistroUsuario', {
            error: 'Por favor, corrige los errores en el formulario.',
            errores: errores.array(),
            formData,
            formType: 'empresa',
            modo: 'editar',
            entidadId: empresaId
        });
    }

    const { nombre, correo, telefono_contacto, password } = req.body;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return res.status(500).render('error500', { mensaje: 'Error al conectar a la base de datos' });
        }

        connection.query('SELECT * FROM empresas WHERE id_empresa = ?', [empresaId], (errorActual, resultadosActuales) => {
            if (errorActual) {
                connection.release();
                console.error('Error al recuperar la empresa:', errorActual);
                return res.status(500).render('error500', { mensaje: 'Error al recuperar la empresa' });
            }

            if (resultadosActuales.length === 0) {
                connection.release();
                return res.status(404).send('Empresa no encontrada');
            }

            connection.query('SELECT id_empresa FROM empresas WHERE correo = ? AND id_empresa != ?', [correo, empresaId], (errorCorreo, resultadosCorreo) => {
                if (errorCorreo) {
                    connection.release();
                    return res.status(500).render('error500', { mensaje: 'Error al verificar el correo' });
                }

                if (resultadosCorreo.length > 0) {
                    connection.release();
                    return renderAdminRegistroView(res, {
                        formType: 'empresa',
                        formData,
                        error: 'El correo electrónico ya está en uso.',
                        errores: [],
                        modo: 'editar',
                        entidadId: empresaId
                    });
                }

                connection.query('SELECT id_empresa FROM empresas WHERE CIF = ? AND id_empresa != ?', [cifNormalizado, empresaId], (errorCif, resultadosCif) => {
                    if (errorCif) {
                        connection.release();
                        return res.status(500).render('error500', { mensaje: 'Error al verificar el CIF' });
                    }

                    if (resultadosCif.length > 0) {
                        connection.release();
                        return renderAdminRegistroView(res, {
                            formType: 'empresa',
                            formData,
                            error: 'El CIF ya está registrado.',
                            errores: [],
                            modo: 'editar',
                            entidadId: empresaId
                        });
                    }

                    connection.query('SELECT id_empresa FROM empresas WHERE telefono_contacto = ? AND id_empresa != ?', [telefono_contacto, empresaId], (errorTelefono, resultadosTelefono) => {
                        if (errorTelefono) {
                            connection.release();
                            return res.status(500).render('error500', { mensaje: 'Error al verificar el teléfono' });
                        }

                        if (resultadosTelefono.length > 0) {
                            connection.release();
                            return renderAdminRegistroView(res, {
                                formType: 'empresa',
                                formData,
                                error: 'El teléfono ya está en uso.',
                                errores: [],
                                modo: 'editar',
                                entidadId: empresaId
                            });
                        }

                        const passwordFinal = password && password.trim()
                            ? password
                            : resultadosActuales[0].contraseña;

                        const updateQuery = 'UPDATE empresas SET nombre = ?, correo = ?, contraseña = ?, CIF = ?, telefono_contacto = ?, tipo = ?, tipo_otro = ?, activo = ? WHERE id_empresa = ?';
                        connection.query(updateQuery, [nombre, correo, passwordFinal, cifNormalizado, telefono_contacto, tipoSeleccionado, tipoOtroGuardado, activo, empresaId], (errorUpdate) => {
                            connection.release();

                            if (errorUpdate) {
                                console.error('Error al actualizar la empresa desde administración:', errorUpdate);
                                return res.status(500).render('error500', { mensaje: 'Error al actualizar la empresa' });
                            }

                            return res.redirect('/admin/adminPanel/gestionUsuarios/filtrar?tab=empresas');
                        });
                    });
                });
            });
        });
    });
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

    const condicionesUsuarios = ['1 = 1'];
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
            CONCAT('/admin/adminPanel/gestionUsuarios/registro?tipo=usuario&modo=editar&id=', u.id_usuario) AS editar_url
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
            CONCAT('/admin/adminPanel/gestionUsuarios/registro?tipo=empresa&modo=editar&id=', e.id_empresa) AS editar_url
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
    getAdminRegistroUsuario,
    postAdminRegistroUsuario,
    postAdminRegistroEmpresa,
    postAdminEditarUsuario,
    postAdminEditarEmpresa,
    filtrarUsuarios,
    getDetalleReporte,
    aplicarAccionReporte,
    eliminarUsuarioGestion,
    editarAccionReporte
}; 