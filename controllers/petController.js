"use strict";

const pool = require('../db'); // Importamos el pool de conexiones a la base de datos
const { validationResult } = require('express-validator');

const getMyPets = (req, res) => {
    const id = req.session.usuario.id;
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }
        connection.query("SELECT * FROM mascotas WHERE activo = 1 AND id_usuario = ?", [id], (err, results) => {
            connection.release();
            if (err) {
                console.error("Error al ejecutar la consulta:", err);
                return res.status(500).send("Error al obtener las mascotas");
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
                return res.status(500).send("Error al conectar a la base de datos");
            }
            const query = "INSERT INTO mascotas (nombre_mascota, fecha_nacimiento, especie, raza, peso, foto, id_usuario) VALUES (?, ?, ?, ?, ?, ?, ?)";
            connection.query(query, [petName, petBirthday, petSpecies, petBreed, petWeight, imagen, id], (err, results) => {
                if (err) {
                    connection.release();
                    console.error("Error al ejecutar la consulta:", err);
                    return res.status(500).send("Error al registrar la mascota");
                }

                const idMascota = results.insertId;
                const cartillaQuery = "INSERT INTO cartilla_medica (id_mascota) VALUES (?)";

                connection.query(cartillaQuery, [idMascota], (err) => {
                    connection.release();
                    if (err) {
                        console.error("Error al crear la cartilla médica:", err);
                        return res.status(500).send("Error al crear la cartilla médica");
                    }

                    return res.redirect("/pets/mypets");
                });
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
            return res.status(404).send('Recurso no encontrado');
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
            return res.status(500).send("Error al conectar a la base de datos");
        }
        // Cualquier otro error (consultas) cae aquí.
        console.error("Error al obtener los datos de la mascota:", err);
        return res.status(500).send("Error al obtener los datos de la mascota");
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
            return res.status(500).send("Error al conectar a la base de datos");
        }
        connection.query("UPDATE mascotas SET activo = 0 WHERE id_mascota = ?", [id], (err, results) => {
            connection.release();
            if(err){
                console.error("Error al eliminar la mascota:", err);
                return res.status(500).send("Error al eliminar la mascota");
            }
            res.redirect("/pets/mypets");
        })
    });
}

const getAddRegistroCartilla = (req, res) => {
    const id_cartilla = req.params.id_cartilla || null;
    res.render("addRegistro", { id_cartilla });
}

const postAddCita = (req, res) => {
    const errores = validationResult(req);
    const { id_cartilla, clinica, fecha, observaciones, diagnostico } = req.body;

    if (!errores.isEmpty()) {
        return res.status(400).render("addRegistro", {
            id_cartilla,
            errores: errores.array(),
            error: "Por favor, corrige los errores en el formulario."
        });
    }

    if (!id_cartilla) {
        return res.status(400).render("addRegistro", {
            id_cartilla: null,
            errores: [{ msg: "No se ha recibido la cartilla médica." }],
            error: "Por favor, corrige los errores en el formulario."
        });
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }

        connection.query(
            "INSERT INTO cita_veterinaria (clinica, observaciones, fecha, diagnostico, id_cartilla) VALUES (?, ?, ?, ?, ?)",
            [clinica, observaciones || null, fecha, diagnostico || null, id_cartilla],
            (err) => {
                if (err) {
                    connection.release();
                    console.error("Error al crear la cita:", err);
                    return res.status(500).send("Error al crear la cita");
                }

                connection.query(
                    "SELECT id_mascota FROM cartilla_medica WHERE id_cartilla = ? LIMIT 1",
                    [id_cartilla],
                    (err, mascotaResults) => {
                        connection.release();

                        if (err) {
                            console.error("Error al obtener la mascota de la cartilla:", err);
                            return res.status(500).send("Error al obtener la mascota de la cartilla");
                        }

                        if (mascotaResults.length === 0) {
                            return res.status(404).send('Recurso no encontrado');
                        }

                        return res.redirect(`/pets/profile/${mascotaResults[0].id_mascota}`);
                    }
                );
            }
        );
    });
}

