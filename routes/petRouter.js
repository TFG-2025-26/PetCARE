"use strict";


const express = require('express');
const router = express.Router();
const pool = require('../db'); // Importamos el pool de conexiones a la base de datos
const {
    getMyPets,
    getRegisterPet,
    postRegisterPet,
    getPetProfile,
    postEliminarMascota,
    getEditarMascota,
    postEditarMascota,
    postEditarCita,
    postEditarVacuna,
    postEditarTratamiento,
    postEditarPatologia,
    eliminarCita,
    eliminarVacuna,
    eliminarTratamiento,
    eliminarPatologia,
    getEditarCita,
    getEditarVacuna,
    getEditarTratamiento,
    getEditarPatologia,
    getAddRegistroCartilla,
    postAddCita,
    postAddVacuna,
    postAddTratamiento,
    postAddPatologia
} = require('../controllers/petController');
const { body } = require('express-validator');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'image/jpeg') {
        cb(new Error('La imagen debe ser un archivo JPEG'));
    } else {
        cb(null, true);
    }
}, limits: { fileSize: 2 * 1024 * 1024 } }); // Configuración de multer para subir archivos a la carpeta 'uploads'

const petValidationRules = [
    body('nombre_mascota').notEmpty().withMessage('El nombre de la mascota es obligatorio.'),
    body('nombre_mascota').isLength({ max: 50 }).withMessage('El nombre de la mascota no puede exceder los 50 caracteres.'),
    body('especie').notEmpty().withMessage('La especie de la mascota es obligatoria.'),
    body('raza').notEmpty().withMessage('La raza de la mascota es obligatoria.'),
    body('peso').notEmpty().withMessage('El peso de la mascota es obligatorio.').isFloat({ gt: 0 }).withMessage('El peso debe ser un número positivo.'),
    body('fecha_nacimiento').notEmpty().withMessage('La fecha de nacimiento de la mascota es obligatoria.').isDate().withMessage('La fecha de nacimiento debe ser una fecha válida.'),
    body('fecha_nacimiento').custom((value) => {
        const today = new Date();
        const birthDate = new Date(value);
        if (birthDate > today) {
            throw new Error('La fecha de nacimiento no puede ser en el futuro.');
        }
        return true;
    })
];

const citaValidationRules = [
    body('clinica').notEmpty().withMessage('La clínica veterinaria es obligatoria.'),
    body('clinica').isLength({ min: 3 }).withMessage('La clínica debe tener al menos 3 caracteres.'),
    body('clinica').isLength({ max: 100 }).withMessage('La clínica no puede superar los 100 caracteres.'),
    body('fecha').notEmpty().withMessage('La fecha de la cita es obligatoria.'),
    body('fecha').custom((value) => {
        if (isNaN(Date.parse(value))) {
            throw new Error('La fecha de la cita no es válida.');
        }
        return true;
    }),
    body('observaciones').optional({ checkFalsy: true }).isLength({ min: 5 }).withMessage('Las observaciones deben tener al menos 5 caracteres.'),
    body('observaciones').optional({ checkFalsy: true }).isLength({ max: 1000 }).withMessage('Las observaciones no pueden superar los 1000 caracteres.'),
    body('diagnostico').optional({ checkFalsy: true }).isLength({ min: 3 }).withMessage('El diagnóstico debe tener al menos 3 caracteres.'),
    body('diagnostico').optional({ checkFalsy: true }).isLength({ max: 1000 }).withMessage('El diagnóstico no puede superar los 1000 caracteres.')
];

const vacunaValidationRules = [
    body('nombre_vacuna').notEmpty().withMessage('El nombre de la vacuna es obligatorio.'),
    body('nombre_vacuna').isLength({ min: 3 }).withMessage('El nombre de la vacuna debe tener al menos 3 caracteres.'),
    body('nombre_vacuna').isLength({ max: 100 }).withMessage('El nombre de la vacuna no puede superar los 100 caracteres.'),
    body('fecha_administracion').notEmpty().withMessage('La fecha de administración es obligatoria.'),
    body('fecha_administracion').custom((value) => {
        if (isNaN(Date.parse(value))) {
            throw new Error('La fecha de administración no es válida.');
        }
        return true;
    }),
    body('observaciones_vacuna').optional({ checkFalsy: true }).isLength({ min: 5 }).withMessage('Las observaciones deben tener al menos 5 caracteres.'),
    body('observaciones_vacuna').optional({ checkFalsy: true }).isLength({ max: 1000 }).withMessage('Las observaciones no pueden superar los 1000 caracteres.')
];

