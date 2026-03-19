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

// Hacer función postRegisterBusiness similar a postRegisterClient pero para empresas, y que también verifique si el CIF ya está registrado antes de crear la nueva empresa.
const postRegisterBusiness = (req, res) => {
    const miDB = req.app.locals.db;
    const errores = validationResult(req);

    if (!errores.isEmpty()) {
        return res.render('register', { 
            error: 'Por favor, corrige los errores en el formulario.', 
            errores: errores.array(),
            formData: req.body,
            formType: 'business'
        });
    }

    // Verificar si el correo ya está registrado
    const emailExistente = findUserByEmail(req.body.email, 'business', miDB);
    if (emailExistente) {
        return res.render('register', { 
            error: 'El correo electrónico ya está registrado.', 
            errores: [], 
            formData: req.body,
            formType: 'business' 
        });
    }

    // Verificar si el CIF ya está registrado
    const cifExistente = findUserByCIF(req.body.cif, miDB);
    if (cifExistente) {
        return res.render('register', { 
            error: 'El CIF ya está registrado.', 
            errores: [], 
            formData: req.body,
            formType: 'business' 
        });
    }

    // Crear una nueva empresa y agregarla a la base de datos
    const nuevaBusiness = {
        id:       Date.now(),
        nombre:   req.body.nombre_empresa,
        email:    req.body.email,
        password: req.body.password,
        cif:      req.body.cif, 
        tipo_empresa: req.body.tipo_empresa === 'otro' ? req.body.tipo_empresa_otro : req.body.tipo_empresa
    };
    miDB.businesses.push(nuevaBusiness);

    // Iniciar sesión automáticamente después del registro
    req.session.usuario = {
        id: nuevaBusiness.id,
        nombre: nuevaBusiness.nombre,
        tipo: 'business'
    };
    res.redirect('/');
};

const postLoginClient = (req, res) => {
    const miDB = req.app.locals.db;
    const { login_input, password } = req.body;

    console.log('Login input:', login_input);

    // comprobar si login_input es un correo electrónico, teléfono o nombre de usuario (para ello usaremos isNaN y tal)
    let email, telefono, username;
    let client = null;
    if (login_input.includes('@')) {
        email = login_input;
        client = findUserByEmail(email, 'client', miDB);
    } else if (!isNaN(login_input)) {
        telefono = login_input;
        client = findUserByTelefono(telefono, miDB);
    } else {
        username = login_input;
        client = findUserByUsername(username, miDB);
    }

    console.log('Login input:', login_input);

    if (!client || client.password !== password) {
        return res.render('login', { 
            error: 'Datos del formulario incorrectos', 
            errores: [], 
            formData: req.body,
            formType: 'client' 
        });
    }

    req.session.usuario = {
        id: client.id,
        nombre: client.nombre,
        tipo: 'client'
    };
    res.redirect('/');
};

const postLoginBusiness = (req, res) => {
    const miDB = req.app.locals.db;
    const { email, password } = req.body;

    const business = findUserByEmail(email, 'business', miDB);
    if (!business || business.password !== password) {
        return res.render('login', { 
            error: 'Correo o contraseña incorrectos', 
            errores: [], 
            formData: req.body,
            formType: 'business' 
        });
    }

    req.session.usuario = {
        id: business.id,
        nombre: business.nombre,
        tipo: 'business'
    };
    res.redirect('/');
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