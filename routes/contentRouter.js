"use strict"; 

const express = require('express'); 
const router = express.Router(); 
const { body } = require('express-validator');
const multer = require('multer');
const contentController = require('../controllers/contentController');
const { isAuthenticated, isAdminAuthenticated } = require('../middlewares/authMiddleware');

const uploadArticulo = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Formato de imagen no permitido'));
        }
    }
});

const validarCreacionForo = [
    body('titulo')
        .notEmpty().withMessage('El título es obligatorio')
        .isLength({ max: 100 }).withMessage('El título no puede exceder los 100 caracteres'),
    body('descripcion')
        .notEmpty().withMessage('La descripción es obligatoria')
        .isLength({ max: 500 }).withMessage('La descripción no puede exceder los 500 caracteres'),
    body('categoria')
        .notEmpty().withMessage('La categoria es obligatoria')
];

const validarCreacionArticulo = [
    body('titulo')
        .notEmpty().withMessage('El título es obligatorio')
        .isLength({ min: 5, max: 255 }).withMessage('El título debe tener entre 5 y 255 caracteres'),
    body('cuerpo')
        .notEmpty().withMessage('El cuerpo del artículo es obligatorio')
        .isLength({ min: 20, max: 10000 }).withMessage('El cuerpo del artículo debe tener entre 20 y 10000 caracteres')
];

router.get('/articulos', isAuthenticated, contentController.getArticulos);
router.get('/articulos/crearArticulo', isAdminAuthenticated, contentController.getCrearArticulo);
router.post('/articulos/crearArticulo', isAdminAuthenticated, uploadArticulo.single('imagen'), validarCreacionArticulo, contentController.postCrearArticulo);
router.get('/articulos/:id', isAuthenticated, contentController.getArticuloDetalle);
router.get('/foros', isAuthenticated, contentController.verForos);
router.get('/foros/filtrar', isAuthenticated, contentController.filtrarForos);
router.post('/foros/filtrar', isAuthenticated, contentController.filtrarForos);
router.get('/foros/crearForo', isAuthenticated, contentController.getCrearForo);
router.post('/foros/crearForo', isAuthenticated, validarCreacionForo, contentController.postCrearForo);
router.get('/foros/:id', isAuthenticated, contentController.verForo);
router.get('/foros/:id/usuario/:id_usuario/editar', isAuthenticated, contentController.getEditarForo);
router.post('/foros/:id/usuario/:id_usuario/editar', isAuthenticated, validarCreacionForo, contentController.postEditarForo);
router.get('/foros/:id/usuario/:id_usuario/eliminar', isAuthenticated, contentController.eliminarForo);
router.post('/foros/:id/usuario/:id_usuario/comentario', isAuthenticated, contentController.comentarForo);
router.get('/foros/:id/usuario/:id_usuario/comentario/:id_comentario/eliminar', isAuthenticated, contentController.eliminarComentario);
router.get('/foros/:id/usuario/:id_usuario/comentario/:id_comentario/editar', isAuthenticated, contentController.getEditarComentario);
router.post('/foros/:id/usuario/:id_usuario/comentario/:id_comentario/editar', isAuthenticated, contentController.postEditarComentario); //me falta hacer esto
router.get('/foros/:id/usuario/:id_usuario/reportar', isAuthenticated, contentController.getReportarForo); 
router.post('/foros/:id/usuario/:id_usuario/reportar', isAuthenticated, contentController.postReportarForo); 
router.get('/foros/:id/usuario/:id_usuario/comentario/:id_comentario/reportar', isAuthenticated, contentController.getReportarComentario);
router.post('/foros/:id/usuario/:id_usuario/comentario/:id_comentario/reportar', isAuthenticated, contentController.postReportarComentario);


module.exports = router;
