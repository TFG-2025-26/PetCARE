"use strict"; 

const getRegister = (req, res) => {
  res.render('registro', { error: null, errores: [] });
};

const getLogin = (req, res) => {
  res.render('login', { error: null, errores: [] });
};

const registerOwner = (req, res) => {
    const miDB = req.app.locals.db;

    // Verificar si el correo ya está registrado usando la función auxiliar findUserByEmail
    const emailExistente = findUserByEmail(req.body.email, 'owner');
    if (emailExistente) {
        return res.render('register', { error: 'El correo electrónico ya está registrado.', errores: [] });
    }

    // Crear un nuevo propietario y agregarlo a la base de datos
    const nuevoOwner = {
        id:       Date.now(),
        nombre:   req.body.nombre,
        email:    req.body.email,
        password: req.body.password
    };
    miDB.owners.push(nuevoOwner);

    // Iniciar sesión automáticamente después del registro
    req.session.usuario = {
        id: nuevoOwner.id,
        nombre: nuevoOwner.nombre,
        tipo: 'owner'
    };
    res.redirect('/');
};

// Hacer función registerBusiness similar a registerOwner pero para empresas, y que también verifique si el CIF ya está registrado antes de crear la nueva empresa.
const registerBusiness = (req, res) => {
    const miDB = req.app.locals.db;

    // Verificar si el correo ya está registrado
    const emailExistente = findUserByEmail(req.body.email, 'business');
    if (emailExistente) {
        return res.render('register', { error: 'El correo electrónico ya está registrado.', errores: [] });
    }

    // Verificar si el CIF ya está registrado
    const cifExistente = findUserByCIF(req.body.cif);
    if (cifExistente) {
        return res.render('register', { error: 'El CIF ya está registrado.', errores: [] });
    }

    // Crear una nueva empresa y agregarla a la base de datos
    const nuevaBusiness = {
        id:       Date.now(),
        nombre:   req.body.nombre,
        email:    req.body.email,
        password: req.body.password,
        cif:      req.body.cif
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

module.exports = {
    getRegister,
    getLogin,
    registerOwner, 
    registerBusiness, 

};

// FUNCIONES AUXILIARES
const findUserByEmail = (email, tipo) => {
    const miDB = req.app.locals.db;
    if (tipo === 'owner') {
        return miDB.owners.find(owner => owner.email === email) || null;
    } else if (tipo === 'business') {
        return miDB.businesses.find(business => business.email === email) || null;
    }
    return null;
};

const findUserByCIF = (cif) => {
    const miDB = req.app.locals.db;
    return miDB.businesses.find(business => business.cif === cif) || null;
};

// función checkParams para verificar todos los parámetros