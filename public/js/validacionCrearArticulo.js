"use strict";

function esDocumentoCompletoArticulo(html) {
    return /<!doctype\s+html|<html[\s>]/i.test(html || '');
}

function initValidacionCrearArticulo() {
    const form = document.getElementById('crearArticuloForm');
    if (!form) return;

    function enviarFormularioNormal() {
        HTMLFormElement.prototype.submit.call(form);
    }

    const tituloInput = document.getElementById('crear-articulo-titulo');
    const cuerpoTextarea = document.getElementById('crear-articulo-cuerpo');
    const imagenInput = document.getElementById('crear-articulo-imagen');

    const errorTitulo = document.getElementById('error-articulo-titulo');
    const errorCuerpo = document.getElementById('error-articulo-cuerpo');
    const errorImagen = document.getElementById('error-articulo-imagen');

    function validarTitulo() {
        const value = tituloInput.value.trim();
        if (value.length < 5) {
            errorTitulo.textContent = 'El título debe tener al menos 5 caracteres.';
            return false;
        }
        if (value.length > 255) {
            errorTitulo.textContent = 'El título no puede tener más de 255 caracteres.';
            return false;
        }

        errorTitulo.textContent = '';
        return true;
    }

    function validarCuerpo() {
        const value = cuerpoTextarea.value.trim();
        if (value.length < 20) {
            errorCuerpo.textContent = 'El cuerpo debe tener al menos 20 caracteres.';
            return false;
        }
        if (value.length > 10000) {
            errorCuerpo.textContent = 'El cuerpo no puede tener más de 10000 caracteres.';
            return false;
        }

        errorCuerpo.textContent = '';
        return true;
    }

    function validarImagen() {
        const file = imagenInput.files && imagenInput.files[0];
        if (!file) {
            errorImagen.textContent = '';
            return true;
        }

        const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
        if (!tiposPermitidos.includes(file.type)) {
            errorImagen.textContent = 'La imagen debe ser JPG, PNG o WEBP.';
            return false;
        }

        if (file.size > 4 * 1024 * 1024) {
            errorImagen.textContent = 'La imagen no puede superar los 4MB.';
            return false;
        }

        errorImagen.textContent = '';
        return true;
    }

    tituloInput.addEventListener('input', validarTitulo);
    cuerpoTextarea.addEventListener('input', validarCuerpo);
    imagenInput.addEventListener('change', validarImagen);

    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        const isTituloValido = validarTitulo();
        const isCuerpoValido = validarCuerpo();
        const isImagenValida = validarImagen();

        if (!isTituloValido || !isCuerpoValido || !isImagenValida) {
            return;
        }

        const formData = new FormData(form);

        try {
            const response = await fetch(form.action, {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: formData
            });

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const data = await response.json();
                if (data.success) {
                    window.location.href = data.redirectUrl;
                    return;
                }
                enviarFormularioNormal();
                return;
            }

            const html = await response.text();
            if (!response.ok || esDocumentoCompletoArticulo(html)) {
                enviarFormularioNormal();
                return;
            }

            if (document.getElementById('modalArticulo') && document.getElementById('modalArticulo').style.display === 'flex') {
                document.getElementById('modalArticulo-contenido').innerHTML = html;
                initValidacionCrearArticulo();
            } else {
                enviarFormularioNormal();
            }
        } catch (error) {
            enviarFormularioNormal();
        }
    });
}
