"use strict";


const pool = require('../db'); // Importamos el pool de conexiones a la base de datos
const { validationResult } = require('express-validator');


const getServicios = (req, res) => {
    res.render('servicios');
}

const anuncios = (req, res) =>{
    res.render('anuncios');
}

const getAnuncios = (req, res) => {
    const pagina = parseInt(req.query.pagina) || 1;
    const limite = parseInt(req.query.limite) || 10;
    const offset = (pagina - 1) * limite;

    const { tipoAnuncio, tipoServicio, tipoAnimal, precioMax, valoracionMin } = req.query;

    let query = `
        SELECT
            a.id_anuncio,
            a.tipo_anuncio,
            a.descripcion,
            a.tipo_mascota,
            a.precio_hora,
            a.tipo_servicio,
            u.id_usuario,
            u.nombre_usuario,
            u.foto,
            COALESCE(AVG(v.puntuacion), 0) AS valoracion_media
        FROM anuncios a
        JOIN usuarios u ON a.id_usuario = u.id_usuario
        LEFT JOIN valoraciones v ON v.id_destinatario = u.id_usuario
        WHERE a.eliminado = 0 AND a.activo = 1
    `;
    const params = [];

    if (tipoAnuncio) {
        query += ` AND a.tipo_anuncio = ?`;
        params.push(tipoAnuncio);
    }
    if (tipoServicio) {
        query += ` AND a.tipo_servicio = ?`;
        params.push(tipoServicio);
    }
    if (tipoAnimal) {
        query += ` AND a.tipo_mascota = ?`;
        params.push(tipoAnimal);
    }
    if (precioMax) {
        query += ` AND a.precio_hora <= ?`;
        params.push(parseInt(precioMax));
    }

    query += ` GROUP BY a.id_anuncio, u.id_usuario, u.nombre_usuario`;

    if (valoracionMin) {
        query += ` HAVING valoracion_media >= ?`;
        params.push(parseFloat(valoracionMin));
    }

    // Pedimos un resultado extra para saber si hay más páginas sin hacer COUNT(*)
    query += ` ORDER BY a.id_anuncio DESC LIMIT ? OFFSET ?`;
    params.push(limite + 1, offset);

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).json({ error: "Error al conectar a la base de datos" });
        }

        connection.query(query, params, (err, anuncios) => {
            if (err) {
                connection.release();
                console.error("Error al obtener los anuncios:", err);
                return res.status(500).json({ error: "Error al obtener los anuncios" });
            }

            const hayMasPaginas = anuncios.length > limite;
            if (hayMasPaginas) anuncios.pop();

            if (anuncios.length === 0) {
                connection.release();
                return res.json({ anuncios: [], hayMasPaginas: false });
            }

            // Convertir foto (longblob) a base64 para poder usarla en el front
            anuncios.forEach(a => {
                if (a.foto) {
                    const buf = Buffer.from(a.foto);
                    const mime = (buf[0] === 0x89) ? 'image/png' : 'image/jpeg';
                    a.foto = `data:${mime};base64,` + buf.toString('base64');
                }
                a.foto = '/images/cat.jpg'; //TODO arreglar esto para que muestra la imagen que tiene que ser cuando cambie lo de la BD para que se guarden las rutas en vez de los blobs
                if (a.descripcion === null || a.descripcion.trim() === '') {
                    a.descripcion = 'El usuario no ha añadido una descripción para este anuncio.';
                }
            });

            // Segunda consulta: disponibilidades de los anuncios obtenidos
            const ids = anuncios.map(a => a.id_anuncio);
            connection.query(
                `SELECT id_disp, tipo, fecha_inicio, dia_semana, hora_inicio, hora_fin, id_anuncio
                 FROM disponibilidad WHERE id_anuncio IN (?)`,
                [ids],
                (err, disponibilidades) => {
                    connection.release();
                    if (err) {
                        console.error("Error al obtener las disponibilidades:", err);
                        return res.status(500).json({ error: "Error al obtener las disponibilidades" });
                    }

                    // Agrupar disponibilidades por id_anuncio y añadirlas a cada anuncio
                    const dispMap = {};
                    disponibilidades.forEach(d => {
                        if (!dispMap[d.id_anuncio]) dispMap[d.id_anuncio] = [];
                        dispMap[d.id_anuncio].push(d);
                    });

                    anuncios.forEach(a => {
                        a.disponibilidades = dispMap[a.id_anuncio] || [];
                    });
                    console.log('Anuncios obtenidos:', anuncios);
                    console.log('¿Hay más páginas?', hayMasPaginas);
                    return res.json({ anuncios, hayMasPaginas });
                }
            );
        });
    });
}

