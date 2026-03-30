"use strict"; 

const express = require('express'); 
const router = express.Router(); 
const { body } = require('express-validator');
const contentController = require('../controllers/contentController');

const validarCreacionForo = [
    body('titulo')
        .notEmpty().withMessage('El título es obligatorio')
        .isLength({ max: 100 }).withMessage('El título no puede exceder los 100 caracteres'),
    body('descripcion')
        .notEmpty().withMessage('La descripción es obligatoria')
        .isLength({ max: 500 }).withMessage('La descripción no puede exceder los 500 caracteres'),
    body('categoría')
        .notEmpty().withMessage('La categoría es obligatoria')
];


router.get('/foros', contentController.verForos);
router.get('/foros/filtrar', contentController.filtrarForos);
router.post('/foros/filtrar', contentController.filtrarForos);
router.get('/foros/crearForo', contentController.getCrearForo); 
router.post('/foros/crearForo', validarCreacionForo, contentController.postCrearForo);
router.get('/foros/:id', contentController.verForo);
router.get('/foros/:id/usuario/:id_usuario/editar', contentController.getEditarForo);
router.post('/foros/:id/usuario/:id_usuario/editar', validarCreacionForo, contentController.postEditarForo);
router.get('/foros/:id/usuario/:id_usuario/eliminar', contentController.eliminarForo);
router.post('/foros/:id/usuario/:id_usuario/comentario', contentController.comentarForo);
router.get('/foros/:id/usuario/:id_usuario/comentario/:id_comentario/eliminar', contentController.eliminarComentario);
router.get('/foros/:id/usuario/:id_usuario/comentario/:id_comentario/editar', contentController.getEditarComentario);
router.post('/foros/:id/usuario/:id_usuario/comentario/:id_comentario/editar', contentController.postEditarComentario);

module.exports = router;
