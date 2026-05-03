"use strict";

const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const pool = require('../db'); 

const getPerfilUsuario = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al obtener la conexión a la base de datos:', err);
            return res.status(500).send('Error al obtener la conexión a la base de datos');
        }

        const usuarioId = parseInt(req.params.id, 10);

        connection.query('SELECT * FROM usuarios WHERE id_usuario = ?', [usuarioId], (err, results) => {
            if (err) {
                connection.release();
                console.error('Error al ejecutar la consulta:', err);
                return res.status(500).send('Error al recuperar los datos del usuario');
            }

            if (results.length === 0) {
                connection.release();
                return res.status(404).send('Usuario no encontrado');
            } else if (results[0].activo === 0) {
                connection.release();
                return res.status(403).send('Cuenta de usuario inactiva');
            }

            connection.query('SELECT * FROM mascotas WHERE id_usuario = ?', [usuarioId], (err, mascotas) => {
                if (err) {
                    connection.release();
                    console.error('Error al recuperar las mascotas del usuario:', err);
                    return res.status(500).send('Error al recuperar las mascotas del usuario');
                }

                // Valoraciones recibidas por este usuario, con el nombre del autor
                const queryValoraciones = `
                    SELECT v.id_valoracion, v.puntuacion, v.comentario, v.id_autor,
                           u.nombre_usuario AS autor_nombre, u.nombre_completo AS autor_nombre_completo
                    FROM valoraciones v
                    LEFT JOIN usuarios u ON v.id_autor = u.id_usuario
                    WHERE v.id_destinatario = ?
                    ORDER BY v.id_valoracion DESC
                `;

                connection.query(queryValoraciones, [usuarioId], (err, valoraciones) => {
                    connection.release();
                    if (err) {
                        console.error('Error al recuperar las valoraciones del usuario:', err);
                        return res.status(500).send('Error al recuperar las valoraciones del usuario');
                    }

                    const mediaValoraciones = valoraciones.length > 0
                        ? Math.round((valoraciones.reduce((sum, v) => sum + v.puntuacion, 0) / valoraciones.length) * 10) / 10
                        : null;

                    const usuarioSesion = req.session && req.session.usuario ? req.session.usuario : null;
                    const esPropia = !!(usuarioSesion && usuarioSesion.tipo === 'usuario' && Number(usuarioSesion.id) === usuarioId);
                    const puedeEditar = esPropia;

                    res.render('perfilUsuario', {
                        perfil: results[0],
                        mascotas,
                        valoraciones,
                        mediaValoraciones,
                        esPropia,
                        puedeEditar,
                        usuarioSesion
                    });
                });
            });
        });
    });
};

const getPerfilEmpresa = (req, res) => {
    pool.getConnection((err, connection) => {
        // Comprobar errores de conexión
        if (err) {
            console.error('Error al obtener la conexión a la base de datos:', err);
            return res.status(500).send('Error al obtener la conexión a la base de datos'); 
        }

        const empresaId = parseInt(req.params.id, 10); 
        connection.query('SELECT * FROM empresas WHERE id_empresa = ?', [empresaId], (err, results) => {
            connection.release(); 
            if (err) { // Comprobar errores de consulta
                console.error('Error al ejecutar la consulta:', err);
                return res.status(500).send('Error al recuperar los datos de la empresa'); 
            }

            if (results.length === 0) { // Comprobar si la empresa existe
                return res.status(404).send('Empresa no encontrada'); 
            } else if (results[0].activo === 0) { // Comprobar si la empresa está activa
                return res.status(403).send('Cuenta de empresa inactiva'); 
            }

            const usuarioSesion = req.session && req.session.usuario ? req.session.usuario : null;
            const esPropia = !!(usuarioSesion && usuarioSesion.tipo === 'empresa' && Number(usuarioSesion.id) === empresaId);
            const puedeEditar = esPropia;

            res.render('perfilEmpresa', {
                empresa: results[0], 
                valoraciones: [], //TODO: Falta recoger bien las valoraciones
                esPropia,
                puedeEditar
            })
        })
    })
};