const postAddVacuna = (req, res) => {
    const errores = validationResult(req);
    const { id_cartilla, nombre_vacuna, fecha_administracion, observaciones_vacuna } = req.body;

    if (!errores.isEmpty()) {
        return res.status(400).render("addRegistro", {
            id_cartilla,
            errores: errores.array(),
            error: "Por favor, corrige los errores en el formulario."
        });
    }

    if (!id_cartilla) {
        return res.status(400).render("addRegistro", {
            id_cartilla: null,
            errores: [{ msg: "No se ha recibido la cartilla médica." }],
            error: "Por favor, corrige los errores en el formulario."
        });
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }

        connection.query(
            "INSERT INTO vacunas (nombre, fecha_administracion, observaciones, id_cartilla) VALUES (?, ?, ?, ?)",
            [nombre_vacuna, fecha_administracion, observaciones_vacuna || null, id_cartilla],
            (err) => {
                if (err) {
                    connection.release();
                    console.error("Error al crear la vacuna:", err);
                    return res.status(500).send("Error al crear la vacuna");
                }

                connection.query(
                    "SELECT id_mascota FROM cartilla_medica WHERE id_cartilla = ? LIMIT 1",
                    [id_cartilla],
                    (err, mascotaResults) => {
                        connection.release();

                        if (err) {
                            console.error("Error al obtener la mascota de la cartilla:", err);
                            return res.status(500).send("Error al obtener la mascota de la cartilla");
                        }

                        if (mascotaResults.length === 0) {
                            return res.status(404).send('Recurso no encontrado');
                        }

                        return res.redirect(`/pets/profile/${mascotaResults[0].id_mascota}`);
                    }
                );
            }
        );
    });
}

const postAddTratamiento = (req, res) => {
    const errores = validationResult(req);
    const { id_cartilla, medicamento, dosis, frecuencia, fecha_inicio, fecha_fin, observaciones_tratamiento } = req.body;

    if (!errores.isEmpty()) {
        return res.status(400).render("addRegistro", {
            id_cartilla,
            errores: errores.array(),
            error: "Por favor, corrige los errores en el formulario."
        });
    }

    if (!id_cartilla) {
        return res.status(400).render("addRegistro", {
            id_cartilla: null,
            errores: [{ msg: "No se ha recibido la cartilla médica." }],
            error: "Por favor, corrige los errores en el formulario."
        });
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }

        connection.query(
            "INSERT INTO tratamientos (medicamento, dosis, frecuencia, fecha_inicio, fecha_fin, observaciones, id_cartilla) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [medicamento, dosis, frecuencia, fecha_inicio, fecha_fin, observaciones_tratamiento || null, id_cartilla],
            (err) => {
                if (err) {
                    connection.release();
                    console.error("Error al crear el tratamiento:", err);
                    return res.status(500).send("Error al crear el tratamiento");
                }

                connection.query(
                    "SELECT id_mascota FROM cartilla_medica WHERE id_cartilla = ? LIMIT 1",
                    [id_cartilla],
                    (err, mascotaResults) => {
                        connection.release();

                        if (err) {
                            console.error("Error al obtener la mascota de la cartilla:", err);
                            return res.status(500).send("Error al obtener la mascota de la cartilla");
                        }

                        if (mascotaResults.length === 0) {
                            return res.status(404).send('Recurso no encontrado');
                        }

                        return res.redirect(`/pets/profile/${mascotaResults[0].id_mascota}`);
                    }
                );
            }
        );
    });
}

const postAddPatologia = (req, res) => {
    const errores = validationResult(req);
    const { id_cartilla, nombre, tipo, estado, fecha_diagnostico, descripcion } = req.body;

    if (!errores.isEmpty()) {
        return res.status(400).render("addRegistro", {
            id_cartilla,
            errores: errores.array(),
            error: "Por favor, corrige los errores en el formulario."
        });
    }

    if (!id_cartilla) {
        return res.status(400).render("addRegistro", {
            id_cartilla: null,
            errores: [{ msg: "No se ha recibido la cartilla médica." }],
            error: "Por favor, corrige los errores en el formulario."
        });
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }

        connection.query(
            "INSERT INTO condicion_medica (nombre, tipo, estado, fecha_diagnostico, descripcion, id_cartilla) VALUES (?, ?, ?, ?, ?, ?)",
            [nombre, tipo, estado, fecha_diagnostico, descripcion || null, id_cartilla],
            (err) => {
                if (err) {
                    connection.release();
                    console.error("Error al crear la patología:", err);
                    return res.status(500).send("Error al crear la patología");
                }

                connection.query(
                    "SELECT id_mascota FROM cartilla_medica WHERE id_cartilla = ? LIMIT 1",
                    [id_cartilla],
                    (err, mascotaResults) => {
                        connection.release();

                        if (err) {
                            console.error("Error al obtener la mascota de la cartilla:", err);
                            return res.status(500).send("Error al obtener la mascota de la cartilla");
                        }

                        if (mascotaResults.length === 0) {
                            return res.status(404).send('Recurso no encontrado');
                        }

                        return res.redirect(`/pets/profile/${mascotaResults[0].id_mascota}`);
                    }
                );
            }
        );
    });
}




