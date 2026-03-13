"use strict";

/*Selectores de elementos*/
const petRegisterForm = document.getElementById("petRegisterForm");
const petNameInput = document.getElementById("pet-name");
const petSpeciesInput = document.getElementById("pet-species");
const petBreedInput = document.getElementById("pet-breed");
const petWeightInput = document.getElementById("pet-weight");
const petBirthdayInput = document.getElementById("pet-birthday");
const petImageInput = document.getElementById("pet-image");

/*Selectores de spans de error*/ 
const errorPetName = document.getElementById("error-pet-name");
const errorPetSpecies = document.getElementById("error-pet-species");
const errorPetBreed = document.getElementById("error-pet-breed");
const errorPetWeight = document.getElementById("error-pet-weight");
const errorPetBirthday = document.getElementById("error-pet-birthday");
const errorPetImage = document.getElementById("error-pet-image");

/********** Funciones de validación **********/
function validatePetName() {
    const name = petNameInput.value.trim();
    if (name === "") {
        errorPetName.textContent = "El nombre de la mascota es obligatorio.";
        return false;
    } else {
        errorPetName.textContent = "";
        return true;
    }
}

function validatePetSpecies() {
    const species = petSpeciesInput.value.trim();
    if (species === "") {
        errorPetSpecies.textContent = "La especie de la mascota es obligatoria.";
        return false;
    } else {
        errorPetSpecies.textContent = "";
        return true;
    }
}

function validatePetBreed() {
    const breed = petBreedInput.value.trim();
    if (breed === "") {
        errorPetBreed.textContent = "La raza de la mascota es obligatoria.";
        return false;
    } else {
        errorPetBreed.textContent = "";
        return true;
    }
}

function validatePetWeight() {
    const weight = petWeightInput.value.trim();
    if (weight === "") {
        errorPetWeight.textContent = "El peso de la mascota es obligatorio.";
        return false;
    } else if (isNaN(weight) || parseFloat(weight) <= 0) {
        errorPetWeight.textContent = "El peso debe ser un número positivo.";
        return false;
    } else {
        errorPetWeight.textContent = "";
        return true;
    }
}

function validatePetBirthday() {
    const birthday = petBirthdayInput.value;
    if (birthday === "") {
        errorPetBirthday.textContent = "La fecha de nacimiento de la mascota es obligatoria.";
        return false;
    } else if(isNaN(Date.parse(birthday))) {
        errorPetBirthday.textContent = "La fecha de nacimiento debe ser una fecha válida.";
        return false;
    } else if (new Date(birthday) > new Date()) {
        errorPetBirthday.textContent = "La fecha de nacimiento no puede ser en el futuro.";
        return false;
    } else {
        errorPetBirthday.textContent = "";
        return true;
    }
}

function validatePetImage() {
    const file = petImageInput.files[0];
    if (!file) {
        errorPetImage.textContent = "La foto de la mascota es obligatoria.";
        return false;
    } else if (!file.type.startsWith("image/")) {
        errorPetImage.textContent = "El archivo debe ser una imagen.";
        return false;
    } else {
        errorPetImage.textContent = "";
        return true;
    }
}

/********** Evento de envío del formulario **********/
petRegisterForm.addEventListener("submit", function(event) {
    const isNameValid = validatePetName();
    const isSpeciesValid = validatePetSpecies();
    const isBreedValid = validatePetBreed();
    const isWeightValid = validatePetWeight();
    const isBirthdayValid = validatePetBirthday();
    const isImageValid = validatePetImage();
    if (!isNameValid || !isSpeciesValid || !isBreedValid || !isWeightValid || !isBirthdayValid || !isImageValid) {
        event.preventDefault(); // Evita el envío del formulario si hay errores
    }
});

/********** Eventos de validación en tiempo real **********/
petNameInput.addEventListener("input", validatePetName);
petSpeciesInput.addEventListener("input", validatePetSpecies);
petBreedInput.addEventListener("input", validatePetBreed);
petWeightInput.addEventListener("input", validatePetWeight);
petBirthdayInput.addEventListener("input", validatePetBirthday);
petImageInput.addEventListener("change", validatePetImage);