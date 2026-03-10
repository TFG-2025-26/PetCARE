"use strict"; 

const express = require('express'); 
const router = express.Router(); 
const {check, validationResult} = require('express-validator'); // validación del cliente
const bcrypt = require('bcrypt');
const path = require('path');

const saltRounds = 10;

router.get("/register", function(req, res) {
    res.render("register", {error: null, errores: []}); 
}); 

router.get("/login", function(req, res) {
    res.render("login", {error: null, errores: []})
})

router.post("/register/owner", 
  check('nombre').notEmpty().withMessage('El nombre es obligatorio'),
  check('nombre').isLength({ min: 3 }).withMessage('El nombre debe tener al menos 3 caracteres'),
  check('usuario').notEmpty().withMessage('El nombre de usuario es obligatorio'),
  check('usuario').isLength({ min: 3 }).withMessage('El nombre de usuario debe tener al menos 3 caracteres'),
  check('usuario').matches(/^\S+$/).withMessage('El nombre de usuario no puede contener espacios en blanco'),
  check('email').isEmail().withMessage('El correo electrónico no es válido'),
  check('email').notEmpty().withMessage('El correo electrónico es obligatorio'),
  check('password').notEmpty().withMessage('La contraseña es obligatoria'),
  check('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  check('password').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/).withMessage('La contraseña debe contener al menos una letra mayúscula, una letra minúscula y un número'),
  check('password').matches(/^\S+$/).withMessage('La contraseña no puede contener espacios en blanco'),
  check('fecha_nacimiento').isDate().withMessage('La fecha de nacimiento no es válida'),
  check('fecha_nacimiento').custom((value) => {
      const fechaNacimiento = new Date(value);
      const hoy = new Date();
      const edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
      if (edad < 14 || edad > 120) {
          throw new Error('La fecha de nacimiento no es válida. Debe tener entre 14 y 120 años.');
      }
      return true;
  }),
  (req, res) => {
    const miDB = req.app.locals.db; 

    // Validación de los datos del formulario
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('register', { error: 'Por favor, corrige los errores en el formulario.', errores: errors.array() });
    }

    // Verificar si el correo electrónico ya está registrado
    const emailExistente = miDB.owners.some(owner => owner.email === req.body.email);
    if (emailExistente) {
        return res.render('register', { error: 'El correo electrónico ya está registrado.', errores: [] });
    }

    // Verificar si el nombre de usuario ya está registrado
    const usuarioExistente = miDB.owners.some(owner => owner.usuario === req.body.usuario);
    if (usuarioExistente) {
        return res.render('register', { error: 'El nombre de usuario ya está registrado.', errores: [] });
    }

    // Crear un nuevo propietario y agregarlo a la base de datos
    const nuevoOwner = {
        id:               Date.now(), //! Generar un ID único basado en la marca de tiempo - temporal
        nombre:           req.body.nombre,
        usuario:          req.body.usuario,
        email:            req.body.email,
        password:         req.body.password,
        fecha_nacimiento: req.body.fecha_nacimiento
    };
    miDB.owners.push(nuevoOwner); 

    req.session.usuario = {
        id: nuevoOwner.id, 
        nombre: nuevoOwner.nombre,
        tipo: 'owner'
    };

    res.redirect("/")
})

router.post("/register/business", 
  check('nombre_empresa').notEmpty().withMessage('El nombre de la empresa es obligatorio'),
  check('nombre_empresa').isLength({ min: 3 }).withMessage('El nombre de la empresa debe tener al menos 3 caracteres'),
  check('email').isEmail().withMessage('El correo electrónico no es válido'),
  check('email').notEmpty().withMessage('El correo electrónico es obligatorio'),
  check('password').notEmpty().withMessage('La contraseña es obligatoria'),
  check('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  check('password').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/).withMessage('La contraseña debe contener al menos una letra mayúscula, una letra minúscula y un número'),
  check('password').matches(/^\S+$/).withMessage('La contraseña no puede contener espacios en blanco'),
  check('cif').notEmpty().withMessage('El CIF es obligatorio'),
  check('cif').matches(/^[A-Za-z0-9]{8,}$/).withMessage('El CIF debe tener al menos 8 caracteres alfanuméricos'),
  check('tipo_empresa').notEmpty().withMessage('El tipo de empresa es obligatorio'),
  check('tipo_empresa_otro').custom((value, { req }) => {
      if (req.body.tipo_empresa === 'otro' && (!value || value.trim() === '')) {
          throw new Error('Por favor, especifica el tipo de empresa.');
      }
      // Contiene al menos 5 caracteres si el tipo de empresa es "otro"
      if (req.body.tipo_empresa === 'otro' && value.trim().length < 5) {
          throw new Error('El tipo de empresa debe tener al menos 5 caracteres.');
      }

      // Si el tipo de empresa no es "otro", no es necesario validar este campo
      return true;
  }),
  (req, res) => {
    const miDB = req.app.locals.db; 

    // Validación de los datos del formulario
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('register', { error: 'Por favor, corrige los errores en el formulario.', errores: errors.array() });
    }

    // Verificar si el correo electrónico ya está registrado
    const emailExistente = miDB.businesses.some(business => business.email === req.body.email);
    if (emailExistente) {
        return res.render('register', { error: 'El correo electrónico ya está registrado.', errores: [] });
    }

    // Verificar si el CIF ya está registrado
    const cifExistente = miDB.businesses.some(business => business.cif === req.body.cif);
    if (cifExistente) {
        return res.render('register', { error: 'El CIF ya está registrado.', errores: [] });
    }

    // Crear una nueva empresa y agregarla a la base de datos
    const nuevaBusiness = {
        id:           Date.now(),
        nombre:       req.body.nombre_empresa,
        email:        req.body.email,
        cif:          req.body.cif,
        password:     req.body.password,
        tipo_empresa: req.body.tipo_empresa === 'otro' ? req.body.tipo_empresa_otro : req.body.tipo_empresa
    }; 
    miDB.businesses.push(nuevaBusiness); 

    req.session.usuario = {
        id: nuevaBusiness.id,
        nombre: nuevaBusiness.nombre,
        tipo: 'business'
    }
})

router.post('/login/owner', (req, res) => {
  const miDB = req.app.locals.db;

  const owner = miDB.owners.find(o => 
    o.email === req.body.email && 
    o.password === req.body.password
  );

  if (!owner) {
    return res.render('login', { error: 'Correo o contraseña incorrectos', errores: [] });
  }

  req.session.usuario = {
    id:     owner.id,
    nombre: owner.nombre,
    tipo:   'owner'
  };

  res.redirect('/');
});

router.post('/login/business', (req, res) => {
  const miDB = req.app.locals.db;

  const business = miDB.businesses.find(b => 
    b.email === req.body.email && 
    b.password === req.body.password
  );

  if (!business) {
    return res.render('login', { error: 'Correo o contraseña incorrectos', errores: [] });
  }

  req.session.usuario = {
    id:     business.id,
    nombre: business.nombre,
    tipo:   'business'
  };

  res.redirect('/');
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports = router; 