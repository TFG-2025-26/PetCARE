"use strict";

const pool = require('../db'); // Importamos el pool de conexiones a la base de datos
const { validationResult } = require('express-validator');

const getMyPets = (req, res) => {
    const id = req.session.usuario.id;
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).render('error500', { mensaje: "Error al conectar a la base de datos" });
        }
        connection.query("SELECT * FROM mascotas WHERE activo = 1 AND id_usuario = ?", [id], (err, results) => {
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
        const { "nombre_mascota": petName, "especie": petSpecies, "raza": petBreed, "fecha_nacimiento": petBirthday, "peso": petWeight } = req.body;
        const imagen = req.file ? req.file.buffer : null;
        const id = req.session.usuario.id;
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

const getEditarMascota = (req, res) => {
    const petId = req.params.id;

    pool.getConnection((err, connection) => {
        if(err){
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).render("error500", {mensaje: "Error al conectar a la base de datos"});
        }
        connection.query("SELECT * FROM mascotas WHERE id_mascota = ? and activo = 1", [petId], (err, results) => {
            connection.release();
            if(err){
                console.error("Error al obtener los datos de la mascota:", err);
                return res.status(500).render("error500", {mensaje: "Error al obtener los datos de la mascota"});
            }
            if(results.length === 0){
                return res.status(404).render("error404");
            }
            const pet = results[0];
            console.log(pet);
            pet.fecha_nacimiento = new Date(pet.fecha_nacimiento).toISOString().split('T')[0];
            res.render("editarMascota", {formData: pet});
        });
    });
}

const postEditarMascota = (req, res) => {
    const errores = validationResult(req);
    console.log(req.body);
    if (!errores.isEmpty()) {
        return res.status(400).render("editarMascota", { formData: req.body, errores: errores.array(), error: "Por favor, corrige los errores en el formulario." });
    }
    const { id_mascota, "nombre_mascota": petName, "especie": petSpecies, "raza": petBreed, "fecha_nacimiento": petBirthday, "peso": petWeight } = req.body;
    const imagen = req.file ? req.file.buffer : null;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).render("error500", { mensaje: "Error al conectar a la base de datos" });
        }
        if (imagen) {
            const query = "UPDATE mascotas SET nombre_mascota = ?, especie = ?, raza = ?, fecha_nacimiento = ?, peso = ?, foto = ? WHERE id_mascota = ?";
            connection.query(query, [petName, petSpecies, petBreed, petBirthday, petWeight, imagen, id_mascota], (err, results) => {
                connection.release();
                if (err) {
                    console.error("Error al actualizar los datos de la mascota:", err);
                    return res.status(500).render("error500", { mensaje: "Error al actualizar los datos de la mascota" });
                }
                res.redirect("/pets/profile/" + id_mascota);
            });
        } else{
            const query = "UPDATE mascotas SET nombre_mascota = ?, especie = ?, raza = ?, fecha_nacimiento = ?, peso = ? WHERE id_mascota = ?";
            connection.query(query, [petName, petSpecies, petBreed, petBirthday, petWeight, id_mascota], (err, results) => {
                connection.release();
                if (err) {
                    console.error("Error al actualizar los datos de la mascota:", err);
                    return res.status(500).render("error500", { mensaje: "Error al actualizar los datos de la mascota" });
                }
                res.redirect("/pets/profile/" + id_mascota);
            });
        }
    });
}


module.exports = {
    getMyPets,
    getRegisterPet,
    postRegisterPet,
    getPetProfile,
    postEliminarMascota,
    getEditarMascota,
    postEditarMascota
};