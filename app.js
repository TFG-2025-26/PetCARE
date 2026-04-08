"use strict";

const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();
const morgan = require('morgan');
const { isAuthenticated } = require('./middlewares/authMiddleware');
const { createHttpError, getDefaultErrorMessage, getErrorView } = require('./handlers/httpErrors');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.locals.io = io; // Hacer io accesible en toda la aplicación

app.use(morgan('dev'));

// Motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares básicos
app.use(express.urlencoded({ extended: true })); // Parsear formularios
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Sesiones
app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_provisional',
  resave: false,
  saveUninitialized: false
}));

//Middleware global para la sesión 
app.use((req, res, next) => {
        res.locals.usuario = req.session.usuario || null;
    next();
});

app.use((req, res, next) => {
    const originalSend = res.send.bind(res);

    res.send = function patchedSend(body) {
        const acceptHeader = req.get('Accept') || '';
        const wantsHtmlErrorView = !req.xhr && !acceptHeader.includes('application/json') && req.accepts('html');
        const isPlainTextBody = typeof body === 'string' && !body.trim().startsWith('<');

        if (!res.headersSent && res.statusCode >= 400 && wantsHtmlErrorView && isPlainTextBody) {
            return next(createHttpError(res.statusCode, body));
        }

        return originalSend(body);
    };

    next();
});

// Rutas (se añadirán aquí)
const authRoutes = require('./routes/authRouter');
const userRoutes = require('./routes/userRouter');
const petRoutes = require('./routes/petRouter');
const contentRoutes = require('./routes/contentRouter');
const servicesRoutes = require('./routes/servicesRouter');
const adminRoutes = require('./routes/adminRouter');

app.get('/', (req, res) => {
    res.render('inicio');
});

app.get('/servicios', (req, res) => {
    res.render('servicios');
});

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/pets', isAuthenticated, petRoutes);
app.use('/content', isAuthenticated, contentRoutes);
app.use('/services', servicesRoutes);

app.use('/admin', isAuthenticated, adminRoutes);

// Manejo de errores
app.use((req, res, next) => {
    return next(createHttpError(404, 'La página que buscas no existe o ya no está disponible.'));
});

app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    const status = Number(err.status || err.statusCode || res.statusCode || 500);
    const mensaje = err.mensaje || err.message || getDefaultErrorMessage(status);
    const mensajeVista = [404, 500].includes(status) ? getDefaultErrorMessage(status) : mensaje;
    const codigoError = err.codigo || err.code || null;
    const acceptHeader = req.get('Accept') || '';

    console.error(err.stack || err);

    if (req.xhr || acceptHeader.includes('application/json')) {
        return res.status(status).json({ error: mensaje, codigoError });
    }

    return res.status(status).render(getErrorView(status), {
        mensaje: mensajeVista,
        codigoError,
        status
    });
});

require('./sockets/chatSocket')(io); // Pasar io al módulo de sockets

// Arranque del servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});