const getEditarPerfilUsuario = (req, res) => {
    pool.getConnection((err, connection) => {
        // Comprobar errores de conexión
        if(err) { 
            console.error('Error al obtener la conexión a la base de datos:', err); 
            return res.status(500).send('Error al obtener la conexión a la base de datos'); 
        }

        const usuarioId = parseInt(req.params.id, 10); 
        connection.query('SELECT * FROM usuarios WHERE id_usuario = ?', [usuarioId], (err, results) => {
            connection.release(); 
            if (err) { // Comprobar errores de consulta
                console.error('Error al ejecutar la consulta:', err); 
                return res.status(500).send('Error al recuperar los datos de usuario'); 
            }
            if (results.length === 0) { // Comprobar si el usuario existe
                return res.status(404).send('Usuario no encontrado'); 
            } else if (results[0].activo === 0) { // Comprobar si el usuario está activo
                return res.status(403).send('Cuenta de usuario inactiva');
            }
            res.render('editarPerfilUsuario', { perfil: results[0] });
        })
    })
};

const getEditarPerfilEmpresa = (req, res) => {
    pool.getConnection((err, connection) => {
        // Comprobar errores de conexión
        if(err) {
            console.error('Error al obtener la conexión a la base de datos:', err); 
            return res.status(500).send('Error al obtener la conexión a la base de datos'); 
        }

        const empresaId = parseInt(req.params.id, 10); 
        connection.query('SELECT * FROM empresas WHERE id_empresa = ?', [empresaId], (err, results) => {
            connection.release(); 
            if (err) { // Comprobar errores de consulta
                console.error('Error al ejecutar la consulta:', err); 
                return res.status(500).send('Error al recuperar los datos de la empresa'); 
            }
            if (results.length === 0) { // Comprobar si la empresa existe
                return res.status(404).send('Empresa no encontrada'); 
            } else if (results[0].activo === 0) { // Comprobar si la empresa está activa
                return res.status(403).send('Cuenta de empresa inactiva');
            }
            res.render('editarPerfilEmpresa', { empresa: results[0] });
        })
    })
}

