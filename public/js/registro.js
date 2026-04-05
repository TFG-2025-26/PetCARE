"use strict"; 

// Selección de formularios
const usuarioForm = document.getElementById("form-usuario");
const empresaForm = document.getElementById("form-empresa");
const esModoEdicionAdmin = Boolean(window.adminRegistroModoEdicion);

// Selección de elementos - Usuario
const usuarioNombreCompletoInput = document.getElementById("usuario-nombre_completo"); 
const usuarioNombreUsuarioInput = document.getElementById("usuario-nombre_usuario"); 
const usuarioCorreoInput = document.getElementById("usuario-correo"); 
const usuarioTelefonoInput = document.getElementById("usuario-telefono");
const usuarioPasswordInput = document.getElementById("usuario-password"); 
const usuarioFechaNacimientoInput = document.getElementById("usuario-fecha_nacimiento"); 

// Selección de elementos - Empresa 
const empresaNombreInput = document.getElementById("empresa-nombre"); 
const empresaCorreoInput = document.getElementById("empresa-correo"); 
const empresaCifInput = document.getElementById("empresa-cif");
const empresaPasswordInput = document.getElementById("empresa-password"); 
const empresaTelefonoContactoInput = document.getElementById("empresa-telefono_contacto");
const empresaTipoSelect = document.getElementById("empresa-tipo"); 
const empresaTipoOtroInput = document.getElementById("empresa-tipo-otro");

// Selección de Spans - Usuario
const usuarioNombreCompletoError = document.getElementById("error-usuario-nombre_completo");
const usuarioNombreUsuarioError = document.getElementById("error-usuario-nombre_usuario");
const usuarioCorreoError = document.getElementById("error-usuario-correo");
const usuarioTelefonoError = document.getElementById("error-usuario-telefono");
const usuarioPasswordError = document.getElementById("error-usuario-password");
const usuarioFechaNacimientoError = document.getElementById("error-usuario-fecha_nacimiento");

// Selección de Spans - Empresa 
const empresaNombreError = document.getElementById("empresa-nombre-error");
const empresaCorreoError = document.getElementById("empresa-correo-error");
const empresaCifError = document.getElementById("empresa-cif-error");
const empresaPasswordError = document.getElementById("empresa-password-error");
const empresaTelefonoContactoError = document.getElementById("empresa-telefono_contacto-error");
const empresaTipoError = document.getElementById("empresa-tipo-error");
const empresaTipoOtroError = document.getElementById("empresa-tipo-otro-error");

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

    if (esModoEdicionAdmin && usuarioPasswordInput.value.trim() === '') {
        usuarioPasswordError.textContent = "";
        return true;
    }

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
function validarNombreEmpresa() {
    let nombreEmpresaValid = true;
    if (empresaNombreInput.value.trim().length < 3) {
        empresaNombreError.textContent = "El nombre de la empresa debe tener al menos 3 caracteres.";
        nombreEmpresaValid = false;
    } else {
        empresaNombreError.textContent = "";
    }

    return nombreEmpresaValid;
}

function validarCorreoEmpresa() {
    let correoEmpresaValid = true;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!regex.test(empresaCorreoInput.value.trim())) {
        empresaCorreoError.textContent = "Por favor, introduce un email válido.";
        correoEmpresaValid = false;
    } else {
        empresaCorreoError.textContent = "";
    }

    return correoEmpresaValid;
}

function validarCifEmpresa() {
    let cifEmpresaValid = true;
    const regex = /^[A-Za-z0-9]{8,}$/;
    empresaCifInput.value = empresaCifInput.value.toUpperCase();

    if (!regex.test(empresaCifInput.value.trim())) {
        empresaCifError.textContent = "Por favor, introduce un CIF válido.";
        cifEmpresaValid = false;
    } else {
        empresaCifError.textContent = "";
    }

    return cifEmpresaValid;
}

function validarPasswordEmpresa() {
    let passwordEmpresaValid = true;
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

    if (esModoEdicionAdmin && empresaPasswordInput.value.trim() === '') {
        empresaPasswordError.textContent = "";
        return true;
    }

    // que no contenga espacios en blanco
    if (/\s/.test(empresaPasswordInput.value)) {
        empresaPasswordError.textContent = "La contraseña no puede contener espacios en blanco.";
        passwordEmpresaValid = false;
    } else if (!regex.test(empresaPasswordInput.value.trim())) {
        empresaPasswordError.textContent = "La contraseña debe tener al menos 8 caracteres, incluyendo una letra mayúscula, una letra minúscula y un número.";
        passwordEmpresaValid = false;
    } else {
        empresaPasswordError.textContent = "";
    }

    return passwordEmpresaValid;
}

function validarTelefonoContactoEmpresa() {
    let telefonoContactoEmpresaValid = true;
    const regex = /^\d{9,15}$/;

    if (!regex.test(empresaTelefonoContactoInput.value.trim())) {
        empresaTelefonoContactoError.textContent = "Por favor, introduce un teléfono válido (9-15 dígitos).";
        telefonoContactoEmpresaValid = false;
    } else {
        empresaTelefonoContactoError.textContent = "";
    }

    return telefonoContactoEmpresaValid;
}

function validarTipoEmpresa() {
    let tipoEmpresaValid = true;
    if (empresaTipoSelect.value === "") {
        empresaTipoError.textContent = "Por favor, selecciona un tipo de empresa.";
        tipoEmpresaValid = false;
    } else {
        empresaTipoError.textContent = "";
    }

    return tipoEmpresaValid;
}

function validarTipoOtroEmpresa() {
    let tipoOtroEmpresaValid = true;
    if (empresaTipoSelect.value === "otro" && empresaTipoOtroInput.value.trim() === "") {
        empresaTipoOtroError.textContent = "Por favor, especifica el tipo de empresa.";
        tipoOtroEmpresaValid = false;
    } else if (empresaTipoSelect.value === "otro" && empresaTipoOtroInput.value.trim().length < 5) {
        empresaTipoOtroError.textContent = "El tipo de empresa debe tener al menos 5 caracteres.";
        tipoOtroEmpresaValid = false;
    } else {
        empresaTipoOtroError.textContent = "";
    }

    return tipoOtroEmpresaValid;
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
empresaNombreInput.addEventListener("input", validarNombreEmpresa);
empresaCorreoInput.addEventListener("input", validarCorreoEmpresa);
empresaCifInput.addEventListener("input", validarCifEmpresa);
empresaPasswordInput.addEventListener("input", validarPasswordEmpresa);
empresaTipoSelect.addEventListener("change", validarTipoEmpresa);
empresaTipoOtroInput.addEventListener("input", validarTipoOtroEmpresa);
empresaTelefonoContactoInput.addEventListener("input", validarTelefonoContactoEmpresa);

empresaForm.addEventListener("submit", function(event) {
    let isNombreValid = validarNombreEmpresa();
    let isCorreoValid = validarCorreoEmpresa();
    let isCifValid = validarCifEmpresa();
    let isPasswordValid = validarPasswordEmpresa();
    let isTipoValid = validarTipoEmpresa();
    let isTipoOtroValid = validarTipoOtroEmpresa();
    let isTelefonoContactoValid = validarTelefonoContactoEmpresa();    
    if (!isNombreValid || !isCorreoValid || !isCifValid || !isPasswordValid || !isTipoValid || !isTipoOtroValid || !isTelefonoContactoValid) {
        event.preventDefault();
        alert("Por favor, corrige los errores en el formulario antes de enviarlo.");
    }
});
