"use strict"; 

const express = require('express'); 
const router = express.Router(); 
const { body } = require('express-validator');
const servicesController = require('../controllers/servicesController.js');
const chatController = require('../controllers/chatController.js');
const citasController = require('../controllers/citasController.js');
const { isAuthenticated, esEmpresa } = require('../middlewares/authMiddleware');

const anuncioValidationRules = [
    body('tipo_servicio')
        .notEmpty().withMessage('El tipo de servicio es obligatorio.')
        .isIn(['cuidador', 'transporte', 'entrenador']).withMessage('El tipo de servicio seleccionado no es válido.'),
    body('tipo_mascota')
        .notEmpty().withMessage('El tipo de mascota es obligatorio.')
        .isIn(['perro', 'gato', 'roedor', 'reptil', 'pez', 'ave', 'otro']).withMessage('El tipo de mascota seleccionado no es válido.'),
    body('precio_hora')
        .notEmpty().withMessage('El precio por hora es obligatorio.')
        .isFloat({ min: 0, max: 999 }).withMessage('El precio debe estar entre 0 y 999.'),
    body('descripcion')
        .optional({ checkFalsy: true })
        .isLength({ max: 500 }).withMessage('La descripción no puede superar los 500 caracteres.'),
    body('tipo')
        .notEmpty().withMessage('Debes seleccionar un tipo de disponibilidad.').bail()
        .isIn(['puntual', 'recurrente']).withMessage('El tipo de disponibilidad no es válido.').bail()
        .custom((value, { req }) => {
            if (value === 'puntual') {
                const disponibilidad = req.body.disponibilidad;
                if (!disponibilidad || disponibilidad.length === 0) {
                    throw new Error('Debes añadir al menos una franja de disponibilidad.');
                }
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                for (let i = 0; i < disponibilidad.length; i++) {
                    const franja = disponibilidad[i];
                    if (!franja.fecha) throw new Error(`Franja ${i + 1}: la fecha es obligatoria.`);
                    const fecha = new Date(franja.fecha + 'T00:00:00');
                    if (fecha < hoy) throw new Error(`Franja ${i + 1}: la fecha no puede ser anterior a hoy.`);
                    if (!franja.hora_inicio) throw new Error(`Franja ${i + 1}: la hora de inicio es obligatoria.`);
                    if (!franja.hora_fin) throw new Error(`Franja ${i + 1}: la hora de fin es obligatoria.`);
                    if (franja.hora_fin <= franja.hora_inicio) throw new Error(`Franja ${i + 1}: la hora de fin debe ser posterior a la de inicio.`);
                }
            } else if (value === 'recurrente') {
                const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
                const recurrente = req.body.recurrente;
                if (!recurrente || Object.keys(recurrente).length === 0) {
                    throw new Error('Debes seleccionar al menos un día de la semana.');
                }
                for (const dia of dias) {
                    if (!recurrente[dia]) continue;
                    const slots = Object.values(recurrente[dia]);
                    for (let i = 0; i < slots.length; i++) {
                        const slot = slots[i];
                        if (!slot.hora_inicio) throw new Error(`${dia} franja ${i + 1}: la hora de inicio es obligatoria.`);
                        if (!slot.hora_fin) throw new Error(`${dia} franja ${i + 1}: la hora de fin es obligatoria.`);
                        if (slot.hora_fin <= slot.hora_inicio) throw new Error(`${dia} franja ${i + 1}: la hora de fin debe ser posterior a la de inicio.`);
                    }
                }
            }
            return true;
        })
];

router.get('/', servicesController.getServicios);
router.get('/anuncios', esEmpresa, servicesController.anuncios);
router.get('/get-anuncios', esEmpresa, servicesController.getAnuncios);
router.get('/mis-anuncios', isAuthenticated, esEmpresa, servicesController.misAnuncios);
router.get('/get-mis-anuncios', isAuthenticated, esEmpresa, servicesController.getMisAnuncios);
router.put('/anuncios/:id/eliminar', isAuthenticated, esEmpresa, servicesController.eliminarAnuncio);
router.put('/anuncios/:id/reactivar', isAuthenticated, esEmpresa, servicesController.reactivarAnuncio);
router.get('/publicar-anuncio', isAuthenticated, esEmpresa, servicesController.getPublicarAnuncio);
router.post('/publicar-anuncio', isAuthenticated, esEmpresa, anuncioValidationRules, servicesController.postPublicarAnuncio);
router.get('/empresas', servicesController.empresas);
router.get('/get-empresas', servicesController.getEmpresas);
router.get('/chat', isAuthenticated, esEmpresa, chatController.getChatPage);
router.get('/chat/historial', isAuthenticated, esEmpresa, chatController.getHistorial);
router.get('/chat/archivado', isAuthenticated, esEmpresa, chatController.getChatArchivadoPage);
router.post('/chat/valorar', isAuthenticated, esEmpresa, chatController.postValorar);
router.get('/mis-chats', isAuthenticated, esEmpresa, chatController.getMisChats);
router.get('/mis-chats/data', isAuthenticated, esEmpresa, chatController.getMisChatsData);
router.put('/mis-chats/:id/eliminar', isAuthenticated, esEmpresa, chatController.eliminarChat);
router.get('/citas', isAuthenticated, esEmpresa, citasController.getCitas);
router.put('/citas/:id/cancelar', isAuthenticated, esEmpresa, citasController.cancelarCita);

module.exports = router;