"use strict"; 

// Selección de formularios
const ownerForm = document.getElementById("form-owner");
const bizForm = document.getElementById("form-business");

// Selección de elementos - Owner
const ownerNombreInput = document.getElementById("owner-nombre"); 
const ownerNombreUsuarioInput = document.getElementById("owner-usuario"); 
const ownerEmailInput = document.getElementById("owner-email"); 
const ownerPasswordInput = document.getElementById("owner-password"); 
const ownerFechaInput = document.getElementById("owner-fecha"); 

// Selección de elementos - Business 
const bizNombreInput = document.getElementById("biz-nombre"); 
const bizEmailInput = document.getElementById("biz-email"); 
const bizCifInput = document.getElementById("biz-cif");
const bizPasswordInput = document.getElementById("biz-password"); 
const bizTipoSelect = document.getElementById("biz-tipo"); 
const bizTipoOtroInput = document.getElementById("biz-tipo-otro");

// Selección de Spans - Owner
const ownerNombreError = document.getElementById("error-owner-nombre");
const ownerUsuarioError = document.getElementById("error-owner-nombre-usuario");
const ownerEmailError = document.getElementById("error-owner-email");
const ownerPasswordError = document.getElementById("error-owner-password");
const ownerFechaError = document.getElementById("error-owner-fecha");

// Selección de Spans - Business 
const bizNombreError = document.getElementById("biz-nombre-error");
const bizEmailError = document.getElementById("biz-email-error");
const bizCifError = document.getElementById("biz-cif-error");
const bizPasswordError = document.getElementById("biz-password-error");
const bizTipoError = document.getElementById("biz-tipo-error");
const bizTipoOtroError = document.getElementById("biz-tipo-otro-error");

// Funciones de validación - Owner
function validarNombreOwner() {
    let nombreOwnerValid = true;

    if (ownerNombreInput.value.trim().length < 3) {
        ownerNombreError.textContent = "El nombre debe tener al menos 3 caracteres.";
        nombreOwnerValid = false; 
    } else {
        ownerNombreError.textContent = "";
    }
    return nombreOwnerValid;
}

function validarUsuarioOwner() {
    let usuarioOwnerValid = true;
    const regex = /^\S+$/;

    if (ownerNombreUsuarioInput.value.trim().length < 3) {
        ownerUsuarioError.textContent = "El nombre de usuario debe tener al menos 3 caracteres.";
        usuarioOwnerValid = false;
    } else if (!regex.test(ownerNombreUsuarioInput.value)) {
        ownerUsuarioError.textContent = "El nombre de usuario no puede contener espacios en blanco.";
        usuarioOwnerValid = false;
    } else {
        ownerUsuarioError.textContent = "";
    }

    return usuarioOwnerValid;
}

function validarEmailOwner() {
    let emailOwnerValid = true;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!regex.test(ownerEmailInput.value.trim())) {
        ownerEmailError.textContent = "Por favor, introduce un email válido.";
        emailOwnerValid = false;
    } else {
        ownerEmailError.textContent = "";
    }

    return emailOwnerValid;
}

function validarPasswordOwner() {
    let passwordOwnerValid = true;
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

    if (/\s/.test(bizPasswordInput.value)) {
        bizPasswordError.textContent = "La contraseña no puede contener espacios en blanco.";
        passwordBusinessValid = false;
    } else if (!regex.test(ownerPasswordInput.value.trim())) {
        ownerPasswordError.textContent = "La contraseña debe tener al menos 8 caracteres, incluyendo una letra mayúscula, una letra minúscula y un número.";
        passwordOwnerValid = false;
    } else {
        ownerPasswordError.textContent = "";
    }

    return passwordOwnerValid;
}

function validarFechaOwner() {
    let fechaOwnerValid = true;
    const fechaNacimiento = new Date(ownerFechaInput.value);
    const hoy = new Date();

    let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const mes = hoy.getMonth() - fechaNacimiento.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
        edad--;
    }

    if (isNaN(fechaNacimiento.getTime())) {
        ownerFechaError.textContent = "Por favor, introduce una fecha de nacimiento válida.";
        fechaOwnerValid = false;
    } else if (edad < 14) {
        ownerFechaError.textContent = "Debes tener al menos 14 años para registrarte.";
        fechaOwnerValid = false;
    } else if (edad > 120) {
        ownerFechaError.textContent = "Por favor, introduce una fecha de nacimiento realista.";
        fechaOwnerValid = false;
    } else {
        ownerFechaError.textContent = "";
    }

    return fechaOwnerValid;
}

