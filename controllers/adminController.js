"use strict"; 

const { validationResult } = require('express-validator');
const pool = require('../db');

const getAdminPanel= (req, res) => {
    res.render('adminPanel');
};

module.exports = {
    getAdminPanel
}; 