const postEditarPerfilUsuario = (req, res) => {
    const errors = validationResult(req);
    const fotoNueva = req.file ? '/uploads/' + req.file.filename : null;

    const usuarioActual = {
        id_usuario: req.params.id,
        nombre_completo: req.body.nombre_completo,
        nombre_usuario: req.body.nombre_usuario,
        correo: req.body.correo,
        fecha_nacimiento: req.body.fecha_nacimiento,
        telefono: req.body.telefono,
        ciudad: req.body.ciudad,
        pais: req.body.pais,
        codigo_postal: req.body.codigo_postal,
        genero: req.body.genero,
        trabajo: req.body.trabajo,
        bio: req.body.bio
    };

    // Comprobar si hay errores de validación
    if (!errors.isEmpty()) {
        return res.status(400).render('editarPerfilUsuario', { 
            perfil: usuarioActual, 
            error: 'Por favor corrige los errores en el formulario', 
            errores: errors.array()
        }); 
    }

    const { nombre_completo, nombre_usuario, correo, fecha_nacimiento, telefono, ciudad, pais, codigo_postal, genero, trabajo, bio, password_actual, password_nueva } = req.body;
    const usuarioId = parseInt(req.params.id, 10); 

    pool.getConnection((err, connection) => {
        // Comprobar errores de conexión
        if (err) {
            console.error('Error al obtener la conexión a la base de datos:', err); 
            return res.status(500).send('Error al obtener la conexión a la base de datos'); 
        }

        // 0. Comprobar si el usuario existe y está activo
        connection.query('SELECT * FROM usuarios WHERE id_usuario = ?', [usuarioId], (err, results) => {
            if (err) {
                connection.release();
                console.error('Error al ejecutar la consulta:', err);
                return res.status(500).send('Error al recuperar los datos del usuario');
            }
            if (results.length === 0) {
                connection.release();
                return res.status(404).send('Usuario no encontrado');
            } else if (results[0].activo === 0) {
                connection.release();
                return res.status(403).send('Cuenta de usuario inactiva');
            }

            // 1. Comprobar correo
            connection.query('SELECT id_usuario FROM usuarios WHERE correo = ? AND id_usuario != ?', [correo, usuarioId], (err, results) => {
                if (err) {
                    connection.release();
                    return res.status(500).send('Error al verificar el correo');
                }
                if (results.length > 0) {
                    connection.release();
                    return res.status(400).render('editarPerfilUsuario', {
                        perfil: usuarioActual,
                        error: 'El correo electrónico ya está en uso',
                        errores: []
                    });
                }

                // 2. Comprobar nombre de usuario
                connection.query('SELECT id_usuario FROM usuarios WHERE nombre_usuario = ? AND id_usuario != ?', [nombre_usuario, usuarioId], (err, results) => {
                    if (err) {
                        connection.release();
                        return res.status(500).send('Error al verificar el nombre de usuario');
                    }
                    if (results.length > 0) {
                        connection.release();
                        return res.status(400).render('editarPerfilUsuario', {
                            perfil: usuarioActual,
                            error: 'El nombre de usuario ya está en uso',
                            errores: []
                        });
                    }

                    // 3. Comprobar teléfono
                    connection.query('SELECT id_usuario FROM usuarios WHERE telefono = ? AND id_usuario != ?', [telefono, usuarioId], (err, results) => {
                        if (err) {
                            connection.release();
                            return res.status(500).send('Error al verificar el teléfono');
                        }
                        if (results.length > 0) {
                            connection.release();
                            return res.status(400).render('editarPerfilUsuario', {
                                perfil: usuarioActual,
                                error: 'El teléfono ya está en uso',
                                errores: []
                            });
                        }

                        // 4. Recuperar contraseña y foto actual
                        connection.query('SELECT contraseña, foto FROM usuarios WHERE id_usuario = ?', [usuarioId], async (err, results) => {
                            if (err) {
                                connection.release();
                                return res.status(500).send('Error al obtener los datos del usuario');
                            }

                            // Si se proporciona una contraseña nueva, validar la actual
                            if (password_nueva && password_nueva.trim()) {
                                try {
                                    const isPasswordCorrect = await bcrypt.compare(password_actual, results[0].contraseña);
                                    
                                    if (!isPasswordCorrect) {
                                        connection.release();
                                        return res.status(400).render('editarPerfilUsuario', {
                                            perfil: usuarioActual,
                                            error: 'La contraseña actual no es correcta',
                                            errores: []
                                        });
                                    }

                                    // Hashear la nueva contraseña
                                    const hashedPassword = await bcrypt.hash(password_nueva, 10);
                                    const fotoFinal = fotoNueva || results[0].foto;

                                    const sql_update = `UPDATE usuarios SET 
                                        nombre_completo = ?, 
                                        nombre_usuario = ?,
                                        correo = ?,
                                        fecha_nacimiento = ?,
                                        telefono = ?,
                                        ciudad = ?,
                                        pais = ?,
                                        codigo_postal = ?,
                                        genero = ?,
                                        trabajo = ?,
                                        bio = ?, 
                                        contraseña = ?,
                                        foto = ?
                                    WHERE id_usuario = ?`;
                                    
                                    connection.query(sql_update, [nombre_completo, nombre_usuario, correo, fecha_nacimiento, telefono, ciudad, pais, codigo_postal, genero, trabajo, bio, hashedPassword, fotoFinal, usuarioId], (err) => {
                                        connection.release();
                                        if (err) {
                                            console.error('Error al ejecutar la consulta:', err);
                                            return res.status(500).send('Error al actualizar los datos del usuario');
                                        }
                                        res.redirect('/user/perfilUsuario/' + usuarioId);
                                    });
                                } catch (error) {
                                    connection.release();
                                    console.error('Error al procesar la contraseña:', error);
                                    return res.status(500).send('Error al procesar la contraseña');
                                }
                            } else {
                                // No cambiar la contraseña, mantener la actual
                                const contrasenhaFinal = results[0].contraseña;
                                const fotoFinal = fotoNueva || results[0].foto;

                                const sql_update = `UPDATE usuarios SET 
                                    nombre_completo = ?, 
                                    nombre_usuario = ?,
                                    correo = ?,
                                    fecha_nacimiento = ?,
                                    telefono = ?,
                                    ciudad = ?,
                                    pais = ?,
                                    codigo_postal = ?,
                                    genero = ?,
                                    trabajo = ?,
                                    bio = ?, 
                                    contraseña = ?,
                                    foto = ?
                                WHERE id_usuario = ?`;
                                
                                connection.query(sql_update, [nombre_completo, nombre_usuario, correo, fecha_nacimiento, telefono, ciudad, pais, codigo_postal, genero, trabajo, bio, contrasenhaFinal, fotoFinal, usuarioId], (err) => {
                                    connection.release();
                                    if (err) {
                                        console.error('Error al ejecutar la consulta:', err);
                                        return res.status(500).send('Error al actualizar los datos del usuario');
                                    }
                                    res.redirect('/user/perfilUsuario/' + usuarioId);
                                });
                            }
                        });
                    }); 
                }); 
            });
        }); 
    });
}; 

