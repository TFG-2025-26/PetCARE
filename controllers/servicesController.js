"use strict";


const pool = require('../db'); // Importamos el pool de conexiones a la base de datos
const { validationResult } = require('express-validator');


const getServicios = (req, res) => {
    res.render('servicios');
}

const getAnuncios = (req, res) =>{
    res.render('anuncios');
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
            return res.status(500).render('error500', { mensaje: "Error al conectar a la base de datos" });
        }
        if(tipo === 'puntual'){
            connection.query("INSERT INTO anuncios (tipo_anuncio, descripcion, tipo_mascota, precio_hora, tipo_servicio, id_usuario) VALUES (?, ?, ?, ?, ?, ?)", [tipo, descripcion, tipo_mascota, precio_hora, tipo_servicio, id_usuario], (err, results) => {
                if (err) {
                    connection.release();
                    console.error("Error al insertar el anuncio:", err);
                    return res.status(500).render('error500', { mensaje: "Error al insertar el anuncio" });
                }
                else{
                    const id_anuncio = results.insertId;
                    const franjas = disponibilidad;
                    const values = franjas.map(franja => ['puntual', franja.fecha, null, franja.hora_inicio, franja.hora_fin, id_anuncio]);
                    connection.query("INSERT INTO disponibilidad (tipo, fecha_inicio, dia_semana, hora_inicio, hora_fin, id_anuncio) VALUES ?", [values], (err) => {
                        connection.release();
                        if (err) {
                            console.error("Error al insertar la disponibilidad:", err);
                            return res.status(500).render('error500', { mensaje: "Error al insertar la disponibilidad" });
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
                    return res.status(500).render('error500', { mensaje: "Error al insertar el anuncio" });
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
                            return res.status(500).render('error500', { mensaje: "Error al insertar la disponibilidad" });
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
    getAnuncios,
    getPublicarAnuncio,
    postPublicarAnuncio,
    getServicios
};