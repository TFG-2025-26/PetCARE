"use strict";


const express = require('express');
const router = express.Router();
const pool = require('../db'); // Importamos el pool de conexiones a la base de datos
const { getMyPets, getRegisterPet, postRegisterPet } = require('../controllers/petController');
const { body } = require('express-validator');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'image/jpeg') {
        cb(new Error('La imagen debe ser un archivo JPEG'));
    } else {
        cb(null, true);
    }
} }); // Configuración de multer para subir archivos a la carpeta 'uploads'

const petValidationRules = [
    body('pet-name').notEmpty().withMessage('El nombre de la mascota es obligatorio.'),
    body('pet-species').notEmpty().withMessage('La especie de la mascota es obligatoria.'),
    body('pet-breed').notEmpty().withMessage('La raza de la mascota es obligatoria.'),
    body('pet-weight').notEmpty().withMessage('El peso de la mascota es obligatorio.').isFloat({ gt: 0 }).withMessage('El peso debe ser un número positivo.'),
    body('pet-birthday').notEmpty().withMessage('La fecha de nacimiento de la mascota es obligatoria.').isDate().withMessage('La fecha de nacimiento debe ser una fecha válida.'),
];



router.get("/mypets", getMyPets);
router.get("/register", getRegisterPet);
router.post("/register", (req, res, next) => {
    upload.single('pet-image')(req, res, (err) => {
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

module.exports = router;