const getEditarMascota = (req, res) => {
    const petId = req.params.id;

    pool.getConnection((err, connection) => {
        if(err){
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }
        connection.query("SELECT * FROM mascotas WHERE id_mascota = ? and activo = 1", [petId], (err, results) => {
            connection.release();
            if(err){
                console.error("Error al obtener los datos de la mascota:", err);
                return res.status(500).send("Error al obtener los datos de la mascota");
            }
            if(results.length === 0){
                return res.status(404).send('Recurso no encontrado');
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
            return res.status(500).send("Error al conectar a la base de datos");
        }
        if (imagen) {
            const query = "UPDATE mascotas SET nombre_mascota = ?, especie = ?, raza = ?, fecha_nacimiento = ?, peso = ?, foto = ? WHERE id_mascota = ?";
            connection.query(query, [petName, petSpecies, petBreed, petBirthday, petWeight, imagen, id_mascota], (err, results) => {
                connection.release();
                if (err) {
                    console.error("Error al actualizar los datos de la mascota:", err);
                    return res.status(500).send("Error al actualizar los datos de la mascota");
                }
                res.redirect("/pets/profile/" + id_mascota);
            });
        } else{
            const query = "UPDATE mascotas SET nombre_mascota = ?, especie = ?, raza = ?, fecha_nacimiento = ?, peso = ? WHERE id_mascota = ?";
            connection.query(query, [petName, petSpecies, petBreed, petBirthday, petWeight, id_mascota], (err, results) => {
                connection.release();
                if (err) {
                    console.error("Error al actualizar los datos de la mascota:", err);
                    return res.status(500).send("Error al actualizar los datos de la mascota");
                }
                res.redirect("/pets/profile/" + id_mascota);
            });
        }
    });
}


const getEditarCita = (req, res) => {
    const id_cita = req.params.id;
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }
        connection.query("SELECT * FROM cita_veterinaria WHERE id_cita = ?", [id_cita], (err, results) => {
            connection.release();
            if (err) {
                console.error("Error al obtener los datos de la cita:", err);
                return res.status(500).send("Error al obtener los datos de la cita");
            }
            if (results.length === 0) {
                return res.status(404).send('Recurso no encontrado');
            }
            const cita = results[0];
            cita.fecha = new Date(cita.fecha).toISOString().slice(0, 16);
            res.render("editarCita", { cita: cita });
        }
        );
    });
}

const getEditarVacuna = (req, res) => {
    const id_vacuna = req.params.id;
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }
        connection.query("SELECT * FROM vacunas WHERE id_vacuna = ?", [id_vacuna], (err, results) => {
            connection.release();
            if (err) {
                console.error("Error al obtener los datos de la vacuna:", err);
                return res.status(500).send("Error al obtener los datos de la vacuna");
            }
            if (results.length === 0) {
                return res.status(404).send('Recurso no encontrado');
            }
            const vacuna = results[0];
            vacuna.fecha_administracion = new Date(vacuna.fecha_administracion).toISOString().slice(0, 10);
            res.render("editarVacuna", { vacuna: vacuna });
        }
        );
    });
}


const getEditarTratamiento = (req, res) => {
    const id_tratamiento = req.params.id;
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }
        connection.query("SELECT * FROM tratamientos WHERE id_tratamiento = ?", [id_tratamiento], (err, results) => {
            connection.release();
            if (err) {
                console.error("Error al obtener los datos del tratamiento:", err);
                return res.status(500).send("Error al obtener los datos del tratamiento");
            }
            if (results.length === 0) {
                return res.status(404).send('Recurso no encontrado');
            }
            const tratamiento = results[0];
            tratamiento.fecha_inicio = new Date(tratamiento.fecha_inicio).toISOString().slice(0, 16);
            tratamiento.fecha_fin = new Date(tratamiento.fecha_fin).toISOString().slice(0, 16);
            res.render("editarTratamiento", { tratamiento: tratamiento });
        }
        );
    });
}


