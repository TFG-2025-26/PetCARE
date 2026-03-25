"use strict"; 

const express = require('express'); 
const router = express.Router(); 
const { body } = require('express-validator');
const contentController = require('../controllers/contentController');

router.get('/crearForo', contentController.getCrearForo); 
router.post('/crearForo', contentController.postCrearForo);
router.get('/foros', contentController.verForos);
router.get('/foros/:id', contentController.verForo);
router.post('/foros/filtrar', contentController.filtrarForos);
router.get('/foro/:id/editar', contentController.getEditarForo);
router.post('/foro/:id/editar', contentController.postEditarForo);
router.get('/foro/:id/eliminar', contentController.eliminarForo);
router.post('/foro/:id/comentario', contentController.comentarForo);
router.get('/foro/:id/comentario/:id_comentario/eliminar', contentController.eliminarComentario);
router.get('/foro/:id/comentario/:id_comentario/editar', contentController.getEditarComentario);
router.post('/foro/:id/comentario/:id_comentario/editar', contentController.postEditarComentario);

module.exports = router;
