"use strict";

const pool = require('../db'); // Importamos el pool de conexiones a la base de datos
const { validationResult } = require('express-validator');

const getMyPets = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).render('error500', { mensaje: "Error al conectar a la base de datos" });
        }
        connection.query("SELECT * FROM mascotas", (err, results) => {
            connection.release();
            if (err) {
                console.error("Error al ejecutar la consulta:", err);
                return res.status(500).render('error500', { mensaje: "Error al obtener las mascotas" });
            }
            res.render("myPets", { pets: results});
        });
    });
}

const getRegisterPet = (req, res) => {
    res.render("petRegister", { error: null, errores: [], formData: null });
}

const postRegisterPet = (req, res) => {
    const errores = validationResult(req);

    if (!errores.isEmpty()) {
        return res.status(400).render('petRegister', { 
            error: 'Por favor, corrige los errores en el formulario.', 
            errores: errores.array(), 
            formData: req.body
        });
    }
    else if(!req.file) {
        errores.errors.push({ msg: 'La imagen de la mascota es obligatoria.' });
        return res.status(400).render('petRegister', { 
            error: 'Por favor, corrige los errores en el formulario.',
            errores: errores.array(),
            formData: req.body
        });
    }
    else if (req.file.mimetype !== 'image/jpeg') {
        errores.errors.push({ msg: 'El formato de la imagen debe ser JPEG.' });
        return res.status(400).render('petRegister', { 
            error: 'Por favor, corrige los errores en el formulario.',
            errores: errores.array(),
            formData: req.body
        });
    }
    else{
        const { "pet-name": petName, "pet-species": petSpecies, "pet-breed": petBreed, "pet-birthday": petBirthday, "pet-weight": petWeight } = req.body;
        const imagen = req.file.buffer;
        pool.getConnection((err, connection) => {
            if (err) {
                console.error("Error al conectar a la base de datos:", err);
                return res.status(500).render('error500', { mensaje: "Error al conectar a la base de datos" });
            }
            const query = "INSERT INTO mascotas (nombre_mascota, fecha_nacimiento, especie, raza, peso, foto, id_usuario) VALUES (?, ?, ?, ?, ?, ?, ?)";
            connection.query(query, [petName, petBirthday, petSpecies, petBreed, petWeight, imagen, 1], (err, results) => {
                connection.release();
                if (err) {
                    console.error("Error al ejecutar la consulta:", err);
                    return res.status(500).render('error500', { mensaje: "Error al registrar la mascota" });
                }
                res.redirect("/pets/mypets");
            });
        });
    }
}

module.exports = {
    getMyPets,
    getRegisterPet,
    postRegisterPet
};