const getEditarPatologia = (req, res) => {
    const id_patologia = req.params.id;
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }
        connection.query("SELECT * FROM condicion_medica WHERE id_condicion = ?", [id_patologia], (err, results) => {
            connection.release();
            if (err) {
                console.error("Error al obtener los datos de la patología:", err);
                return res.status(500).send("Error al obtener los datos de la patología");
            }
            if (results.length === 0) {
                return res.status(404).send('Recurso no encontrado');
            }
            const patologia = results[0];
            patologia.fecha_diagnostico = new Date(patologia.fecha_diagnostico).toISOString().slice(0, 10);
            res.render("editarPatologia", { patologia: patologia });
        }
        );
    });
}

const postEditarCita = (req, res) => {
    const errores = validationResult(req);

    if (!errores.isEmpty()) {
        return res.status(400).render("editarCita", {
            cita: req.body,
            errores: errores.array(),
            error: "Por favor, corrige los errores en el formulario."
        });
    }

    const { id_cita, clinica, fecha, observaciones, diagnostico } = req.body;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }

        connection.query(
            `SELECT cm.id_mascota
             FROM cita_veterinaria cv
             INNER JOIN cartilla_medica cm ON cm.id_cartilla = cv.id_cartilla
             WHERE cv.id_cita = ?
             LIMIT 1`,
            [id_cita],
            (err, mascotaResults) => {
                if (err) {
                    connection.release();
                    console.error("Error al obtener la mascota de la cita:", err);
                    return res.status(500).send("Error al obtener la mascota de la cita");
                }

                if (mascotaResults.length === 0) {
                    connection.release();
                    return res.status(404).send('Recurso no encontrado');
                }

                const idMascota = mascotaResults[0].id_mascota;

                connection.query(
                    "UPDATE cita_veterinaria SET clinica = ?, fecha = ?, observaciones = ?, diagnostico = ? WHERE id_cita = ?",
                    [clinica, fecha, observaciones || null, diagnostico || null, id_cita],
                    (err) => {
                        connection.release();
                        if (err) {
                            console.error("Error al actualizar la cita:", err);
                            return res.status(500).send("Error al actualizar la cita");
                        }

                        return res.redirect(`/pets/profile/${idMascota}`);
                    }
                );
            }
        );
    });
}

const postEditarVacuna = (req, res) => {
    const errores = validationResult(req);

    if (!errores.isEmpty()) {
        return res.status(400).render("editarVacuna", {
            vacuna: {
                id_vacuna: req.body.id_vacuna,
                nombre: req.body.nombre_vacuna,
                fecha_administracion: req.body.fecha_administracion,
                observaciones: req.body.observaciones_vacuna
            },
            errores: errores.array(),
            error: "Por favor, corrige los errores en el formulario."
        });
    }

    const { id_vacuna, nombre_vacuna, fecha_administracion, observaciones_vacuna } = req.body;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }

        connection.query(
            `SELECT cm.id_mascota
             FROM vacunas v
             INNER JOIN cartilla_medica cm ON cm.id_cartilla = v.id_cartilla
             WHERE v.id_vacuna = ?
             LIMIT 1`,
            [id_vacuna],
            (err, mascotaResults) => {
                if (err) {
                    connection.release();
                    console.error("Error al obtener la mascota de la vacuna:", err);
                    return res.status(500).send("Error al obtener la mascota de la vacuna");
                }

                if (mascotaResults.length === 0) {
                    connection.release();
                    return res.status(404).send('Recurso no encontrado');
                }

                const idMascota = mascotaResults[0].id_mascota;

                connection.query(
                    "UPDATE vacunas SET nombre = ?, fecha_administracion = ?, observaciones = ? WHERE id_vacuna = ?",
                    [nombre_vacuna, fecha_administracion, observaciones_vacuna || null, id_vacuna],
                    (err) => {
                        connection.release();
                        if (err) {
                            console.error("Error al actualizar la vacuna:", err);
                            return res.status(500).send("Error al actualizar la vacuna");
                        }

                        return res.redirect(`/pets/profile/${idMascota}`);
                    }
                );
            }
        );
    });
}

