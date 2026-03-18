"use strict"; 

const { validationResult } = require('express-validator');

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
    formType: null});
};

const postRegisterClient = (req, res) => {
    const miDB = req.app.locals.db;
    const errores = validationResult(req);

    if (!errores.isEmpty()) {
        return res.render('register', { 
            error: 'Por favor, corrige los errores en el formulario.', 
            errores: errores.array(), 
            formData: req.body,
            formType: 'client' 
        });
    }

    // Verificar si el correo ya está registrado usando la función auxiliar findUserByEmail
    const emailExistente = findUserByEmail(req.body.email, 'client', miDB);
    if (emailExistente) {
        return res.render('register', { 
            error: 'El correo electrónico ya está registrado.', 
            errores: [],
            formData: req.body,
            formType: 'client' 
        });
    }

    // Verificar si el nombre de usuario ya está registrado usando la función auxiliar findUserByUsername
    const usernameExistente = findUserByUsername(req.body.nombreUsuario, miDB);
    if (usernameExistente) {
        return res.render('register', {
            error: 'El nombre de usuario ya está registrado.', 
            errores: [],
            formData: req.body,
            formType: 'client' 
        });
    }

    const telefonoExistente = findUserByTelefono(req.body.telefono, miDB);
    if (telefonoExistente) {
        return res.render('register', {
            error: 'El teléfono ya está registrado.',
            errores: [],
            formData: req.body,
            formType: 'client'
        });
    }

    // Crear un nuevo cliente y agregarlo a la base de datos
    const nuevoClient = {
        id:       Date.now(),
        nombre:   req.body.nombre,
        email:    req.body.email,
        nombreUsuario: req.body.usuario,
        telefono: req.body.telefono,
        password: req.body.password
    };
    miDB.clients.push(nuevoClient);

    // Iniciar sesión automáticamente después del registro
    req.session.usuario = {
        id: nuevoClient.id,
        nombre: nuevoClient.nombre,
        tipo: 'client'
    };
    res.redirect('/');
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