"use strict";

const DEFAULT_MESSAGES = {
    400: 'La solicitud no es válida o está incompleta.',
    401: 'Necesitas iniciar sesión para continuar.',
    403: 'No tienes permisos para acceder a este recurso.',
    404: 'Parece que la página que estás buscando salió a pasear sin correa...',
    423: 'El acceso está temporalmente bloqueado.',
    500: 'Nuestro gato de mantenimiento ha vuelto a las andadas. Inténtalo de nuevo en unos minutos.'
};

function createHttpError(status = 500, mensaje, codigo = null) {
    const error = new Error(mensaje || DEFAULT_MESSAGES[status] || DEFAULT_MESSAGES[500]);
    error.status = status;
    error.statusCode = status;
    error.codigo = codigo || null;
    error.mensaje = error.message;
    return error;
}

function getDefaultErrorMessage(status = 500) {
    return DEFAULT_MESSAGES[status] || DEFAULT_MESSAGES[500];
}

function getErrorView(status = 500) {
    const vistasSoportadas = new Set([400, 401, 403, 404, 423, 500]);
    return vistasSoportadas.has(Number(status)) ? `error${Number(status)}` : 'error500';
}

module.exports = {
    createHttpError,
    getDefaultErrorMessage,
    getErrorView
};
