"use strict";

const { validationResult } = require('express-validator');
const pool = require('../db'); 

const getPerfilUsuario = (req, res) => {

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al obtener la conexión a la base de datos:', err); 
            return res.status(500).send('Error al obtener la conexión a la base de datos'); 
        }

        const usuarioId = parseInt(req.params.id, 10); 
        connection.query('SELECT * FROM usuarios WHERE id_usuario = ?', [usuarioId], (err, results) => {
            connection.release(); 
            if (err) {
                console.error('Error al ejecutar la consulta:', err); 
                return res.status(500).send('Error al recuperar los datos del usuario'); 
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

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al obtener la conexión a la base de datos:', err);
            return res.status(500).send('Error al obtener la conexión a la base de datos'); 
        }

        const empresaId = parseInt(req.params.id, 10); 
        connection.query('SELECT * FROM empresas WHERE id_empresa = ?', [empresaId], (err, results) => {
            connection.release(); 
            if (err) {
                console.error('Error al ejecutar la consulta:', err);
                return res.status(500).send('Error al recuperar los datos de la empresa'); 
            }
            if (results.length === 0) {
                return res.status(404).send('Empresa no encontrada'); 
            }
            res.render('perfilEmpresa', {
                empresa: results[0], 
                valoraciones: [], //TODO: Falta recoger bien las valoraciones
                esPropia: true //TODO: Falta comprobar si la empresa es propia o no
            })
        })
    })
};

const getEditarPerfilUsuario = (req, res) => {

    pool.getConnection((err, connection) => {
        if(err) {
            console.error('Error al obtener la conexión a la base de datos:', err); 
            return res.status(500).send('Error al obtener la conexión a la base de datos'); 
        }

        const usuarioId = parseInt(req.params.id, 10); 
        connection.query('SELECT * FROM usuarios WHERE id_usuario = ?', [usuarioId], (err, results) => {
            connection.release(); 
            if (err) {
                console.error('Error al ejecutar la consulta:', err); 
                return res.status(500).send('Error al recuperar los datos de usuario'); 
            }
            if (results.length === 0) {
                return res.status(404).send('Usuario no encontrado'); 
            }
            res.render('editarPerfilUsuario', { usuario: results[0] });
        })
    })
};

const getEditarPerfilEmpresa = (req, res) => {
    
    pool.getConnection((err, connection) => {
        if(err) {
            console.error('Error al obtener la conexión a la base de datos:', err); 
            return res.status(500).send('Error al obtener la conexión a la base de datos'); 
        }

        const empresaId = parseInt(req.params.id, 10); 
        connection.query('SELECT * FROM empresas WHERE id_empresa = ?', [empresaId], (err, results) => {
            connection.release(); 
            if (err) {
                console.error('Error al ejecutar la consulta:', err); 
                return res.status(500).send('Error al recuperar los datos de la empresa'); 
            }
            if (results.length === 0) {
                return res.status(404).send('Empresa no encontrada'); 
            }
            res.render('editarPerfilEmpresa', { empresa: results[0] });
        })
    })
}

const postEditarPerfilUsuario = (req, res) => {
    const errors = validationResult(req); 

    const usuarioActual = {
        id_usuario: req.params.id,
        nombre_completo: req.body.nombre,
        nombre_usuario: req.body.usuario,
        correo: req.body.email,
        fecha_nacimiento: req.body.fecha_nacimiento,
        telefono: req.body.telefono,
        ciudad: req.body.ciudad,
        pais: req.body.pais,
        codigo_postal: req.body.codigo_postal,
        genero: req.body.genero,
        trabajo: req.body.trabajo,
        bio: req.body.bio
    };

    if (!errors.isEmpty()) {
        return res.status(400).render('editarPerfilUsuario', { 
            usuario: usuarioActual, 
            error: 'Por favor corrige los errores en el formulario', 
            errores: errors.array()
        }); 
    }

    const { nombre, usuario, email, fecha_nacimiento, telefono, ciudad, pais, codigo_postal, genero, trabajo, bio, password_actual, password_nueva } = req.body;
    const usuarioId = parseInt(req.params.id, 10); 

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error al obtener la conexión a la base de datos:', err); 
            return res.status(500).send('Error al obtener la conexión a la base de datos'); 
        }

        // 1. En caso de cambiar la contraseña se precisa verificar la actual
        if (password_nueva) {
            connection.query('SELECT contraseña FROM usuarios WHERE id_usuario = ?', [usuarioId], (err, results) => {
                if (err) {
                    connection.release();
                    return res.status(500).send('Error al verificar la contraseña');
                }
                if (results[0].contraseña !== password_actual) {
                    connection.release();
                    return res.status(400).render('editarPerfilUsuario', {
                        usuario: usuarioActual,
                        error: 'La contraseña actual no es correcta',
                        errores: []
                    });
                }
                // Contraseña correcta, actualizar con nueva contraseña
                ejecutarUpdate(connection, [nombre, usuario, email, fecha_nacimiento, telefono, ciudad, pais, codigo_postal, genero, trabajo, bio, password_nueva, usuarioId], res, usuarioId);
            });
        } else {
            // 2. Sin cambio de contraseña, mantener la actual
            connection.query('SELECT contraseña FROM usuarios WHERE id_usuario = ?', [usuarioId], (err, results) => {
                if (err) {
                    connection.release();
                    return res.status(500).send('Error al obtener la contraseña');
                }
                ejecutarUpdate(connection, [nombre, usuario, email, fecha_nacimiento, telefono, ciudad, pais, codigo_postal, genero, trabajo, bio, results[0].contraseña, usuarioId], res, usuarioId);
            });
        }

        function ejecutarUpdate(connection, params, res, usuarioId) {
            const sql_update = `UPDATE usuarios SET 
                nombre_completo = ?, 
                nombre_usuario = ?,
                correo = ?,
                fecha_nacimiento = ?,
                telefono = ?,
                ciudad = ?,
                pais = ?,
                codigo_postal = ?,
                genero = ?,
                trabajo = ?,
                bio = ?, 
                contraseña = ?
            WHERE id_usuario = ?`;
            connection.query(sql_update, params, (err) => {
                connection.release();
                if (err) {
                    console.error('Error al ejecutar la consulta:', err);
                    return res.status(500).send('Error al actualizar los datos del usuario');
                }
                res.redirect('/user/perfilUsuario/' + usuarioId);
            });
        }
    });
};

const postEditarPerfilEmpresa = (req, res) => {};

module.exports = {
    getPerfilUsuario,
    getPerfilEmpresa, 
    getEditarPerfilUsuario, 
    getEditarPerfilEmpresa, 
    postEditarPerfilUsuario, 
    postEditarPerfilEmpresa
};