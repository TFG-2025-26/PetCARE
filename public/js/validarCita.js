"use strict";

document.addEventListener("DOMContentLoaded", function () {
	const form = document.getElementById("citaEditForm");
	if (!form) return;

	const clinicaInput = document.getElementById("clinica");
	const fechaInput = document.getElementById("fecha");
	const observacionesInput = document.getElementById("observaciones");
	const diagnosticoInput = document.getElementById("diagnostico");

	const errorClinica = document.getElementById("error-clinica");
	const errorFecha = document.getElementById("error-fecha");
	const errorObservaciones = document.getElementById("error-observaciones");
	const errorDiagnostico = document.getElementById("error-diagnostico");

	function validarClinica() {
		const clinica = clinicaInput.value.trim();

		if (clinica === "") {
			errorClinica.textContent = "La clínica veterinaria es obligatoria.";
			return false;
		}

		if (clinica.length < 3) {
			errorClinica.textContent = "La clínica debe tener al menos 3 caracteres.";
			return false;
		}

		if (clinica.length > 100) {
			errorClinica.textContent = "La clínica no puede superar los 100 caracteres.";
			return false;
		}

		errorClinica.textContent = "";
		return true;
	}

	function validarFecha() {
		const fecha = fechaInput.value;

		if (fecha === "") {
			errorFecha.textContent = "La fecha de la cita es obligatoria.";
			return false;
		}

		if (isNaN(Date.parse(fecha))) {
			errorFecha.textContent = "La fecha de la cita no es válida.";
			return false;
		}

		errorFecha.textContent = "";
		return true;
	}

	function validarObservaciones() {
		const observaciones = observacionesInput.value.trim();

		if (observaciones === "") {
			errorObservaciones.textContent = "";
			return true;
		}

		if (observaciones.length < 5) {
			errorObservaciones.textContent = "Las observaciones deben tener al menos 5 caracteres.";
			return false;
		}

		if (observaciones.length > 1000) {
			errorObservaciones.textContent = "Las observaciones no pueden superar los 1000 caracteres.";
			return false;
		}

		errorObservaciones.textContent = "";
		return true;
	}

	function validarDiagnostico() {
		const diagnostico = diagnosticoInput.value.trim();

		if (diagnostico === "") {
			errorDiagnostico.textContent = "";
			return true;
		}

		if (diagnostico.length < 3) {
			errorDiagnostico.textContent = "El diagnóstico debe tener al menos 3 caracteres.";
			return false;
		}

		if (diagnostico.length > 1000) {
			errorDiagnostico.textContent = "El diagnóstico no puede superar los 1000 caracteres.";
			return false;
		}

		errorDiagnostico.textContent = "";
		return true;
	}

	clinicaInput.addEventListener("input", validarClinica);
	fechaInput.addEventListener("change", validarFecha);
	observacionesInput.addEventListener("input", validarObservaciones);
	diagnosticoInput.addEventListener("input", validarDiagnostico);

	form.addEventListener("submit", function (event) {
		const isClinicaValid = validarClinica();
		const isFechaValid = validarFecha();
		const isObservacionesValid = validarObservaciones();
		const isDiagnosticoValid = validarDiagnostico();

		if (!isClinicaValid || !isFechaValid || !isObservacionesValid || !isDiagnosticoValid) {
			event.preventDefault();
		}
	});
});