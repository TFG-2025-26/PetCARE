"use strict"; 

const { validationResult } = require('express-validator');
const pool = require('../db'); 

const getCrearForo = (req, res) => {}; 

const postCrearForo = (req, res) => {};

const verForos = (req, res) => {};

const verForo = (req, res) => {};

const filtrarForos = (req, res) => {};

const getEditarForo = (req, res) => {};

const postEditarForo = (req, res) => {};

const eliminarForo = (req, res) => {};

const comentarForo = (req, res) => {};

const eliminarComentario = (req, res) => {};

const getEditarComentario = (req, res) => {};

const postEditarComentario = (req, res) => {};

module.exports = {
    getCrearForo, 
    postCrearForo,
    verForos,
    verForo,
    filtrarForos,
    getEditarForo,
    postEditarForo,
    eliminarForo,
    comentarForo,
    eliminarComentario,
    getEditarComentario,
    postEditarComentario
};