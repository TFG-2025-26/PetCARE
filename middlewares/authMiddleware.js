"use strict";

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
        return res.status(403).render('error404');
    }

    return next();
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

    return res.status(403).render('error404');
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

    return res.status(403).render('error404');
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

    return res.status(403).render('error404');
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

    return res.status(403).render('error404');
}

module.exports = {
    isAuthenticated,
    isAdminAuthenticated,
    canEditUserProfile,
    canEditCompanyProfile,
    isOwnUserProfile,
    isOwnCompanyProfile
};