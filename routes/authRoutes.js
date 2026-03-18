"use strict"; 

const express = require('express'); 
const router = express.Router(); 
const { body } = require('express-validator');
const authController = require('../controllers/authController');

const bcrypt = require('bcrypt');
const saltRounds = 10;

// validación de los parámetros del registro para clientes
const validarRegistroClient = [
    body('nombre')
        .notEmpty().withMessage('El nombre es obligatorio')
        .isLength({ min: 3 }).withMessage('El nombre debe tener al menos 3 caracteres'),
    body('usuario')
        .notEmpty().withMessage('El nombre de usuario es obligatorio')
        .isLength({ min: 3 }).withMessage('El nombre de usuario debe tener al menos 3 caracteres')
        .matches(/^\S+$/).withMessage('El nombre de usuario no puede contener espacios en blanco'),
    body('email')
        .isEmail().withMessage('El correo electrónico no es válido')
        .notEmpty().withMessage('El correo electrónico es obligatorio'),
    body('telefono')
        .notEmpty().withMessage('El teléfono es obligatorio')
        .isLength({ min: 9, max: 15 }).withMessage('El teléfono debe tener entre 9 y 15 caracteres')
        .matches(/^\d+$/).withMessage('El teléfono solo puede contener números'),
    body('password')
        .notEmpty().withMessage('La contraseña es obligatoria')
        .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/).withMessage('La contraseña debe contener al menos una letra mayúscula, una letra minúscula y un número')
        .matches(/^\S+$/).withMessage('La contraseña no puede contener espacios en blanco'),
    body('fecha_nacimiento')
        .isDate().withMessage('La fecha de nacimiento no es válida')
        .custom((value) => {
            const fechaNacimiento = new Date(value);
            const hoy = new Date();
            const edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
            if (edad < 14 || edad > 120) {
                throw new Error('La fecha de nacimiento no es válida. Debe tener entre 14 y 120 años.');
            }
            return true;
        })
]

// validación de los parámetros del registro para empresas
const validarRegistroBusiness = [
    body('nombre_empresa')
        .notEmpty().withMessage('El nombre de la empresa es obligatorio')
        .isLength({ min: 3 }).withMessage('El nombre de la empresa debe tener al menos 3 caracteres'),
    body('email')
        .isEmail().withMessage('El correo electrónico no es válido')
        .notEmpty().withMessage('El correo electrónico es obligatorio'),
    body('password')
        .notEmpty().withMessage('La contraseña es obligatoria')
        .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/).withMessage('La contraseña debe contener al menos una letra mayúscula, una letra minúscula y un número')
        .matches(/^\S+$/).withMessage('La contraseña no puede contener espacios en blanco'),
    body('cif')
        .notEmpty().withMessage('El CIF es obligatorio')
        .matches(/^[A-Za-z0-9]{8,}$/).withMessage('El CIF debe tener al menos 8 caracteres alfanuméricos'),
    body('tipo_empresa')
        .notEmpty().withMessage('El tipo de empresa es obligatorio'),
    body('tipo_empresa_otro')
        .custom((value, { req }) => {
            if (req.body.tipo_empresa === 'otro' && value.trim() === '') {
                throw new Error('Por favor, especifica el tipo de empresa.');
            }  
            if (req.body.tipo_empresa === 'otro' && value.trim().length < 5) {
                throw new Error('El tipo de empresa debe tener al menos 5 caracteres.');
            }
            return true;
        })
]

// Rutas de authentication
router.get('/register', authController.getRegister);
router.get('/login', authController.getLogin);
router.post('/register/client', validarRegistroClient, authController.postRegisterClient);
router.post('/register/business', validarRegistroBusiness, authController.postRegisterBusiness);
router.post('/login/client', authController.postLoginClient);
router.post('/login/business', authController.postLoginBusiness);
router.get('/logout', authController.logout);

module.exports = router; 