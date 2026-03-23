"use strict";


const express = require('express');
const router = express.Router();
const pool = require('../db'); // Importamos el pool de conexiones a la base de datos
const { getMyPets, getRegisterPet, postRegisterPet, getPetProfile, postEliminarMascota } = require('../controllers/petController');
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
    body('pet-name').notEmpty().withMessage('El nombre de la mascota es obligatorio.'),
    body('pet-species').notEmpty().withMessage('La especie de la mascota es obligatoria.'),
    body('pet-breed').notEmpty().withMessage('La raza de la mascota es obligatoria.'),
    body('pet-weight').notEmpty().withMessage('El peso de la mascota es obligatorio.').isFloat({ gt: 0 }).withMessage('El peso debe ser un número positivo.'),
    body('pet-birthday').notEmpty().withMessage('La fecha de nacimiento de la mascota es obligatoria.').isDate().withMessage('La fecha de nacimiento debe ser una fecha válida.'),
    body('pet-birthday').custom((value) => {
        const today = new Date();
        const birthDate = new Date(value);
        if (birthDate > today) {
            throw new Error('La fecha de nacimiento no puede ser en el futuro.');
        }
        return true;
    })
];

//TODO Añadir middleware de autenticación para proteger las rutas de mascotas

router.get("/mypets", getMyPets);
router.get("/register", getRegisterPet);
router.post("/register", (req, res, next) => {
    upload.single('pet-image')(req, res, (err) => {
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

module.exports = router;
