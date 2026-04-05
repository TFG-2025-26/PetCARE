"use strict";

const express = require('express'); 
const router = express.Router(); 
const { body } = require('express-validator');
const adminController = require('../controllers/adminController');
const { isAdminAuthenticated } = require('../middlewares/authMiddleware');

router.use(isAdminAuthenticated);

router.get('/adminPanel', adminController.getAdminPanel);
router.get('/adminPanel/gestionUsuarios', adminController.getGestionUsuarios);
router.get('/adminPanel/gestionUsuarios/filtrar', adminController.filtrarUsuarios);
router.post('/adminPanel/gestionUsuarios/:tipo/:id/eliminar', adminController.eliminarUsuarioGestion);
router.get('/adminPanel/gestionReportes', adminController.getGestionReportes);
router.get('/adminPanel/gestionReportes/filtrar', adminController.filtrarReportes);
router.get('/adminPanel/gestionReportes/:id_reporte', adminController.getDetalleReporte);
router.post('/adminPanel/gestionReportes/:id_reporte/acciones/:accion', adminController.aplicarAccionReporte);
router.get('/adminPanel/gestionReportes/:id_reporte/editarAccion', adminController.editarAccionReporte);

module.exports = router;