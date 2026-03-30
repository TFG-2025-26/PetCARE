"use strict"; 

const { validationResult } = require('express-validator');
const pool = require('../db'); 

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

const postRegisterUsuario = (req, res) => {
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

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).render('error500', { mensaje: "Error al conectar a la base de datos" });
        }

        // 1. Comprobar email
        connection.query("SELECT id_usuario FROM usuarios WHERE correo = ?", [correo], (err, results) => {
            if (err) {
                connection.release();
                console.error("Error al verificar el correo:", err);
                return res.status(500).render('error500', { mensaje: "Error al verificar el correo" });
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
                    return res.status(500).render('error500', { mensaje: "Error al verificar el nombre de usuario" });
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
                connection.query("SELECT id_usuario FROM usuarios WHERE telefono = ?", [telefono], (err, results) => {
                    if (err) {
                        connection.release();
                        console.error("Error al verificar el teléfono:", err);
                        return res.status(500).render('error500', { mensaje: "Error al verificar el teléfono" });
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
                    connection.query(insert_query, [nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, password], (err, results) => {
                        connection.release();
                        if (err) {
                            console.error("Error al ejecutar la consulta de inserción:", err);
                            return res.status(500).render('error500', { mensaje: "Error al registrar el usuario" });
                        }
                        req.session.usuario = {
                            id:     results.insertId,
                            nombre_completo: nombre_completo, 
                            nombre_usuario: nombre_usuario, 
                            tipo:   'usuario'
                        };
                        res.redirect('/');
                    });
                });
            });
        });
    });
};

const postRegisterEmpresa = (req, res) => {
    
    const errores = validationResult(req);

    if (!errores.isEmpty()) {
        return res.status(400).render('register', {
            error: 'Por favor, corrige los errores en el formulario.',
            errores: errores.array(),
            formData: req.body,
            formType: 'business'
        });
    }

    const { nombre_empresa, email, telefono, password, cif, tipo_empresa, tipo_empresa_otro } = req.body;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).render('error500', { mensaje: "Error al conectar a la base de datos" });
        }

        // 1. Comprobar email 
        connection.query("SELECT id_empresa FROM empresas WHERE correo = ?", [email], (err, results) => {
            if (err) {
                connection.release();
                console.error("Error al verificar el correo:", err);
                return res.status(500).render('error500', { mensaje: "Error al verificar el correo" });
            }
            if (results.length > 0) {
                connection.release();
                return res.render('register', {
                    error: 'El correo electrónico ya está registrado.',
                    errores: [],
                    formData: req.body,
                    formType: 'business'
                });
            }

            // 2. Comprobar CIF
            connection.query("SELECT id_empresa FROM empresas WHERE CIF = ?", [cif], (err, results) => {
                if (err) {
                    connection.release();
                    console.error("Error al verificar el CIF:", err);
                    return res.status(500).render('error500', { mensaje: "Error al verificar el CIF" });
                }
                if (results.length > 0) {
                    connection.release();
                    return res.render('register', {
                        error: 'El CIF ya está registrado.',
                        errores: [],
                        formData: req.body,
                        formType: 'business'
                    });
                }

                // 3. Comprobar teléfono
                connection.query("SELECT id_empresa FROM empresas WHERE telefono_contacto = ?", [telefono], (err, results) => {
                    if (err) {
                        connection.release();
                        console.error("Error al verificar el teléfono:", err);
                        return res.status(500).render('error500', { mensaje: "Error al verificar el teléfono" });
                    }
                    if (results.length > 0) {
                        connection.release();
                        return res.render('register', {
                            error: 'El teléfono ya está registrado.',
                            errores: [],
                            formData: req.body,
                            formType: 'business'
                        });
                    }

                    // 4. Insertar
                    //! Cambiar tipo_empresa en bd y aquí
                    const insert_query = "INSERT INTO empresas (nombre, correo, contraseña, CIF, telefono_contacto, tipo) VALUES (?, ?, ?, ?, ?, ?)";
                    connection.query(insert_query, [nombre_empresa, email, password, cif, telefono, tipo_empresa === 'otro' ? tipo_empresa_otro : tipo_empresa], (err, results) => {
                        connection.release();
                        if (err) {
                            console.error("Error al insertar la empresa:", err);
                            return res.status(500).render('error500', { mensaje: "Error al insertar la empresa" });
                        }
                        req.session.usuario = {
                            id:    results.insertId,
                            nombre: nombre_empresa,
                            tipo: 'business'
                        };
                        // Empresa registrada correctamente
                        res.redirect('/');
                    });
                }); 
            }); 
        });
    }); 

};

