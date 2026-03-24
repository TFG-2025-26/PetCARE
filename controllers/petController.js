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

const getPetProfile = async (req, res) => {
    // ID de la mascota que llega por la URL: /pets/profile/:id
    const petId = req.params.id;
    // Guardaremos aquí la conexión para poder cerrarla en finally, haya éxito o error.
    let connection;

    // Convierte pool.getConnection (callback) en una Promise para poder usar await.
    // resolve(conn) = conexión obtenida correctamente.
    // reject(err) = error al conectar.
    const getConnectionAsync = () => {
        return new Promise((resolve, reject) => {
            pool.getConnection((err, conn) => {
                if (err) {
                    // Añadimos una marca para saber en el catch que el error fue en la conexión.
                    err.queryStep = "connection";
                    return reject(err);
                }
                resolve(conn);
            });
        });
    };

    // Convierte connection.query (callback) en una Promise para poder usar await.
    // Así evitamos anidar callbacks y el código queda más lineal.
    const queryAsync = (conn, query, params = []) => {
        return new Promise((resolve, reject) => {
            conn.query(query, params, (err, results) => {
                if (err) {
                    // Marca de error para identificar que falló una consulta SQL.
                    err.queryStep = "query";
                    return reject(err);
                }
                // Devolvemos el array de filas resultante de la consulta.
                resolve(results);
            });
        });
    };

    try {
        // 1) Abrimos conexión a BD.
        connection = await getConnectionAsync();

        // 2) Traemos datos base: mascota + id_cartilla (si existe cartilla médica).
        // await "pausa" esta función hasta tener el resultado.
        const results = await queryAsync(
            connection,
            "SELECT m.*, cm.id_cartilla FROM mascotas m LEFT JOIN cartilla_medica cm ON cm.id_mascota = m.id_mascota WHERE m.id_mascota = ?",
            [petId]
        );

        // Si no existe la mascota, devolvemos 404.
        if (results.length === 0) {
            return res.status(404).render("error404");
        }

        // Tomamos la primera fila (solo debería haber una mascota con ese id).
        const pet = results[0];
        // Formateamos la fecha para mostrarla en formato español en la vista.
        pet.fecha_nacimiento = new Date(pet.fecha_nacimiento).toLocaleDateString('es-ES');
        const id_cartilla = pet.id_cartilla;

        // Si la mascota no tiene cartilla creada, enviamos arrays vacíos para evitar errores en EJS.
        if (!id_cartilla) {
            return res.render("perfilMascota", {
                pet,
                condiciones: [],
                vacunas: [],
                tratamientos: [],
                citas: []
            });
        }

        // 3) Ejecutamos las 4 consultas en paralelo con Promise.all.
        // Ventaja: es más rápido que lanzarlas una detrás de otra.
        // Promise.all devuelve un array con los resultados en el mismo orden en que pasamos las promesas.
        const [condiciones, vacunas, tratamientos, citas] = await Promise.all([
            queryAsync(connection, "SELECT * FROM condicion_medica WHERE id_cartilla = ? ORDER BY fecha_diagnostico DESC", [id_cartilla]),
            queryAsync(connection, "SELECT * FROM vacunas WHERE id_cartilla = ? ORDER BY fecha_administracion DESC", [id_cartilla]),
            queryAsync(connection, "SELECT * FROM tratamientos WHERE id_cartilla = ? ORDER BY fecha_inicio DESC", [id_cartilla]),
            queryAsync(connection, "SELECT * FROM cita_veterinaria WHERE id_cartilla = ? ORDER BY fecha DESC", [id_cartilla])
        ]);

        // 4) Render final: enviamos objetos separados a la vista.
        return res.render("perfilMascota", {
            pet,
            condiciones,
            vacunas,
            tratamientos,
            citas
        });
    } catch (err) {
        // Si falló abrir conexión, mostramos mensaje específico.
        if (err.queryStep === "connection") {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).render("error500", { mensaje: "Error al conectar a la base de datos" });
        }
        // Cualquier otro error (consultas) cae aquí.
        console.error("Error al obtener los datos de la mascota:", err);
        return res.status(500).render("error500", { mensaje: "Error al obtener los datos de la mascota" });
    } finally {
        // finally se ejecuta SIEMPRE: haya ido bien o mal.
        // Cerramos la conexión para no dejar conexiones abiertas (fugas de conexión).
        if (connection) {
            connection.release();
        }
    }
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