"use strict"; 

function initValidacionCrearForo() {
    const form = document.getElementById('crearForoForm'); 

    const tituloInput = document.getElementById('crear-titulo');
    const categoriaSelect = document.getElementById('crear-categoria');
    const descripcionTextarea = document.getElementById('crear-descripcion');

    const errorTitulo = document.getElementById('error-titulo');
    const errorCategoria = document.getElementById('error-categoria');
    const errorDescripcion = document.getElementById('error-descripcion');

    function validarTitulo() {
        const value = tituloInput.value.trim();
        if (value.length < 5) {
            errorTitulo.textContent = 'El título debe tener al menos 5 caracteres.';
            return false;
        } else if (value.length > 100) {
            errorTitulo.textContent = 'El título no puede tener más de 100 caracteres.';
            return false;
        } else {
            errorTitulo.textContent = '';
            return true;
        }
    };

    function validarCategoria() {
        if (categoriaSelect.value === '') {
            errorCategoria.textContent = 'Por favor selecciona una categoría.';
            return false;
        } else {
            errorCategoria.textContent = '';
            return true;
        }
    };

    function validarDescripcion() {
        const value = descripcionTextarea.value.trim();
        if (value.length < 10) {
            errorDescripcion.textContent = 'La descripción debe tener al menos 10 caracteres.';
            return false;
        } else if (value.length > 255) {
            errorDescripcion.textContent = 'La descripción no puede tener más de 255 caracteres.';
            return false;
        } else {
            errorDescripcion.textContent = '';
            return true;
        }
    }

    tituloInput.addEventListener('input', validarTitulo);
    categoriaSelect.addEventListener('change', validarCategoria);
    descripcionTextarea.addEventListener('input', validarDescripcion);

    form.addEventListener('submit', function(event) {
        const isTituloValido = validarTitulo();
        const isCategoriaValida = validarCategoria();
        const isDescripcionValida = validarDescripcion();

        if (!isTituloValido || !isCategoriaValida || !isDescripcionValida) {
            event.preventDefault();
            alert('Por favor corrige los errores antes de enviar el formulario.');
        }
    });
}
