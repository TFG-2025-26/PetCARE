"use strict";

const pool = require('../db'); // Importamos el pool de conexiones a la base de datos
const { validationResult } = require('express-validator');

const getMyPets = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).render('error500', { mensaje: "Error al conectar a la base de datos" });
        }
        connection.query("SELECT * FROM mascotas WHERE activo = 1", (err, results) => {
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
    } else{
        const { "pet-name": petName, "pet-species": petSpecies, "pet-breed": petBreed, "pet-birthday": petBirthday, "pet-weight": petWeight } = req.body;
        const imagen = req.file ? req.file.buffer : null;
        //const id = req.session.usuario.id; // Asegúrate de que el ID del usuario esté disponible en la sesión
        const id = 1; // Temporalmente, se asigna un ID fijo para pruebas. Reemplazar con el ID del usuario autenticado.
        pool.getConnection((err, connection) => {
            if (err) {
                console.error("Error al conectar a la base de datos:", err);
                return res.status(500).render('error500', { mensaje: "Error al conectar a la base de datos" });
            }
            const query = "INSERT INTO mascotas (nombre_mascota, fecha_nacimiento, especie, raza, peso, foto, id_usuario) VALUES (?, ?, ?, ?, ?, ?, ?)";
            connection.query(query, [petName, petBirthday, petSpecies, petBreed, petWeight, imagen, id], (err, results) => {
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

const getPetProfile = (req, res) => {
    const petId = req.params.id;

    pool.getConnection((err, connection) => {
        if(err){
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).render("error500", {mensaje: "Error al conectar a la base de datos"});
        }
        connection.query("SELECT * FROM mascotas WHERE id_mascota = ?", [petId], (err, results) => {
            connection.release();
            if(err){
                console.error("Error al obtener los datos de la mascota:", err);
                return res.status(500).render("error500", {mensaje: "Error al obtener los datos de la mascota"});
            }
            if(results.lenght === 0){
                return res.status(404).render("error404");
            }
            const pet = results[0];
            pet.fecha_nacimiento = new Date(pet.fecha_nacimiento).toLocaleDateString('es-ES');
            res.render("perfilMascota", {pet: pet});
        })
    })
}

const postEliminarMascota = (req, res) =>{
    const id = req.body.id;

    pool.getConnection((err, connection) => {
        if(err){
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).render("error500", {mensaje: "Error al conectar a la base de datos"});
        }
        connection.query("UPDATE mascotas SET activo = 0 WHERE id_mascota = ?", [id], (err, results) => {
            connection.release();
            if(err){
                console.error("Error al eliminar la mascota:", err);
                return res.status(500).render("error500", {mensaje: "Error al eliminar la mascota"});
            }
            res.redirect("/pets/mypets");
        })
    });
}

module.exports = {
    getMyPets,
    getRegisterPet,
    postRegisterPet,
    getPetProfile,
    postEliminarMascota
};