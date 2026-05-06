"use strict"; 

const { validationResult } = require('express-validator');
const pool = require('../db'); 
const { createHttpError } = require('../handlers/httpErrors');
const bcrypt = require('bcrypt');

const AUTH_ERROR_CODES = Object.freeze({
    ACCOUNT_BANNED: 'AUTH_ACCOUNT_BANNED',
    ACCOUNT_SUSPENDED: 'AUTH_ACCOUNT_SUSPENDED'
});

const crearErrorCuentaBaneada = (mensaje = 'La cuenta está baneada y no puede acceder a PetCare.') => ({
    status: 403,
    codigo: AUTH_ERROR_CODES.ACCOUNT_BANNED,
    mensaje
});

const crearErrorCuentaSuspendida = (mensaje = 'La cuenta está suspendida temporalmente.') => ({
    status: 423,
    codigo: AUTH_ERROR_CODES.ACCOUNT_SUSPENDED,
    mensaje
});

const renderAuthStatusError = (next, authError) => {
    return next(createHttpError(authError.status || 403, authError.mensaje, authError.codigo || null));
};

// TODO: Queda pendiente verificación de cuentas inactivas y doble factor para cuentas inactivas. También queda pendiente recuperar contraseña.

const getRegister = (req, res) => {
    res.render('register', { 
        error: null,    // titulo del error general (ej: "Por favor, corrige los errores en el formulario.")
        errores: [],    // Array de errores específicos de cada campo, generalmente enviado después de validar con express-validator
        formData: null, // Para rellenar el formulario con los datos que el usuario había introducido antes de que se produjera un error
        formType: null  // Identificar el tipo de formulario (usuario o empresa)
    });
};

const getLogin = (req, res) => {
    res.render('login', { 
        error: null, 
        errores: [], 
        formData: null,
        formType: null
    });
};

