"use strict";


const express = require('express');
const router = express.Router();
const pool = require('../db'); // Importamos el pool de conexiones a la base de datos
const { getMyPets, getRegisterPet, postRegisterPet } = require('../controllers/petController');



router.get("/mypets", getMyPets);
router.get("/register", getRegisterPet);
router.post("/register", postRegisterPet);

module.exports = router;
