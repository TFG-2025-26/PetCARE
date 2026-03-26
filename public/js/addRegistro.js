"use strict";

document.addEventListener("DOMContentLoaded", function () {
    const seleccionRegistro = document.getElementById("seleccionRegistro");
    const registroButtons = document.querySelectorAll(".registro-button");
    const volverButtons = document.querySelectorAll(".btn-volver-atras");
    const formContainers = document.querySelectorAll(".form-container");

    // Manejar click en botones de selección
    registroButtons.forEach(button => {
        button.addEventListener("click", function (e) {
            e.preventDefault();
            const tipo = this.dataset.tipo;
            mostrarFormulario(tipo);
        });
    });

    // Manejar click en botones volver atrás
    volverButtons.forEach(button => {
        button.addEventListener("click", function (e) {
            e.preventDefault();
            volverASeleccion();
        });
    });

    function mostrarFormulario(tipo) {
        // Ocultar selección
        seleccionRegistro.style.display = "none";
        
        // Ocultar todos los formularios
        formContainers.forEach(form => {
            form.style.display = "none";
        });

        // Mostrar el formulario correspondiente
        const formulario = document.getElementById(`form${tipo.charAt(0).toUpperCase()}${tipo.slice(1)}`);
        if (formulario) {
            formulario.style.display = "block";
        }
    }

    function volverASeleccion() {
        // Ocultar todos los formularios
        formContainers.forEach(form => {
            form.style.display = "none";
        });

        // Mostrar selección
        seleccionRegistro.style.display = "block";
    }
});
