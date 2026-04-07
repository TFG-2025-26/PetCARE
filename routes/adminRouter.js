"use strict";

const express = require('express'); 
const router = express.Router(); 
const { body } = require('express-validator');
const multer = require('multer');
const adminController = require('../controllers/adminController');
const contentController = require('../controllers/contentController');
const { isAdminAuthenticated } = require('../middlewares/authMiddleware');

const validarAdminRegistroUsuario = [
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
        }),
    body('rol')
        .notEmpty().withMessage('El rol es obligatorio')
        .isIn(['user', 'admin']).withMessage('El rol seleccionado no es válido')
];

const validarAdminEdicionUsuario = [
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
    body('password')
        .optional({ values: 'falsy' })
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
        }),
    body('rol')
        .notEmpty().withMessage('El rol es obligatorio')
        .isIn(['user', 'admin']).withMessage('El rol seleccionado no es válido'),
    body('activo')
        .optional()
        .isIn(['0', '1']).withMessage('El estado seleccionado no es válido'),
    body('ban')
        .optional()
        .isIn(['0', '1']).withMessage('La opción de ban no es válida'),
    body('suspendido')
        .optional()
        .isIn(['0', '1']).withMessage('La opción de suspensión no es válida')
];

const validarAdminRegistroEmpresa = [
    body('nombre')
        .notEmpty().withMessage('El nombre de la empresa es obligatorio')
        .isLength({ min: 3 }).withMessage('El nombre de la empresa debe tener al menos 3 caracteres'),
    body('correo')
        .isEmail().withMessage('El correo electrónico no es válido')
        .notEmpty().withMessage('El correo electrónico es obligatorio'),
    body('password')
        .notEmpty().withMessage('La contraseña es obligatoria')
        .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/).withMessage('La contraseña debe contener al menos una letra mayúscula, una letra minúscula y un número')
        .matches(/^\S+$/).withMessage('La contraseña no puede contener espacios en blanco'),
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
            if (req.body.tipo === 'otro' && (!value || value.trim() === '')) {
                throw new Error('Por favor, especifica el tipo de empresa.');
            }
            if (req.body.tipo === 'otro' && value.trim().length < 5) {
                throw new Error('El tipo de empresa debe tener al menos 5 caracteres.');
            }
            return true;
        })
];

const validarAdminEdicionEmpresa = [
    body('nombre')
        .notEmpty().withMessage('El nombre de la empresa es obligatorio')
        .isLength({ min: 3 }).withMessage('El nombre de la empresa debe tener al menos 3 caracteres'),
    body('correo')
        .isEmail().withMessage('El correo electrónico no es válido')
        .notEmpty().withMessage('El correo electrónico es obligatorio'),
    body('password')
        .optional({ values: 'falsy' })
        .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/).withMessage('La contraseña debe contener al menos una letra mayúscula, una letra minúscula y un número')
        .matches(/^\S+$/).withMessage('La contraseña no puede contener espacios en blanco'),
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
            if (req.body.tipo === 'otro' && (!value || value.trim() === '')) {
                throw new Error('Por favor, especifica el tipo de empresa.');
            }
            if (req.body.tipo === 'otro' && value.trim().length < 5) {
                throw new Error('El tipo de empresa debe tener al menos 5 caracteres.');
            }
            return true;
        }),
    body('activo')
        .optional()
        .isIn(['0', '1']).withMessage('El estado seleccionado no es válido')
];

const uploadArticulo = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Formato de imagen no permitido'));
        }
    }
});

const validarCreacionArticulo = [
    body('titulo')
        .notEmpty().withMessage('El título es obligatorio')
        .isLength({ min: 5, max: 255 }).withMessage('El título debe tener entre 5 y 255 caracteres'),
    body('cuerpo')
        .notEmpty().withMessage('El cuerpo del artículo es obligatorio')
        .isLength({ min: 20, max: 10000 }).withMessage('El cuerpo del artículo debe tener entre 20 y 10000 caracteres')
];

router.use(isAdminAuthenticated);

router.get('/adminPanel', adminController.getAdminPanel);
router.get('/adminPanel/gestionArticulos', adminController.getGestionArticulos);
router.get('/adminPanel/gestionForos', adminController.getGestionForos);
router.get('/adminPanel/gestionArticulos/crearArticulo', contentController.getCrearArticulo);
router.post('/adminPanel/gestionArticulos/crearArticulo', uploadArticulo.single('imagen'), validarCreacionArticulo, contentController.postCrearArticulo);
router.get('/adminPanel/gestionArticulos/:id_articulo/editar', contentController.getEditarArticulo);
router.post('/adminPanel/gestionArticulos/:id_articulo/editar', uploadArticulo.single('imagen'), validarCreacionArticulo, contentController.postEditarArticulo);
router.get('/adminPanel/gestionArticulos/:id_articulo/eliminar', contentController.eliminarArticulo);
router.get('/adminPanel/gestionUsuarios', adminController.getGestionUsuarios);
router.get('/adminPanel/gestionUsuarios/filtrar', adminController.filtrarUsuarios);
router.get('/adminPanel/gestionUsuarios/registro', adminController.getAdminRegistroUsuario);
router.post('/adminPanel/gestionUsuarios/registro/usuario', validarAdminRegistroUsuario, adminController.postAdminRegistroUsuario);
router.post('/adminPanel/gestionUsuarios/registro/empresa', validarAdminRegistroEmpresa, adminController.postAdminRegistroEmpresa);
router.post('/adminPanel/gestionUsuarios/usuario/:id/editar', validarAdminEdicionUsuario, adminController.postAdminEditarUsuario);
router.post('/adminPanel/gestionUsuarios/empresa/:id/editar', validarAdminEdicionEmpresa, adminController.postAdminEditarEmpresa);
router.post('/adminPanel/gestionUsuarios/:tipo/:id/eliminar', adminController.eliminarUsuarioGestion);
router.get('/adminPanel/gestionReportes', adminController.getGestionReportes);
router.get('/adminPanel/gestionReportes/filtrar', adminController.filtrarReportes);
router.get('/adminPanel/gestionReportes/:id_reporte', adminController.getDetalleReporte);
router.post('/adminPanel/gestionReportes/:id_reporte/acciones/:accion', adminController.aplicarAccionReporte);
router.get('/adminPanel/gestionReportes/:id_reporte/editarAccion', adminController.editarAccionReporte);

module.exports = router;