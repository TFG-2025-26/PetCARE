"use strict"; 

const express = require('express'); 
const router = express.Router(); 
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { isAuthenticated, isOwnUserProfile, isOwnCompanyProfile, canViewUserProfile, canViewCompanyProfile } = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, 'perfil-' + Date.now() + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Formato no permitido'));
        }
    }
});

const validarEdicionUsuario = [
    body('nombre_completo')
        .notEmpty().withMessage('El nombre es obligatorio')
        .isLength({ min: 3 }).withMessage('El nombre debe tener al menos 3 caracteres'),
    body('nombre_usuario')
        .notEmpty().withMessage('El nombre de usuario es obligatorio')
        .isLength({ min: 3 }).withMessage('El nombre de usuario debe tener al menos 3 caracteres')
        .matches(/^\S+$/).withMessage('El nombre de usuario no puede contener espacios en blanco'),
    body('correo')
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

const validarEdicionEmpresa = [
    body('nombre')
        .notEmpty().withMessage('El nombre de la empresa es obligatorio')
        .isLength({ min: 3 }).withMessage('El nombre de la empresa debe tener al menos 3 caracteres'),
    body('correo')
        .notEmpty().withMessage('El correo corporativo es obligatorio')
        .isEmail().withMessage('El correo corporativo no es válido'),
    body('telefono_contacto')
        .notEmpty().withMessage('El teléfono es obligatorio')
        .isLength({ min: 9, max: 15 }).withMessage('El teléfono debe tener entre 9 y 15 caracteres')
        .matches(/^\d+$/).withMessage('El teléfono solo puede contener números'),
    body('cif')
        .trim()
        .toUpperCase()
        .notEmpty().withMessage('El CIF es obligatorio')
        .matches(/^[A-Za-z0-9]{8,}$/).withMessage('El CIF debe tener al menos 8 caracteres alfanuméricos'),
    body('tipo')
        .notEmpty().withMessage('El tipo de empresa es obligatorio'),
    body('tipo_otro')
        .custom((value, { req }) => {
            if (req.body.tipo === 'otro' && value.trim() === '') {
                throw new Error('Por favor, especifica el tipo de empresa.');
            }  
            if (req.body.tipo === 'otro' && value.trim().length < 5) {
                throw new Error('El tipo de empresa debe tener al menos 5 caracteres.');
            }
            return true;
        }), 
    body('ubicacion')
        .optional({ values: 'falsy' })
        .isLength({ min: 5 }).withMessage('La ubicación debe tener al menos 5 caracteres'), 
    body('descripcion')
        .optional({ values: 'falsy' })
        .isLength({ min: 10, max: 255 }).withMessage('La descripción debe tener entre 10 y 255 caracteres'),

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
]; 

router.get('/perfilUsuario/:id', isAuthenticated, canViewUserProfile, userController.getPerfilUsuario);
router.get('/perfilEmpresa/:id', isAuthenticated, canViewCompanyProfile, userController.getPerfilEmpresa);
router.get('/perfilUsuario/:id/editar', isAuthenticated, isOwnUserProfile, userController.getEditarPerfilUsuario);
router.get('/perfilEmpresa/:id/editar', isAuthenticated, isOwnCompanyProfile, userController.getEditarPerfilEmpresa);
router.post('/perfilUsuario/:id/editar', isAuthenticated, isOwnUserProfile, upload.single('foto'), validarEdicionUsuario, userController.postEditarPerfilUsuario); 
router.post('/perfilEmpresa/:id/editar', isAuthenticated, isOwnCompanyProfile, upload.single('foto'), validarEdicionEmpresa, userController.postEditarPerfilEmpresa);
router.get('/eliminarCuentaUsuario/:id', isAuthenticated, isOwnUserProfile, userController.postEliminarCuentaUsuario);
router.get('/eliminarCuentaEmpresa/:id', isAuthenticated, isOwnCompanyProfile, userController.postEliminarCuentaEmpresa);
router.get('/perfilUsuario/:id_perfil/valoracion/:id_valoracion/usuario/:id_autor/reportar', userController.getReportarValoracion);
router.post('/perfilUsuario/:id_perfil/valoracion/:id_valoracion/usuario/:id_autor/reportar', userController.postReportarValoracion);

module.exports = router; 