const postEditarTratamiento = (req, res) => {
    const errores = validationResult(req);

    if (!errores.isEmpty()) {
        return res.status(400).render("editarTratamiento", {
            tratamiento: {
                id_tratamiento: req.body.id_tratamiento,
                medicamento: req.body.medicamento,
                dosis: req.body.dosis,
                frecuencia: req.body.frecuencia,
                fecha_inicio: req.body.fecha_inicio,
                fecha_fin: req.body.fecha_fin,
                observaciones: req.body.observaciones_tratamiento
            },
            errores: errores.array(),
            error: "Por favor, corrige los errores en el formulario."
        });
    }

    const { id_tratamiento, medicamento, dosis, frecuencia, fecha_inicio, fecha_fin, observaciones_tratamiento } = req.body;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }

        connection.query(
            `SELECT cm.id_mascota
             FROM tratamientos t
             INNER JOIN cartilla_medica cm ON cm.id_cartilla = t.id_cartilla
             WHERE t.id_tratamiento = ?
             LIMIT 1`,
            [id_tratamiento],
            (err, mascotaResults) => {
                if (err) {
                    connection.release();
                    console.error("Error al obtener la mascota del tratamiento:", err);
                    return res.status(500).send("Error al obtener la mascota del tratamiento");
                }

                if (mascotaResults.length === 0) {
                    connection.release();
                    return res.status(404).send('Recurso no encontrado');
                }

                const idMascota = mascotaResults[0].id_mascota;

                connection.query(
                    "UPDATE tratamientos SET medicamento = ?, dosis = ?, frecuencia = ?, fecha_inicio = ?, fecha_fin = ?, observaciones = ? WHERE id_tratamiento = ?",
                    [medicamento, dosis, frecuencia, fecha_inicio, fecha_fin, observaciones_tratamiento || null, id_tratamiento],
                    (err) => {
                        connection.release();
                        if (err) {
                            console.error("Error al actualizar el tratamiento:", err);
                            return res.status(500).send("Error al actualizar el tratamiento");
                        }

                        return res.redirect(`/pets/profile/${idMascota}`);
                    }
                );
            }
        );
    });
}

const postEditarPatologia = (req, res) => {
    const errores = validationResult(req);

    if (!errores.isEmpty()) {
        return res.status(400).render("editarPatologia", {
            patologia: req.body,
            errores: errores.array(),
            error: "Por favor, corrige los errores en el formulario."
        });
    }

    const { id_condicion, nombre, tipo, estado, fecha_diagnostico, descripcion } = req.body;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }

        connection.query(
            `SELECT cm.id_mascota
             FROM condicion_medica c
             INNER JOIN cartilla_medica cm ON cm.id_cartilla = c.id_cartilla
             WHERE c.id_condicion = ?
             LIMIT 1`,
            [id_condicion],
            (err, mascotaResults) => {
                if (err) {
                    connection.release();
                    console.error("Error al obtener la mascota de la patología:", err);
                    return res.status(500).send("Error al obtener la mascota de la patología");
                }

                if (mascotaResults.length === 0) {
                    connection.release();
                    return res.status(404).send('Recurso no encontrado');
                }

                const idMascota = mascotaResults[0].id_mascota;

                connection.query(
                    "UPDATE condicion_medica SET nombre = ?, tipo = ?, estado = ?, fecha_diagnostico = ?, descripcion = ? WHERE id_condicion = ?",
                    [nombre, tipo, estado, fecha_diagnostico, descripcion || null, id_condicion],
                    (err) => {
                        connection.release();
                        if (err) {
                            console.error("Error al actualizar la patología:", err);
                            return res.status(500).send("Error al actualizar la patología");
                        }

                        return res.redirect(`/pets/profile/${idMascota}`);
                    }
                );
            }
        );
    });
}






