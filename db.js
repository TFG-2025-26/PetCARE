"use strict";

const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'petcare',
});

//Importar en los routers y app para solo crear un pool de conexiones a la base de datos
module.exports = pool;