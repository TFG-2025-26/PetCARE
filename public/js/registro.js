"use strict"; 

// Selección de formularios
const usuarioForm = document.getElementById("form-usuario");
const empresaForm = document.getElementById("form-business");

// Selección de elementos - Usuario
const usuarioNombreCompletoInput = document.getElementById("usuario-nombre_completo"); 
const usuarioNombreUsuarioInput = document.getElementById("usuario-nombre_usuario"); 
const usuarioCorreoInput = document.getElementById("usuario-correo"); 
const usuarioTelefonoInput = document.getElementById("usuario-telefono");
const usuarioPasswordInput = document.getElementById("usuario-password"); 
const usuarioFechaNacimientoInput = document.getElementById("usuario-fecha_nacimiento"); 

// Selección de elementos - Empresa 
const bizNombreInput = document.getElementById("biz-nombre"); 
const bizEmailInput = document.getElementById("biz-email"); 
const bizCifInput = document.getElementById("biz-cif");
const bizPasswordInput = document.getElementById("biz-password"); 
const bizTelefonoInput = document.getElementById("biz-telefono");
const bizTipoSelect = document.getElementById("biz-tipo"); 
const bizTipoOtroInput = document.getElementById("biz-tipo-otro");

// Selección de Spans - Usuario
const usuarioNombreCompletoError = document.getElementById("error-usuario-nombre_completo");
const usuarioNombreUsuarioError = document.getElementById("error-usuario-nombre_usuario");
const usuarioCorreoError = document.getElementById("error-usuario-correo");
const usuarioTelefonoError = document.getElementById("error-usuario-telefono");
const usuarioPasswordError = document.getElementById("error-usuario-password");
const usuarioFechaNacimientoError = document.getElementById("error-usuario-fecha_nacimiento");

// Selección de Spans - Empresa 
const bizNombreError = document.getElementById("biz-nombre-error");
const bizEmailError = document.getElementById("biz-email-error");
const bizCifError = document.getElementById("biz-cif-error");
const bizPasswordError = document.getElementById("biz-password-error");
const bizTelefonoError = document.getElementById("biz-telefono-error");
const bizTipoError = document.getElementById("biz-tipo-error");
const bizTipoOtroError = document.getElementById("biz-tipo-otro-error");

// Funciones de validación - Usuario
function validarNombreCompleto() {
    let nombreUsuarioValid = true;

    if (usuarioNombreCompletoInput.value.trim().length < 3) {
        usuarioNombreCompletoError.textContent = "El nombre debe tener al menos 3 caracteres.";
        nombreUsuarioValid = false; 
    } else {
        usuarioNombreCompletoError.textContent = "";
    }
    return nombreUsuarioValid;
}

function validarNombreUsuario() {
    let nombreUsuarioInputValid = true;
    const regex = /^\S+$/;

    if (usuarioNombreUsuarioInput.value.trim().length < 3) {
        usuarioNombreUsuarioError.textContent = "El nombre de usuario debe tener al menos 3 caracteres.";
        nombreUsuarioInputValid = false;
    } else if (!regex.test(usuarioNombreUsuarioInput.value)) {
        usuarioNombreUsuarioError.textContent = "El nombre de usuario no puede contener espacios en blanco.";
        nombreUsuarioInputValid = false;
    } else {
        usuarioNombreUsuarioError.textContent = "";
    }

    return nombreUsuarioInputValid ;
}

function validarCorreoUsuario() {
    let emailUsuarioValid = true;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!regex.test(usuarioCorreoInput.value.trim())) {
        usuarioCorreoError.textContent = "Por favor, introduce un email válido.";
        emailUsuarioValid = false;
    } else {
        usuarioCorreoError.textContent = "";
    }

    return emailUsuarioValid;
}

function validarTelefonoUsuario() {
    let telefonoUsuarioValid = true;
    const regex = /^\d{9,15}$/;

    if (!regex.test(usuarioTelefonoInput.value.trim())) {
        usuarioTelefonoError.textContent = "Por favor, introduce un teléfono válido (9-15 dígitos).";
        telefonoUsuarioValid = false;
    } else {
        usuarioTelefonoError.textContent = "";
    }

    return telefonoUsuarioValid;
}