const postEditarPerfilEmpresa = (req, res) => {
    const errors = validationResult(req);
    const fotoNueva = req.file ? '/uploads/' + req.file.filename : null;
    const tipoSeleccionado = req.body.tipo;
    const tipoOtroGuardado = tipoSeleccionado === 'otro' ? (req.body.tipo_otro || '').trim() : null;

    const cifNorm = (req.body.cif || '').trim().toUpperCase();
    const empresaActual = {
        id_empresa: req.params.id,
        nombre: req.body.nombre,
        correo: req.body.correo,
        telefono_contacto: req.body.telefono_contacto,
        CIF: cifNorm,
        cif: cifNorm,
        tipo: tipoSeleccionado,
        tipo_otro: req.body.tipo_otro,
        ubicacion: req.body.ubicacion,
        descripcion: req.body.descripcion, 
        foto: fotoNueva
    };

    // Comprobar si hay errores de validación
    if (!errors.isEmpty()) {
        return res.status(400).render('editarPerfilEmpresa', {
            empresa: empresaActual,
            error: 'Por favor corrige los errores en el formulario',
            errores: errors.array()
        });
    }

    const { nombre, correo, telefono_contacto, ubicacion, descripcion, password_actual, password_nueva } = req.body;
    const cifNormalizado = cifNorm;
    const empresaId = parseInt(req.params.id, 10);

    pool.getConnection((err, connection) => {
        // Comprobar errores de conexión
        if (err) {
            console.error('Error al obtener la conexión a la base de datos:', err);
            return res.status(500).send('Error al obtener la conexión a la base de datos');
        }

        // 0. Comprobar si la empresa existe y está activa
        connection.query('SELECT * FROM empresas WHERE id_empresa = ?', [empresaId], (err, results) => {
            if (err) {
                connection.release();
                console.error('Error al ejecutar la consulta:', err);
                return res.status(500).send('Error al recuperar los datos de la empresa');
            }
            if (results.length === 0) {
                connection.release();
                return res.status(404).send('Empresa no encontrada');
            } else if (results[0].activo === 0) {
                connection.release();
                return res.status(403).send('Cuenta de empresa inactiva');
            }

            // 1. Comprobar correo
            connection.query('SELECT id_empresa FROM empresas WHERE correo = ? AND id_empresa != ?', [correo, empresaId], (err, results) => {
                if (err) {
                    connection.release();
                    return res.status(500).send('Error al verificar el correo');
                }
                if (results.length > 0) {
                    connection.release();
                    return res.status(400).render('editarPerfilEmpresa', {
                        empresa: empresaActual,
                        error: 'El correo electrónico ya está en uso',
                        errores: []
                    });
                }

                // 2. Comprobar CIF
                connection.query('SELECT id_empresa FROM empresas WHERE CIF = ? AND id_empresa != ?', [cifNormalizado, empresaId], (err, results) => {
                    if (err) {
                        connection.release();
                        return res.status(500).send('Error al verificar el CIF');
                    }
                    if (results.length > 0) {
                        connection.release();
                        return res.status(400).render('editarPerfilEmpresa', {
                            empresa: empresaActual,
                            error: 'El CIF ya está registrado',
                            errores: []
                        });
                    }

                    // 3. Recuperar contraseña y foto actual
                    connection.query('SELECT contraseña, foto FROM empresas WHERE id_empresa = ?', [empresaId], async (err, results) => {
                        if (err) {
                            connection.release();
                            return res.status(500).send('Error al obtener los datos de la empresa');
                        }

                        // Si se proporciona una contraseña nueva, validar la actual
                        if (password_nueva && password_nueva.trim()) {
                            try {
                                const isPasswordCorrect = await bcrypt.compare(password_actual, results[0].contraseña);
                                
                                if (!isPasswordCorrect) {
                                    connection.release();
                                    return res.status(400).render('editarPerfilEmpresa', {
                                        empresa: empresaActual,
                                        error: 'La contraseña actual no es correcta',
                                        errores: []
                                    });
                                }

                                // Hashear la nueva contraseña
                                const hashedPassword = await bcrypt.hash(password_nueva, 10);
                                const fotoFinal = fotoNueva || results[0].foto;

                                const sql_update = `UPDATE empresas SET
                                    nombre = ?,
                                    correo = ?,
                                    telefono_contacto = ?,
                                    CIF = ?,
                                    tipo = ?,
                                    tipo_otro = ?,
                                    ubicacion = ?,
                                    descripcion = ?,
                                    contraseña = ?,
                                    foto = ?
                                WHERE id_empresa = ?`;
                                
                                connection.query(sql_update, [nombre, correo, telefono_contacto, cifNormalizado, tipoSeleccionado, tipoOtroGuardado, ubicacion, descripcion, hashedPassword, fotoFinal, empresaId], (err) => {
                                    connection.release();
                                    if (err) {
                                        console.error('Error al ejecutar la consulta:', err);
                                        return res.status(500).send('Error al actualizar los datos de la empresa');
                                    }
                                    res.redirect('/user/perfilEmpresa/' + empresaId);
                                });
                            } catch (error) {
                                connection.release();
                                console.error('Error al procesar la contraseña:', error);
                                return res.status(500).send('Error al procesar la contraseña');
                            }
                        } else {
                            // No cambiar la contraseña, mantener la actual
                            const contrasenhaFinal = results[0].contraseña;
                            const fotoFinal = fotoNueva || results[0].foto;

                            const sql_update = `UPDATE empresas SET
                                nombre = ?,
                                correo = ?,
                                telefono_contacto = ?,
                                CIF = ?,
                                tipo = ?,
                                tipo_otro = ?,
                                ubicacion = ?,
                                descripcion = ?,
                                contraseña = ?,
                                foto = ?
                            WHERE id_empresa = ?`;
                            
                            connection.query(sql_update, [nombre, correo, telefono_contacto, cifNormalizado, tipoSeleccionado, tipoOtroGuardado, ubicacion, descripcion, contrasenhaFinal, fotoFinal, empresaId], (err) => {
                                connection.release();
                                if (err) {
                                    console.error('Error al ejecutar la consulta:', err);
                                    return res.status(500).send('Error al actualizar los datos de la empresa');
                                }
                                res.redirect('/user/perfilEmpresa/' + empresaId);
                            });
                        }
                    });
                });
            });
        }); 
    });
};

