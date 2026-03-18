"use strict"; 

const express = require('express'); 
const router = express.Router(); 
const { body } = require('express-validator');
const userController = require('../controllers/userController');

router.get('/perfilUsuario/:id', userController.getPerfilUsuario);
router.get('/perfilEmpresa/:id', userController.getPerfilEmpresa);
router.get('/perfilUsuario/:id/editar', userController.getEditarPerfilUsuario);
router.get('/perfilEmpresa/:id/editar', userController.getEditarPerfilEmpresa);  

module.exports = router; 