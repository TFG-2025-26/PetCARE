"use strict"; 

const express = require('express'); 
const router = express.Router(); 
const { body } = require('express-validator');
const userController = require('../controllers/userController');

const validarEdicionUsuario = [
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
        }),
    
    // CONTRASEÑAS
    body('password_actual')
        .custom((value, { req }) => {
            const { password_nueva, password_confirmar } = req.body;
            if (password_nueva || password_confirmar) {
                if (!value) throw new Error('Debes introducir tu contraseña actual para cambiarla');
            }
            return true;
        }),
    body('password_nueva')
        .custom((value, { req }) => {
            const { password_actual, password_confirmar } = req.body;
            if (password_actual || password_confirmar) {
                if (!value) throw new Error('Debes introducir la nueva contraseña');
                if (value.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
                if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value)) throw new Error('La contraseña debe contener mayúscula, minúscula y número');
                if (/\s/.test(value)) throw new Error('La contraseña no puede contener espacios');
            }
            return true;
        }),
    body('password_confirmar')
        .custom((value, { req }) => {
            const { password_nueva } = req.body;
            if (password_nueva) {
                if (!value) throw new Error('Debes confirmar la nueva contraseña');
                if (value !== password_nueva) throw new Error('Las contraseñas no coinciden');
            }
            return true;
        }),

    // DATOS OPCIONALES
    body('ciudad')
        .optional({ values: 'falsy' })
        .isLength({ min: 2 }).withMessage('La ciudad debe tener al menos 2 caracteres'),
    body('pais')
        .optional({ values: 'falsy' })
        .isLength({ min: 2 }).withMessage('El país debe tener al menos 2 caracteres'),
    body('codigo_postal')
        .optional({ values: 'falsy' })
        .isLength({ min: 4, max: 10 }).withMessage('El código postal debe tener entre 4 y 10 caracteres'),
    body('genero')
        .optional({ values: 'falsy' })
        .isIn(['hombre', 'mujer', 'otro']).withMessage('El género no es válido'),
    body('trabajo')
        .optional({ values: 'falsy' })
        .isLength({ min: 2, max: 64 }).withMessage('El trabajo debe tener al menos 2 caracteres y no mas de 64'),
    body('bio')
        .optional({ values: 'falsy' })
        .isLength({ min: 2, max: 255 }).withMessage('La bio debe tener entre 2 y 255 caracteres')
]; 

const validarEdicionEmpresa = []; 

router.get('/perfilUsuario/:id', userController.getPerfilUsuario);
router.get('/perfilEmpresa/:id', userController.getPerfilEmpresa);
router.get('/perfilUsuario/:id/editar', userController.getEditarPerfilUsuario);
router.get('/perfilEmpresa/:id/editar', userController.getEditarPerfilEmpresa);
router.post('/perfilUsuario/:id/editar', validarEdicionUsuario, userController.postEditarPerfilUsuario); 
router.post('/perfilEmpresa/:id/editar', validarEdicionEmpresa, userController.postEditarPerfilEmpresa);

module.exports = router; 