const postEliminarCuentaUsuario = (req, res) => {
    const usuarioId = parseInt(req.params.id, 10);

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al obtener la conexión a la base de datos:', err);
            return res.status(500).send('Error al obtener la conexión a la base de datos');
        }
        connection.query('UPDATE usuarios SET activo = 0 WHERE id_usuario = ?', [usuarioId], (err) => {
            connection.release();
            if (err) {
                console.error('Error al eliminar la cuenta del usuario:', err);
                return res.status(500).send('Error al eliminar la cuenta del usuario');
            }
            res.redirect('/auth/logout');
        });
    });
};

const postEliminarCuentaEmpresa = (req, res) => {
    const empresaId = parseInt(req.params.id, 10);

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al obtener la conexión a la base de datos:', err);
            return res.status(500).send('Error al obtener la conexión a la base de datos');
        }
        connection.query('UPDATE empresas SET activo = 0 WHERE id_empresa = ?', [empresaId], (err) => {
            connection.release();
            if (err) {
                console.error('Error al eliminar la cuenta de la empresa:', err);
                return res.status(500).send('Error al eliminar la cuenta de la empresa');
            }
            res.redirect('/auth/logout');
        });
    });
}

const getReportarValoracion = (req, res) => {
    const esAjax = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest';
    if (!esAjax) {
        return res.redirect(`/user/perfilUsuario/${req.params.id_perfil}`);
    }

    res.render('plantillas/reportar', {
        usuario: req.session.usuario || null,
        tipo: 'valoracion',
        action: `/user/perfilUsuario/${req.params.id_perfil}/valoracion/${req.params.id_valoracion}/usuario/${req.params.id_autor}/reportar`,
        error: null,
        errores: [],
        reporte: {
            motivo: '',
            fecha: new Date().toISOString().slice(0, 19).replace('T', ' '),
            id_usuario_reportado: req.params.id_autor,
            id_foro: null,
            id_comentario: null,
            id_valoracion: req.params.id_valoracion
        }
    });
};