// Funciones de validación - Business 
function validarNombreBusiness() {
    let nombreBusinessValid = true;
    if (bizNombreInput.value.trim().length < 3) {
        bizNombreError.textContent = "El nombre de la empresa debe tener al menos 3 caracteres.";
        nombreBusinessValid = false;
    } else {
        bizNombreError.textContent = "";
    }

    return nombreBusinessValid;
}

function validarEmailBusiness() {
    let emailBusinessValid = true;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!regex.test(bizEmailInput.value.trim())) {
        bizEmailError.textContent = "Por favor, introduce un email válido.";
        emailBusinessValid = false;
    } else {
        bizEmailError.textContent = "";
    }

    return emailBusinessValid;
}

function validarCifBusiness() {
    let cifBusinessValid = true;
    const regex = /^[A-Za-z0-9]{8,}$/;

    if (!regex.test(bizCifInput.value.trim())) {
        bizCifError.textContent = "Por favor, introduce un CIF válido.";
        cifBusinessValid = false;
    } else {
        bizCifError.textContent = "";
    }

    return cifBusinessValid;
}

function validarPasswordBusiness() {
    let passwordBusinessValid = true;
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    // que no contenga espacios en blanco
    if (/\s/.test(bizPasswordInput.value)) {
        bizPasswordError.textContent = "La contraseña no puede contener espacios en blanco.";
        passwordBusinessValid = false;
    } else if (!regex.test(bizPasswordInput.value.trim())) {
        bizPasswordError.textContent = "La contraseña debe tener al menos 8 caracteres, incluyendo una letra mayúscula, una letra minúscula y un número.";
        passwordBusinessValid = false;
    } else {
        bizPasswordError.textContent = "";
    }

    return passwordBusinessValid;
}

function validarTipoBusiness() {
    let tipoBusinessValid = true;
    if (bizTipoSelect.value === "") {
        bizTipoError.textContent = "Por favor, selecciona un tipo de empresa.";
        tipoBusinessValid = false;
    } else {
        bizTipoError.textContent = "";
    }

    return tipoBusinessValid;
}

function validarTipoOtroBusiness() {
    let tipoOtroBusinessValid = true;
    if (bizTipoSelect.value === "otro" && bizTipoOtroInput.value.trim() === "") {
        bizTipoOtroError.textContent = "Por favor, especifica el tipo de empresa.";
        tipoOtroBusinessValid = false;
    } else if (bizTipoSelect.value === "otro" && bizTipoOtroInput.value.trim().length < 5) {
        bizTipoOtroError.textContent = "El tipo de empresa debe tener al menos 5 caracteres.";
        tipoOtroBusinessValid = false;
    } else {
        bizTipoOtroError.textContent = "";
    }

    return tipoOtroBusinessValid;
}

// Eventos de validación - Owner
ownerNombreInput.addEventListener("input", validarNombreOwner);
ownerNombreUsuarioInput.addEventListener("input", validarUsuarioOwner);
ownerEmailInput.addEventListener("input", validarEmailOwner);
ownerPasswordInput.addEventListener("input", validarPasswordOwner);
ownerFechaInput.addEventListener("input", validarFechaOwner);

ownerForm.addEventListener("submit", function(event) {
    let isNombreValid = validarNombreOwner();
    let isUsuarioValid = validarUsuarioOwner();
    let isEmailValid = validarEmailOwner();
    let isPasswordValid = validarPasswordOwner();
    let isFechaValid = validarFechaOwner();
    if (!isNombreValid || !isUsuarioValid || !isEmailValid || !isPasswordValid || !isFechaValid) {
        event.preventDefault();
        alert("Por favor, corrige los errores en el formulario antes de enviarlo.");
    }
});

// Eventos de validación - Business 
bizNombreInput.addEventListener("input", validarNombreBusiness);
bizEmailInput.addEventListener("input", validarEmailBusiness);
bizCifInput.addEventListener("input", validarCifBusiness);
bizPasswordInput.addEventListener("input", validarPasswordBusiness);
bizTipoSelect.addEventListener("change", validarTipoBusiness);
bizTipoOtroInput.addEventListener("input", validarTipoOtroBusiness);

bizForm.addEventListener("submit", function(event) {
    let isNombreValid = validarNombreBusiness();
    let isEmailValid = validarEmailBusiness();
    let isCifValid = validarCifBusiness();
    let isPasswordValid = validarPasswordBusiness();
    let isTipoValid = validarTipoBusiness();
    let isTipoOtroValid = validarTipoOtroBusiness();
    if (!isNombreValid || !isEmailValid || !isCifValid || !isPasswordValid || !isTipoValid || !isTipoOtroValid) {
        event.preventDefault();
        alert("Por favor, corrige los errores en el formulario antes de enviarlo.");
    }
});
