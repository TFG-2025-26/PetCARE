"use strict";

const getPerfilUsuario = (req, res) => {
    const miDB = req.app.locals.db;
    const usuarioId = parseInt(req.params.id, 10);
    const usuario = miDB.clients.find(client => client.id === usuarioId);
    const mascotas = []; // Aquí se podrían cargar las mascotas asociadas al usuario
    res.render('perfilUsuario', { usuario, mascotas });
};

const getPerfilEmpresa = (req, res) => {
    const miDB = req.app.locals.db;
    const empresaId = parseInt(req.params.id, 10);
    const empresa = miDB.businesses.find(business => business.id === empresaId);
    res.render('perfilEmpresa', { empresa });
};

module.exports = {
    getPerfilUsuario,
    getPerfilEmpresa
};