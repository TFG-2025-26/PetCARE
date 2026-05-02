"use strict"; 

// Función para validar el formulario de reporte
document.addEventListener('DOMContentLoaded', function() {
	console.log("DOM completamente cargado y analizado");

	document.addEventListener('submit', function(event) {
		if (event.target.id === 'reportarForm') {

			// Se buscan aquí, cuando el modal ya existe en el DOM
			const form = event.target;
			const selectMotivo = form.querySelector('#reportar-motivo');
			const textareaDescripcion = form.querySelector('#reportar-descripcion');
			const errorMotivo = form.querySelector('#error-motivo');
			const errorDescripcion = form.querySelector('#error-descripcion');

			function validarMotivo() {
				const motivoSeleccionado = selectMotivo.value;
				if (motivoSeleccionado === null || motivoSeleccionado === '') {
					errorMotivo.textContent = 'Debes seleccionar un motivo válido';
					return false;
				} else {
					errorMotivo.textContent = '';
					return true;
				}
			}

			function validarDescripcion() {
				const descripcion = textareaDescripcion.value.trim();
				if (descripcion === '') {
					errorDescripcion.textContent = 'La descripción es obligatoria';
					return false;
				}
				if (descripcion.length > 255) {
					errorDescripcion.textContent = 'La descripción no puede superar 255 caracteres';
					return false;
				}
				errorDescripcion.textContent = '';
				return true;
			}

			const motivoValido = validarMotivo();
			const descripcionValida = validarDescripcion();

			if (!motivoValido || !descripcionValida) {
				event.preventDefault();
			}

			// Si todo es válido, el submit continúa... pero ya lo hemos prevenido.
			// Si quieres enviarlo manualmente:
			// form.submit();
		}
	});
});

