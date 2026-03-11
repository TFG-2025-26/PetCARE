"use strict"; 

// Selección de formularios
const clientForm = document.getElementById("form-client");
const bizForm = document.getElementById("form-business");

// Selección de elementos - Client
const clientNombreInput = document.getElementById("client-nombre"); 
const clientNombreUsuarioInput = document.getElementById("client-usuario"); 
const clientEmailInput = document.getElementById("client-email"); 
const clientTelefonoInput = document.getElementById("client-telefono");
const clientPasswordInput = document.getElementById("client-password"); 
const clientFechaInput = document.getElementById("client-fecha"); 

// Selección de elementos - Business 
const bizNombreInput = document.getElementById("biz-nombre"); 
const bizEmailInput = document.getElementById("biz-email"); 
const bizCifInput = document.getElementById("biz-cif");
const bizPasswordInput = document.getElementById("biz-password"); 
const bizTipoSelect = document.getElementById("biz-tipo"); 
const bizTipoOtroInput = document.getElementById("biz-tipo-otro");

// Selección de Spans - Client
const clientNombreError = document.getElementById("error-client-nombre");
const clientUsuarioError = document.getElementById("error-client-nombre-usuario");
const clientEmailError = document.getElementById("error-client-email");
const clientTelefonoError = document.getElementById("error-client-telefono");
const clientPasswordError = document.getElementById("error-client-password");
const clientFechaError = document.getElementById("error-client-fecha");

// Selección de Spans - Business 
const bizNombreError = document.getElementById("biz-nombre-error");
const bizEmailError = document.getElementById("biz-email-error");
const bizCifError = document.getElementById("biz-cif-error");
const bizPasswordError = document.getElementById("biz-password-error");
const bizTipoError = document.getElementById("biz-tipo-error");
const bizTipoOtroError = document.getElementById("biz-tipo-otro-error");

// Funciones de validación - Client
function validarNombreClient() {
    let nombreClientValid = true;

    if (clientNombreInput.value.trim().length < 3) {
        clientNombreError.textContent = "El nombre debe tener al menos 3 caracteres.";
        nombreClientValid = false; 
    } else {
        clientNombreError.textContent = "";
    }
    return nombreClientValid;
}

function validarUsuarioClient() {
    let usuarioClientValid = true;
    const regex = /^\S+$/;

    if (clientNombreUsuarioInput.value.trim().length < 3) {
        clientUsuarioError.textContent = "El nombre de usuario debe tener al menos 3 caracteres.";
        usuarioClientValid = false;
    } else if (!regex.test(clientNombreUsuarioInput.value)) {
        clientUsuarioError.textContent = "El nombre de usuario no puede contener espacios en blanco.";
        usuarioClientValid = false;
    } else {
        clientUsuarioError.textContent = "";
    }

    return usuarioClientValid;
}

function validarEmailClient() {
    let emailClientValid = true;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!regex.test(clientEmailInput.value.trim())) {
        clientEmailError.textContent = "Por favor, introduce un email válido.";
        emailClientValid = false;
    } else {
        clientEmailError.textContent = "";
    }

    return emailClientValid;
}

function validarTelefonoClient() {
    let telefonoClientValid = true;
    const regex = /^\d{9,15}$/;

    if (!regex.test(clientTelefonoInput.value.trim())) {
        clientTelefonoError.textContent = "Por favor, introduce un teléfono válido (9-15 dígitos).";
        telefonoClientValid = false;
    } else {
        clientTelefonoError.textContent = "";
    }

    return telefonoClientValid;
}

function validarPasswordClient() {
    let passwordClientValid = true;
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

    if (/\s/.test(clientPasswordInput.value)) {
        clientPasswordError.textContent = "La contraseña no puede contener espacios en blanco.";
        passwordClientValid = false;
    } else if (!regex.test(clientPasswordInput.value.trim())) {
        clientPasswordError.textContent = "La contraseña debe tener al menos 8 caracteres, incluyendo una letra mayúscula, una letra minúscula y un número.";
        passwordClientValid = false;
    } else {
        clientPasswordError.textContent = "";
    }

    return passwordClientValid;
}

function validarFechaClient() {
    let fechaClientValid = true;
    const fechaNacimiento = new Date(clientFechaInput.value);
    const hoy = new Date();

    let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const mes = hoy.getMonth() - fechaNacimiento.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
        edad--;
    }

    if (isNaN(fechaNacimiento.getTime())) {
        clientFechaError.textContent = "Por favor, introduce una fecha de nacimiento válida.";
        fechaClientValid = false;
    } else if (edad < 14) {
        clientFechaError.textContent = "Debes tener al menos 14 años para registrarte.";
        fechaClientValid = false;
    } else if (edad > 120) {
        clientFechaError.textContent = "Por favor, introduce una fecha de nacimiento realista.";
        fechaClientValid = false;
    } else {
        clientFechaError.textContent = "";
    }

    return fechaClientValid;
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

// Eventos de validación - Client
clientNombreInput.addEventListener("input", validarNombreClient);
clientNombreUsuarioInput.addEventListener("input", validarUsuarioClient);
clientEmailInput.addEventListener("input", validarEmailClient);
clientTelefonoInput.addEventListener("input", validarTelefonoClient);
clientPasswordInput.addEventListener("input", validarPasswordClient);
clientFechaInput.addEventListener("input", validarFechaClient);

clientForm.addEventListener("submit", function(event) {
    let isNombreValid = validarNombreClient();
    let isUsuarioValid = validarUsuarioClient();
    let isEmailValid = validarEmailClient();
    let isPasswordValid = validarPasswordClient();
    let isFechaValid = validarFechaClient();
    let isTelefonoValid = validarTelefonoClient();
    if (!isNombreValid || !isUsuarioValid || !isEmailValid || !isPasswordValid || !isFechaValid || !isTelefonoValid) {
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
