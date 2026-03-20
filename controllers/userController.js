"use strict";

const { validationResult } = require('express-validator');
const pool = require('../db'); 

const getPerfilUsuario = (req, res) => {

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al obtener la cnexión a la base de datos:', err); 
            return res.status(500).send('Error al obtener la conexión a la base de datos'); 
        }

        const usuarioId = parseInt(req.params.id, 10); 
        connection.query('SELECT * FROM usuarios WHERE id_usuario = ?', [usuarioId], (err, results) => {
            connection.release(); 
            if (err) {
                console.error('Error al ejecutar la consulta:', err); 
                return res.status(500).send('Error al ejecutar al recuperar los datos del usuario'); 
            }
            if (results.length === 0) {
                return res.status(404).send('Usuario no encontrado'); 
            }
            // TODO: Falta recoger bien las mascotas 
            res.render('perfilUsuario', { usuario: results[0], mascotas: [] });
        })
    })
};

const getPerfilEmpresa = (req, res) => {
    const miDB = req.app.locals.db;
    const empresaId = parseInt(req.params.id, 10);
    const empresa = miDB.businesses.find(business => business.id === empresaId);
    res.render('perfilEmpresa', { 
        empresa, 
        valoraciones: [],
        esPropia: true
    });
};

const getEditarPerfilUsuario = (req, res) => {
    const miDB = req.app.locals.db;
    const usuarioId = parseInt(req.params.id, 10);
    const usuario = miDB.clients.find(client => client.id === usuarioId);
    res.render('editarPerfilUsuario', { usuario });
};

const getEditarPerfilEmpresa = (req, res) => {
    const miDB = req.app.locals.db; 
    const empresaId = parseInt(req.params.id, 10); 
    const empresa = miDB.businesses.find(business => business.id === empresaId); 
    res.render('editarPerfilEmpresa', {empresa}); 
}

module.exports = {
    getPerfilUsuario,
    getPerfilEmpresa, 
    getEditarPerfilUsuario, 
    getEditarPerfilEmpresa
};