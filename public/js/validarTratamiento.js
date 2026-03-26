"use strict";

document.addEventListener("DOMContentLoaded", function () {
	const form = document.getElementById("tratamientoEditForm");
	if (!form) return;

	const medicamentoInput = document.getElementById("medicamento");
	const dosisInput = document.getElementById("dosis");
	const frecuenciaInput = document.getElementById("frecuencia");
	const fechaInicioInput = document.getElementById("fecha_inicio");
	const fechaFinInput = document.getElementById("fecha_fin");
	const observacionesInput = document.getElementById("observaciones_tratamiento");

	const errorMedicamento = document.getElementById("error-medicamento");
	const errorDosis = document.getElementById("error-dosis");
	const errorFrecuencia = document.getElementById("error-frecuencia");
	const errorFechaInicio = document.getElementById("error-fecha_inicio");
	const errorFechaFin = document.getElementById("error-fecha_fin");
	const errorObservaciones = document.getElementById("error-observaciones_tratamiento");

	function validarMedicamento() {
		const medicamento = medicamentoInput.value.trim();

		if (medicamento === "") {
			errorMedicamento.textContent = "El medicamento es obligatorio.";
			return false;
		}

		if (medicamento.length < 3) {
			errorMedicamento.textContent = "El medicamento debe tener al menos 3 caracteres.";
			return false;
		}

		if (medicamento.length > 100) {
			errorMedicamento.textContent = "El medicamento no puede superar los 100 caracteres.";
			return false;
		}

		errorMedicamento.textContent = "";
		return true;
	}

	function validarDosis() {
		const dosis = dosisInput.value.trim();

		if (dosis === "") {
			errorDosis.textContent = "La dosis es obligatoria.";
			return false;
		}

		if (dosis.length > 100) {
			errorDosis.textContent = "La dosis no puede superar los 100 caracteres.";
			return false;
		}

		errorDosis.textContent = "";
		return true;
	}

	function validarFrecuencia() {
		const frecuencia = frecuenciaInput.value.trim();

		if (frecuencia === "") {
			errorFrecuencia.textContent = "La frecuencia es obligatoria.";
			return false;
		}

		if (frecuencia.length > 100) {
			errorFrecuencia.textContent = "La frecuencia no puede superar los 100 caracteres.";
			return false;
		}

		errorFrecuencia.textContent = "";
		return true;
	}

	function validarFechaInicio() {
		const fecha = fechaInicioInput.value;

		if (fecha === "") {
			errorFechaInicio.textContent = "La fecha de inicio es obligatoria.";
			return false;
		}

		if (isNaN(Date.parse(fecha))) {
			errorFechaInicio.textContent = "La fecha de inicio no es válida.";
			return false;
		}

		errorFechaInicio.textContent = "";
		return true;
	}

	function validarFechaFin() {
		const fechaFin = fechaFinInput.value;
		const fechaInicio = fechaInicioInput.value;

		if (fechaFin === "") {
			errorFechaFin.textContent = "La fecha de fin es obligatoria.";
			return false;
		}

		if (isNaN(Date.parse(fechaFin))) {
			errorFechaFin.textContent = "La fecha de fin no es válida.";
			return false;
		}

		if (fechaInicio && !isNaN(Date.parse(fechaInicio)) && new Date(fechaFin) < new Date(fechaInicio)) {
			errorFechaFin.textContent = "La fecha de fin no puede ser anterior a la fecha de inicio.";
			return false;
		}

		errorFechaFin.textContent = "";
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

	medicamentoInput.addEventListener("input", validarMedicamento);
	dosisInput.addEventListener("input", validarDosis);
	frecuenciaInput.addEventListener("input", validarFrecuencia);
	fechaInicioInput.addEventListener("change", validarFechaInicio);
	fechaFinInput.addEventListener("change", validarFechaFin);
	observacionesInput.addEventListener("input", validarObservaciones);

	form.addEventListener("submit", function (event) {
		const isMedicamentoValid = validarMedicamento();
		const isDosisValid = validarDosis();
		const isFrecuenciaValid = validarFrecuencia();
		const isFechaInicioValid = validarFechaInicio();
		const isFechaFinValid = validarFechaFin();
		const isObservacionesValid = validarObservaciones();

		if (!isMedicamentoValid || !isDosisValid || !isFrecuenciaValid || !isFechaInicioValid || !isFechaFinValid || !isObservacionesValid) {
			event.preventDefault();
		}
	});
});
