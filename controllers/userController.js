"use strict";

const { validationResult } = require('express-validator');
const pool = require('../db'); 

const getPerfilUsuario = (req, res) => {
    pool.getConnection((err, connection) => {
        // Comprobar errores de conexión
        if (err) {
            console.error('Error al obtener la conexión a la base de datos:', err); 
            return res.status(500).send('Error al obtener la conexión a la base de datos'); 
        }

        const usuarioId = parseInt(req.params.id, 10); 
        connection.query('SELECT * FROM usuarios WHERE id_usuario = ?', [usuarioId], (err, results) => {
            connection.release(); 

            if (err) { // Comprobar errores de consulta
                console.error('Error al ejecutar la consulta:', err); 
                return res.status(500).send('Error al recuperar los datos del usuario'); 
            }

            if (results.length === 0) { // Comprobar si el usuario existe
                return res.status(404).send('Usuario no encontrado'); 
            } else if (results[0].activo === 0) { // Comprobar si el usuario está activo
                return res.status(403).send('Cuenta de usuario inactiva');
            }

            // TODO: Falta recoger bien las mascotas 
            res.render('perfilUsuario', { usuario: results[0], mascotas: [] });
        })
    })
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

            res.render('perfilEmpresa', {
                empresa: results[0], 
                valoraciones: [], //TODO: Falta recoger bien las valoraciones
                esPropia: true //TODO: Falta comprobar si la empresa es propia o no
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
            res.render('editarPerfilUsuario', { usuario: results[0] });
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
        nombre_completo: req.body.nombre,
        nombre_usuario: req.body.usuario,
        correo: req.body.email,
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
            usuario: usuarioActual, 
            error: 'Por favor corrige los errores en el formulario', 
            errores: errors.array()
        }); 
    }

    const { nombre, usuario, email, fecha_nacimiento, telefono, ciudad, pais, codigo_postal, genero, trabajo, bio, password_actual, password_nueva } = req.body;
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
            connection.query('SELECT id_usuario FROM usuarios WHERE correo = ? AND id_usuario != ?', [email, usuarioId], (err, results) => {
                if (err) {
                    connection.release();
                    return res.status(500).send('Error al verificar el correo');
                }
                if (results.length > 0) {
                    connection.release();
                    return res.status(400).render('editarPerfilUsuario', {
                        usuario: usuarioActual,
                        error: 'El correo electrónico ya está en uso',
                        errores: []
                    });
                }

                // 2. Comprobar nombre de usuario
                connection.query('SELECT id_usuario FROM usuarios WHERE nombre_usuario = ? AND id_usuario != ?', [usuario, usuarioId], (err, results) => {
                    if (err) {
                        connection.release();
                        return res.status(500).send('Error al verificar el nombre de usuario');
                    }
                    if (results.length > 0) {
                        connection.release();
                        return res.status(400).render('editarPerfilUsuario', {
                            usuario: usuarioActual,
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
                                usuario: usuarioActual,
                                error: 'El teléfono ya está en uso',
                                errores: []
                            });
                        }

                        // 4. Recuperar contraseña y foto actual
                        connection.query('SELECT contraseña, foto FROM usuarios WHERE id_usuario = ?', [usuarioId], (err, results) => {
                            if (err) {
                                connection.release();
                                return res.status(500).send('Error al obtener los datos del usuario');
                            }

                            if (password_nueva && results[0].contraseña !== password_actual) {
                                connection.release();
                                return res.status(400).render('editarPerfilUsuario', {
                                    usuario: usuarioActual,
                                    error: 'La contraseña actual no es correcta',
                                    errores: []
                                });
                            }

                            const contrasenhaFinal = password_nueva || results[0].contraseña;
                            const fotoFinal = fotoNueva || results[0].foto;

                            ejecutarUpdate(connection, [nombre, usuario, email, fecha_nacimiento, telefono, ciudad, pais, codigo_postal, genero, trabajo, bio, contrasenhaFinal, fotoFinal, usuarioId], res, usuarioId);
                        });
                    });
                });
            });

            function ejecutarUpdate(connection, params, res, usuarioId) {
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
                connection.query(sql_update, params, (err) => {
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
};

const postEditarPerfilEmpresa = (req, res) => {
    const errors = validationResult(req);
    const fotoNueva = req.file ? '/uploads/' + req.file.filename : null;

    const empresaActual = {
        id_empresa: req.params.id,
        nombre_empresa: req.body.nombre_empresa,
        email: req.body.email,
        telefono_contacto: req.body.telefono,
        cif: req.body.cif,
        tipo_empresa: req.body.tipo_empresa,
        tipo_empresa_otro: req.body.tipo_empresa_otro,
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

    const { nombre_empresa, email, telefono, cif, tipo_empresa, ubicacion, descripcion, password_actual, password_nueva } = req.body;
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
            connection.query('SELECT id_empresa FROM empresas WHERE correo = ? AND id_empresa != ?', [email, empresaId], (err, results) => {
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
                connection.query('SELECT id_empresa FROM empresas WHERE cif = ? AND id_empresa != ?', [cif, empresaId], (err, results) => {
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
                    connection.query('SELECT contraseña, foto FROM empresas WHERE id_empresa = ?', [empresaId], (err, results) => {
                        if (err) {
                            connection.release();
                            return res.status(500).send('Error al obtener los datos de la empresa');
                        }

                        const contrasenhaFinal = password_nueva
                            ? (results[0].contraseña !== password_actual
                                ? null  // contraseña incorrecta, se gestiona abajo
                                : password_nueva)
                            : results[0].contraseña;

                        if (password_nueva && results[0].contraseña !== password_actual) {
                            connection.release();
                            return res.status(400).render('editarPerfilEmpresa', {
                                empresa: empresaActual,
                                error: 'La contraseña actual no es correcta',
                                errores: []
                            });
                        }

                        const fotoFinal = fotoNueva || results[0].foto;

                        ejecutarUpdate(connection, [nombre_empresa, email, telefono, cif, tipo_empresa, ubicacion, descripcion, contrasenhaFinal, fotoFinal, empresaId], res, empresaId);
                    });
                });
            });

            function ejecutarUpdate(connection, params, res, empresaId) {
                const sql_update = `UPDATE empresas SET
                    nombre = ?,
                    correo = ?,
                    telefono_contacto = ?,
                    CIF = ?,
                    tipo = ?,
                    ubicacion = ?,
                    descripcion = ?,
                    contraseña = ?,
                    foto = ?
                WHERE id_empresa = ?`;
                connection.query(sql_update, params, (err) => {
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

module.exports = {
    getPerfilUsuario,
    getPerfilEmpresa, 
    getEditarPerfilUsuario, 
    getEditarPerfilEmpresa, 
    postEditarPerfilUsuario, 
    postEditarPerfilEmpresa, 
    postEliminarCuentaUsuario,
    postEliminarCuentaEmpresa
};