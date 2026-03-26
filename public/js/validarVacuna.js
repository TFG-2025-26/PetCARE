"use strict";

document.addEventListener("DOMContentLoaded", function () {
	const form = document.getElementById("vacunaEditForm");
	if (!form) return;

	const nombreVacunaInput = document.getElementById("nombre_vacuna");
	const fechaAdministracionInput = document.getElementById("fecha_administracion");
	const observacionesVacunaInput = document.getElementById("observaciones_vacuna");

	const errorNombreVacuna = document.getElementById("error-nombre_vacuna");
	const errorFechaAdministracion = document.getElementById("error-fecha_administracion");
	const errorObservacionesVacuna = document.getElementById("error-observaciones_vacuna");

	function validarNombreVacuna() {
		const nombreVacuna = nombreVacunaInput.value.trim();

		if (nombreVacuna === "") {
			errorNombreVacuna.textContent = "El nombre de la vacuna es obligatorio.";
			return false;
		}

		if (nombreVacuna.length < 3) {
			errorNombreVacuna.textContent = "El nombre de la vacuna debe tener al menos 3 caracteres.";
			return false;
		}

		if (nombreVacuna.length > 100) {
			errorNombreVacuna.textContent = "El nombre de la vacuna no puede superar los 100 caracteres.";
			return false;
		}

		errorNombreVacuna.textContent = "";
		return true;
	}

	function validarFechaAdministracion() {
		const fecha = fechaAdministracionInput.value;

		if (fecha === "") {
			errorFechaAdministracion.textContent = "La fecha de administración es obligatoria.";
			return false;
		}

		if (isNaN(Date.parse(fecha))) {
			errorFechaAdministracion.textContent = "La fecha de administración no es válida.";
			return false;
		}

		errorFechaAdministracion.textContent = "";
		return true;
	}

	function validarObservacionesVacuna() {
		const observaciones = observacionesVacunaInput.value.trim();

		if (observaciones === "") {
			errorObservacionesVacuna.textContent = "";
			return true;
		}

		if (observaciones.length < 5) {
			errorObservacionesVacuna.textContent = "Las observaciones deben tener al menos 5 caracteres.";
			return false;
		}

		if (observaciones.length > 1000) {
			errorObservacionesVacuna.textContent = "Las observaciones no pueden superar los 1000 caracteres.";
			return false;
		}

		errorObservacionesVacuna.textContent = "";
		return true;
	}

	nombreVacunaInput.addEventListener("input", validarNombreVacuna);
	fechaAdministracionInput.addEventListener("change", validarFechaAdministracion);
	observacionesVacunaInput.addEventListener("input", validarObservacionesVacuna);

	form.addEventListener("submit", function (event) {
		const isNombreVacunaValid = validarNombreVacuna();
		const isFechaAdministracionValid = validarFechaAdministracion();
		const isObservacionesVacunaValid = validarObservacionesVacuna();

		if (!isNombreVacunaValid || !isFechaAdministracionValid || !isObservacionesVacunaValid) {
			event.preventDefault();
		}
	});
});