const tratamientoValidationRules = [
    body('medicamento').notEmpty().withMessage('El medicamento es obligatorio.'),
    body('medicamento').isLength({ min: 3 }).withMessage('El medicamento debe tener al menos 3 caracteres.'),
    body('medicamento').isLength({ max: 100 }).withMessage('El medicamento no puede superar los 100 caracteres.'),
    body('dosis').notEmpty().withMessage('La dosis es obligatoria.'),
    body('dosis').isLength({ max: 100 }).withMessage('La dosis no puede superar los 100 caracteres.'),
    body('frecuencia').notEmpty().withMessage('La frecuencia es obligatoria.'),
    body('frecuencia').isLength({ max: 100 }).withMessage('La frecuencia no puede superar los 100 caracteres.'),
    body('fecha_inicio').notEmpty().withMessage('La fecha de inicio es obligatoria.'),
    body('fecha_inicio').custom((value) => {
        if (isNaN(Date.parse(value))) {
            throw new Error('La fecha de inicio no es válida.');
        }
        return true;
    }),
    body('fecha_fin').notEmpty().withMessage('La fecha de fin es obligatoria.'),
    body('fecha_fin').custom((value) => {
        if (isNaN(Date.parse(value))) {
            throw new Error('La fecha de fin no es válida.');
        }
        return true;
    }),
    body('fecha_fin').custom((value, { req }) => {
        const fechaInicio = req.body.fecha_inicio;

        if (fechaInicio && !isNaN(Date.parse(fechaInicio)) && new Date(value) < new Date(fechaInicio)) {
            throw new Error('La fecha de fin no puede ser anterior a la fecha de inicio.');
        }
        return true;
    }),
    body('observaciones_tratamiento').optional({ checkFalsy: true }).isLength({ min: 5 }).withMessage('Las observaciones deben tener al menos 5 caracteres.'),
    body('observaciones_tratamiento').optional({ checkFalsy: true }).isLength({ max: 1000 }).withMessage('Las observaciones no pueden superar los 1000 caracteres.')
];

const patologiaValidationRules = [
    body('nombre').notEmpty().withMessage('El nombre de la patología es obligatorio.'),
    body('nombre').isLength({ min: 3 }).withMessage('El nombre debe tener al menos 3 caracteres.'),
    body('nombre').isLength({ max: 100 }).withMessage('El nombre no puede superar los 100 caracteres.'),
    body('tipo').notEmpty().withMessage('El tipo es obligatorio.'),
    body('tipo').isIn(['enfermedad', 'alergia', 'condicion']).withMessage('El tipo seleccionado no es válido.'),
    body('estado').notEmpty().withMessage('El estado es obligatorio.'),
    body('estado').isIn(['activa', 'superada']).withMessage('El estado seleccionado no es válido.'),
    body('fecha_diagnostico').notEmpty().withMessage('La fecha de diagnóstico es obligatoria.'),
    body('fecha_diagnostico').custom((value) => {
        if (isNaN(Date.parse(value))) {
            throw new Error('La fecha de diagnóstico no es válida.');
        }
        return true;
    }),
    body('descripcion').optional({ checkFalsy: true }).isLength({ min: 5 }).withMessage('La descripción debe tener al menos 5 caracteres.'),
    body('descripcion').optional({ checkFalsy: true }).isLength({ max: 1000 }).withMessage('La descripción no puede superar los 1000 caracteres.')
];

router.get("/mypets", getMyPets);
router.get("/register", getRegisterPet);
router.post("/register", (req, res, next) => {
    upload.single('foto')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).render('petRegister', { 
                    error: 'Por favor, corrige los errores en el formulario.',
                    errores: [{ msg: 'El tamaño de la imagen no debe exceder los 2MB.' }],
                    formData: req.body
                });
            }
        } 
        if (err) {
            return res.status(400).render('petRegister', { 
                error: 'Por favor, corrige los errores en el formulario.',
                errores: [{ msg: err.message }],
                formData: req.body
            });
        }
        next();
    });
}, petValidationRules, postRegisterPet);

router.get("/profile/:id", getPetProfile);
router.post("/eliminar", postEliminarMascota);
router.get("/editar/:id", getEditarMascota);
router.post("/editar", (req, res, next) => {
    upload.single('foto')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).render('editarMascota', { 
                    error: 'Por favor, corrige los errores en el formulario.',
                    errores: [{ msg: 'El tamaño de la imagen no debe exceder los 2MB.' }],
                    formData: req.body
                });
            }
        } 
        if (err) {
            return res.status(400).render('editarMascota', { 
                error: 'Por favor, corrige los errores en el formulario.',
                errores: [{ msg: err.message }],
                formData: req.body
            });
        }
        next();
    });
}, petValidationRules, postEditarMascota);


router.get("/cartilla/add-registro/:id_cartilla", getAddRegistroCartilla);
router.post("/cartilla/add-cita", citaValidationRules, postAddCita);
router.post("/cartilla/add-vacuna", vacunaValidationRules, postAddVacuna);
router.post("/cartilla/add-tratamiento", tratamientoValidationRules, postAddTratamiento);
router.post("/cartilla/add-patologia", patologiaValidationRules, postAddPatologia);

router.get("/cartilla/editar-cita/:id", getEditarCita);
router.get("/cartilla/editar-vacuna/:id", getEditarVacuna);
router.get("/cartilla/editar-tratamiento/:id", getEditarTratamiento);
router.get("/cartilla/editar-patologia/:id", getEditarPatologia);

router.post("/cartilla/editar-cita", citaValidationRules, postEditarCita);
router.post("/cartilla/editar-vacuna", vacunaValidationRules, postEditarVacuna);
router.post("/cartilla/editar-tratamiento", tratamientoValidationRules, postEditarTratamiento);
router.post("/cartilla/editar-patologia", patologiaValidationRules, postEditarPatologia);




router.post("/cartilla/eliminar-cita", eliminarCita);
router.post("/cartilla/eliminar-vacuna", eliminarVacuna);
router.post("/cartilla/eliminar-tratamiento", eliminarTratamiento);
router.post("/cartilla/eliminar-patologia", eliminarPatologia);

module.exports = router;
