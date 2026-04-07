"use strict";

const { createHttpError } = require('../handlers/httpErrors');

const denyAccess = (next) => next(createHttpError(403, 'No tienes permiso para acceder a este recurso.'));

function isAuthenticated(req, res, next) {
    if (req.session && req.session.usuario) {
        return next();
    } else {
        return res.redirect('/auth/login');
    }
}

function isAdminAuthenticated(req, res, next) {
    if (!req.session || !req.session.usuario) {
        return res.redirect('/auth/login');
    }

    if (req.session.usuario.rol !== 'admin') {
        return denyAccess(next);
    }

    return next();
}

function esAdmin(usuarioSesion) {
    return !!(usuarioSesion && usuarioSesion.rol === 'admin');
}

function canViewUserProfile(req, res, next) {
    if (!req.session || !req.session.usuario) {
        return res.redirect('/auth/login');
    }

    const usuarioSesion = req.session.usuario;
    const objetivoId = parseInt(req.params.id, 10);
    const esPropietario = usuarioSesion.tipo === 'usuario' && Number(usuarioSesion.id) === objetivoId;

    if (esPropietario || esAdmin(usuarioSesion)) {
        return next();
    }

    return denyAccess(next);
}

function canViewCompanyProfile(req, res, next) {
    if (!req.session || !req.session.usuario) {
        return res.redirect('/auth/login');
    }

    const usuarioSesion = req.session.usuario;
    const objetivoId = parseInt(req.params.id, 10);
    const esPropietario = usuarioSesion.tipo === 'empresa' && Number(usuarioSesion.id) === objetivoId;

    if (esPropietario || esAdmin(usuarioSesion)) {
        return next();
    }

    return denyAccess(next);
}

function canEditUserProfile(req, res, next) {
    if (!req.session || !req.session.usuario) {
        return res.redirect('/auth/login');
    }

    const usuarioSesion = req.session.usuario;
    const objetivoId = parseInt(req.params.id, 10);
    const esPropietario = usuarioSesion.tipo === 'usuario' && Number(usuarioSesion.id) === objetivoId;

    if (esPropietario) {
        return next();
    }

    return denyAccess(next);
}

function canEditCompanyProfile(req, res, next) {
    if (!req.session || !req.session.usuario) {
        return res.redirect('/auth/login');
    }

    const usuarioSesion = req.session.usuario;
    const objetivoId = parseInt(req.params.id, 10);
    const esPropietario = usuarioSesion.tipo === 'empresa' && Number(usuarioSesion.id) === objetivoId;

    if (esPropietario) {
        return next();
    }

    return denyAccess(next);
}

function isOwnUserProfile(req, res, next) {
    if (!req.session || !req.session.usuario) {
        return res.redirect('/auth/login');
    }

    const usuarioSesion = req.session.usuario;
    const objetivoId = parseInt(req.params.id, 10);
    const esPropietario = usuarioSesion.tipo === 'usuario' && Number(usuarioSesion.id) === objetivoId;

    if (esPropietario) {
        return next();
    }

    return denyAccess(next);
}

function isOwnCompanyProfile(req, res, next) {
    if (!req.session || !req.session.usuario) {
        return res.redirect('/auth/login');
    }

    const usuarioSesion = req.session.usuario;
    const objetivoId = parseInt(req.params.id, 10);
    const esPropietario = usuarioSesion.tipo === 'empresa' && Number(usuarioSesion.id) === objetivoId;

    if (esPropietario) {
        return next();
    }

    return denyAccess(next);
}

module.exports = {
    isAuthenticated,
    isAdminAuthenticated,
    canViewUserProfile,
    canViewCompanyProfile,
    canEditUserProfile,
    canEditCompanyProfile,
    isOwnUserProfile,
    isOwnCompanyProfile
};