const eliminarCita = (req, res) => {
    const id_cita = req.body.id_cita;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }
        connection.query(
            `SELECT cm.id_mascota
             FROM cita_veterinaria cv
             INNER JOIN cartilla_medica cm ON cm.id_cartilla = cv.id_cartilla
             WHERE cv.id_cita = ?
             LIMIT 1`,
            [id_cita],
            (err, mascotaResults) => {
                if (err) {
                    connection.release();
                    console.error("Error al obtener la mascota de la cita:", err);
                    return res.status(500).send("Error al obtener la mascota de la cita");
                }

                if (mascotaResults.length === 0) {
                    connection.release();
                    return res.status(404).send('Recurso no encontrado');
                }

                const idMascota = mascotaResults[0].id_mascota;

                connection.query("DELETE FROM cita_veterinaria WHERE id_cita = ?", [id_cita], (err) => {
                    connection.release();
                    if (err) {
                        console.error("Error al eliminar la cita:", err);
                        return res.status(500).send("Error al eliminar la cita");
                    }

                    return res.redirect(`/pets/profile/${idMascota}`);
                });
            }
        );
    });
}

const eliminarVacuna = (req, res) => {
    const id_vacuna = req.body.id_vacuna;
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }
        connection.query(
            `SELECT cm.id_mascota
             FROM vacunas v
                INNER JOIN cartilla_medica cm ON cm.id_cartilla = v.id_cartilla
                WHERE v.id_vacuna = ?
                LIMIT 1`,
            [id_vacuna],
            (err, mascotaResults) => {
                if (err) {
                    connection.release();
                    console.error("Error al obtener la mascota de la vacuna:", err);
                    return res.status(500).send("Error al obtener la mascota de la vacuna");
                }

                if (mascotaResults.length === 0) {
                    connection.release();
                    return res.status(404).send('Recurso no encontrado');
                }

                const idMascota = mascotaResults[0].id_mascota;

                connection.query("DELETE FROM vacunas WHERE id_vacuna = ?", [id_vacuna], (err) => {
                    connection.release();
                    if (err) {
                        console.error("Error al eliminar la vacuna:", err);
                        return res.status(500).send("Error al eliminar la vacuna");
                    }

                    return res.redirect(`/pets/profile/${idMascota}`);
                });
            }
        );
    });
}

const eliminarTratamiento = (req, res) => {
    const id_tratamiento = req.body.id_tratamiento;
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }
        connection.query(
            `SELECT cm.id_mascota
             FROM tratamientos t
                INNER JOIN cartilla_medica cm ON cm.id_cartilla = t.id_cartilla
                WHERE t.id_tratamiento = ?
                LIMIT 1`,
            [id_tratamiento],
            (err, mascotaResults) => {
                if (err) {
                    connection.release();
                    console.error("Error al obtener la mascota del tratamiento:", err);
                    return res.status(500).send("Error al obtener la mascota del tratamiento");
                }

                if (mascotaResults.length === 0) {
                    connection.release();
                    return res.status(404).send('Recurso no encontrado');
                }

                const idMascota = mascotaResults[0].id_mascota;

                connection.query("DELETE FROM tratamientos WHERE id_tratamiento = ?", [id_tratamiento], (err) => {
                    connection.release();
                    if (err) {
                        console.error("Error al eliminar el tratamiento:", err);
                        return res.status(500).send("Error al eliminar el tratamiento");
                    }

                    return res.redirect(`/pets/profile/${idMascota}`);
                });
            }
        );
    });
}

const eliminarPatologia = (req, res) => {
    const id_patologia = req.body.id_patologia;
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }
        connection.query(
            `SELECT cm.id_mascota
             FROM condicion_medica c
                INNER JOIN cartilla_medica cm ON cm.id_cartilla = c.id_cartilla
                WHERE c.id_condicion = ?
                LIMIT 1`,
            [id_patologia],
            (err, mascotaResults) => {
                if (err) {
                    connection.release();
                    console.error("Error al obtener la mascota de la patología:", err);
                    return res.status(500).send("Error al obtener la mascota de la patología");
                }

                if (mascotaResults.length === 0) {
                    connection.release();
                    return res.status(404).send('Recurso no encontrado');
                }

                const idMascota = mascotaResults[0].id_mascota;

                connection.query("DELETE FROM condicion_medica WHERE id_condicion = ?", [id_patologia], (err) => {
                    connection.release();
                    if (err) {
                        console.error("Error al eliminar la patología:", err);
                        return res.status(500).send("Error al eliminar la patología");
                    }

                    return res.redirect(`/pets/profile/${idMascota}`);
                });
            }
        );
    });
}

module.exports = {
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
};