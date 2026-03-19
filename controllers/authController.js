"use strict"; 

const { validationResult } = require('express-validator');
const pool = require('../db'); 

const getRegister = (req, res) => {
    res.render('register', { 
        error: null, 
        errores: [], 
        formData: null, 
        formType: null
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

const postRegisterClient = (req, res) => {

    const errores = validationResult(req);

    if (!errores.isEmpty()) {
        return res.status(400).render('register', {
            error: 'Por favor, corrige los errores en el formulario.',
            errores: errores.array(),
            formData: req.body,
            formType: 'client'
        });
    }

    const { nombre, email, usuario, telefono, password, fecha_nacimiento } = req.body;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).render('error500', { mensaje: "Error al conectar a la base de datos" });
        }

        // 1. Comprobar email
        connection.query("SELECT id_usuario FROM usuarios WHERE correo = ?", [email], (err, results) => {
            if (err) {
                connection.release();
                console.error("Error al verificar el correo:", err);
                return res.status(500).render('error500', { mensaje: "Error al verificar el correo" });
            }
            if (results.length > 0) {
                connection.release();
                return res.render('register', {
                    error: 'El correo electrónico ya está registrado.',
                    errores: [], formData: req.body, formType: 'client'
                });
            }

            // 2. Comprobar usuario
            connection.query("SELECT id_usuario FROM usuarios WHERE nombre_usuario = ?", [usuario], (err, results) => {
                if (err) {
                    connection.release();
                    console.error("Error al verificar el nombre de usuario:", err);
                    return res.status(500).render('error500', { mensaje: "Error al verificar el nombre de usuario" });
                }
                if (results.length > 0) {
                    connection.release();
                    return res.render('register', {
                        error: 'El nombre de usuario ya está en uso.',
                        errores: [], formData: req.body, formType: 'client'
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
                            errores: [], formData: req.body, formType: 'client'
                        });
                    }

                    // 4. Insertar
                    const insert_query = "INSERT INTO usuarios (nombre_usuario, nombre_completo, fecha_nacimiento, telefono, correo, contraseña) VALUES (?, ?, ?, ?, ?, ?)";
                    connection.query(insert_query, [usuario, nombre, fecha_nacimiento, telefono, email, password], (err, results) => {
                        connection.release();
                        if (err) {
                            console.error("Error al ejecutar la consulta de inserción:", err);
                            return res.status(500).render('error500', { mensaje: "Error al registrar el usuario" });
                        }
                        req.session.usuario = {
                            id:     results.insertId,
                            nombre: nombre,        // ← antes ponías results.nombre, que no existe
                            tipo:   'client'
                        };
                        res.redirect('/');
                    });
                });
            });
        });
    });
};

const postRegisterBusiness = (req, res) => {
    
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

const postLoginClient = (req, res) => {

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).render('error500', { mensaje: "Error al conectar a la base de datos" });
        }

        const { login_input, password } = req.body; 

        const query = "SELECT * FROM usuarios WHERE correo = ? OR telefono = ? OR nombre_usuario = ?";
        connection.query(query, [login_input, login_input, login_input], (err, results) => {
            connection.release();
            if (err) {
                console.error("Error al ejecutar la consulta de login:", err);
                return res.status(500).render('error500', { mensaje: "Error al ejecutar la consulta de login" });
            }

            console.log(results); // <-- Añade este log para ver qué devuelve la consulta
            
            // 1. Comprobar si se encontró un usuario con ese correo, teléfono o nombre de usuario
            if (results.length === 0) {
                return res.render('login', { 
                    error: 'Datos del formulario incorrectos', 
                    errores: [], 
                    formData: req.body,
                    formType: 'client' 
                });
            }

            // 2. Comprobar contraseña
            const client = results[0];
            if (client.contraseña !== password) {
                return res.render('login', { 
                    error: 'Datos del formulario incorrectos', 
                    errores: [], 
                    formData: req.body,
                    formType: 'client' 
                });
            }

            // 3. Guardar en sesión
            req.session.usuario = {
                id: client.id_usuario,
                nombre: client.nombre_usuario,
                tipo: 'client'
            };
            res.redirect('/');
        }); 
    })
};

const postLoginBusiness = (req, res) => {

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err); 
            return res.status(500).render('error500', {mensake: "Error al conectar a la base de datos"}); 
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

            // 1. Comprobar si se encontró una empresa con ese correo
            if (results.length === 0) {
                return res.render('login', { 
                    error: 'Datos del formulario incorrectos', 
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
                tipo: 'business'
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


module.exports = {
    getRegister,
    getLogin,
    postRegisterClient,
    postRegisterBusiness, 
    postLoginClient,
    postLoginBusiness,
    logout
};

// FUNCIONES AUXILIARES
const findUserByEmail = (email, tipo, miDB) => {
    if (tipo === 'client') {
        return miDB.clients.find(client => client.email === email) || null;
    } else if (tipo === 'business') {
        return miDB.businesses.find(business => business.email === email) || null;
    }
    return null;
};

const findUserByCIF = (cif, miDB) => {
    return miDB.businesses.find(business => business.cif === cif) || null;
};

const findUserByUsername = (username, miDB) => {
    return miDB.clients.find(client => client.nombreUsuario === username) || null;
}; 

const findUserByTelefono = (telefono, miDB) => {
    return miDB.clients.find(client => client.telefono === telefono) || null;
};