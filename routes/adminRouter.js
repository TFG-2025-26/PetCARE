"use strict";

const express = require('express'); 
const router = express.Router(); 
const { body } = require('express-validator');
const adminController = require('../controllers/adminController');
const { isAuthenticated } = require('../middlewares/authMiddleware');

router.get('/adminPanel', isAuthenticated, adminController.getAdminPanel);

module.exports = router;