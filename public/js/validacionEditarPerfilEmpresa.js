"use strict"; 

document.addEventListener('DOMContentLoaded', function() {

    // Selección de formulario
    const form = document.getElementById('editarPerfilEmpresaForm');

    // Selección de campos
    const NombreInput = document.getElementById("nombre_empresa"); 
    const EmailInput = document.getElementById("email");
    const TelefonoInput = document.getElementById("telefono");
    const CIFInput = document.getElementById("cif");
    const UbicacionInput = document.getElementById("ubicacion");
    const DescripcionInput = document.getElementById("descripcion");
    const TipoEmpresaOtroInput = document.getElementById("tipo_empresa_otro");

    // Selección de campos - contraseñas
    const PasswordActualInput = document.getElementById("password_actual");
    const PasswordNuevaInput = document.getElementById("password_nueva");
    const PasswordConfirmarInput = document.getElementById("password_confirmar");

    // Selección de campos - errores
    const ErrorNombre = document.getElementById("error-nombre_empresa");
    const ErrorEmail = document.getElementById("error-email");
    const ErrorTelefono = document.getElementById("error-telefono");
    const ErrorCIF = document.getElementById("error-cif");
    const ErrorUbicacion = document.getElementById("error-ubicacion");
    const ErrorDescripcion = document.getElementById("error-descripcion");
    const ErrorTipoEmpresaOtro = document.getElementById("error-tipo_empresa_otro");
    const ErrorPasswordActual = document.getElementById("error-password_actual");
    const ErrorPasswordNueva = document.getElementById("error-password_nueva");
    const ErrorPasswordConfirmar = document.getElementById("error-password_confirmar");

    // Funciones de validación
    function validarNombre() {
        const nombre = NombreInput.value.trim();
        if (nombre === '') {
            ErrorNombre.textContent = 'El nombre de la empresa es obligatorio.';
            return false;
        } else if (nombre.length < 3) {
            ErrorNombre.textContent = 'El nombre de la empresa debe tener al menos 3 caracteres.';
            return false;
        } else {
            ErrorNombre.textContent = '';
            return true;
        }
    }

    function validarEmail() {
        const email = EmailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            ErrorEmail.textContent = 'El correo electrónico no es válido.';
            return false;
        } else {
            ErrorEmail.textContent = '';
            return true;
        }
    }

    function validarTelefono() {
        const telefono = TelefonoInput.value.trim();
        const telefonoRegex = /^\d{9,15}$/;
        if (telefono && !telefonoRegex.test(telefono)) {
            ErrorTelefono.textContent = 'El teléfono no es válido.';
            return false;
        } else {
            ErrorTelefono.textContent = '';
            return true;
        }
    }

    function validarCIF() {
        const cif = CIFInput.value.trim();
        const cifRegex = /^[A-Za-z0-9]{8,}$/;
        if (!cifRegex.test(cif)) {
            ErrorCIF.textContent = 'El CIF no es válido.';
            return false;
        } else {
            ErrorCIF.textContent = '';
            return true;
        }
    }

    function validarUbicacion() {
        const ubicacion = UbicacionInput.value.trim();
        if (ubicacion.trim() !== "" && ubicacion.length < 5) {
            ErrorUbicacion.textContent = 'La ubicación debe tener al menos 5 caracteres.';
            return false;
        } else {
            ErrorUbicacion.textContent = '';
            return true;
        }
    }

    function validarDescripcion() {
        const descripcion = DescripcionInput.value.trim();
        if (descripcion.trim() !== "" && (descripcion.length < 10 || descripcion.length > 255)) {
            ErrorDescripcion.textContent = 'La descripción debe tener entre 10 y 255 caracteres.';
            return false;
        } else {
            ErrorDescripcion.textContent = '';
            return true;
        }
    }

    function validarTipoEmpresaOtro() {
        const tipoEmpresaOtro = TipoEmpresaOtroInput.value.trim();
        if (document.getElementById("tipo_empresa").value === "otro" && tipoEmpresaOtro === '') {
            ErrorTipoEmpresaOtro.textContent = 'Por favor, describe tu tipo de empresa.';
            return false;
        } else if (document.getElementById("tipo_empresa").value === "otro" && tipoEmpresaOtro.length < 5) {
            ErrorTipoEmpresaOtro.textContent = 'El tipo de empresa debe tener al menos 5 caracteres.';
            return false;
        } else {
            ErrorTipoEmpresaOtro.textContent = '';
            return true;
        }
    }

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

    // Validación en tiempo real
    NombreInput.addEventListener('input', validarNombre);
    EmailInput.addEventListener('input', validarEmail);
    TelefonoInput.addEventListener('input', validarTelefono);
    CIFInput.addEventListener('input', validarCIF);
    UbicacionInput.addEventListener('input', validarUbicacion);
    DescripcionInput.addEventListener('input', validarDescripcion);
    document.getElementById("tipo_empresa").addEventListener('change', validarTipoEmpresaOtro);
    TipoEmpresaOtroInput.addEventListener('input', validarTipoEmpresaOtro);
    PasswordActualInput.addEventListener('input', () => {
        validarPassword(PasswordActualInput, ErrorPasswordActual); 
    }); 
    PasswordNuevaInput.addEventListener('input', () => {
        validarPassword(PasswordNuevaInput, ErrorPasswordNueva); 
    });
    PasswordConfirmarInput.addEventListener('input', () => {
        validarPassword(PasswordConfirmarInput, ErrorPasswordConfirmar);
    });

    // Validación final al enviar el formulario
    form.addEventListener('submit', function(event) {
        const isValid = validarNombre() && validarEmail() && validarTelefono() && validarCIF() &&
                        validarUbicacion() && validarDescripcion() && validarTipoEmpresaOtro() &&
                        validarPassword(PasswordActualInput, ErrorPasswordActual) &&
                        validarPassword(PasswordNuevaInput, ErrorPasswordNueva) &&
                        validarPassword(PasswordConfirmarInput, ErrorPasswordConfirmar) &&
                        validarPasswordsConjunto();
        if (!isValid) {
            event.preventDefault();
            alert("Por favor, corrige los errores en el formulario antes de enviarlo.");
        }
    }); 
}); 