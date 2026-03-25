"use strict";

const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();
const morgan = require('morgan');
const { isAuthenticated } = require('./middlewares/authMiddleware');

const app = express();
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

// Almacén temporal (sustituirá la base de datos más adelante)
const db = {
  clients:    [],
  businesses: []
};
app.locals.db = db;

// Rutas (se añadirán aquí)
const authRoutes = require('./routes/authRouter');
const userRoutes = require('./routes/userRouter');
const petRoutes = require('./routes/petRouter');

app.get('/', (req, res) => {
    res.render('inicio');
});

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/pets', isAuthenticated, petRoutes);



// Manejo de errores
app.use((req, res) => {
    res.status(404).render('error404');
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error500', { mensaje: err.mensaje || 'Error interno del servidor' });
});

// Arranque del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});