const postRegisterUsuario = async (req, res, next) => {
    const errores = validationResult(req);

    if (!errores.isEmpty()) {
        return res.status(400).render('register', {
            error: 'Por favor, corrige los errores en el formulario.',
            errores: errores.array(),
            formData: req.body,
            formType: 'usuario'
        });
    }

    const { nombre_completo, correo, nombre_usuario, telefono, password, fecha_nacimiento } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        pool.getConnection((err, connection) => {
            if (err) {
                console.error("Error al conectar a la base de datos:", err);
                return res.status(500).send("Error al conectar a la base de datos");
            }

            // 1. Comprobar email
            connection.query("SELECT id_usuario, ban FROM usuarios WHERE correo = ?", [correo], (err, results) => {
                if (err) {
                    connection.release();
                    console.error("Error al verificar el correo:", err);
                    return res.status(500).send("Error al verificar el correo");
                }

                if (results.some((usuario) => Number(usuario.ban) === 1)) {
                    connection.release();
                    return renderAuthStatusError(next, crearErrorCuentaBaneada('No puedes registrarte con un correo asociado a una cuenta baneada.'));
                }

                if (results.length > 0) {
                    connection.release();
                    return res.render('register', {
                        error: 'El correo electrónico ya está registrado.',
                        errores: [], 
                        formData: req.body, 
                        formType: 'usuario'
                    });
                }

                // 2. Comprobar usuario
                connection.query("SELECT id_usuario FROM usuarios WHERE nombre_usuario = ?", [nombre_usuario], (err, results) => {
                    if (err) {
                        connection.release();
                        console.error("Error al verificar el nombre de usuario:", err);
                        return res.status(500).send("Error al verificar el nombre de usuario");
                    }
                    if (results.length > 0) {
                        connection.release();
                        return res.render('register', {
                            error: 'El nombre de usuario ya está en uso.',
                            errores: [], 
                            formData: req.body,
                            formType: 'usuario'
                        });
                    }

                    // 3. Comprobar teléfono
                    connection.query("SELECT id_usuario, ban FROM usuarios WHERE telefono = ?", [telefono], (err, results) => {
                        if (err) {
                            connection.release();
                            console.error("Error al verificar el teléfono:", err);
                            return res.status(500).send("Error al verificar el teléfono");
                        }

                        if (results.some((usuario) => Number(usuario.ban) === 1)) {
                            connection.release();
                            return renderAuthStatusError(next, crearErrorCuentaBaneada('No puedes registrarte con un teléfono asociado a una cuenta baneada.'));
                        }

                        if (results.length > 0) {
                            connection.release();
                            return res.render('register', {
                                error: 'El teléfono ya está registrado.',
                                errores: [], 
                                formData: req.body, 
                                formType: 'usuario'
                            });
                        }

                        // 4. Insertar
                        const insert_query = "INSERT INTO usuarios (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña) VALUES (?, ?, ?, ?, ?, ?)";
                        connection.query(insert_query, [nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, hashedPassword], (err, results) => {
                            connection.release();
                            if (err) {
                                console.error("Error al ejecutar la consulta de inserción:", err);
                                return res.status(500).send("Error al registrar el usuario");
                            }
                            const fotoUsuario = null; 
                            req.session.usuario = {
                                id:     results.insertId,
                                nombre_completo: nombre_completo, 
                                nombre_usuario: nombre_usuario, 
                                foto: fotoUsuario,
                                tipo: 'usuario',
                                rol: 'user'
                            };
                            res.redirect('/services');
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error("Error al hashear la contraseña:", error);
        return res.status(500).send("Error interno del servidor");
    }
};

const postRegisterEmpresa = async (req, res, next) => {
    const errores = validationResult(req);

    if (!errores.isEmpty()) {
        return res.status(400).render('register', {
            error: 'Por favor, corrige los errores en el formulario.',
            errores: errores.array(),
            formData: req.body,
            formType: 'empresa'
        });
    }

    const { nombre, correo, telefono_contacto, password, cif, tipo, tipo_otro } = req.body;
    const cifNormalizado = (cif || '').trim().toUpperCase();
    req.body.cif = cifNormalizado;
    const tipoOtroGuardado = tipo === 'otro' ? tipo_otro.trim() : null;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        pool.getConnection((err, connection) => {
            if (err) {
                console.error("Error al conectar a la base de datos:", err);
                return res.status(500).send("Error al conectar a la base de datos");
            }

            connection.query("SELECT id_usuario, ban FROM usuarios WHERE correo = ?", [correo], (errorCorreoBan, usuariosCoincidentes) => {
                if (errorCorreoBan) {
                    connection.release();
                    console.error("Error al verificar el correo baneado:", errorCorreoBan);
                    return res.status(500).send("Error al verificar el correo");
                }

                if (usuariosCoincidentes.some((usuario) => Number(usuario.ban) === 1)) {
                    connection.release();
                    return renderAuthStatusError(next, crearErrorCuentaBaneada('No puedes registrarte con un correo asociado a una cuenta baneada.'));
                }

                connection.query("SELECT id_empresa FROM empresas WHERE correo = ?", [correo], (errorCorreo, empresasCorreo) => {
                    if (errorCorreo) {
                        connection.release();
                        console.error("Error al verificar el correo:", errorCorreo);
                        return res.status(500).send("Error al verificar el correo");
                    }

                    if (empresasCorreo.length > 0) {
                        connection.release();
                        return res.render('register', {
                            error: 'El correo electrónico ya está registrado.',
                            errores: [],
                            formData: req.body,
                            formType: 'empresa'
                        });
                    }

                    connection.query("SELECT id_empresa FROM empresas WHERE CIF = ?", [cifNormalizado], (errorCif, empresasCif) => {
                        if (errorCif) {
                            connection.release();
                            console.error("Error al verificar el CIF:", errorCif);
                            return res.status(500).send("Error al verificar el CIF");
                        }

                        if (empresasCif.length > 0) {
                            connection.release();
                            return res.render('register', {
                                error: 'El CIF ya está registrado.',
                                errores: [],
                                formData: req.body,
                                formType: 'empresa'
                            });
                        }

                        connection.query("SELECT id_usuario, ban FROM usuarios WHERE telefono = ?", [telefono_contacto], (errorTelefonoBan, usuariosTelefono) => {
                            if (errorTelefonoBan) {
                                connection.release();
                                console.error("Error al verificar el teléfono baneado:", errorTelefonoBan);
                                return res.status(500).send("Error al verificar el teléfono");
                            }

                            if (usuariosTelefono.some((usuario) => Number(usuario.ban) === 1)) {
                                connection.release();
                                return renderAuthStatusError(next, crearErrorCuentaBaneada('No puedes registrarte con un teléfono asociado a una cuenta baneada.'));
                            }

                            connection.query("SELECT id_empresa FROM empresas WHERE telefono_contacto = ?", [telefono_contacto], (errorTelefono, empresasTelefono) => {
                                if (errorTelefono) {
                                    connection.release();
                                    console.error("Error al verificar el teléfono:", errorTelefono);
                                    return res.status(500).send("Error al verificar el teléfono");
                                }

                                if (empresasTelefono.length > 0) {
                                    connection.release();
                                    return res.render('register', {
                                        error: 'El teléfono ya está registrado.',
                                        errores: [],
                                        formData: req.body,
                                        formType: 'empresa'
                                    });
                                }

                                const insert_query = "INSERT INTO empresas (nombre, correo, contraseña, CIF, telefono_contacto, tipo, tipo_otro) VALUES (?, ?, ?, ?, ?, ?, ?)";
                                connection.query(insert_query, [nombre, correo, hashedPassword, cifNormalizado, telefono_contacto, tipo, tipoOtroGuardado], (insertErr, results) => {
                                    connection.release();
                                    if (insertErr) {
                                        console.error("Error al insertar la empresa:", insertErr);
                                        return res.status(500).send("Error al insertar la empresa");
                                    }
                                    const fotoEmpresa = null;
                                    req.session.usuario = {
                                        id: results.insertId,
                                        nombre,
                                        fotoEmpresa, 
                                        tipo: 'empresa'
                                    };

                                    return res.redirect('/');
                                });
                            });
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error("Error al hashear la contraseña:", error);
        return res.status(500).send("Error interno del servidor");
    }
};

const postLoginUsuario = async (req, res, next) => {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }

        const { usuario_input, password } = req.body; 

        const query = "SELECT * FROM usuarios WHERE correo = ? OR telefono = ? OR nombre_usuario = ?";
        connection.query(query, [usuario_input, usuario_input, usuario_input], async (err, results) => {
            connection.release();
            // Comprobar errores en la consulta
            if (err) {
                console.error("Error al ejecutar la consulta de login:", err);
                return res.status(500).send("Error al ejecutar la consulta de login");
            }

            // 1. Comprobar si la cuenta existe y está activa
            if (results.length === 0) {
                return res.render('login', { 
                    error: 'Datos del formulario incorrectos', 
                    errores: [], 
                    formData: req.body,
                    formType: 'usuario'
                });
            }

            const usuario = results[0];

            if (Number(usuario.ban) === 1) {
                return renderAuthStatusError(next, crearErrorCuentaBaneada('Tu cuenta ha sido baneada. Si crees que se trata de un error, contacta con soporte.'));
            }

            if (Number(usuario.suspendido) === 1) {
                return renderAuthStatusError(next, crearErrorCuentaSuspendida('Tu cuenta está suspendida temporalmente. Contacta con soporte para más información.'));
            }

            if (Number(usuario.activo) === 0) {
                return res.render('login', { 
                    error: 'Cuenta inactiva. Por favor, contacta con soporte.',
                    errores: [],
                    formData: req.body,
                    formType: 'usuario' 
                });
            }

            // 2. Comprobar contraseña
            try {
                const isMatch = await bcrypt.compare(password, usuario.contraseña);
                if (!isMatch) {
                    return res.render('login', { 
                        error: 'Datos del formulario incorrectos', 
                        errores: [], 
                        formData: req.body,
                        formType: 'usuario' 
                    });
                }
            } catch (error) {
                console.error("Error al comparar la contraseña:", error);
                return res.status(500).send("Error interno del servidor");
            }

            // 3. Guardar en sesión
            const fotoUsuario = usuario.foto;
            req.session.usuario = {
                id: usuario.id_usuario,
                nombre_usuario: usuario.nombre_usuario,
                nombre_completo: usuario.nombre_completo,
                foto: fotoUsuario,
                tipo: 'usuario', 
                rol: usuario.rol
            };
            res.redirect('/services');
        }); 
    })
};

const postLoginEmpresa = async (req, res) => {

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos"); 
        }

        const { correo, password } = req.body;
        
        const query = "SELECT * FROM empresas WHERE correo = ?";
        connection.query(query, [correo], async (err, results) => {
            connection.release();
            if (err) {
                console.error("Error al ejecutar la consulta de login:", err);
                return res.status(500).send("Error al ejecutar la consulta de login");
            }

            // 1. Comprobar si existe la cuenta y está activa
            if (results.length === 0) {
                return res.render('login', { 
                    error: 'Datos del formulario incorrectos', 
                    errores: [], 
                    formData: req.body,
                    formType: 'empresa' 
                });
            } else if (results[0].activo === 0) {
                return res.render('login', { 
                    error: 'Cuenta inactiva. Por favor, contacta con soporte.',
                    errores: [],
                    formData: req.body,
                    formType: 'empresa' 
                });
            }

            // 2. Comprobar contraseña
            const empresa = results[0];
            try {
                const isMatch = await bcrypt.compare(password, empresa.contraseña);
                if (!isMatch) {
                    return res.render('login', { 
                        error: 'Datos del formulario incorrectos', 
                        errores: [], 
                        formData: req.body,
                        formType: 'empresa' 
                    });
                }
            } catch (error) {
                console.error("Error al comparar la contraseña:", error);
                return res.status(500).send("Error interno del servidor");
            }

            // 3. Guardar en sesión
            const fotoEmpresa = empresa.foto;
            req.session.usuario = {
                id: empresa.id_empresa,
                nombre: empresa.nombre,
                tipo: 'empresa',
                foto: fotoEmpresa
            };
            res.redirect('/');
        });
    })
};

const logout = (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('Error al cerrar sesión:', err);
        res.redirect('/');
    });
};

const getRecuperarContrasena = (req, res) => {
    res.render('recuperarContrasena', {
        error: null,
        errores: [],
        formData: null,
        formType: null
    });
}; 

module.exports = {
    getRegister,
    getLogin,
    postRegisterUsuario,
    postRegisterEmpresa, 
    postLoginUsuario,
    postLoginEmpresa,
    logout, 
    getRecuperarContrasena
};