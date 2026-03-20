"use strict"; 

document.addEventListener('DOMContentLoaded', function() {

    console.log('JS cargado');
    
    // Seleccion de formulario
    const form = document.getElementById('editarPerfilUsuarioForm'); 

    console.log(form);

    // Selección de campos - obligatorios
    const NombreInput = document.getElementById("nombre"); 
    const NombreUsuarioInput = document.getElementById("usuario"); 
    const EmailInput = document.getElementById("email"); 
    const TelefonoInput = document.getElementById("telefono");
    const FechaInput = document.getElementById("fecha_nacimiento"); 

    // Selección de campos - opcionales
    const CiudadInput = document.getElementById("ciudad"); 
    const PaisInput = document.getElementById("pais"); 
    const CodigoPostalInput = document.getElementById("codigo_postal");
    const TrabajoInput = document.getElementById("trabajo"); 
    const BioInput = document.getElementById("bio");

    // Selección de campos - contraseñas
    const PasswordInput = document.getElementById("password_nueva");
    const ConfirmPasswordInput = document.getElementById("password_confirmar");

    // Selección de Spans de error 
    const ErrorNombre = document.getElementById("error-nombre");
    const ErrorNombreUsuario = document.getElementById("error-usuario");
    const ErrorEmail = document.getElementById("error-email");
    const ErrorTelefono = document.getElementById("error-telefono");
    const ErrorFecha = document.getElementById("error-fecha_nacimiento");
    const ErrorCiudad = document.getElementById("error-ciudad");
    const ErrorPais = document.getElementById("error-pais");
    const ErrorCodigoPostal = document.getElementById("error-codigo_postal");
    const ErrorTrabajo = document.getElementById("error-trabajo");
    const ErrorBio = document.getElementById("error-bio");
    const ErrorPassword = document.getElementById("error-password_nueva");
    const ErrorConfirmPassword = document.getElementById("error-password_confirmar");

    // Funciones de validación - obligatorios
    function validarNombre() {
        let nombreValid = true;

        if (NombreInput.value.trim().length < 3) {
            ErrorNombre.textContent = "El nombre debe tener al menos 3 caracteres.";
            nombreValid = false; 
        } else {
            ErrorNombre.textContent = "";
        }
        return nombreValid;
    }

    function validarUsuario() {
        let usuarioValid = true;
        const regex = /^\S+$/;

        if (NombreUsuarioInput.value.trim().length < 3) {
            ErrorNombreUsuario.textContent = "El nombre de usuario debe tener al menos 3 caracteres.";
            usuarioValid = false;
        } else if (!regex.test(NombreUsuarioInput.value)) {
            ErrorNombreUsuario.textContent = "El nombre de usuario no puede contener espacios en blanco.";
            usuarioValid = false;
        } else {
            ErrorNombreUsuario.textContent = "";
        }

        return usuarioValid;
    }

    function validarEmail() {
        let emailValid = true;
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!regex.test(EmailInput.value.trim())) {
            ErrorEmail.textContent = "Por favor, introduce un email válido.";
            emailValid = false;
        } else {
            ErrorEmail.textContent = "";
        }

        return emailValid;
    }

    function validarTelefono() {
        let telefonoValid = true;
        const regex = /^\d{9,15}$/;

        if (!regex.test(TelefonoInput.value.trim())) {
            ErrorTelefono.textContent = "Por favor, introduce un teléfono válido (9-15 dígitos).";
            telefonoValid = false;
        } else {
            ErrorTelefono.textContent = "";
        }

        return telefonoValid;
    }

    function validarFechaNacimiento() {
        let fechaValid = true;
        const fechaNacimiento = new Date(FechaInput.value);
        const hoy = new Date();

        let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
        const mes = hoy.getMonth() - fechaNacimiento.getMonth();

        if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
            edad--;
        }

        if (isNaN(fechaNacimiento.getTime())) {
            ErrorFecha.textContent = "Por favor, introduce una fecha de nacimiento válida.";
            fechaValid = false;
        } else if (edad < 14) {
            ErrorFecha.textContent = "Debes tener al menos 14 años para registrarte.";
            fechaValid = false;
        } else if (edad > 120) {
            ErrorFecha.textContent = "Por favor, introduce una fecha de nacimiento realista.";
            fechaValid = false;
        } else {
            ErrorFecha.textContent = "";
        }

        return fechaValid;
    }

    // Funciones de validación - opcionales
    function validarCiudad() {
        if (CiudadInput.value.trim() !== "" && CiudadInput.value.trim().length < 2) {
            ErrorCiudad.textContent = "La ciudad debe tener al menos 2 caracteres.";
            return false;
        } else {
            ErrorCiudad.textContent = "";
            return true;
        }
    }

    function validarPais() {
        if (PaisInput.value.trim() !== "" && PaisInput.value.trim().length < 2) {
            ErrorPais.textContent = "El país debe tener al menos 2 caracteres.";
            return false;
        } else {
            ErrorPais.textContent = "";
            return true;
        }
    }

    function validarCodigoPostal() {
        if (CodigoPostalInput.value.trim() !== "" && CodigoPostalInput.value.trim().length < 4) {
            ErrorCodigoPostal.textContent = "El código postal debe tener al menos 4 caracteres.";
            return false;
        } else if (CodigoPostalInput.value.trim() !== "" && CodigoPostalInput.value.trim().length > 10) {
            ErrorCodigoPostal.textContent = "El código postal no puede tener más de 10 caracteres.";
            return false;
        } else {
            ErrorCodigoPostal.textContent = "";
            return true;
        }
    }

    function validarTrabajo() {
        if (TrabajoInput.value.trim() !== "" && (TrabajoInput.value.trim().length < 2 || TrabajoInput.value.trim().length > 64)) {
            ErrorTrabajo.textContent = "El trabajo debe tener entre 2 y 64 caracteres.";
            return false;
        } else {
            ErrorTrabajo.textContent = "";
            return true;
        }
    }

    function validarBio() {
        if (BioInput.value.trim() !== "" && BioInput.value.trim().length < 10) {
            ErrorBio.textContent = "La bio debe tener al menos 10 caracteres.";
            return false;
        } else if (BioInput.value.trim() !== "" && BioInput.value.trim().length > 255) {
            ErrorBio.textContent = "La bio no puede tener más de 255 caracteres.";
            return false;
        } else {
            ErrorBio.textContent = "";
            return true;
        }
    }

    // Función de validación - contraseña
    function validarPassword(input, error) {
        const value = input.value;

        if (value === '') {
            error.textContent = '';
            return true;
        }
        if (value.length < 8) {
            error.textContent = 'La contraseña debe tener al menos 8 caracteres';
            return false;
        }
        if (!/(?=.*[a-z])/.test(value)) {
            error.textContent = 'La contraseña debe contener al menos una letra minúscula';
            return false;
        }
        if (!/(?=.*[A-Z])/.test(value)) {
            error.textContent = 'La contraseña debe contener al menos una letra mayúscula';
            return false;
        }
        if (!/(?=.*\d)/.test(value)) {
            error.textContent = 'La contraseña debe contener al menos un número';
            return false;
        }
        if (/\s/.test(value)) {
            error.textContent = 'La contraseña no puede contener espacios';
            return false;
        }

        error.textContent = '';
        return true;
    }

    function validarPasswordsConjunto() {
        const actual    = PasswordActualInput.value;
        const nueva     = PasswordNuevaInput.value;
        const confirmar = PasswordConfirmarInput.value;

        if (actual || nueva || confirmar) {
            if (!actual) {
                ErrorPasswordActual.textContent = 'Debes introducir tu contraseña actual';
                return false;
            }
            if (!nueva) {
                ErrorPasswordNueva.textContent = 'Debes introducir la nueva contraseña';
                return false;
            }
            if (!confirmar) {
                ErrorPasswordConfirmar.textContent = 'Debes confirmar la nueva contraseña';
                return false;
            }
        }
        return true;
    }

    // Eventos de validación en tiempo real
    NombreInput.addEventListener("input", validarNombre);
    NombreUsuarioInput.addEventListener("input", validarUsuario);
    EmailInput.addEventListener("input", validarEmail);
    TelefonoInput.addEventListener("input", validarTelefono);
    FechaInput.addEventListener("input", validarFechaNacimiento);
    CiudadInput.addEventListener("input", validarCiudad);
    PaisInput.addEventListener("input", validarPais);
    CodigoPostalInput.addEventListener("input", validarCodigoPostal);
    TrabajoInput.addEventListener("input", validarTrabajo);
    BioInput.addEventListener("input", validarBio);
    PasswordInput.addEventListener("input",     () => validarPassword(PasswordInput,     ErrorPassword));
    ConfirmPasswordInput.addEventListener("input", () => validarPassword(ConfirmPasswordInput, ErrorConfirmPassword));

    // Validación final al enviar el formulario
    form.addEventListener("submit", function(event) {
        let isNombreValid          = validarNombre();
        let isUsuarioValid         = validarUsuario();
        let isEmailValid           = validarEmail();
        let isTelefonoValid        = validarTelefono();
        let isFechaValid           = validarFechaNacimiento();
        let isCiudadValid          = validarCiudad();
        let isPaisValid            = validarPais();
        let isCodigoPostalValid    = validarCodigoPostal();
        let isTrabajoValid         = validarTrabajo();
        let isBioValid             = validarBio();
        let isPasswordNuevaValid     = validarPassword(PasswordInput,     ErrorPassword);
        let isPasswordConfirmarValid = validarPassword(ConfirmPasswordInput, ErrorConfirmPassword);
        let isPasswordConjuntoValid  = validarPasswordsConjunto();

        console.log({
            isNombreValid,
            isUsuarioValid,
            isEmailValid,
            isTelefonoValid,
            isFechaValid,
            isCiudadValid,
            isPaisValid,
            isCodigoPostalValid,
            isTrabajoValid,
            isBioValid,
            isPasswordNuevaValid,
            isPasswordConfirmarValid,
            isPasswordConjuntoValid
        });

        if (!isNombreValid || !isUsuarioValid || !isEmailValid || !isTelefonoValid || !isFechaValid || !isCiudadValid || !isPaisValid || !isCodigoPostalValid || !isTrabajoValid || !isBioValid || !isPasswordNuevaValid || !isPasswordConfirmarValid || !isPasswordConjuntoValid) {
            event.preventDefault();
            alert("Por favor, corrige los errores en el formulario antes de enviarlo.");
        }
    });
});