function validarPasswordUsuario() {
    let passwordUsuarioValid = true;
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

    if (/\s/.test(usuarioPasswordInput.value)) {
        usuarioPasswordError.textContent = "La contraseña no puede contener espacios en blanco.";
        passwordUsuarioValid = false;
    } else if (!regex.test(usuarioPasswordInput.value.trim())) {
        usuarioPasswordError.textContent = "La contraseña debe tener al menos 8 caracteres, incluyendo una letra mayúscula, una letra minúscula y un número.";
        passwordUsuarioValid = false;
    } else {
        usuarioPasswordError.textContent = "";
    }

    return passwordUsuarioValid;
}

function validarFechaNacimientoUsuario() {
    let fechaUsuarioValid = true;
    const fechaNacimiento = new Date(usuarioFechaNacimientoInput.value);
    const hoy = new Date();

    let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const mes = hoy.getMonth() - fechaNacimiento.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
        edad--;
    }

    if (isNaN(fechaNacimiento.getTime())) {
        usuarioFechaNacimientoError.textContent = "Por favor, introduce una fecha de nacimiento válida.";
        fechaUsuarioValid = false;
    } else if (edad < 14) {
        usuarioFechaNacimientoError.textContent = "Debes tener al menos 14 años para registrarte.";
        fechaUsuarioValid = false;
    } else if (edad > 120) {
        usuarioFechaNacimientoError.textContent = "Por favor, introduce una fecha de nacimiento realista.";
        fechaUsuarioValid = false;
    } else {
        usuarioFechaNacimientoError.textContent = "";
    }

    return fechaUsuarioValid;
}

// Funciones de validación - Empresa 
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

function validarTelefonoBusiness() {
    let telefonoBusinessValid = true;
    const regex = /^\d{9,15}$/;

    if (!regex.test(bizTelefonoInput.value.trim())) {
        bizTelefonoError.textContent = "Por favor, introduce un teléfono válido (9-15 dígitos).";
        telefonoBusinessValid = false;
    } else {
        bizTelefonoError.textContent = "";
    }

    return telefonoBusinessValid;
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

// Eventos de validación - Usuario
usuarioNombreCompletoInput.addEventListener("input", validarNombreCompleto);
usuarioNombreUsuarioInput.addEventListener("input", validarNombreUsuario);
usuarioCorreoInput.addEventListener("input", validarCorreoUsuario);
usuarioTelefonoInput.addEventListener("input", validarTelefonoUsuario);
usuarioPasswordInput.addEventListener("input", validarPasswordUsuario);
usuarioFechaNacimientoInput.addEventListener("input", validarFechaNacimientoUsuario);

usuarioForm.addEventListener("submit", function(event) {
    let isNombreValid = validarNombreCompleto();
    let isUsuarioValid = validarNombreUsuario();
    let isEmailValid = validarCorreoUsuario();
    let isPasswordValid = validarPasswordUsuario();
    let isFechaValid = validarFechaNacimientoUsuario();
    let isTelefonoValid = validarTelefonoUsuario();
    if (!isNombreValid || !isUsuarioValid || !isEmailValid || !isPasswordValid || !isFechaValid || !isTelefonoValid) {
        event.preventDefault();
        alert("Por favor, corrige los errores en el formulario antes de enviarlo.");
    }
});

// Eventos de validación - Empresa
bizNombreInput.addEventListener("input", validarNombreBusiness);
bizEmailInput.addEventListener("input", validarEmailBusiness);
bizCifInput.addEventListener("input", validarCifBusiness);
bizPasswordInput.addEventListener("input", validarPasswordBusiness);
bizTipoSelect.addEventListener("change", validarTipoBusiness);
bizTipoOtroInput.addEventListener("input", validarTipoOtroBusiness);
bizTelefonoInput.addEventListener("input", validarTelefonoBusiness);

empresaForm.addEventListener("submit", function(event) {
    let isNombreValid = validarNombreBusiness();
    let isEmailValid = validarEmailBusiness();
    let isCifValid = validarCifBusiness();
    let isPasswordValid = validarPasswordBusiness();
    let isTipoValid = validarTipoBusiness();
    let isTipoOtroValid = validarTipoOtroBusiness();
    let isTelefonoValid = validarTelefonoBusiness();    
    if (!isNombreValid || !isEmailValid || !isCifValid || !isPasswordValid || !isTipoValid || !isTipoOtroValid || !isTelefonoValid) {
        event.preventDefault();
        alert("Por favor, corrige los errores en el formulario antes de enviarlo.");
    }
});