const postLoginUsuario = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).render('error500', { mensaje: "Error al conectar a la base de datos" });
        }

        const { login_input, password } = req.body; 

        const query = "SELECT * FROM usuarios WHERE correo = ? OR telefono = ? OR nombre_usuario = ?";
        connection.query(query, [login_input, login_input, login_input], (err, results) => {
            connection.release();
            // Comprobar errores en la consulta
            if (err) {
                console.error("Error al ejecutar la consulta de login:", err);
                return res.status(500).render('error500', { mensaje: "Error al ejecutar la consulta de login" });
            }

            // 1. Comprobar si la cuenta existe y está activa
            if (results.length === 0) {
                return res.render('login', { 
                    error: 'Datos del formulario incorrectos', 
                    errores: [], 
                    formData: req.body,
                    formType: 'usuario' 
                });
            } else if (results[0].activo === 0) {
                return res.render('login', { 
                    error: 'Cuenta inactiva. Por favor, contacta con soporte.',
                    errores: [],
                    formData: req.body,
                    formType: 'usuario' 
                });
            }

            // 2. Comprobar contraseña
            const usuario = results[0];
            if (usuario.contraseña !== password) {
                return res.render('login', { 
                    error: 'Datos del formulario incorrectos', 
                    errores: [], 
                    formData: req.body,
                    formType: 'usuario' 
                });
            }

            // 3. Guardar en sesión
            req.session.usuario = {
                id: usuario.id_usuario,
                nombre_usuario: usuario.nombre_usuario,
                nombre_completo: usuario.nombre_completo,
                tipo: 'usuario'
            };
            res.redirect('/');
        }); 
    })
};

const postLoginEmpresa = (req, res) => {

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err); 
            return res.status(500).render('error500', {mensaje: "Error al conectar a la base de datos"}); 
        }

        const { email, password } = req.body;
        
        const query = "SELECT * FROM empresas WHERE correo = ?";
        connection.query(query, [email], (err, results) => {
            connection.release();
            if (err) {
                console.error("Error al ejecutar la consulta de login:", err);
                return res.status(500).render('error500', { mensaje: "Error al ejecutar la consulta de login" });
            }

            console.log(results); // <-- Añade este log para ver qué devuelve la consulta

            // 1. Comprobar si existe la cuenta y está activa
            if (results.length === 0) {
                return res.render('login', { 
                    error: 'Datos del formulario incorrectos', 
                    errores: [], 
                    formData: req.body,
                    formType: 'business' 
                });
            } else if (results[0].activo === 0) {
                return res.render('login', { 
                    error: 'Cuenta inactiva. Por favor, contacta con soporte.',
                    errores: [],
                    formData: req.body,
                    formType: 'business' 
                });
            }

            // 2. Comprobar contraseña
            const business = results[0];
            if (business.contraseña !== password) {
                return res.render('login', { 
                    error: 'Datos del formulario incorrectos', 
                    errores: [], 
                    formData: req.body,
                    formType: 'business' 
                });
            }

            // 3. Guardar en sesión
            req.session.usuario = {
                id: business.id_empresa,
                nombre: business.nombre,
                tipo: 'empresa'
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