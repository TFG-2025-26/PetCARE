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

module.exports = {
    isAuthenticated,
    isAdminAuthenticated
};