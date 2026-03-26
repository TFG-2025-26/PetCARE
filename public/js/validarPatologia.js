"use strict";

document.addEventListener("DOMContentLoaded", function () {
	const form = document.getElementById("patologiaEditForm");
	if (!form) return;

	const nombreInput = document.getElementById("nombre");
	const tipoInput = document.getElementById("tipo");
	const estadoInput = document.getElementById("estado");
	const fechaDiagnosticoInput = document.getElementById("fecha_diagnostico");
	const descripcionInput = document.getElementById("descripcion");

	const errorNombre = document.getElementById("error-nombre");
	const errorTipo = document.getElementById("error-tipo");
	const errorEstado = document.getElementById("error-estado");
	const errorFechaDiagnostico = document.getElementById("error-fecha_diagnostico");
	const errorDescripcion = document.getElementById("error-descripcion");

	const TIPOS_VALIDOS = ["enfermedad", "alergia", "condicion"];
	const ESTADOS_VALIDOS = ["activa", "superada"];

	function validarNombre() {
		const nombre = nombreInput.value.trim();

		if (nombre === "") {
			errorNombre.textContent = "El nombre de la patología es obligatorio.";
			return false;
		}

		if (nombre.length < 3) {
			errorNombre.textContent = "El nombre debe tener al menos 3 caracteres.";
			return false;
		}

		if (nombre.length > 100) {
			errorNombre.textContent = "El nombre no puede superar los 100 caracteres.";
			return false;
		}

		errorNombre.textContent = "";
		return true;
	}

	function validarTipo() {
		const tipo = tipoInput.value;

		if (!TIPOS_VALIDOS.includes(tipo)) {
			errorTipo.textContent = "El tipo seleccionado no es válido.";
			return false;
		}

		errorTipo.textContent = "";
		return true;
	}

	function validarEstado() {
		const estado = estadoInput.value;

		if (!ESTADOS_VALIDOS.includes(estado)) {
			errorEstado.textContent = "El estado seleccionado no es válido.";
			return false;
		}

		errorEstado.textContent = "";
		return true;
	}

	function validarFechaDiagnostico() {
		const fecha = fechaDiagnosticoInput.value;

		if (fecha === "") {
			errorFechaDiagnostico.textContent = "La fecha de diagnóstico es obligatoria.";
			return false;
		}

		if (isNaN(Date.parse(fecha))) {
			errorFechaDiagnostico.textContent = "La fecha de diagnóstico no es válida.";
			return false;
		}

		errorFechaDiagnostico.textContent = "";
		return true;
	}

	function validarDescripcion() {
		const descripcion = descripcionInput.value.trim();

		if (descripcion === "") {
			errorDescripcion.textContent = "";
			return true;
		}

		if (descripcion.length < 5) {
			errorDescripcion.textContent = "La descripción debe tener al menos 5 caracteres.";
			return false;
		}

		if (descripcion.length > 1000) {
			errorDescripcion.textContent = "La descripción no puede superar los 1000 caracteres.";
			return false;
		}

		errorDescripcion.textContent = "";
		return true;
	}

	nombreInput.addEventListener("input", validarNombre);
	tipoInput.addEventListener("change", validarTipo);
	estadoInput.addEventListener("change", validarEstado);
	fechaDiagnosticoInput.addEventListener("change", validarFechaDiagnostico);
	descripcionInput.addEventListener("input", validarDescripcion);

	form.addEventListener("submit", function (event) {
		const isNombreValid = validarNombre();
		const isTipoValid = validarTipo();
		const isEstadoValid = validarEstado();
		const isFechaDiagnosticoValid = validarFechaDiagnostico();
		const isDescripcionValid = validarDescripcion();

		if (!isNombreValid || !isTipoValid || !isEstadoValid || !isFechaDiagnosticoValid || !isDescripcionValid) {
			event.preventDefault();
		}
	});
});