const getPublicarAnuncio = (req, res) =>{
    res.render('publicarAnuncio', { error: null, errores: [] });
}

const postPublicarAnuncio = (req, res) => {
    const errores = validationResult(req);
    const anuncio = req.body;
    console.log('Datos recibidos en el servidor:', anuncio);

    if (!errores.isEmpty()) {
        return res.status(400).render('publicarAnuncio', {
            error: 'Por favor, corrige los errores en el formulario.',
            errores: errores.array()
        });
    }
    else{
        const id_usuario = req.session.usuario.id;
        const { tipo, tipo_servicio, precio_hora, tipo_mascota, descripcion, disponibilidad} = anuncio;

        pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err);
            return res.status(500).send("Error al conectar a la base de datos");
        }
        if(tipo === 'puntual'){
            connection.query("INSERT INTO anuncios (tipo_anuncio, descripcion, tipo_mascota, precio_hora, tipo_servicio, id_usuario) VALUES (?, ?, ?, ?, ?, ?)", [tipo, descripcion, tipo_mascota, precio_hora, tipo_servicio, id_usuario], (err, results) => {
                if (err) {
                    connection.release();
                    console.error("Error al insertar el anuncio:", err);
                    return res.status(500).send("Error al insertar el anuncio");
                }
                else{
                    const id_anuncio = results.insertId;
                    const franjas = disponibilidad;
                    const values = franjas.map(franja => ['puntual', franja.fecha, null, franja.hora_inicio, franja.hora_fin, id_anuncio]);
                    connection.query("INSERT INTO disponibilidad (tipo, fecha_inicio, dia_semana, hora_inicio, hora_fin, id_anuncio) VALUES ?", [values], (err) => {
                        connection.release();
                        if (err) {
                            console.error("Error al insertar la disponibilidad:", err);
                            return res.status(500).send("Error al insertar la disponibilidad");
                        }
                        else{
                            res.redirect('/services/anuncios');
                        }
                    });
                }
            });
        }
        else if(tipo === 'recurrente'){
            const { recurrente } = anuncio;
            connection.query("INSERT INTO anuncios (tipo_anuncio, descripcion, tipo_mascota, precio_hora, tipo_servicio, id_usuario) VALUES (?, ?, ?, ?, ?, ?)", [tipo, descripcion, tipo_mascota, precio_hora, tipo_servicio, id_usuario], (err, results) => {
                if (err) {
                    connection.release();
                    console.error("Error al insertar el anuncio:", err);
                    return res.status(500).send("Error al insertar el anuncio");
                }
                else{
                    const id_anuncio = results.insertId;
                    const values = [];
                    for (const dia of Object.keys(recurrente)) {
                        const slots = Object.values(recurrente[dia]);
                        for (const slot of slots) {
                            values.push(['recurrente', null, dia, slot.hora_inicio, slot.hora_fin, id_anuncio]);
                        }
                    }
                    connection.query("INSERT INTO disponibilidad (tipo, fecha_inicio, dia_semana, hora_inicio, hora_fin, id_anuncio) VALUES ?", [values], (err) => {
                        connection.release();
                        if (err) {
                            console.error("Error al insertar la disponibilidad:", err);
                            return res.status(500).send("Error al insertar la disponibilidad");
                        }
                        else{
                            res.redirect('/services/anuncios');
                        }
                    });
                }
            });
        }
    });
    }
}



module.exports = {
    anuncios,
    getAnuncios,
    getPublicarAnuncio,
    postPublicarAnuncio,
    getServicios
};