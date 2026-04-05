"use strict";

const express = require('express'); 
const router = express.Router(); 
const { body } = require('express-validator');
const adminController = require('../controllers/adminController');
const { isAuthenticated } = require('../middlewares/authMiddleware');

router.get('/adminPanel', isAuthenticated, adminController.getAdminPanel);
router.get('/adminPanel/gestionUsuarios', isAuthenticated, adminController.getGestionUsuarios);
router.get('/adminPanel/gestionUsuarios/filtrar', isAuthenticated, adminController.filtrarUsuarios);
router.post('/adminPanel/gestionUsuarios/:tipo/:id/eliminar', isAuthenticated, adminController.eliminarUsuarioGestion);
router.get('/adminPanel/gestionReportes', isAuthenticated, adminController.getGestionReportes);
router.get('/adminPanel/gestionReportes/filtrar', isAuthenticated, adminController.filtrarReportes);
router.get('/adminPanel/gestionReportes/:id_reporte', isAuthenticated, adminController.getDetalleReporte);
router.post('/adminPanel/gestionReportes/:id_reporte/acciones/:accion', isAuthenticated, adminController.aplicarAccionReporte);
router.get('/adminPanel/gestionReportes/:id_reporte/editarAccion', isAuthenticated, adminController.editarAccionReporte);

module.exports = router;