const postReportarValoracion = (req, res) => {
    const usuario = req.session.usuario;
    const id_autor = usuario ? usuario.id : null;
    const id_perfil = parseInt(req.params.id_perfil, 10);
    const id_valoracion = parseInt(req.params.id_valoracion, 10);
    const id_usuario_reportado = parseInt(req.params.id_autor, 10);
    const { motivo, fecha, descripcion } = req.body;
    const estado = 'pendiente';
    const motivosPermitidos = ['spam', 'lenguaje_ofensivo', 'contenido_inapropiado', 'informacion_falsa'];

    if (!id_autor) {
        return res.status(401).send('Debes iniciar sesion para reportar contenido');
    }

    if (Number.isNaN(id_valoracion) || Number.isNaN(id_usuario_reportado)) {
        return res.status(400).send('Parametros invalidos');
    }

    if (!motivo || !motivosPermitidos.includes(motivo)) {
        return res.status(400).send('Motivo de reporte invalido');
    }

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

        const sql = `
            INSERT INTO reportes
                (motivo, estado, fecha, id_autor, id_usuario_reportado, id_foro, id_comentario, id_valoracion, descripcion)
            VALUES
                (?, ?, ?, ?, ?, NULL, NULL, ?, ?)
        `;

        connection.query(sql, [motivo, estado, fechaReporte, id_autor, id_usuario_reportado, id_valoracion, descripcionLimpia], (insertErr) => {
            connection.release();
            if (insertErr) {
                console.error('Error al crear el reporte de la valoracion:', insertErr);
                return res.status(500).send('Error al crear el reporte');
            }
            return res.redirect(`/user/perfilUsuario/${id_perfil}?reporte=ok&tipo=valoracion`);
        });
    });
};

module.exports = {
    getPerfilUsuario,
    getPerfilEmpresa, 
    getEditarPerfilUsuario, 
    getEditarPerfilEmpresa, 
    postEditarPerfilUsuario, 
    postEditarPerfilEmpresa, 
    postEliminarCuentaUsuario,
    postEliminarCuentaEmpresa, 
    getReportarValoracion,
    postReportarValoracion
};