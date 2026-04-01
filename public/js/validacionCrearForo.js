"use strict"; 

function esDocumentoCompleto(html) {
    return /<!doctype\s+html|<html[\s>]/i.test(html || '');
}

function initValidacionCrearForo() {
    const form = document.getElementById('crearForoForm'); 
    if (!form) return;

    function enviarFormularioNormal() {
        HTMLFormElement.prototype.submit.call(form);
    }

    const tituloInput = document.getElementById('crear-titulo');
    const categoriaSelect = document.getElementById('crear-categoria');
    const descripcionTextarea = document.getElementById('crear-descripcion');

    const errorTitulo = document.getElementById('error-titulo');
    const errorCategoria = document.getElementById('error-categoria');
    const errorDescripcion = document.getElementById('error-descripcion');

    function validarTitulo() {
        const value = tituloInput.value.trim();
        // Si el campo no es editable (edición), no validar longitud
        if (tituloInput.hasAttribute('readonly') || tituloInput.hasAttribute('disabled')) {
            errorTitulo.textContent = '';
            return true;
        }
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
            errorCategoria.textContent = 'Por favor selecciona una categoria.';
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

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        const isTituloValido = validarTitulo();
        const isCategoriaValida = validarCategoria();
        const isDescripcionValida = validarDescripcion();

        if (!isTituloValido || !isCategoriaValida || !isDescripcionValida) {
            return;
        }

        // Enviamos como urlencoded para que express.urlencoded procese req.body.
        const formData = new FormData(form);
        const body = new URLSearchParams(formData);
        try {
            const response = await fetch(form.action, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body
            });

            // Intentar parsear como JSON (éxito)
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const data = await response.json();
                if (data.success) {
                    window.location.href = data.redirectUrl;
                    return;
                }
                // Salir del modo AJAX: delegar navegación completa al servidor.
                enviarFormularioNormal();
                return;
            }

            // Si no es JSON, es HTML (errores de validación)
            const html = await response.text();

            // Nunca inyectar respuestas de error ni documentos HTML completos dentro del modal.
            if (!response.ok || esDocumentoCompleto(html)) {
                enviarFormularioNormal();
                return;
            }

            // Si hay modal abierto, inyectar respuesta en él
            if (document.getElementById('modalEditarForo') && document.getElementById('modalEditarForo').style.display === 'flex') {
                document.getElementById('modalEditarForo-contenido').innerHTML = html;
                initValidacionCrearForo(); 
            } else if (document.getElementById('modalForo') && document.getElementById('modalForo').style.display === 'flex') {
                document.getElementById('modalForo-contenido').innerHTML = html;
                initValidacionCrearForo(); 
            } else {
                // Si no hay modal, redirigir (fallback)
                enviarFormularioNormal();
            }
        } catch (error) {
            enviarFormularioNormal();
        }
    });
}
